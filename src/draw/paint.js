import { ref, get } from 'firebase/database';
import { db } from '../firebase.js';

// The drawing engine shared by the live board, the playback reels and GIF export.
// Everything is painted onto a fixed-size "paper" (PAPER_W × PAPER_H) so a bucket fill floods
// exactly the same pixels on every device.

export const PAPER_W = 1200;
export const PAPER_H = 900;
const STEPS = 1295;
const FILL_TOLERANCE = 60;

// Points are stored as fractions of the board, each coordinate packed into 2 base-36 characters
// (0 to 1295), so a point costs 4 bytes.
const pack = v => Math.round(Math.min(1, Math.max(0, v)) * STEPS).toString(36).padStart(2, '0');
export const encode = points => points.map(([x, y]) => pack(x) + pack(y)).join('');
export function decode(text = '') {
  const points = [];
  for (let i = 0; i + 3 < text.length; i += 4) {
    points.push([parseInt(text.slice(i, i + 2), 36) / STEPS, parseInt(text.slice(i + 2, i + 4), 36) / STEPS]);
  }
  return points;
}
export const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
export const rgbToHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

export function makeCanvas(width = PAPER_W, height = PAPER_H) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// Lines, boxes and circles, from the first point to the last. Also used for the drag preview.
export function paintShape(ctx, op, scaleX = PAPER_W, scaleY = PAPER_H) {
  const [a, b] = [op.points[0], op.points.at(-1)];
  const [x1, y1, x2, y2] = [a[0] * scaleX, a[1] * scaleY, b[0] * scaleX, b[1] * scaleY];
  ctx.strokeStyle = op.c;
  ctx.fillStyle = op.c;
  ctx.lineWidth = Math.max(1, op.w * scaleX);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (op.t === 'l') { ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); return; }
  if (op.t === 'r' || op.t === 'R') ctx.rect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  else ctx.ellipse((x1 + x2) / 2, (y1 + y2) / 2, Math.abs(x2 - x1) / 2, Math.abs(y2 - y1) / 2, 0, 0, Math.PI * 2);
  if (op.t === 'R' || op.t === 'E') ctx.fill();
  else ctx.stroke();
}

const WHITE = '#ffffff';

// `transparent`: an "ink" page with nothing behind it, so whatever's underneath on screen shows
// through the gaps. White (the eraser) rubs the ink away instead of painting white, and bucket fills
// work out their area from `maskFrom` (the normal white page with the same drawing on it).
export class Painter {
  constructor(canvas, { transparent = false, maskFrom = null } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { willReadFrequently: true });
    this.transparent = transparent;
    this.maskFrom = maskFrom;
    this.layers = new Map(); // see-through pen lines still being drawn: opId → { canvas, ctx, op }
    this.progress = new Map(); // opId → how many of its points have been drawn
  }

  // A blank page, optionally starting from another picture (e.g. earlier players' drawings).
  wipe(base) {
    if (this.transparent) this.ctx.clearRect(0, 0, PAPER_W, PAPER_H);
    else {
      this.ctx.fillStyle = WHITE;
      this.ctx.fillRect(0, 0, PAPER_W, PAPER_H);
    }
    if (base) this.ctx.drawImage(base, 0, 0);
    this.layers.clear();
    this.progress.clear();
  }

  // On an ink page, white rubs out rather than painting.
  erases(op) {
    return this.transparent && op.c === WHITE;
  }

  // Draws whatever's new in an op. Pens grow a bit at a time; everything else is drawn in one go.
  // A see-through pen line is drawn solid on a layer of its own and laid onto the paper at its
  // opacity, so the places where the line crosses itself don't come out darker.
  // Returns true if anything was drawn.
  paint(op) {
    const from = this.progress.get(op.id) || 0;
    if (op.hidden || !op.points.length || from >= op.points.length) return false;
    const alpha = op.o ?? 1;
    this.commitLayers(op.id); // keep things in order: earlier see-through lines go down first
    if (this.erases(op) && op.t !== 'f') this.ctx.globalCompositeOperation = 'destination-out';
    if (op.t === 'p') this.paintPen(op, from, alpha < 1 ? this.layerFor(op).ctx : this.ctx);
    else if (op.t === 'f') this.floodFill(op.points[0], op.c, alpha);
    else if (op.points.length >= 2) {
      this.ctx.globalAlpha = alpha;
      paintShape(this.ctx, op);
      this.ctx.globalAlpha = 1;
    }
    this.ctx.globalCompositeOperation = 'source-over';
    if (op.t !== 'p' && op.t !== 'f' && op.points.length < 2) return false;
    this.progress.set(op.id, op.points.length);
    return true;
  }

  layerFor(op) {
    let layer = this.layers.get(op.id);
    if (!layer) {
      const canvas = makeCanvas();
      layer = { canvas, ctx: canvas.getContext('2d'), op };
      this.layers.set(op.id, layer);
    }
    return layer;
  }

  // Lays the see-through lines (except `keep`) onto the paper for good.
  commitLayers(keep) {
    this.layers.forEach((layer, id) => {
      if (id === keep) return;
      this.ctx.globalAlpha = layer.op.o ?? 1;
      if (this.erases(layer.op)) this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.drawImage(layer.canvas, 0, 0);
      this.ctx.globalAlpha = 1;
      this.ctx.globalCompositeOperation = 'source-over';
      this.layers.delete(id);
    });
  }

  // Smooth pen lines: a curve from the middle of each segment to the middle of the next.
  paintPen(op, from, ctx = this.ctx) {
    ctx.strokeStyle = op.c;
    ctx.fillStyle = op.c;
    ctx.lineWidth = Math.max(1, op.w * PAPER_W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const px = ([x, y]) => [x * PAPER_W, y * PAPER_H];
    if (from === 0) {
      const [x, y] = px(op.points[0]);
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (op.points.length < 2) return;
    ctx.beginPath();
    for (let i = Math.max(1, from); i < op.points.length; i++) {
      const [ax, ay] = px(op.points[i - 1]);
      const [bx, by] = px(op.points[i]);
      let sx = ax, sy = ay;
      if (i > 1) { const [zx, zy] = px(op.points[i - 2]); sx = (zx + ax) / 2; sy = (zy + ay) / 2; }
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.stroke();
  }

  // Bucket fill: floods the area of similar colour around the point, then grows it by one pixel
  // so there's no pale fringe left along soft line edges.
  floodFill([fx, fy], hex, alpha = 1) {
    const W = PAPER_W, H = PAPER_H;
    const sx = Math.min(W - 1, Math.max(0, Math.round(fx * W)));
    const sy = Math.min(H - 1, Math.max(0, Math.round(fy * H)));
    // The area is worked out on a white page (this one, or the one we're shadowing).
    const source = (this.maskFrom || this).ctx.getImageData(0, 0, W, H);
    const d = source.data;
    const start = (sy * W + sx) * 4;
    const [tr, tg, tb] = [d[start], d[start + 1], d[start + 2]];
    const [fr, fg, fb] = hexToRgb(hex);
    if (alpha >= 1 && Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return;
    const like = p => Math.abs(d[p] - tr) + Math.abs(d[p + 1] - tg) + Math.abs(d[p + 2] - tb) <= FILL_TOLERANCE;
    const mask = new Uint8Array(W * H);
    const stack = [sx, sy];
    while (stack.length) {
      const y = stack.pop();
      let x = stack.pop();
      let i = y * W + x;
      while (x >= 0 && !mask[i] && like(i * 4)) { x--; i--; }
      x++; i++;
      let up = false, down = false;
      while (x < W && !mask[i] && like(i * 4)) {
        mask[i] = 1;
        if (y > 0) {
          const u = i - W;
          if (!mask[u] && like(u * 4)) { if (!up) { stack.push(x, y - 1); up = true; } } else up = false;
        }
        if (y < H - 1) {
          const n = i + W;
          if (!mask[n] && like(n * 4)) { if (!down) { stack.push(x, y + 1); down = true; } } else down = false;
        }
        x++; i++;
      }
    }
    // See-through fills mix with what's underneath. On an ink page, a white fill rubs the ink away.
    const image = this.maskFrom ? this.ctx.getImageData(0, 0, W, H) : source;
    const out = image.data;
    const rubOut = this.erases({ c: hex });
    const mix = (under, over) => Math.round(under + (over - under) * alpha);
    const paint = i => {
      const p = i * 4;
      if (rubOut) { out[p + 3] = Math.round(out[p + 3] * (1 - alpha)); return; }
      if (this.transparent && out[p + 3] === 0) { out[p] = fr; out[p + 1] = fg; out[p + 2] = fb; out[p + 3] = Math.round(255 * alpha); return; }
      out[p] = mix(out[p], fr); out[p + 1] = mix(out[p + 1], fg); out[p + 2] = mix(out[p + 2], fb);
      out[p + 3] = this.transparent ? Math.max(out[p + 3], Math.round(255 * alpha)) : 255;
    };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (mask[i]) paint(i);
        else if ((x > 0 && mask[i - 1]) || (x < W - 1 && mask[i + 1]) || (y > 0 && mask[i - W]) || (y < H - 1 && mask[i + W])) paint(i);
      }
    }
    this.ctx.putImageData(image, 0, 0);
  }
}

// ----- finished drawings -----

// Everything drawn on one layer (canvases/{room}/b/{layer}), oldest first, without undone strokes.
export async function loadOps(code, layer) {
  const value = (await get(ref(db, `canvases/${code}/b/${layer}/s`))).val() || {};
  return Object.entries(value).sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .filter(([, v]) => v?.m && !v.x)
    .map(([id, v]) => {
      const chunks = Array.isArray(v.k) ? v.k : Object.values(v.k || {});
      return { id, t: v.m.t || 'p', c: v.m.c, w: v.m.w, o: v.m.o ?? 1, u: v.m.u, points: chunks.flatMap(c => decode(c?.p)) };
    });
}

// Paints layers one on top of the other onto a fresh page. With `snapshots`, also returns a copy of
// the picture after each layer (each step of a picture that several people added to).
export async function renderLayers(code, layers, { snapshots = false } = {}) {
  const canvas = makeCanvas();
  const painter = new Painter(canvas);
  painter.wipe();
  const steps = [];
  for (const layer of layers) {
    (await loadOps(code, layer)).forEach(op => painter.paint(op));
    painter.commitLayers(null);
    if (snapshots) { const copy = makeCanvas(); copy.getContext('2d').drawImage(canvas, 0, 0); steps.push(copy); }
  }
  return snapshots ? steps : canvas;
}

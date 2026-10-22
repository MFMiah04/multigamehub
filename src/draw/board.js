import { ref, push, update, remove, onChildAdded, onChildChanged, onChildRemoved, off } from 'firebase/database';
import { db, serverNow } from '../firebase.js';

// A shared drawing board: <sketch-board room="ABCD" uid="..."></sketch-board>
//
// Everything is drawn onto a fixed-size "paper" (PAPER_W × PAPER_H) that's then scaled onto the
// screen. That way a bucket fill floods exactly the same pixels on every phone and computer.
//
// Each thing someone draws is an "op", stored at canvases/{room}/s/{opId}, outside the room itself
// so a busy board doesn't make the rest of the page redraw:
//   m: { t: type, c: colour, w: width, u: who }   types: p pen, l line, r box, R filled box,
//                                                   e circle, E filled circle, f bucket fill
//   k: batches of points. Pen strokes stream every SEND_MS; shapes and fills send theirs once.
//   x: true when its owner has undone it.
//
// Points are stored as fractions of the board, each coordinate packed into 2 base-36 characters
// (0 to 1295), so a point costs 4 bytes.

const SEND_MS = 40;
const PAPER_W = 1200;
const PAPER_H = 900;
const STEPS = 1295;
const COLORS = ['#222222', '#ffffff', '#d23c5f', '#f28c28', '#f2c94c', '#3fae5b', '#3b82c4', '#8e5bd1', '#8b5a3c', '#f7a8c4'];
const SIZES = [0.006, 0.014, 0.03, 0.06]; // as a fraction of the board's width
const ERASER = '#ffffff';
const FILL_TOLERANCE = 60;

const pack = v => Math.round(Math.min(1, Math.max(0, v)) * STEPS).toString(36).padStart(2, '0');
const encode = points => points.map(([x, y]) => pack(x) + pack(y)).join('');
function decode(text = '') {
  const points = [];
  for (let i = 0; i + 3 < text.length; i += 4) {
    points.push([parseInt(text.slice(i, i + 2), 36) / STEPS, parseInt(text.slice(i + 2, i + 4), 36) / STEPS]);
  }
  return points;
}
const hexToRgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const rgbToHex = (r, g, b) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;

// Little doodled icons for the tools.
const icon = path => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;
const TOOLS = [
  ['pen', 'Pencil', icon('<path d="M4 20 l1 -4 L16 5 l3 3 L8 19 z" fill="#ffe066" /><path d="M14 7 l3 3" />')],
  ['eraser', 'Eraser', icon('<path d="M10 20 h10" /><path d="M4 15 l9 -9 l6 6 l-8 8 h-3 z" fill="#ffaebc" /><path d="M8 11 l6 6" />')],
  ['line', 'Line', icon('<path d="M5 19 L19 5" />')],
  ['rect', 'Box', icon('<rect x="4" y="6" width="16" height="12" rx="1" />')],
  ['rectFill', 'Filled box', icon('<rect x="4" y="6" width="16" height="12" rx="1" fill="#222" />')],
  ['circle', 'Circle', icon('<ellipse cx="12" cy="12" rx="8" ry="7" />')],
  ['circleFill', 'Filled circle', icon('<ellipse cx="12" cy="12" rx="8" ry="7" fill="#222" />')],
  ['fill', 'Bucket fill', icon('<path d="M5 11 l6 -6 l7 7 l-6 6 z" fill="#9ad0f5" /><path d="M8 8 l-2 -3" /><path d="M20 15 q2 3 0 5 q-2 -2 0 -5 z" fill="#3b82c4" />')],
  ['picker', 'Eyedropper', icon('<path d="M14 4 l6 6 l-3 3 l-6 -6 z" fill="#c3b1e1" /><path d="M12 9 l-7 7 v3 h3 l7 -7" />')],
];
const TYPE_OF = { pen: 'p', eraser: 'p', line: 'l', rect: 'r', rectFill: 'R', circle: 'e', circleFill: 'E', fill: 'f' };
const UNDO_ICON = icon('<path d="M9 6 L4 11 L9 16" /><path d="M4 11 H14 a5 5 0 0 1 0 10 H11" />');
const REDO_ICON = icon('<path d="M15 6 L20 11 L15 16" /><path d="M20 11 H10 a5 5 0 0 0 0 10 H13" />');

class SketchBoard extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.code = this.getAttribute('room');
    this.uid = this.getAttribute('uid');
    this.tool = 'pen';
    this.color = COLORS[0];
    this.custom = '#3fa7a0';
    this.size = SIZES[1];
    this.ops = new Map(); // id → { id, t, c, w, u, points, drawn, hidden, chunks }
    this.redoStack = [];
    this.stats = { sentBytes: 0, gotBytes: 0, delays: [] };
    this.paper = document.createElement('canvas');
    this.paper.width = PAPER_W;
    this.paper.height = PAPER_H;
    this.pctx = this.paper.getContext('2d', { willReadFrequently: true });
    this.wipePaper();
    this.build();
    this.listen();
    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this.frame);
    this.timer = setInterval(() => this.flush(), SEND_MS);
    this.statsTimer = setInterval(() => this.showStats(), 1000);
    this.onKey = e => this.key(e);
    document.addEventListener('keydown', this.onKey);
  }

  disconnectedCallback() {
    // lit may move the element; only tear down if it's really gone.
    setTimeout(() => {
      if (this.isConnected) return;
      this.flush();
      clearInterval(this.timer);
      clearInterval(this.statsTimer);
      this.resizer?.disconnect();
      document.removeEventListener('keydown', this.onKey);
      off(this.opsRef);
      this.ready = false;
    });
  }

  // ----- the page bits -----

  build() {
    this.innerHTML = `
      <div class="board__frame wobble"><canvas class="board__canvas"></canvas></div>
      <div class="board__tools">
        <div class="board__row">${TOOLS.map(([id, label, svg]) => `<button class="board__tool" data-tool="${id}" aria-label="${label}" title="${label}">${svg}</button>`).join('')}</div>
        <div class="board__row">
          ${COLORS.map(c => `<button class="board__color" style="--c:${c}" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}
          <label class="board__color board__custom" title="Pick any colour" style="--c:${this.custom}">
            <input type="color" value="${this.custom}" aria-label="Pick any colour"></label>
        </div>
        <div class="board__row">
          ${SIZES.map((s, i) => `<button class="board__size" data-size="${s}" aria-label="Brush size ${i + 1}"><i style="--d:${4 + i * 5}px"></i></button>`).join('')}
          <span class="board__gap"></span>
          <button class="board__tool" data-act="undo" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">${UNDO_ICON}</button>
          <button class="board__tool" data-act="redo" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)">${REDO_ICON}</button>
          <button class="board__clear link" data-act="clear">clear</button>
        </div>
      </div>
      <p class="board__stats note center"></p>`;
    this.frame = this.querySelector('.board__frame');
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => this.pickTool(b.dataset.tool)));
    this.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => this.pickColor(b.dataset.color)));
    this.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { this.size = +b.dataset.size; this.markTools(); }));
    this.querySelector('[data-act="undo"]').addEventListener('click', () => this.undo());
    this.querySelector('[data-act="redo"]').addEventListener('click', () => this.redo());
    this.querySelector('[data-act="clear"]').addEventListener('click', () => remove(ref(db, `canvases/${this.code}`)));
    const customInput = this.querySelector('.board__custom input');
    customInput.addEventListener('input', () => this.setCustom(customInput.value));
    this.markTools();

    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => c.addEventListener(t, e => this.up(e)));
  }

  pickTool(tool) {
    this.tool = tool;
    this.markTools();
  }

  pickColor(color) {
    this.color = color;
    if (this.tool === 'eraser' || this.tool === 'picker') this.tool = 'pen';
    this.markTools();
  }

  setCustom(color) {
    this.custom = color;
    const swatch = this.querySelector('.board__custom');
    swatch.style.setProperty('--c', color);
    swatch.querySelector('input').value = color;
    this.pickColor(color);
  }

  markTools() {
    this.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('is-on', b.dataset.tool === this.tool));
    this.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('is-on', b.dataset.color === this.color && this.tool !== 'eraser'));
    this.querySelector('.board__custom').classList.toggle('is-on', this.color === this.custom && !COLORS.includes(this.color) && this.tool !== 'eraser');
    this.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('is-on', +b.dataset.size === this.size));
    const undoable = this.ownVisible().length > 0;
    this.querySelector('[data-act="undo"]').disabled = !undoable;
    this.querySelector('[data-act="redo"]').disabled = !this.redoStack.length;
    this.canvas.style.cursor = this.tool === 'fill' || this.tool === 'picker' ? 'pointer' : 'crosshair';
  }

  // Matches the screen canvas to its box (and the screen's pixel density).
  fit() {
    const width = this.frame.clientWidth;
    const height = Math.round(width * PAPER_H / PAPER_W);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.show();
  }

  // ----- painting onto the paper -----

  wipePaper() {
    this.pctx.fillStyle = '#ffffff';
    this.pctx.fillRect(0, 0, PAPER_W, PAPER_H);
  }

  style(op) {
    const ctx = this.pctx;
    ctx.strokeStyle = op.c;
    ctx.fillStyle = op.c;
    ctx.lineWidth = Math.max(1, op.w * PAPER_W);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  // Draws whatever's new in an op. Pens grow a bit at a time; everything else is drawn in one go.
  paint(op) {
    if (op.hidden || !op.points.length || op.drawn >= op.points.length) return;
    if (op.t === 'p') this.paintPen(op, op.drawn);
    else if (op.t === 'f') this.floodFill(op.points[0], op.c);
    else if (op.points.length >= 2) this.paintShape(this.pctx, op);
    else return;
    op.drawn = op.points.length;
    this.show();
  }

  // Smooth pen lines: a curve from the middle of each segment to the middle of the next.
  paintPen(op, from) {
    const ctx = this.pctx;
    this.style(op);
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

  // Lines, boxes and circles, from the first point to the last. Also used for the drag preview.
  paintShape(ctx, op, scaleX = PAPER_W, scaleY = PAPER_H) {
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

  // Bucket fill: floods the area of similar colour around the point, then grows it by one pixel
  // so there's no pale fringe left along soft line edges.
  floodFill([fx, fy], hex) {
    const W = PAPER_W, H = PAPER_H;
    const sx = Math.min(W - 1, Math.max(0, Math.round(fx * W)));
    const sy = Math.min(H - 1, Math.max(0, Math.round(fy * H)));
    const image = this.pctx.getImageData(0, 0, W, H);
    const d = image.data;
    const start = (sy * W + sx) * 4;
    const [tr, tg, tb] = [d[start], d[start + 1], d[start + 2]];
    const [fr, fg, fb] = hexToRgb(hex);
    if (Math.abs(tr - fr) + Math.abs(tg - fg) + Math.abs(tb - fb) < 8) return;
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
    const paint = i => { const p = i * 4; d[p] = fr; d[p + 1] = fg; d[p + 2] = fb; d[p + 3] = 255; };
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (mask[i]) paint(i);
        else if ((x > 0 && mask[i - 1]) || (x < W - 1 && mask[i + 1]) || (y > 0 && mask[i - W]) || (y < H - 1 && mask[i + W])) paint(i);
      }
    }
    this.pctx.putImageData(image, 0, 0);
  }

  // Paints everything again from scratch, oldest first. Used after an undo, redo or clear.
  repaint() {
    this.wipePaper();
    [...this.ops.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).forEach(op => { op.drawn = 0; this.paint(op); });
    this.show();
  }

  // Copies the paper onto the screen (at most once a frame), plus the shape being dragged out.
  show() {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      const { width, height } = this.canvas;
      this.ctx.drawImage(this.paper, 0, 0, width, height);
      if (this.preview) this.paintShape(this.ctx, this.preview, width, height);
    });
  }

  // ----- your pointer -----

  pointAt(e) {
    const box = this.canvas.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))];
  }

  newOp(type, color, points) {
    const id = push(ref(db, `canvases/${this.code}/s`)).key;
    const op = { id, t: type, c: color, w: this.size, u: this.uid, points, drawn: 0, sent: 0, chunk: 0, metaSent: false, mine: true };
    this.ops.set(id, op);
    // Doing something new forgets anything you could have redone.
    this.redoStack.splice(0).forEach(old => { this.ops.delete(old); remove(ref(db, `canvases/${this.code}/s/${old}`)); });
    return op;
  }

  down(e) {
    if (this.pointer !== undefined) return; // one finger at a time
    e.preventDefault();
    const p = this.pointAt(e);
    if (this.tool === 'picker') return this.pickAt(p);
    if (this.tool === 'fill') {
      const op = this.newOp('f', this.color, [p]);
      this.paint(op);
      this.flush();
      return this.markTools();
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* keep drawing without capture */ }
    this.pointer = e.pointerId;
    const type = TYPE_OF[this.tool];
    const color = this.tool === 'eraser' ? ERASER : this.color;
    if (type === 'p') {
      this.current = this.newOp('p', color, [p]);
      this.paint(this.current);
    } else {
      this.preview = { t: type, c: color, w: this.size, points: [p, p] };
      this.show();
    }
  }

  move(e) {
    if (e.pointerId !== this.pointer) return;
    if (this.preview) {
      this.preview.points[1] = this.pointAt(e);
      return this.show();
    }
    if (!this.current) return;
    // Coalesced events are the extra points the browser caught between frames; some browsers give none.
    const extra = e.getCoalescedEvents?.();
    (extra?.length ? extra : [e]).forEach(ev => {
      const p = this.pointAt(ev);
      const last = this.current.points.at(-1);
      // Skip points too close to the last one; they add bytes but not detail.
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.0015) this.current.points.push(p);
    });
    this.paint(this.current);
  }

  up(e) {
    if (e.pointerId !== this.pointer) return;
    this.pointer = undefined;
    if (this.preview) {
      const { t, c, points } = this.preview;
      this.preview = null;
      const moved = Math.abs(points[0][0] - points[1][0]) + Math.abs(points[0][1] - points[1][1]) > 0.004;
      if (moved) this.paint(this.newOp(t, c, points));
      else this.show();
    }
    this.flush();
    this.current = null;
    this.markTools();
  }

  // The eyedropper: takes the colour under your finger and switches back to the pencil.
  pickAt([x, y]) {
    const [r, g, b] = this.pctx.getImageData(Math.min(PAPER_W - 1, Math.round(x * PAPER_W)), Math.min(PAPER_H - 1, Math.round(y * PAPER_H)), 1, 1).data;
    const hex = rgbToHex(r, g, b);
    if (COLORS.includes(hex)) this.pickColor(hex);
    else this.setCustom(hex);
    this.tool = 'pen';
    this.markTools();
  }

  // ----- undo and redo (your own drawing only) -----

  ownVisible() {
    return [...this.ops.values()].filter(op => op.u === this.uid && !op.hidden).sort((a, b) => (a.id < b.id ? -1 : 1));
  }

  undo() {
    const op = this.ownVisible().at(-1);
    if (!op) return;
    op.hidden = true;
    this.redoStack.push(op.id);
    update(ref(db, `canvases/${this.code}/s/${op.id}`), { x: true }).catch(() => {});
    this.repaint();
    this.markTools();
  }

  redo() {
    const id = this.redoStack.pop();
    const op = id && this.ops.get(id);
    if (!op) return this.markTools();
    op.hidden = false;
    update(ref(db, `canvases/${this.code}/s/${op.id}`), { x: null }).catch(() => {});
    this.repaint();
    this.markTools();
  }

  // Ctrl+Z to undo; Ctrl+Y or Ctrl+Shift+Z to redo (Cmd on a Mac). Not while typing in a box.
  key(e) {
    if (!(e.ctrlKey || e.metaKey) || e.target.closest?.('input, textarea, select')) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); this.undo(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); this.redo(); }
  }

  // ----- sending and receiving -----

  flush() {
    const mine = [...this.ops.values()].filter(op => op.mine && op.points.length > op.sent);
    if (!mine.length) return;
    const updates = {};
    mine.forEach(op => {
      const base = `canvases/${this.code}/s/${op.id}`;
      if (!op.metaSent) { updates[`${base}/m`] = { t: op.t, c: op.c, w: op.w, u: op.u }; op.metaSent = true; }
      const p = encode(op.points.slice(op.sent));
      updates[`${base}/k/${op.chunk++}`] = { p, t: Math.round(serverNow()) };
      this.stats.sentBytes += p.length + 40;
      op.sent = op.points.length;
    });
    update(ref(db), updates).catch(err => console.error(err));
  }

  listen() {
    this.opsRef = ref(db, `canvases/${this.code}/s`);
    const take = snap => {
      const value = snap.val();
      if (!value?.m) return;
      let op = this.ops.get(snap.key);
      if (op?.mine) return; // already drawn as you drew it
      if (!op) { op = { id: snap.key, t: value.m.t || 'p', c: value.m.c, w: value.m.w, u: value.m.u, points: [], drawn: 0, chunks: 0, hidden: !!value.x }; this.ops.set(snap.key, op); }
      const chunks = Array.isArray(value.k) ? value.k : Object.values(value.k || {});
      for (let i = op.chunks; i < chunks.length; i++) {
        if (!chunks[i]) break;
        op.points.push(...decode(chunks[i].p));
        // Only count what arrives live, not old drawings loaded when the page opens.
        const age = chunks[i].t ? serverNow() - chunks[i].t : Infinity;
        if (age < 10000) { this.stats.gotBytes += chunks[i].p.length + 40; this.stats.delays.push(age); }
        op.chunks = i + 1;
      }
      // Someone undid or redid this: paint everything again without (or with) it.
      if (!!value.x !== op.hidden) { op.hidden = !!value.x; this.repaint(); return; }
      this.paint(op);
    };
    onChildAdded(this.opsRef, take);
    onChildChanged(this.opsRef, take);
    onChildRemoved(this.opsRef, snap => {
      if (!this.ops.delete(snap.key)) return;
      this.redoStack = this.redoStack.filter(id => id !== snap.key);
      clearTimeout(this.repaintSoon);
      this.repaintSoon = setTimeout(() => { this.repaint(); this.markTools(); }, 30); // a clear removes many at once
    });
  }

  showStats() {
    const el = this.querySelector('.board__stats');
    if (!el) return;
    const d = this.stats.delays.splice(0);
    if (d.length) this.lastDelay = Math.round(d.reduce((a, b) => a + b, 0) / d.length);
    const kb = n => (n / 1024).toFixed(1);
    el.textContent = `Sent ${kb(this.stats.sentBytes)} KB · received ${kb(this.stats.gotBytes)} KB${this.lastDelay !== undefined ? ` · delay ≈ ${Math.max(0, this.lastDelay)} ms` : ''}`;
  }
}

if (!customElements.get('sketch-board')) customElements.define('sketch-board', SketchBoard);

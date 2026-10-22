import { ref, push, update, remove, onChildAdded, onChildChanged, onChildRemoved, off } from 'firebase/database';
import { db, serverNow } from '../firebase.js';

// A shared drawing board: <sketch-board room="ABCD" uid="..."></sketch-board>
//
// Drawing happens on your own screen straight away. The points are also sent to the database
// in small batches (every SEND_MS), and everyone else draws them as they arrive.
// Strokes live at canvases/{room}/s/{strokeId}, outside the room itself, so a busy board doesn't
// make the rest of the page redraw. Each stroke has `m` (colour, width, who) and `k`, its batches of points.
//
// Points are stored as fractions of the board's size, so a drawing looks the same on every screen.
// Each coordinate is packed into 2 base-36 characters (0 to 1295), so a point costs 4 bytes.

const SEND_MS = 40;
const RATIO = 3 / 4; // height / width
const STEPS = 1295;
const COLORS = ['#222222', '#d23c5f', '#f28c28', '#f2c94c', '#3fae5b', '#3b82c4', '#8e5bd1', '#8b5a3c'];
const SIZES = [0.006, 0.014, 0.03]; // as a fraction of the board's width
const ERASER = '#ffffff';

const pack = v => Math.round(Math.min(1, Math.max(0, v)) * STEPS).toString(36).padStart(2, '0');
const encode = points => points.map(([x, y]) => pack(x) + pack(y)).join('');
function decode(text = '') {
  const points = [];
  for (let i = 0; i + 3 < text.length; i += 4) {
    points.push([parseInt(text.slice(i, i + 2), 36) / STEPS, parseInt(text.slice(i + 2, i + 4), 36) / STEPS]);
  }
  return points;
}

class SketchBoard extends HTMLElement {
  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.code = this.getAttribute('room');
    this.uid = this.getAttribute('uid');
    this.color = COLORS[0];
    this.size = SIZES[1];
    this.strokes = new Map(); // id → { c, w, u, points, drawn }
    this.stats = { sentBytes: 0, gotBytes: 0, delays: [] };
    this.build();
    this.listen();
    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this.frame);
    this.timer = setInterval(() => this.flush(), SEND_MS);
    this.statsTimer = setInterval(() => this.showStats(), 1000);
  }

  disconnectedCallback() {
    // lit may move the element; only tear down if it's really gone.
    setTimeout(() => {
      if (this.isConnected) return;
      this.flush();
      clearInterval(this.timer);
      clearInterval(this.statsTimer);
      this.resizer?.disconnect();
      off(this.strokesRef);
      this.ready = false;
    });
  }

  // ----- the page bits -----

  build() {
    this.innerHTML = `
      <div class="board__frame wobble"><canvas class="board__canvas"></canvas></div>
      <div class="board__tools">
        <div class="board__colors">${COLORS.map(c => `<button class="board__color" style="--c:${c}" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}</div>
        <div class="board__sizes">
          ${SIZES.map((s, i) => `<button class="board__size" data-size="${s}" aria-label="Brush size ${i + 1}"><i style="--d:${6 + i * 6}px"></i></button>`).join('')}
          <button class="board__eraser" data-color="${ERASER}" aria-label="Eraser">eraser</button>
          <button class="board__clear link">clear</button>
        </div>
      </div>
      <p class="board__stats note center"></p>`;
    this.frame = this.querySelector('.board__frame');
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { this.color = b.dataset.color; this.markTools(); }));
    this.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { this.size = +b.dataset.size; this.markTools(); }));
    this.querySelector('.board__clear').addEventListener('click', () => remove(ref(db, `canvases/${this.code}`)));
    this.markTools();

    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => c.addEventListener(t, e => this.up(e)));
  }

  markTools() {
    this.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('is-on', b.dataset.color === this.color));
    this.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('is-on', +b.dataset.size === this.size));
  }

  // Matches the canvas to its box (and the screen's pixel density), then redraws everything.
  fit() {
    const width = this.frame.clientWidth;
    const height = Math.round(width * RATIO);
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.w = width;
    this.h = height;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.redraw();
  }

  // ----- drawing -----

  // Smooth lines: a curve from the middle of each segment to the middle of the next.
  segment(stroke, from) {
    const { points, c, w } = stroke;
    const ctx = this.ctx;
    ctx.strokeStyle = c;
    ctx.fillStyle = c;
    ctx.lineWidth = Math.max(1, w * this.w);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const px = ([x, y]) => [x * this.w, y * this.h];
    if (points.length === 1 || (from === 0 && points.length < 3)) {
      const [x, y] = px(points[0]);
      ctx.beginPath();
      ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
      if (points.length === 1) return;
    }
    ctx.beginPath();
    for (let i = Math.max(1, from); i < points.length; i++) {
      const [ax, ay] = px(points[i - 1]);
      const [bx, by] = px(points[i]);
      const [sx, sy] = i === 1 ? [ax, ay] : (() => { const [zx, zy] = px(points[i - 2]); return [(zx + ax) / 2, (zy + ay) / 2]; })();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.stroke();
  }

  drawNew(stroke) {
    if (stroke.points.length > stroke.drawn) {
      this.segment(stroke, stroke.drawn);
      stroke.drawn = stroke.points.length;
    }
  }

  redraw() {
    this.ctx.clearRect(0, 0, this.w, this.h);
    this.strokes.forEach(s => { s.drawn = 0; if (s.points.length) { this.segment(s, 0); s.drawn = s.points.length; } });
  }

  pointAt(e) {
    const box = this.canvas.getBoundingClientRect();
    return [(e.clientX - box.left) / box.width, (e.clientY - box.top) / box.height];
  }

  down(e) {
    if (this.pointer !== undefined) return; // one finger at a time
    e.preventDefault();
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* keep drawing without capture */ }
    this.pointer = e.pointerId;
    const id = push(ref(db, `canvases/${this.code}/s`)).key;
    this.current = { id, c: this.color, w: this.size, u: this.uid, points: [this.pointAt(e)], drawn: 0, sent: 0, chunk: 0, metaSent: false };
    this.strokes.set(id, this.current);
    this.drawNew(this.current);
  }

  move(e) {
    if (e.pointerId !== this.pointer || !this.current) return;
    // Coalesced events are the extra points the browser caught between frames; some browsers give none.
    const extra = e.getCoalescedEvents?.();
    const events = extra?.length ? extra : [e];
    events.forEach(ev => {
      const p = this.pointAt(ev);
      const last = this.current.points.at(-1);
      // Skip points too close to the last one; they add bytes but not detail.
      if (Math.abs(p[0] - last[0]) + Math.abs(p[1] - last[1]) > 0.0015) this.current.points.push(p);
    });
    this.drawNew(this.current);
  }

  up(e) {
    if (e.pointerId !== this.pointer) return;
    this.pointer = undefined;
    this.flush();
    this.current = null;
  }

  // ----- sending and receiving -----

  flush() {
    const strokes = [...this.strokes.values()].filter(s => s.u === this.uid && s.sent !== undefined && s.points.length > s.sent);
    if (!strokes.length) return;
    const updates = {};
    strokes.forEach(s => {
      const base = `canvases/${this.code}/s/${s.id}`;
      if (!s.metaSent) { updates[`${base}/m`] = { c: s.c, w: s.w, u: s.u }; s.metaSent = true; }
      const p = encode(s.points.slice(s.sent));
      updates[`${base}/k/${s.chunk++}`] = { p, t: Math.round(serverNow()) };
      this.stats.sentBytes += p.length + 40;
      s.sent = s.points.length;
    });
    update(ref(db), updates).catch(err => console.error(err));
  }

  listen() {
    this.strokesRef = ref(db, `canvases/${this.code}/s`);
    const take = snap => {
      const value = snap.val();
      if (!value?.m || value.m.u === this.uid && this.strokes.has(snap.key)) return;
      let stroke = this.strokes.get(snap.key);
      if (!stroke) { stroke = { id: snap.key, ...value.m, points: [], drawn: 0, chunks: 0 }; this.strokes.set(snap.key, stroke); }
      const chunks = Array.isArray(value.k) ? value.k : Object.values(value.k || {});
      for (let i = stroke.chunks; i < chunks.length; i++) {
        if (!chunks[i]) break;
        stroke.points.push(...decode(chunks[i].p));
        // Only count what arrives live, not old strokes loaded when the page opens.
        const age = chunks[i].t ? serverNow() - chunks[i].t : Infinity;
        if (age < 10000) { this.stats.gotBytes += chunks[i].p.length + 40; this.stats.delays.push(age); }
        stroke.chunks = i + 1;
      }
      this.drawNew(stroke);
    };
    onChildAdded(this.strokesRef, take);
    onChildChanged(this.strokesRef, take);
    onChildRemoved(this.strokesRef, snap => { this.strokes.delete(snap.key); this.redraw(); });
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

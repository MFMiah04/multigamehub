import { ref, push, update, remove, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database';
import { db, serverNow } from '../firebase.js';
import { PAPER_W, PAPER_H, Painter, paintShape, encode, decode, hexToRgb, rgbToHex, renderLayers } from './paint.js';

// A shared drawing board: <sketch-board room="ABCD" uid="..."></sketch-board>
// Add layer="..." for a board of its own (e.g. one per player): canvases/{room}/b/{layer}/...
//
// Everything is drawn onto a fixed-size "paper" (PAPER_W × PAPER_H) that's then scaled onto the
// screen. That way a bucket fill floods exactly the same pixels on every phone and computer.
//
// Each thing someone draws is an "op", stored at canvases/{room}/s/{opId}, outside the room itself
// so a busy board doesn't make the rest of the page redraw:
//   m: { t: type, c: colour, w: width, u: who, o: opacity (left out when solid) }   types: p pen, l line, r box, R filled box,
//                                                   e circle, E filled circle, f bucket fill
//   k: batches of points. Pen strokes stream every SEND_MS; shapes and fills send theirs once.
//   x: true when its owner has undone it.
//
// Points are stored as fractions of the board, each coordinate packed into 2 base-36 characters
// (0 to 1295), so a point costs 4 bytes.
//
// Each game sets `.config` to choose what the board offers (anything left out uses the default):
//   tools: list of tool ids to show (default: all). Empty or one tool hides the tool buttons.
//   colors / sizes / opacity: show the palette / brush sizes / opacity slider (default true). color / size: fixed values.
//   undo, clear, stats: show those buttons and the data line (default true).
//   canDraw: whether you can draw right now (default true).
//   oneStroke: after one finished line, shape or fill, stop until `turnKey` changes.
//   under: other layers to show underneath (finished drawings, loaded once). underMode:
//     'faded'  a see-through guide behind your drawing (the last frame of an animation)
//     'base'   part of the picture you're adding to, so fills and the eyedropper see it too
//   showUnder / showMine: hide either, to compare (default true).
//   maxHeight: the tallest the canvas may be, as a fraction of the screen's height (default 0.72).
// When you finish a line, shape or fill the board fires a `strokeend` event.

const SEND_MS = 40;
const COLORS = ['#222222', '#ffffff', '#d23c5f', '#f28c28', '#f2c94c', '#3fae5b', '#3b82c4', '#8e5bd1', '#8b5a3c', '#f7a8c4'];
const SIZES = [0.006, 0.014, 0.03, 0.06]; // as a fraction of the board's width
const ERASER = '#ffffff';
const DEFAULTS = { tools: null, colors: true, sizes: true, opacity: true, undo: true, clear: true, stats: true, canDraw: true, oneStroke: false, maxHeight: 0.72, under: null, underMode: 'faded', showUnder: true, showMine: true };

// Hue (0-360), saturation and value (0-1) to and from #rrggbb, for the custom colour panel.
function hsvToHex(h, sat, val) {
  const f = n => { const k = (n + h / 60) % 6; return val - val * sat * Math.max(0, Math.min(k, 4 - k, 1)); };
  return rgbToHex(...[5, 3, 1].map(n => Math.round(f(n) * 255)));
}
function hexToHsv(hex) {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, max ? d / max : 0, max];
}
// Little doodled icons for the tools.
const icon = path => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</g></svg>`;
const TOOLS = [
  ['pen', 'Pencil', icon('<path d="M4 20 l1 -4 L16 5 l3 3 L8 19 z" fill="#ffe066" /><path d="M14 7 l3 3" />')],
  ['eraser', 'Eraser', icon('<path d="M10 20 h10" /><path d="M4 15 l9 -9 l6 6 l-8 8 h-3 z" fill="#ffaebc" /><path d="M8 11 l6 6" />')],
  ['line', 'Line', icon('<path d="M5 19 L19 5" />')],
  ['fill', 'Bucket fill', icon('<path d="M5 11 l6 -6 l7 7 l-6 6 z" fill="#9ad0f5" /><path d="M8 8 l-2 -3" /><path d="M20 15 q2 3 0 5 q-2 -2 0 -5 z" fill="#3b82c4" />')],
  ['rect', 'Box', icon('<rect x="4" y="6" width="16" height="12" rx="1" />')],
  ['rectFill', 'Filled box', icon('<rect x="4" y="6" width="16" height="12" rx="1" fill="#222" />')],
  ['circle', 'Circle', icon('<ellipse cx="12" cy="12" rx="8" ry="7" />')],
  ['circleFill', 'Filled circle', icon('<ellipse cx="12" cy="12" rx="8" ry="7" fill="#222" />')],
  ['picker', 'Eyedropper', icon('<path d="M14 4 l6 6 l-3 3 l-6 -6 z" fill="#c3b1e1" /><path d="M12 9 l-7 7 v3 h3 l7 -7" />')],
];
// Cursors drawn in black with a white outline, so they show up on any colour (the browser's own
// crosshair can be white, and vanishes on a white page).
const svgCursor = (svg, x, y, fallback) => `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${x} ${y}, ${fallback}`;
const outlined = (size, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <g fill="none" stroke-linecap="round" stroke-linejoin="round"><g stroke="#fff" stroke-width="4">${body}</g><g stroke="#222" stroke-width="1.6">${body}</g></g></svg>`;
// A ring the size of the brush, with a dot in the middle.
function brushCursor(diameter) {
  const d = Math.round(Math.min(96, Math.max(6, diameter)));
  const size = d + 6, c = size / 2;
  return svgCursor(outlined(size, `<circle cx="${c}" cy="${c}" r="${d / 2}" /><path d="M${c} ${c} h0.01" />`), Math.round(c), Math.round(c), 'crosshair');
}
const CROSS_CURSOR = svgCursor(outlined(24, '<path d="M12 3 v6 M12 15 v6 M3 12 h6 M15 12 h6" />'), 12, 12, 'crosshair');
const FILL_CURSOR = svgCursor(outlined(28, '<path d="M6 13 l7 -7 l8 8 l-7 7 z" /><path d="M24 18 q2 3 0 5 q-2 -2 0 -5 z" /><path d="M9 10 l-3 -4" />'), 24, 24, 'pointer');
const PICKER_CURSOR = svgCursor(outlined(28, '<path d="M17 4 l7 7 l-3 3 l-7 -7 z" /><path d="M14 9 l-9 9 v4 h4 l9 -9" />'), 5, 23, 'pointer');

const TYPE_OF = { pen: 'p', eraser: 'p', line: 'l', rect: 'r', rectFill: 'R', circle: 'e', circleFill: 'E', fill: 'f' };
const UNDO_ICON = icon('<path d="M9 6 L4 11 L9 16" /><path d="M4 11 H14 a5 5 0 0 1 0 10 H11" />');
const REDO_ICON = icon('<path d="M15 6 L20 11 L15 16" /><path d="M20 11 H10 a5 5 0 0 0 0 10 H13" />');

class SketchBoard extends HTMLElement {
  get config() { return this.cfg || DEFAULTS; }

  // Games set this on every redraw, so only react when something actually changed.
  set config(value) {
    const next = { ...DEFAULTS, ...value };
    const key = JSON.stringify(next);
    if (key === this.cfgKey) return;
    const turnChanged = this.cfg && next.turnKey !== this.cfg.turnKey;
    this.cfg = next;
    this.cfgKey = key;
    if (turnChanged) this.used = false;
    if (next.color) this.color = next.color;
    if (next.size) this.size = next.size;
    const tools = next.tools || TOOLS.map(t => t[0]);
    if (!tools.includes(this.tool)) this.tool = tools[0] || 'pen';
    // Your turn ended mid-line: finish it off without starting the next turn.
    if (!next.canDraw && this.pointer !== undefined) this.finish(false);
    if (this.ready) this.applyConfig();
    if (this.ready && JSON.stringify(next.under) !== this.underKey) this.loadUnder();
  }

  connectedCallback() {
    if (this.ready) return;
    this.ready = true;
    this.code = this.getAttribute('room');
    this.uid = this.getAttribute('uid');
    const layer = this.getAttribute('layer');
    this.base = layer ? `canvases/${this.code}/b/${layer}` : `canvases/${this.code}`;
    this.tool = 'pen';
    this.color = COLORS[0];
    this.custom = '#3fa7a0';
    this.size = SIZES[1];
    this.alpha = 1;
    // A game may have fixed these before the board appeared on the page.
    if (this.cfg?.color) this.color = this.cfg.color;
    if (this.cfg?.size) this.size = this.cfg.size;
    if (this.cfg?.tools?.length) this.tool = this.cfg.tools[0];
    this.ops = new Map(); // id → { id, t, c, w, u, points, drawn, hidden, chunks }
    this.redoStack = [];
    this.stats = { sentBytes: 0, gotBytes: 0, delays: [] };
    this.paper = document.createElement('canvas');
    this.paper.width = PAPER_W;
    this.paper.height = PAPER_H;
    this.painter = new Painter(this.paper);
    this.pctx = this.painter.ctx;
    this.wipePaper();
    this.build();
    this.applyConfig();
    this.loadUnder();
    this.listen();
    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this);
    this.onResize = () => this.fit();
    window.addEventListener('resize', this.onResize);
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
      window.removeEventListener('resize', this.onResize);
      this.closePicker();
      this.unlisten?.forEach(stop => stop());
      this.ready = false;
    });
  }

  // ----- the page bits -----

  // On wide screens the tools and colours sit in columns either side of the canvas.
  // Only when the board is wide enough that the canvas still gets most of the room.
  // On narrow screens with more than one kind of control, they fold into tabs instead (board--compact).
  sideWidth() {
    const sides = [...this.querySelectorAll('.board__side')].filter(el => !el.hidden);
    const wide = sides.length > 0 && this.clientWidth >= 640;
    this.classList.toggle('board--wide', wide);
    this.classList.toggle('board--compact', !wide && this.clientWidth < 560 && this.tabCount > 1);
    return wide ? sides.reduce((sum, el) => sum + el.offsetWidth + 12, 0) : 0;
  }

  build() {
    this.innerHTML = `
      <div class="board__frame wobble"><canvas class="board__canvas"></canvas></div>
      <div class="board__tabs">
        <button class="board__tab" data-tab="tools" aria-label="Tools"><span class="board__tab-tool"></span>Tools</button>
        <button class="board__tab" data-tab="colors" aria-label="Colours"><span class="board__tab-color"></span>Colour</button>
        <button class="board__tab" data-tab="sizes" aria-label="Size and opacity"><span class="board__tab-size"><i></i></span>Size</button>
        <button class="board__tool" data-act="undo" aria-label="Undo" title="Undo">${UNDO_ICON}</button>
        <button class="board__tool" data-act="redo" aria-label="Redo" title="Redo">${REDO_ICON}</button>
      </div>
      <div class="board__side board__side--tools">
        <div class="board__group board__group--tools">${TOOLS.map(([id, label, svg]) => `<button class="board__tool" data-tool="${id}" aria-label="${label}" title="${label}">${svg}</button>`).join('')}</div>
        <div class="board__group board__group--actions">
          <button class="board__tool" data-act="undo" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)">${UNDO_ICON}</button>
          <button class="board__tool" data-act="redo" aria-label="Redo (Ctrl+Y)" title="Redo (Ctrl+Y)">${REDO_ICON}</button>
          <button class="board__clear link" data-act="clear">clear</button>
        </div>
      </div>
      <div class="board__side board__side--colors">
        <div class="board__group board__group--colors">
          ${COLORS.map(c => `<button class="board__color" style="--c:${c}" data-color="${c}" aria-label="Colour ${c}"></button>`).join('')}
          <button class="board__color board__custom" title="Pick any colour" aria-label="Pick any colour" style="--c:${this.custom}"></button>
        </div>
        <div class="board__group board__group--sizes">
          <div class="board__sizes">${SIZES.map((s, i) => `<button class="board__size" data-size="${s}" aria-label="Brush size ${i + 1}"><i style="--d:${4 + i * 5}px"></i></button>`).join('')}</div>
          <label class="board__opacity" title="Opacity">
            <input type="range" min="10" max="100" step="5" value="100" aria-label="Opacity"><small>100%</small>
          </label>
        </div>
      </div>
      <p class="board__stats note center"></p>
      <div class="board__picker wobble" hidden role="dialog" aria-label="Pick a colour">
        <div class="board__sv"><span class="board__knob"></span></div>
        <div class="board__hue"><span class="board__knob"></span></div>
        <div class="board__picker-foot">
          <span class="board__preview"></span><code class="board__hex"></code>
          <button class="btn btn--yellow btn--small wobble board__picker-done">Done</button>
        </div>
      </div>`;
    this.frame = this.querySelector('.board__frame');
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => this.pickTool(b.dataset.tool)));
    this.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => this.pickColor(b.dataset.color)));
    this.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { this.size = +b.dataset.size; this.markTools(); }));
    const opacity = this.querySelector('.board__opacity input');
    opacity.addEventListener('input', () => {
      this.alpha = +opacity.value / 100;
      this.querySelector('.board__opacity small').textContent = `${opacity.value}%`;
    });
    this.querySelectorAll('[data-act="undo"]').forEach(b => b.addEventListener('click', () => this.undo()));
    this.querySelectorAll('[data-act="redo"]').forEach(b => b.addEventListener('click', () => this.redo()));
    // On phones the tools, colours and sizes fold into three tabs; tapping one opens its row (one at a time).
    this.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
      this.dataset.open = this.dataset.open === b.dataset.tab ? '' : b.dataset.tab;
      this.querySelectorAll('[data-tab]').forEach(t => t.classList.toggle('is-on', t.dataset.tab === this.dataset.open));
    }));
    this.querySelector('[data-act="clear"]').addEventListener('click', () => remove(ref(db, this.base)));
    this.querySelector('.board__custom').addEventListener('click', () => (this.querySelector('.board__picker').hidden ? this.openPicker() : this.closePicker()));
    this.querySelector('.board__picker-done').addEventListener('click', () => this.closePicker());
    this.setupPicker();
    this.markTools();

    const c = this.canvas;
    c.addEventListener('pointerdown', e => this.down(e));
    c.addEventListener('contextmenu', e => e.preventDefault()); // right-click is the eraser here, not a menu
    c.addEventListener('pointermove', e => this.move(e));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => c.addEventListener(t, e => this.up(e)));
  }

  // Shows only what this game wants, and greys the board out when it isn't your turn.
  applyConfig() {
    const cfg = this.config;
    const tools = cfg.tools || TOOLS.map(t => t[0]);
    this.querySelectorAll('[data-tool]').forEach(b => { b.hidden = !tools.includes(b.dataset.tool); });
    const show = (sel, on) => this.querySelectorAll(sel).forEach(el => { el.hidden = !on; });
    show('.board__group--tools', tools.length > 1);
    show('[data-act="undo"]', cfg.undo);
    show('[data-act="redo"]', cfg.undo);
    show('[data-act="clear"]', cfg.clear);
    show('.board__group--actions', cfg.undo || cfg.clear);
    show('.board__group--colors', cfg.colors && !cfg.color);
    show('.board__sizes', cfg.sizes && !cfg.size);
    show('.board__opacity', cfg.opacity);
    show('.board__group--sizes', (cfg.sizes && !cfg.size) || cfg.opacity);
    show('.board__stats', cfg.stats);
    const toolsShown = tools.length > 1 || cfg.undo || cfg.clear;
    const colorsShown = (cfg.colors && !cfg.color) || (cfg.sizes && !cfg.size) || cfg.opacity;
    show('.board__side--tools', toolsShown);
    show('.board__side--colors', colorsShown);
    show('[data-tab="tools"]', tools.length > 1 || cfg.clear);
    show('[data-tab="colors"]', cfg.colors && !cfg.color);
    show('[data-tab="sizes"]', (cfg.sizes && !cfg.size) || cfg.opacity);
    this.tabCount = [...this.querySelectorAll('[data-tab]')].filter(t => !t.hidden).length;
    this.classList.toggle('board--bare', !toolsShown && !colorsShown);
    this.classList.toggle('board--locked', !this.canDrawNow());
    this.markTools();
    if (this.canvas) this.fit();
  }

  canDrawNow() {
    return this.config.canDraw && !(this.config.oneStroke && this.used);
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
    this.querySelector('.board__custom').style.setProperty('--c', color);
    this.pickColor(color);
  }

  // ----- the custom colour panel: a box of shades on top, a strip of every hue underneath -----

  openPicker() {
    this.hsv = hexToHsv(this.custom);
    this.querySelector('.board__picker').hidden = false;
    this.drawPicker();
    this.setCustom(this.custom);
    // Tapping anywhere outside the panel (or pressing Escape) closes it.
    this.outside = e => {
      if (e.target.closest?.('.board__picker, .board__custom')) return;
      this.closePicker();
      // A tap on the canvas just closes the panel; it doesn't draw a dot as well.
      if (e.target === this.canvas) { e.stopPropagation(); e.preventDefault(); }
    };
    this.escape = e => { if (e.key === 'Escape') this.closePicker(); };
    document.addEventListener('pointerdown', this.outside, true);
    document.addEventListener('keydown', this.escape);
  }

  closePicker() {
    this.querySelector('.board__picker').hidden = true;
    document.removeEventListener('pointerdown', this.outside, true);
    document.removeEventListener('keydown', this.escape);
  }

  drawPicker() {
    const [h, sat, val] = this.hsv;
    const hex = hsvToHex(h, sat, val);
    const panel = this.querySelector('.board__picker');
    panel.style.setProperty('--hue', `hsl(${h} 100% 50%)`);
    panel.querySelector('.board__sv .board__knob').style.cssText = `left:${sat * 100}%;top:${(1 - val) * 100}%;background:${hex}`;
    panel.querySelector('.board__hue .board__knob').style.cssText = `left:${(h / 360) * 100}%;background:hsl(${h} 100% 50%)`;
    panel.querySelector('.board__preview').style.background = hex;
    panel.querySelector('.board__hex').textContent = hex;
    return hex;
  }

  setupPicker() {
    const drag = (el, onMove) => {
      const at = e => {
        const box = el.getBoundingClientRect();
        onMove(Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height)));
        this.setCustom(this.drawPicker());
      };
      el.addEventListener('pointerdown', e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch { /* fine */ } at(e); });
      el.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') at(e); });
    };
    drag(this.querySelector('.board__sv'), (x, y) => { this.hsv[1] = x; this.hsv[2] = 1 - y; });
    drag(this.querySelector('.board__hue'), x => { this.hsv[0] = Math.min(359.9, x * 360); });
  }

  markTools() {
    this.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('is-on', b.dataset.tool === this.tool));
    this.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('is-on', b.dataset.color === this.color && this.tool !== 'eraser'));
    this.querySelector('.board__custom').classList.toggle('is-on', this.color === this.custom && !COLORS.includes(this.color) && this.tool !== 'eraser');
    this.querySelectorAll('[data-size]').forEach(b => b.classList.toggle('is-on', +b.dataset.size === this.size));
    const undoable = this.ownVisible().length > 0;
    this.querySelectorAll('[data-act="undo"]').forEach(b => { b.disabled = !undoable; });
    this.querySelectorAll('[data-act="redo"]').forEach(b => { b.disabled = !this.redoStack.length; });
    // The folded tabs show what's picked right now.
    this.querySelector('.board__tab-tool').innerHTML = TOOLS.find(t => t[0] === this.tool)?.[2] || '';
    this.querySelector('.board__tab-color').style.setProperty('--c', this.tool === 'eraser' ? '#ffffff' : this.color);
    this.querySelector('.board__tab-size i').style.setProperty('--d', `${4 + SIZES.indexOf(this.size) * 5}px`);
    this.setCursor();
  }

  setCursor() {
    if (!this.canvas) return;
    const width = parseFloat(this.canvas.style.width) || this.canvas.clientWidth;
    this.canvas.style.cursor = !this.canDrawNow() ? 'default'
      : this.tool === 'fill' ? FILL_CURSOR
      : this.tool === 'picker' ? PICKER_CURSOR
      : this.tool === 'pen' || this.tool === 'eraser' ? brushCursor(this.size * width)
      : CROSS_CURSOR;
  }

  // Matches the screen canvas to its box (and the screen's pixel density).
  fit() {
    const room = this.clientWidth - this.sideWidth();
    const tallest = Math.max(160, window.innerHeight * this.config.maxHeight);
    const width = Math.max(120, Math.floor(Math.min(room, tallest * PAPER_W / PAPER_H)));
    const height = Math.round(width * PAPER_H / PAPER_W);
    this.canvas.style.width = `${width}px`;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.style.height = `${height}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(height * dpr);
    this.setCursor();
    this.show();
  }

  // ----- painting onto the paper -----

  // In 'base' mode the paper starts from the drawings underneath, so fills and the eyedropper see them.
  // With a faded guide behind, your drawing is also kept on a see-through "ink" page, so on screen it
  // covers the guide where you've drawn and the guide shows through everywhere else.
  wipePaper() {
    const faded = this.under && this.config.underMode === 'faded';
    if (faded && !this.ink) this.ink = new Painter(Object.assign(document.createElement('canvas'), { width: PAPER_W, height: PAPER_H }), { transparent: true, maskFrom: this.painter });
    if (!faded) this.ink = null;
    this.painter.wipe(this.config.underMode === 'base' ? this.under : null);
    this.ink?.wipe();
  }

  paint(op) {
    // The ink page goes first: its fills look at the white page before this op is added to it.
    this.ink?.paint(op);
    if (this.painter.paint(op)) this.show();
  }

  commitLayers(keep) {
    this.ink?.commitLayers(keep);
    this.painter.commitLayers(keep);
  }

  // Loads the finished drawings to show underneath. Done twice, in case the last strokes of the
  // previous turn were still on their way.
  async loadUnder() {
    const layers = this.config.under;
    const key = JSON.stringify(layers);
    this.underKey = key;
    if (!layers?.length) { this.under = null; return this.repaint(); }
    for (const delay of [0, 1500]) {
      if (delay) await new Promise(r => setTimeout(r, delay));
      const picture = await renderLayers(this.code, layers);
      if (this.underKey !== key) return; // something newer was asked for meanwhile
      this.under = picture;
      this.repaint();
    }
  }

  // Paints everything again from scratch, oldest first. Used after an undo, redo or clear.
  repaint() {
    this.wipePaper();
    [...this.ops.values()].sort((a, b) => (a.id < b.id ? -1 : 1)).forEach(op => this.paint(op));
    this.show();
  }

  // Copies the paper onto the screen (at most once a frame), plus the shape being dragged out.
  show() {
    if (this.frameRequested) return;
    this.frameRequested = true;
    requestAnimationFrame(() => {
      this.frameRequested = false;
      const { width, height } = this.canvas;
      const ctx = this.ctx;
      const cfg = this.config;
      const faded = this.under && cfg.underMode === 'faded' && this.ink;
      if (faded) {
        // White page, the faded guide, then your ink on top: what you draw hides the guide beneath it.
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        if (cfg.showUnder) { ctx.globalAlpha = cfg.showMine ? 0.3 : 0.85; ctx.drawImage(this.under, 0, 0, width, height); ctx.globalAlpha = 1; }
        if (!cfg.showMine) return;
      }
      ctx.drawImage(faded ? this.ink.canvas : this.paper, 0, 0, width, height);
      (faded ? this.ink : this.painter).layers.forEach(layer => {
        if (faded && layer.op.c === '#ffffff') return; // a see-through rub-out only shows once it's finished
        ctx.globalAlpha = layer.op.o ?? 1;
        ctx.drawImage(layer.canvas, 0, 0, width, height);
      });
      ctx.globalAlpha = this.preview?.o ?? 1;
      if (this.preview) paintShape(ctx, this.preview, width, height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    });
  }

  // ----- your pointer -----

  pointAt(e) {
    const box = this.canvas.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - box.left) / box.width)), Math.min(1, Math.max(0, (e.clientY - box.top) / box.height))];
  }

  newOp(type, color, points) {
    const id = push(ref(db, `${this.base}/s`)).key;
    const op = { id, t: type, c: color, w: this.size, o: this.alpha, u: this.uid, points, sent: 0, chunk: 0, metaSent: false, mine: true };
    this.ops.set(id, op);
    // Doing something new forgets anything you could have redone.
    this.redoStack.splice(0).forEach(old => { this.ops.delete(old); remove(ref(db, `${this.base}/s/${old}`)); });
    return op;
  }

  down(e) {
    if (this.pointer !== undefined || !this.canDrawNow()) return; // one finger at a time
    // Mice: the left button draws, the right button rubs out (if this game has an eraser), others do nothing.
    const tools = this.config.tools || TOOLS.map(t => t[0]);
    const rightErase = e.pointerType === 'mouse' && e.button === 2;
    if (e.pointerType === 'mouse' && e.button !== 0 && !(rightErase && tools.includes('eraser'))) return;
    e.preventDefault();
    const p = this.pointAt(e);
    if (rightErase) {
      try { this.canvas.setPointerCapture(e.pointerId); } catch { /* keep drawing without capture */ }
      this.pointer = e.pointerId;
      this.current = this.newOp('p', ERASER, [p]);
      this.current.o = 1; // the right-click eraser always rubs out fully
      return this.paint(this.current);
    }
    if (this.tool === 'picker') return this.pickAt(p);
    if (this.tool === 'fill') {
      const op = this.newOp('f', this.color, [p]);
      this.paint(op);
      this.flush();
      return this.done(op);
    }
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* keep drawing without capture */ }
    this.pointer = e.pointerId;
    const type = TYPE_OF[this.tool];
    const color = this.tool === 'eraser' ? ERASER : this.color;
    if (type === 'p') {
      this.current = this.newOp('p', color, [p]);
      this.paint(this.current);
    } else {
      this.preview = { t: type, c: color, w: this.size, o: this.alpha, points: [p, p] };
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
    if (e.pointerId === this.pointer) this.finish(true);
  }

  // Ends the line or shape in progress. `announce` is false when it was cut short by the turn ending.
  finish(announce) {
    this.pointer = undefined;
    if (this.current) this.commitLayers(null);
    let op = this.current;
    if (this.preview) {
      const { t, c, points } = this.preview;
      this.preview = null;
      const moved = Math.abs(points[0][0] - points[1][0]) + Math.abs(points[0][1] - points[1][1]) > 0.004;
      op = moved ? this.newOp(t, c, points) : null;
      if (op) this.paint(op);
      else this.show();
    }
    this.flush();
    this.current = null;
    if (op && announce) this.done(op);
    else this.markTools();
  }

  done(op) {
    if (this.config.oneStroke) { this.used = true; this.applyConfig(); }
    else this.markTools();
    this.dispatchEvent(new CustomEvent('strokeend', { bubbles: true, detail: { id: op.id } }));
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
    if (!this.config.undo) return;
    const op = this.ownVisible().at(-1);
    if (!op) return;
    op.hidden = true;
    this.redoStack.push(op.id);
    update(ref(db, `${this.base}/s/${op.id}`), { x: true }).catch(() => {});
    this.repaint();
    this.markTools();
  }

  redo() {
    if (!this.config.undo) return;
    const id = this.redoStack.pop();
    const op = id && this.ops.get(id);
    if (!op) return this.markTools();
    op.hidden = false;
    update(ref(db, `${this.base}/s/${op.id}`), { x: null }).catch(() => {});
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
      const base = `${this.base}/s/${op.id}`;
      if (!op.metaSent) { updates[`${base}/m`] = { t: op.t, c: op.c, w: op.w, u: op.u, ...(op.o < 1 ? { o: op.o } : {}) }; op.metaSent = true; }
      const p = encode(op.points.slice(op.sent));
      updates[`${base}/k/${op.chunk++}`] = { p, t: Math.round(serverNow()) };
      this.stats.sentBytes += p.length + 40;
      op.sent = op.points.length;
    });
    update(ref(db), updates).catch(err => console.error(err));
  }

  listen() {
    this.opsRef = ref(db, `${this.base}/s`);
    const take = snap => {
      const value = snap.val();
      if (!value?.m) return;
      let op = this.ops.get(snap.key);
      if (op?.mine) return; // already drawn as you drew it
      if (!op) { op = { id: snap.key, t: value.m.t || 'p', c: value.m.c, w: value.m.w, o: value.m.o ?? 1, u: value.m.u, points: [], chunks: 0, hidden: !!value.x }; this.ops.set(snap.key, op); }
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
    // Keep the unsubscribe functions: another board for the same room may be listening too.
    this.unlisten = [
      onChildAdded(this.opsRef, take),
      onChildChanged(this.opsRef, take),
      onChildRemoved(this.opsRef, snap => {
      if (!this.ops.delete(snap.key)) return;
      this.redoStack = this.redoStack.filter(id => id !== snap.key);
      clearTimeout(this.repaintSoon);
      this.repaintSoon = setTimeout(() => { this.repaint(); this.markTools(); }, 30); // a clear removes many at once
      }),
    ];
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

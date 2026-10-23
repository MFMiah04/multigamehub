import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { PAPER_W, PAPER_H, makeCanvas, renderLayers } from './paint.js';

// Plays a chain of finished drawings: <frame-reel> with properties
//   code: the room, frames: list of layer ids in order,
//   mode: 'animation' (each frame on its own) or 'stack' (each step adds to the picture so far),
//   step: how many frames to show one by one (a still of that frame); at or past the end it loops,
//   fps and direction ('forward', 'backward' or 'boomerang') for the loop. (Not `dir`: every element
//   already has a `dir` property, for text direction.)
// It also turns the frames into a GIF for downloading: await reel.gif().

const GIF_W = 480;
const GIF_H = 360;

export function playOrder(count, dir) {
  const forward = Array.from({ length: count }, (_, i) => i);
  if (dir === 'backward') return forward.reverse();
  if (dir === 'boomerang') return count > 2 ? [...forward, ...forward.slice(1, -1).reverse()] : forward;
  return forward;
}

class FrameReel extends HTMLElement {
  connectedCallback() {
    if (this.canvas) return;
    this.innerHTML = '<div class="reel__frame wobble"><canvas class="reel__canvas"></canvas></div>';
    this.canvas = this.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.images = [];
    this.resizer = new ResizeObserver(() => this.fit());
    this.resizer.observe(this);
    this.tick();
    this.load();
  }

  disconnectedCallback() {
    setTimeout(() => {
      if (this.isConnected) return;
      cancelAnimationFrame(this.raf);
      this.resizer?.disconnect();
      this.canvas = null;
    });
  }

  // Properties are set on every redraw of the page; only reload when the frames really change.
  set frames(list) { this._frames = list; this.load(); }
  get frames() { return this._frames || []; }
  set mode(value) { if (value !== this._mode) { this._mode = value; this.loadedKey = ''; this.load(); } }
  get mode() { return this._mode || 'animation'; }

  async load() {
    if (!this.canvas || !this.code || !this.frames.length) return;
    const key = `${this.mode}:${this.frames.join(',')}`;
    if (key === this.loadedKey) return;
    this.loadedKey = key;
    const images = this.mode === 'stack'
      ? await renderLayers(this.code, this.frames, { snapshots: true })
      : await Promise.all(this.frames.map(f => renderLayers(this.code, [f])));
    if (this.loadedKey !== key) return;
    this.images = images;
    this.dispatchEvent(new CustomEvent('reelready', { bubbles: true }));
  }

  fit() {
    if (!this.canvas) return;
    const width = Math.max(120, Math.min(this.clientWidth, (window.innerHeight * 0.6) * PAPER_W / PAPER_H));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${width * PAPER_H / PAPER_W}px`;
    this.canvas.width = Math.round(width * dpr);
    this.canvas.height = Math.round(width * PAPER_H / PAPER_W * dpr);
  }

  // Which frame to show right now: a still while frames are being revealed, otherwise the loop.
  current() {
    const count = this.images.length;
    if (!count) return null;
    const step = this.step ?? count;
    if (step < count) return Math.max(0, step - 1);
    const order = playOrder(count, this.direction);
    const fps = this.fps || 8;
    return order[Math.floor(performance.now() / (1000 / fps)) % order.length];
  }

  tick() {
    this.raf = requestAnimationFrame(() => this.tick());
    if (!this.canvas) return;
    const i = this.current();
    const { width, height } = this.canvas;
    if (i === null) {
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillRect(0, 0, width, height);
      return;
    }
    if (i === this.shown && width === this.shownWidth) return;
    this.shown = i;
    this.shownWidth = width;
    this.ctx.drawImage(this.images[i], 0, 0, width, height);
  }

  // The whole loop as an animated GIF, at the current speed and direction.
  async gif() {
    if (!this.images.length) await this.load();
    const frame = makeCanvas(GIF_W, GIF_H);
    const ctx = frame.getContext('2d', { willReadFrequently: true });
    const encoder = GIFEncoder();
    const delay = Math.round(1000 / (this.fps || 8));
    for (const i of playOrder(this.images.length, this.direction)) {
      ctx.drawImage(this.images[i], 0, 0, GIF_W, GIF_H);
      const { data } = ctx.getImageData(0, 0, GIF_W, GIF_H);
      const palette = quantize(data, 256);
      encoder.writeFrame(applyPalette(data, palette), GIF_W, GIF_H, { palette, delay });
    }
    encoder.finish();
    return new Blob([encoder.bytes()], { type: 'image/gif' });
  }
}

if (!customElements.get('frame-reel')) customElements.define('frame-reel', FrameReel);

// Saves a blob as a file.
export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

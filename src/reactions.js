import { html, nothing } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { set, serverTimestamp } from 'firebase/database';
import { roomRef } from './room.js';
import { play } from './sound.js';

// Quick reactions that float up on everyone's screen.
// Each player has a single slot in the room (reactions/{uid}) that's overwritten every time,
// so the data never grows, and the database rules only allow one write every 0.7 seconds.

export const REACTIONS = { laugh: '😂', shock: '😱', clap: '👏', fire: '🔥', think: '🤔', cry: '😭' };
const COOLDOWN_MS = 1000;
const FLOAT_MS = 2800;

let open = false;
let lastSent = 0;
const seen = new Set();
let floats = [];

function send(ctx, e) {
  if (Date.now() - lastSent < COOLDOWN_MS) return;
  lastSent = Date.now();
  // `n` tells reactions apart: the timestamp changes once the server confirms it, so it can't be the key.
  const n = Math.random().toString(36).slice(2, 10);
  set(roomRef(ctx.room.code, `reactions/${ctx.uid}`), { e, n, at: serverTimestamp() }).catch(() => {});
}

// Spreads the floats across the screen, the same way on every device.
const spread = key => {
  let h = 0;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 8 + (h % 76);
};

export function reactionLayer(ctx) {
  const now = ctx.now();
  Object.entries(ctx.room.reactions || {}).forEach(([uid, r]) => {
    if (!r?.at || !REACTIONS[r.e]) return;
    const key = `${uid}:${r.n}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (now - r.at > 3000) return; // old news, e.g. when you've just joined
    floats.push({ key, emoji: REACTIONS[r.e], name: ctx.room.players[uid]?.name || '', x: spread(key), until: Date.now() + FLOAT_MS });
    play('pop');
  });
  floats = floats.filter(f => f.until > Date.now());
  if (!floats.length) return nothing;
  return html`<div class="reaction-layer" aria-hidden="true">
    ${repeat(floats, f => f.key, f => html`<span class="reaction-float" style="left: ${f.x}%">
      <span class="reaction-float__emoji">${f.emoji}</span><small>${f.name}</small>
    </span>`)}
  </div>`;
}

export function reactionBar(ctx) {
  const toggle = () => { open = !open; ctx.rerender(); };
  return html`<div class="reactions ${open ? 'reactions--open' : ''}">
    ${open ? html`<div class="reactions__options wobble">
      ${Object.entries(REACTIONS).map(([e, emoji]) => html`<button class="reactions__option" aria-label="React ${e}" @click=${() => send(ctx, e)}>${emoji}</button>`)}
    </div>` : nothing}
    <button class="reactions__toggle wobble" aria-label=${open ? 'Close reactions' : 'React'} aria-expanded=${open ? 'true' : 'false'} @click=${toggle}>
      ${open ? '×' : '😀'}
    </button>
  </div>`;
}

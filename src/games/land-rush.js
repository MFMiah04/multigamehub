import { runTransaction } from 'firebase/database';
import { html, nothing, selectField } from '../ui.js';
import { svg } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { CELL, xy, inkOf, scores, grid, finish, leaders } from './grid-kit.js';

// Land Rush: everyone at once, against the clock. Tap squares to paint them. Squares can be
// strengthened (tap your own, up to 3) and stolen (tap someone else's until it's worn down).
const COUNTDOWN_MS = 3000;
const MAX = 3;
const TAP_GAP_MS = 110; // the fastest a finger can claim, so nobody can just auto-click
const sizeFor = players => (players <= 4 ? 8 : 10);

// Each square is its own little record (round/c/c<square>), so lots of people can tap at once.
const ck = i => `c${i}`;
const owned = (cells, p) => Object.values(cells).filter(c => c?.o === p).length;

function tapSquare(ctx, i, p) {
  return runTransaction(roomRef(ctx.room.code, `round/c/${ck(i)}`), c => {
    if (!c || c.o === undefined || c.o < 0) return { o: p, h: 1 };
    if (c.o === p) return c.h >= MAX ? undefined : { o: p, h: c.h + 1 };
    return c.h > 1 ? { o: c.o, h: c.h - 1 } : { o: p, h: 1 };
  });
}

export default {
  id: 'land-rush',
  name: 'Land Rush',
  color: 'lime',
  players: '2–8',
  blurb: 'Everyone at once: tap squares to paint them, steal everyone else\'s.',
  rules: [
    'No turns! When the clock starts, tap squares as fast as you can to paint them your colour.',
    `Tap your own squares to make them stronger (up to ${MAX}). Tap someone else's to wear it down, then it's yours.`,
    'When time runs out, whoever has the most squares wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="1.6">
    <rect x="8" y="10" width="14" height="14" fill="#9be07a" /><rect x="22" y="10" width="14" height="14" fill="#9be07a" /><rect x="22" y="24" width="14" height="14" fill="#f2a9a2" />
    <rect x="36" y="24" width="14" height="14" fill="#f2a9a2" /><rect x="36" y="38" width="14" height="14" fill="#a9c8f0" />
    <path d="M44 6 l4 8 M54 10 l-6 5 M56 20 l-7 -1" fill="none" stroke-linecap="round" />
  </g></svg>`,

  defaults: () => ({ secs: 30 }),
  settingsView: (ctx, s, set) => selectField('Time', s.secs, [[20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute']], v => set({ secs: +v }), !ctx.isHost),
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const startsAt = ctx.now() + COUNTDOWN_MS;
    return { phase: 'play', round: { n: sizeFor(order.length), order, startsAt, endsAt: startsAt + (s.secs || 30) * 1000 } };
  },

  view(ctx) {
    const { round, local } = ctx;
    const { n, order } = round;
    const cells = round.c || {};
    const now = ctx.now();
    const p = order.indexOf(ctx.uid);
    const counting = now < round.startsAt;
    const over = now >= round.endsAt;
    const playing = !counting && !over && p >= 0;
    // Redraw often while the clock runs, so the countdown and timer stay smooth.
    if (!over) { clearTimeout(local.timer); local.timer = setTimeout(ctx.rerender, 200); }

    const layers = svg`${Object.entries(cells).map(([k, c]) => {
      if (!c || c.o < 0) return nothing;
      const [x, y] = xy(+k.slice(1), n).map(v => v * CELL);
      return keyed(`${k}:${c.o}`, svg`<g class="lr-square">
        <rect x=${x + 0.4} y=${y + 0.4} width=${CELL - 0.8} height=${CELL - 0.8} rx="1" fill=${inkOf(c.o)} opacity=${0.25 + 0.25 * c.h} />
        ${c.h > 1 ? svg`<path class="lr-strength" d=${c.h > 2 ? `M${x + 2} ${y + 8} L${x + 8} ${y + 2} M${x + 2} ${y + 2} L${x + 8} ${y + 8}` : `M${x + 2} ${y + 8} L${x + 8} ${y + 2}`} />` : nothing}
      </g>`);
    })}`;
    const tap = i => {
      const t = performance.now();
      if (t - (local.lastTap || 0) < TAP_GAP_MS) return;
      local.lastTap = t;
      cue(`lr:${t}`, 'tap');
      tapSquare(ctx, i, p).catch(() => {});
    };

    const left = Math.ceil((round.endsAt - now) / 1000);
    const count = Math.ceil((round.startsAt - now) / 1000);
    if (counting) cue(`lr:${round.startsAt}:${count}`, 'tock');
    else if (!over) cue(`lr:${round.startsAt}:go`, 'pop');
    const body = html`<div class="cr" style="--ratio: 1">
      ${scores(ctx, order, { value: i => owned(cells, i) })}
      <p class="db-status center">${counting ? html`<b class="lr-count">Get ready… ${count}</b>` : over ? html`<b>Time's up!</b>` : html`<b class="lr-clock ${left <= 5 ? 'lr-clock--low' : ''}">${left}s</b><br>Tap, tap, tap!`}</p>
      ${grid({ w: n, h: n, layers, onTap: playing ? tap : null, cls: 'lr-board' })}
    </div>`;
    if (!over) return body;
    return finish(ctx, order, { winners: leaders(order, i => owned(cells, i), id => ctx.room.players[id]), body });
  },
};

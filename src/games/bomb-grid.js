import { runTransaction } from 'firebase/database';
import { html, nothing, toast, selectField } from '../ui.js';
import { svg } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { CELL, xy, at, inkOf, nextTurn, scores, status, turnLine, grid, ring, finish, leaders } from './grid-kit.js';

// Bomb Grid: drop bombs with short fuses. When one goes off it paints its row and column (3 squares
// each way) in the colour of whoever set it off, and sets off any bombs it hits, for them too.
const REACH = 3;
const sizeFor = players => (players <= 3 ? 7 : 9);
const FUSES = [[0, 'Now'], [1, 'Next turn'], [2, 'In 2 turns']];

// paint: one character per square ('-' or owner). bombs: { b<square>: { o: owner, f: turns left } }
// (letter-keyed so the database keeps it an object, not a list with gaps).
const bk = i => `b${i}`;
const squareOf = k => +k.slice(1);
const owned = (paint, p) => [...paint].filter(c => c === String(p)).length;

// Sets off every bomb that's due (and every bomb those hit). Returns the blasts, in order, for the animation.
function explode(round, due) {
  const { n } = round;
  const paint = [...round.paint];
  const bombs = { ...(round.bombs || {}) };
  const queue = due.map(i => ({ i, by: bombs[bk(i)].o }));
  const blasts = [];
  while (queue.length) {
    const { i, by } = queue.shift();
    if (!bombs[bk(i)]) continue;
    delete bombs[bk(i)];
    const [x, y] = xy(i, n);
    const hit = [i];
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      for (let k = 1; k <= REACH; k++) { const j = at(x + dx * k, y + dy * k, n, n); if (j >= 0) hit.push(j); }
    });
    hit.forEach(j => {
      paint[j] = String(by);
      if (bombs[bk(j)]) queue.push({ i: j, by }); // a chain: it goes off for whoever set off this one
    });
    blasts.push({ i, by });
  }
  round.paint = paint.join('');
  round.bombs = bombs;
  return blasts;
}

function drop(ctx, i, fuse) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid) return undefined;
    const p = round.order.indexOf(ctx.uid);
    if (round.bombs?.[bk(i)]) return undefined;
    // Every other bomb's fuse burns down a turn, then the new one is set.
    const bombs = Object.fromEntries(Object.entries(round.bombs || {}).map(([k, b]) => [k, { ...b, f: b.f - 1 }]));
    bombs[bk(i)] = { o: p, f: fuse };
    round.bombs = bombs;
    const due = Object.keys(bombs).filter(k => bombs[k].f <= 0).map(squareOf).sort((a, b) => (a === i ? 1 : b === i ? -1 : a - b));
    const blasts = explode(round, due);
    round.moves = (round.moves || 0) + 1;
    round.last = { i, p, fuse, blasts, n: round.moves };
    if (round.moves >= round.turns * round.order.length) {
      // Out of turns: everything left goes off.
      round.last.blasts = round.last.blasts || [];
      round.last.blasts.push(...explode(round, Object.keys(round.bombs || {}).map(squareOf)));
      round.done = true;
    } else round.turn = nextTurn(ctx, round.order, p);
    return round;
  });
}

export default {
  id: 'bomb-grid',
  name: 'Bomb Grid',
  color: 'orange',
  players: '2–6',
  blurb: 'Drop bombs on short fuses. Blasts paint the board and set off other bombs.',
  rules: [
    'On your turn, pick a fuse (now, next turn, or in 2 turns) and tap a square to drop a bomb.',
    `When a bomb goes off it paints its row and column, ${REACH} squares each way, in the colour of whoever set it off.`,
    'Any bombs caught in the blast go off too, and they paint for the same player. Steal other people\'s bombs!',
    'When everyone has had their turns, the bombs left all go off. Most squares wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <path d="M6 30 h52 M32 6 v46" stroke="#f0a35a" stroke-width="7" opacity="0.55" />
    <circle cx="32" cy="30" r="9" fill="#444" /><path d="M37 22 q4 -6 9 -5" /><path d="M48 13 l2 -3 M50 17 l3 0 M47 10 l0 -3" stroke="#e05a4f" />
  </g></svg>`,

  defaults: () => ({ turns: 8 }),
  settingsView: (ctx, s, set) => selectField('Turns each', s.turns, [[5, '5 turns (quick)'], [8, '8 turns'], [12, '12 turns (long)']], v => set({ turns: +v }), !ctx.isHost),
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 6 ? '6 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const n = sizeFor(order.length);
    return { phase: 'play', round: { n, order, turns: s.turns || 8, paint: '-'.repeat(n * n), turn: order[Math.floor(Math.random() * order.length)] } };
  },

  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    if (round.order.filter(id => ctx.room.players[id]).length < 2) return { 'round/done': true };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)) };
    return null;
  },

  view(ctx) {
    const { round, local } = ctx;
    const { n, order } = round;
    const last = round.last && { blasts: [], ...round.last }; // the database drops empty lists
    const p = order.indexOf(ctx.uid);
    const myTurn = round.turn === ctx.uid && !round.done;
    local.fuse ??= 1;
    const bombs = round.bombs || {};
    const box = i => xy(i, n).map(v => v * CELL);
    const layers = svg`
      ${[...round.paint].map((c, i) => { if (c === '-') return nothing; const [x, y] = box(i); return svg`<rect class="bg-paint" x=${x} y=${y} width=${CELL} height=${CELL} fill=${inkOf(+c)} />`; })}
      ${keyed(last?.n || 0, svg`${(last?.blasts || []).map(({ i, by }, k) => {
        const [x, y] = box(i);
        return svg`<g class="bg-blast" style="--k: ${k}" fill=${inkOf(by)}>
          <rect x=${Math.max(0, x - REACH * CELL)} y=${y + 3} width=${Math.min(n * CELL, x + (REACH + 1) * CELL) - Math.max(0, x - REACH * CELL)} height="4" rx="2" />
          <rect x=${x + 3} y=${Math.max(0, y - REACH * CELL)} width="4" height=${Math.min(n * CELL, y + (REACH + 1) * CELL) - Math.max(0, y - REACH * CELL)} rx="2" /></g>`;
      })}`)}
      ${Object.entries(bombs).map(([k, b]) => bomb(squareOf(k), n, b))}
      ${last ? ring(last.i, n, last.p) : nothing}`;
    if (last) cue(`bg:${round.id}:${last.n}`, last.blasts.length > 1 ? 'score' : last.blasts.length ? 'buzz' : 'pop');
    if (myTurn) cue(`bg:${round.id}:turn:${last?.n || 0}`, 'ding');

    const who = last && (order[last.p] === ctx.uid ? 'You' : ctx.room.players[order[last.p]]?.name || 'Someone');
    const news = !last ? `${myTurn ? 'You go' : `${ctx.room.players[round.turn]?.name || 'Someone'} goes`} first.`
      : last.blasts.length > 1 ? `Boom! A chain of ${last.blasts.length} bombs!` : last.blasts.length ? 'Boom!' : `${who} dropped a bomb.`;
    const left = round.turns * order.length - (round.moves || 0);
    const body = html`<div class="cr" style="--ratio: 1">
      ${scores(ctx, order, { turn: round.done ? null : round.turn, value: i => owned(round.paint, i) })}
      ${round.done ? nothing : status(`${news} (${left} turn${left === 1 ? '' : 's'} left)`, order.includes(ctx.uid) ? turnLine(myTurn, { mine: 'Pick a fuse, then tap a square.', waiting: `Waiting for ${ctx.room.players[round.turn]?.name || 'the next player'}…` }) : '')}
      ${grid({ w: n, h: n, layers, onTap: myTurn ? i => {
        if (bombs[bk(i)]) return toast('There\'s already a bomb there.');
        drop(ctx, i, local.fuse).catch(() => toast("That didn't go through. Try again?"));
      } : null })}
      ${myTurn ? html`<div class="bg-fuses" role="radiogroup" aria-label="Fuse">${FUSES.map(([f, label]) => html`<button class="bg-fuse wobble ${local.fuse === f ? 'bg-fuse--on' : ''}" role="radio" aria-checked=${local.fuse === f}
        @click=${() => { local.fuse = f; ctx.rerender(); }}>${fuseIcon(f)} ${label}</button>`)}</div>` : nothing}
    </div>`;
    if (!round.done) return body;
    return finish(ctx, order, { winners: leaders(order, i => owned(round.paint, i), id => ctx.room.players[id]), body });
  },
};

// A doodled bomb in its owner's ink, with how many turns are left on its fuse.
function bomb(i, n, b) {
  const [x, y] = xy(i, n);
  const cx = x * CELL + 5, cy = y * CELL + 5.6;
  return svg`<g class="bg-bomb ${b.f <= 1 ? 'bg-bomb--soon' : ''}">
    <path d="M${cx + 1.8} ${cy - 2.6} q1.6 -2.2 3 -1.6" class="cr-dot" fill="none" />
    <circle class="cr-dot" cx=${cx} cy=${cy} r="3.2" fill="#3a3a3a" stroke=${inkOf(b.o)} />
    <text class="bg-fuse-count" x=${cx} y=${cy + 1.4}>${Math.max(0, b.f)}</text>
  </g>`;
}
const fuseIcon = f => html`<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><circle cx="9" cy="11" r="6" fill="#3a3a3a" stroke="#222" stroke-width="1.5" />
  <text x="9" y="14" fill="#fff" font-size="8" text-anchor="middle">${f}</text><path d="M13 6 q2 -3 5 -2" fill="none" stroke="#222" stroke-width="1.5" /></svg>`;

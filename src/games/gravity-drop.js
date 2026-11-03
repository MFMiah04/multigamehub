import { runTransaction } from 'firebase/database';
import { html, nothing, button, toast } from '../ui.js';
import { svg } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { CELL, xy, nextTurn, scores, status, turnLine, grid, dot, ring, finish } from './grid-kit.js';

// Gravity Drop: drop counters into columns to get four in a row. Or, instead, pop one of your own
// counters out of the bottom row and let the whole column fall.
const sizeFor = players => (players <= 2 ? [7, 6] : [8, 7]);
const LINES = [[1, 0], [0, 1], [1, 1], [1, -1]];

// The first four-in-a-row for player p, as its four squares, or null.
function fourFor(board, w, h, p) {
  const mine = i => i >= 0 && board[i] === String(p);
  for (let i = 0; i < w * h; i++) {
    if (!mine(i)) continue;
    const [x, y] = xy(i, w);
    for (const [dx, dy] of LINES) {
      const run = [0, 1, 2, 3].map(k => { const a = x + dx * k, b = y + dy * k; return a >= 0 && b >= 0 && a < w && b < h ? b * w + a : -1; });
      if (run.every(mine)) return run;
    }
  }
  return null;
}
const dropRow = (board, w, h, c) => { for (let y = h - 1; y >= 0; y--) if (board[y * w + c] === '-') return y; return -1; };
const canPop = (board, w, h, c, p) => board[(h - 1) * w + c] === String(p);

function move(ctx, c, pop) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid) return undefined;
    const { w, h } = round;
    const p = round.order.indexOf(ctx.uid);
    const cells = [...round.board];
    let landed = -1;
    if (pop) {
      if (!canPop(round.board, w, h, c, p)) return undefined;
      for (let y = h - 1; y > 0; y--) cells[y * w + c] = cells[(y - 1) * w + c];
      cells[c] = '-';
    } else {
      const y = dropRow(round.board, w, h, c);
      if (y < 0) return undefined;
      landed = y * w + c;
      cells[landed] = String(p);
    }
    round.board = cells.join('');
    round.last = { c, p, pop: !!pop, landed, n: (round.last?.n || 0) + 1 };
    // The mover's four counts first; a pop can also hand someone else a four.
    const order = [p, ...round.order.map((id, i) => i).filter(i => i !== p)];
    const winner = order.find(i => fourFor(round.board, w, h, i));
    if (winner !== undefined) { round.done = true; round.winners = [round.order[winner]]; round.line = fourFor(round.board, w, h, winner); return round; }
    const next = nextTurn(ctx, round.order, p);
    const full = !round.board.includes('-');
    const nextCanPop = [...Array(w).keys()].some(col => canPop(round.board, w, h, col, round.order.indexOf(next)));
    if ((full && !nextCanPop) || round.last.n >= w * h * 3) round.done = true; // stuck, or going round in circles: a draw (no winners)
    else round.turn = next;
    return round;
  });
}

export default {
  id: 'gravity-drop',
  name: 'Gravity Drop',
  color: 'yellow',
  players: '2–4',
  blurb: 'Four in a row, but you can pop counters out of the bottom.',
  rules: [
    'Take turns dropping a counter into a column. Get four of yours in a row (across, down or diagonally) to win.',
    'Instead of dropping, you can pop one of your own counters out of the bottom row. Everything above it falls down one.',
    'A pop can make a four for someone else, so be careful. If it makes one for you too, yours counts.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M8 12 v38 h48 v-38 M20 12 v38 M32 12 v38 M44 12 v38" stroke-width="1.5" stroke="#9db7d6" />
    <circle cx="14" cy="44" r="4.5" fill="#d99a1e" /><circle cx="26" cy="44" r="4.5" fill="#e05a4f" /><circle cx="26" cy="33" r="4.5" fill="#d99a1e" /><circle cx="38" cy="44" r="4.5" fill="#d99a1e" />
    <circle cx="38" cy="22" r="4.5" fill="#d99a1e" /><path d="M38 5 v8 M35 10 l3 3 l3 -3" />
  </g></svg>`,

  defaults: () => ({}),
  settingsView: ctx => html`<p class="note">${sizeFor(ctx.players.length).join(' × ')} board for ${ctx.players.length} players.</p>`,
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 4 ? '4 players max' : null),

  start(ctx) {
    const order = ctx.players.map(p => p.id);
    const [w, h] = sizeFor(order.length);
    return { phase: 'play', round: { w, h, order, board: '-'.repeat(w * h), turn: order[Math.floor(Math.random() * order.length)] } };
  },

  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const here = round.order.filter(id => ctx.room.players[id]);
    if (here.length < 2) return { 'round/done': true, 'round/winners': here };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)) };
    return null;
  },

  view(ctx) {
    const { round, local } = ctx;
    const { w, h, order, board, last } = round;
    const p = order.indexOf(ctx.uid);
    const done = !!round.done;
    const myTurn = round.turn === ctx.uid && !done;
    const popping = myTurn && local.pop;
    const poppable = [...Array(w).keys()].filter(c => canPop(board, w, h, c, p));
    const layers = svg`
      ${[...board].map((c, i) => (c === '-' || i === last?.landed ? nothing : dot(i, w, +c, 4, popping && poppable.includes(i % w) && i >= (h - 1) * w ? 'gd-poppable' : '')))}
      ${last?.landed >= 0 ? keyed(last.n, svg`<g class="gd-fall" style="--from: ${-(Math.floor(last.landed / w) + 1) * CELL}px">${dot(last.landed, w, last.p, 4)}</g>`) : nothing}
      ${last ? ring(last.pop ? (h - 1) * w + last.c : last.landed, w, last.p) : nothing}
      ${round.line ? svg`<path class="gd-line" d="M${round.line.map(i => { const [x, y] = xy(i, w); return `${x * CELL + 5} ${y * CELL + 5}`; }).join(' L')}" />` : nothing}`;
    if (last) cue(`gd:${round.id}:${last.n}`, last.pop ? 'whoosh' : 'pop');
    if (myTurn) cue(`gd:${round.id}:turn:${last?.n || 0}`, 'ding');

    const who = last && (order[last.p] === ctx.uid ? 'You' : ctx.room.players[order[last.p]]?.name || 'Someone');
    const news = !last ? `${myTurn ? 'You go' : `${ctx.room.players[round.turn]?.name || 'Someone'} goes`} first.`
      : last.pop ? `${who} popped a counter out of column ${last.c + 1}!` : `${who} dropped into column ${last.c + 1}.`;
    const body = html`<div class="cr" style="--ratio: ${w / h}">
      ${scores(ctx, order, { turn: done ? null : round.turn, value: i => [...board].filter(c => c === String(i)).length })}
      ${done ? nothing : status(news, order.includes(ctx.uid) ? turnLine(myTurn, { mine: popping ? 'Tap one of your bottom counters to pop it.' : 'Tap a column to drop a counter.', waiting: `Waiting for ${ctx.room.players[round.turn]?.name || 'the next player'}…` }) : '')}
      ${grid({ w, h, layers, onTap: myTurn ? i => {
        const c = i % w;
        if (popping) {
          if (!poppable.includes(c)) return toast('Pick a column with your counter at the bottom.');
          local.pop = false;
        } else if (dropRow(board, w, h, c) < 0) return toast('That column is full.');
        move(ctx, c, popping).catch(() => toast("That didn't go through. Try again?"));
      } : null })}
      ${myTurn && poppable.length ? html`<div class="gd-actions">${button(popping ? 'Drop instead' : 'Pop one out', () => { local.pop = !popping; ctx.rerender(); }, { kind: 'white', small: true })}</div>` : nothing}
    </div>`;
    if (!done) return body;
    return finish(ctx, order, { winners: round.winners || [], note: round.winners?.length ? null : 'No four in a row. A draw!', body });
  },
};

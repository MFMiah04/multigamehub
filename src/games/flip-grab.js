import { runTransaction } from 'firebase/database';
import { html, nothing, toast } from '../ui.js';
import { svg } from 'lit-html';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { xy, at, nextTurn, scores, status, turnLine, grid, dot, ring, finish, leaders } from './grid-kit.js';

// Flip Grab: place a dot to trap lines of other players' dots between two of yours, and they flip to you.
const EIGHT = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const sizeFor = players => (players <= 2 ? 8 : players <= 4 ? 10 : 12);

// The dots a move would flip: in each direction, a run of other players' dots ended by one of yours.
function flipsFor(board, n, i, p) {
  if (board[i] !== '-') return [];
  const [x, y] = xy(i, n);
  const flips = [];
  for (const [dx, dy] of EIGHT) {
    const run = [];
    for (let k = 1; ; k++) {
      const j = at(x + dx * k, y + dy * k, n, n);
      if (j < 0 || board[j] === '-') break;
      if (+board[j] === p) { flips.push(...run); break; }
      run.push(j);
    }
  }
  return flips;
}
// If you can't flip anything, you can still play next to any dot.
const touching = (board, n, i) => { const [x, y] = xy(i, n); return EIGHT.some(([dx, dy]) => { const j = at(x + dx, y + dy, n, n); return j >= 0 && board[j] !== '-'; }); };
const movesFor = (board, n, p) => {
  const all = [...board].map((c, i) => i).filter(i => board[i] === '-');
  const flipping = all.filter(i => flipsFor(board, n, i, p).length);
  return { flipping, any: flipping.length ? flipping : all.filter(i => touching(board, n, i)) };
};
const count = (board, p) => [...board].filter(c => c === String(p)).length;

function place(ctx, i) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid) return undefined;
    const p = round.order.indexOf(ctx.uid);
    const { any } = movesFor(round.board, round.n, p);
    if (!any.includes(i)) return undefined;
    const flipped = flipsFor(round.board, round.n, i, p);
    const cells = [...round.board];
    [i, ...flipped].forEach(j => { cells[j] = String(p); });
    round.board = cells.join('');
    round.last = { i, p, flipped, n: (round.last?.n || 0) + 1 };
    if (!round.board.includes('-')) round.done = true;
    else round.turn = nextTurn(ctx, round.order, p);
    return round;
  });
}

export default {
  id: 'flip-grab',
  name: 'Flip Grab',
  color: 'mint',
  players: '2–8',
  blurb: 'Trap other players\' dots between two of yours to flip them to your colour.',
  rules: [
    'Take turns placing a dot. If it traps a line of other players\' dots between it and another of your dots (in any direction, diagonals too), they all flip to your colour.',
    'The faint dots show where you can flip something. If you can\'t flip anything, place next to any dot.',
    'When the board is full, whoever has the most dots wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" fill="none" stroke-linecap="round">
    <path d="M6 10 h52 v38 h-52 z M19 10 v38 M32 10 v38 M45 10 v38 M6 23 h52 M6 36 h52" stroke-width="1.3" stroke="#9db7d6" />
    <circle cx="12.5" cy="29.5" r="4.5" fill="#3fae6a" /><circle cx="25.5" cy="29.5" r="4.5" fill="#3fae6a" /><circle cx="38.5" cy="29.5" r="4.5" fill="#e05a4f" /><circle cx="51.5" cy="29.5" r="4.5" fill="#3fae6a" />
    <path d="M34 20 q5 -5 9 0 M43 20 l0 -4 M43 20 l-4 0" stroke-width="1.8" />
  </g></svg>`,

  defaults: () => ({}),
  settingsView: ctx => html`<p class="note">${sizeFor(ctx.players.length)} × ${sizeFor(ctx.players.length)} board for ${ctx.players.length} players.</p>`,
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx) {
    const order = ctx.players.map(p => p.id);
    const n = sizeFor(order.length);
    const cells = Array(n * n).fill('-');
    // A little mixed-up block of everyone's dots in the middle.
    const players = order.length;
    if (players <= 4) {
      const k = players <= 2 ? 2 : players === 3 ? 3 : 4;
      const start = Math.floor((n - k) / 2);
      for (let y = 0; y < k; y++) for (let x = 0; x < k; x++) {
        cells[(start + y) * n + start + x] = String(players <= 2 ? (x + y) % 2 : (x + (players === 4 ? 2 : 1) * y) % players);
      }
    } else {
      // Bigger groups: two dots each, dealt across a 4 × 4 block so neighbours are mixed up.
      const start = (n - 4) / 2;
      for (let k = 0; k < players * 2; k++) cells[(start + Math.floor(k / 4)) * n + start + (k % 4)] = String(k % players);
    }
    return { phase: 'play', round: { n, order, board: cells.join(''), turn: order[Math.floor(Math.random() * order.length)] } };
  },

  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    if (round.order.filter(id => ctx.room.players[id]).length < 2) return { 'round/done': true };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)) };
    return null;
  },

  view(ctx) {
    const { round } = ctx;
    const { n, order, board } = round;
    const last = round.last && { flipped: [], ...round.last }; // the database drops empty lists
    const p = order.indexOf(ctx.uid);
    const myTurn = round.turn === ctx.uid && !round.done;
    const layers = svg`
      ${myTurn ? movesFor(board, n, p).any.map(i => dot(i, n, p, 1.4, 'fg-hint')) : nothing}
      ${last ? ring(last.i, n, last.p) : nothing}
      ${[...board].map((c, i) => (c === '-' ? nothing : dot(i, n, +c, 3.2, last?.flipped?.includes(i) ? 'fg-flipped' : '')))}`;
    const board_ = html`<div class="cr" style="--ratio: 1">${scores(ctx, order, { turn: round.done ? null : round.turn, value: i => count(board, i) })}
      ${round.done ? nothing : status(news(ctx), order.includes(ctx.uid) ? turnLine(myTurn, { mine: 'Tap a square to place a dot.', waiting: `Waiting for ${ctx.room.players[round.turn]?.name || 'the next player'}…` }) : '')}
      ${grid({ w: n, h: n, layers, onTap: myTurn ? i => {
        if (!movesFor(board, n, p).any.includes(i)) return toast('Try one of the faint dots.');
        place(ctx, i).catch(() => toast("That didn't go through. Try again?"));
      } : null })}</div>`;
    if (last) cue(`fg:${round.id}:${last.n}`, last.flipped.length >= 4 ? 'score' : 'pop');
    if (myTurn) cue(`fg:${round.id}:turn:${last?.n || 0}`, 'ding');
    if (!round.done) return board_;
    return finish(ctx, order, { winners: leaders(order, i => count(board, i), id => ctx.room.players[id]), body: board_ });
  },
};

function news(ctx) {
  const { round } = ctx;
  const last = round.last && { flipped: [], ...round.last };
  if (!last) return `${round.turn === ctx.uid ? 'You go' : `${ctx.room.players[round.turn]?.name || 'Someone'} goes`} first.`;
  const who = round.order[last.p] === ctx.uid ? 'You' : ctx.room.players[round.order[last.p]]?.name || 'Someone';
  return last.flipped.length ? `${who} flipped ${last.flipped.length} dot${last.flipped.length === 1 ? '' : 's'}!` : `${who} placed a dot.`;
}

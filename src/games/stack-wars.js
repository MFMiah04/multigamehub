import { runTransaction } from 'firebase/database';
import { html, nothing, toast } from '../ui.js';
import { svg } from 'lit-html';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { CELL, xy, around, inkOf, nextTurn, scores, status, turnLine, grid, ring, finish, leaders } from './grid-kit.js';

// Stack Wars: grow your stacks, march them at other players' stacks, and topple tall ones over everything nearby.
const TOPPLE = 5; // a stack this tall falls over
const START = 3;
const sizeFor = players => (players <= 2 ? 6 : 7);
const turnsFor = players => 12 * players; // after this many turns in all, the most counters wins

// Squares are "-0" for empty or owner + height, two characters each.
const decode = s => Array.from({ length: s.length / 2 }, (_, i) => ({ o: s[2 * i] === '-' ? -1 : +s[2 * i], h: +s[2 * i + 1] }));
const encode = cells => cells.map(c => (c.h > 0 ? `${c.o}${Math.min(9, c.h)}` : '-0')).join('');
const totalFor = (cells, p) => cells.reduce((n, c) => n + (c.o === p ? c.h : 0), 0);
const stillIn = (cells, p) => cells.some(c => c.o === p && c.h > 0);

// Stacks that grow too tall fall over: they give a counter to every square next to them, and those
// squares become theirs. That can make more stacks fall, in a chain.
function topple(cells, n, p) {
  const fell = [];
  for (let guard = 0; guard < 200; guard++) {
    const i = cells.findIndex(c => c.h >= TOPPLE);
    if (i < 0) break;
    fell.push(i);
    const owner = cells[i].o;
    cells[i].h -= around(i, n, n).length;
    if (cells[i].h <= 0) cells[i] = { o: -1, h: 0 };
    around(i, n, n).forEach(j => { cells[j] = { o: owner, h: (cells[j].h || 0) + 1 }; });
  }
  return fell;
}

// Grow a stack (to === from) or move it onto a neighbour (leaving one counter behind).
function act(ctx, from, to) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid) return undefined;
    const { n } = round;
    const p = round.order.indexOf(ctx.uid);
    const cells = decode(round.board);
    const src = cells[from];
    if (src.o !== p || !src.h) return undefined;
    let fight = null;
    if (from === to) src.h += 1;
    else {
      if (!around(from, n, n).includes(to) || src.h < 2) return undefined;
      const moving = src.h - 1;
      src.h = 1;
      const dst = cells[to];
      if (!dst.h || dst.o === p) cells[to] = { o: p, h: dst.h + moving };
      else {
        // A fight: the bigger side wins and keeps the difference. A tie wipes both out.
        fight = { them: dst.o, a: moving, d: dst.h };
        cells[to] = moving > dst.h ? { o: p, h: moving - dst.h } : moving < dst.h ? { o: dst.o, h: dst.h - moving } : { o: -1, h: 0 };
      }
    }
    const fell = topple(cells, n, p);
    round.board = encode(cells);
    round.moves = (round.moves || 0) + 1;
    round.last = { p, from, to, fight, fell, n: round.moves };
    const left = round.order.filter((id, i) => ctx.room.players[id] && stillIn(cells, i));
    if (left.length <= 1 || round.moves >= turnsFor(round.order.length)) round.done = true;
    else round.turn = nextTurn(ctx, round.order, p, i => stillIn(cells, i));
    return round;
  });
}

export default {
  id: 'stack-wars',
  name: 'Stack Wars',
  color: 'coral',
  players: '2–4',
  blurb: 'Grow stacks, march them into battle, and topple the tall ones.',
  rules: [
    'Everyone starts with one stack of counters. On your turn, tap one of your stacks, then either tap it again to add a counter, or tap a square next to it to move all but one counter there.',
    'Moving onto someone else\'s stack is a fight: the bigger side wins and keeps the difference. A tie wipes both out.',
    `A stack that reaches ${TOPPLE} topples over, giving a counter to every square next to it, and they all become yours. Topples can chain.`,
    'Lose all your stacks and you\'re out. Last one standing wins, or whoever has the most counters when the turns run out.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="1.8" stroke-linejoin="round">
    ${[0, 1, 2, 3].map(k => svg`<ellipse cx="20" cy=${44 - k * 6} rx="11" ry="4.5" fill="#e05a4f" />`)}
    ${[0, 1].map(k => svg`<ellipse cx="46" cy=${44 - k * 6} rx="11" ry="4.5" fill="#4a8fd8" />`)}
    <path d="M28 14 q8 -8 16 4 M44 18 l0 -5 M44 18 l-5 -1" fill="none" stroke-linecap="round" />
  </g></svg>`,

  defaults: () => ({}),
  settingsView: ctx => html`<p class="note">${sizeFor(ctx.players.length)} × ${sizeFor(ctx.players.length)} board, ${turnsFor(ctx.players.length) / Math.max(1, ctx.players.length)} turns each at most.</p>`,
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 4 ? '4 players max' : null),

  start(ctx) {
    const order = ctx.players.map(p => p.id);
    const n = sizeFor(order.length);
    const cells = Array.from({ length: n * n }, () => ({ o: -1, h: 0 }));
    // Corners, opposite each other first.
    [0, n * n - 1, n - 1, n * (n - 1)].slice(0, order.length).forEach((i, p) => { cells[i] = { o: p, h: START }; });
    return { phase: 'play', round: { n, order, board: encode(cells), turn: order[Math.floor(Math.random() * order.length)] } };
  },

  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const cells = decode(round.board);
    if (round.order.filter((id, i) => ctx.room.players[id] && stillIn(cells, i)).length < 2) return { 'round/done': true };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn), i => stillIn(cells, i)) };
    return null;
  },

  view(ctx) {
    const { round, local } = ctx;
    const { n, order } = round;
    // The database drops empty lists, so fill in what's missing.
    const last = round.last && { fell: [], fight: null, ...round.last };
    const cells = decode(round.board);
    const p = order.indexOf(ctx.uid);
    const myTurn = round.turn === ctx.uid && !round.done;
    const pick = myTurn && cells[local.pick]?.o === p ? local.pick : undefined;
    const targets = pick !== undefined && cells[pick].h >= 2 ? around(pick, n, n) : [];

    const tap = i => {
      if (pick === undefined) {
        if (cells[i].o !== p) return toast('Tap one of your own stacks first.');
        local.pick = i; return ctx.rerender();
      }
      if (i !== pick && !targets.includes(i)) {
        if (cells[i].o === p) { local.pick = i; return ctx.rerender(); }
        local.pick = undefined; return ctx.rerender();
      }
      local.pick = undefined;
      act(ctx, pick, i).catch(() => toast("That didn't go through. Try again?"));
    };

    const layers = svg`
      ${(last?.fell || []).map(i => ring(i, n, last.p, 'sw-fell'))}
      ${targets.map(i => { const [x, y] = xy(i, n); return svg`<rect class="sw-target" x=${x * CELL + 1} y=${y * CELL + 1} width=${CELL - 2} height=${CELL - 2} rx="1.5" />`; })}
      ${cells.map((c, i) => (c.h ? stack(i, n, c) : nothing))}
      ${last ? ring(last.to, n, last.p) : nothing}
      ${pick !== undefined ? ring(pick, n, p, 'sw-pick') : nothing}`;
    if (last) cue(`sw:${round.id}:${last.n}`, last.fell.length ? 'score' : last.fight ? 'buzz' : 'pop');
    if (myTurn) cue(`sw:${round.id}:turn:${last?.n || 0}`, 'ding');

    const who = last && (order[last.p] === ctx.uid ? 'You' : ctx.room.players[order[last.p]]?.name || 'Someone');
    const them = last?.fight && (order[last.fight.them] === ctx.uid ? 'you' : ctx.room.players[order[last.fight.them]]?.name || 'someone');
    const news = !last ? `${myTurn ? 'You go' : `${ctx.room.players[round.turn]?.name || 'Someone'} goes`} first.`
      : last.fell.length ? `${who} toppled a stack!`
        : last.fight ? `${who} attacked ${them}: ${last.fight.a > last.fight.d ? 'and won!' : last.fight.a < last.fight.d ? 'and lost!' : 'both wiped out!'}`
          : last.from === last.to ? `${who} grew a stack.` : `${who} moved a stack.`;
    const left = turnsFor(order.length) - (round.moves || 0);
    const hint = pick === undefined ? 'Tap one of your stacks.' : targets.length ? 'Tap it again to grow it, or a glowing square to move.' : 'Tap it again to grow it.';
    const body = html`<div class="cr" style="--ratio: 1">
      ${scores(ctx, order, { turn: round.done ? null : round.turn, value: i => totalFor(cells, i), out: i => !stillIn(cells, i) })}
      ${round.done ? nothing : status(`${news} ${left <= order.length * 2 ? `(${left} turns left)` : ''}`, order.includes(ctx.uid) ? turnLine(myTurn, { mine: hint, waiting: `Waiting for ${ctx.room.players[round.turn]?.name || 'the next player'}…` }) : '')}
      ${grid({ w: n, h: n, layers, onTap: myTurn ? tap : null })}
    </div>`;
    if (!round.done) return body;
    return finish(ctx, order, { winners: leaders(order, i => totalFor(cells, i), id => ctx.room.players[id]), body });
  },
};

// A stack of counters seen from the side, with its height written on top.
function stack(i, n, c) {
  const [x, y] = xy(i, n);
  const cx = x * CELL + 5, base = y * CELL + 8.2;
  const shown = Math.min(c.h, 6);
  const step = shown > 4 ? 1 : 1.3;
  return svg`<g class="sw-stack">
    ${Array.from({ length: shown }, (_, k) => svg`<ellipse cx=${cx} cy=${base - k * step} rx="3.4" ry="1.35" fill=${inkOf(c.o)} />`)}
    <text class="sw-count" x=${cx} y=${base - (shown - 1) * step - 1.8}>${c.h}</text>
  </g>`;
}

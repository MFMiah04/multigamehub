import { runTransaction } from 'firebase/database';
import { html, nothing, button, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { inkOf, scores, status, turnLine, nextTurn, finish } from './grid-kit.js';

// Snakes and Ladders: take turns rolling and moving. Land on a ladder's foot to climb it, on a
// snake's head to slide down. First to 100 wins.
const TURN_MS = 12000; // time to roll before the dice roll themselves
const MOVE_MS = 1900; // how long a move takes to show, before the next player can roll
const LADDERS = { 3: 22, 8: 30, 28: 55, 46: 66, 58: 77, 71: 92, 80: 99 };
const SNAKES = { 17: 7, 37: 19, 54: 34, 64: 41, 87: 57, 93: 73, 98: 79 };
const jump = s => LADDERS[s] || SNAKES[s] || s;

// Square 1 is bottom left; the numbers snake back and forth up the board.
function centre(s) {
  const row = Math.floor((s - 1) / 10);
  const col = row % 2 ? 9 - ((s - 1) % 10) : (s - 1) % 10;
  return [col * 10 + 5, (9 - row) * 10 + 5];
}
const dice = () => 1 + Math.floor(Math.random() * 6);

// One player's roll and move, then it's the next player's turn.
function moveFor(ctx, round, id, roll) {
  const now = ctx.now();
  const from = round.pos[id];
  const land = Math.min(100, from + roll);
  const to = jump(land);
  round.pos = { ...round.pos, [id]: to };
  round.last = { by: id, from, land, to, roll, n: (round.last?.n || 0) + 1 };
  round.busyUntil = now + MOVE_MS;
  if (to >= 100) { round.done = true; round.winners = [id]; return round; }
  round.turn = nextTurn(ctx, round.order, round.order.indexOf(id));
  round.endsAt = round.busyUntil + TURN_MS;
  return round;
}

function rollDice(ctx) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid || ctx.now() < (round.busyUntil || 0)) return undefined;
    return moveFor(ctx, round, ctx.uid, dice());
  });
}

export default {
  id: 'snakes-ladders',
  name: 'Snakes and Ladders',
  twoLines: true,
  color: 'lime',
  players: '2–12',
  blurb: 'Take turns rolling. Climb ladders, dodge snakes, first to 100 wins.',
  rules: [
    'Take turns rolling the dice and moving your counter that many squares.',
    'Land at the foot of a ladder to climb it, or on a snake\'s head to slide down its tail.',
    `First to reach square 100 wins. If you don't roll within ${TURN_MS / 1000} seconds, the dice roll themselves.`,
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <path d="M12 50 L26 8 M20 52 L34 10 M14 44 l8 3 M17 35 l8 3 M20 26 l8 3 M23 17 l8 3" stroke="#a0703c" />
    <path d="M52 10 q-12 6 -2 14 q10 8 -2 14 q-8 5 -6 12" stroke="#3fae6a" stroke-width="4" />
    <circle cx="52" cy="10" r="3.5" fill="#3fae6a" />
  </g></svg>`,

  defaults: () => ({}),
  settingsView: () => html`<p class="note">No settings. Just roll!</p>`,
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

  start(ctx) {
    const order = ctx.players.map(p => p.id);
    const turn = order[Math.floor(Math.random() * order.length)];
    return { phase: 'play', round: { order, pos: Object.fromEntries(order.map(id => [id, 1])), turn, endsAt: ctx.now() + TURN_MS } };
  },

  // The host rolls for anyone who takes too long, and skips anyone who's left.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)) };
    if (ctx.now() < round.endsAt) return null;
    const next = moveFor(ctx, structuredClone(round), round.turn, dice());
    return { 'round/pos': next.pos, 'round/last': next.last, 'round/busyUntil': next.busyUntil, 'round/turn': next.turn,
      'round/endsAt': next.endsAt ?? null, ...(next.done ? { 'round/done': true, 'round/winners': next.winners } : {}) };
  },

  view(ctx) {
    const { round } = ctx;
    if (round.done && ctx.now() >= (round.busyUntil || 0)) return finish(ctx, round.order, { winners: round.winners || [], body: boardView(ctx, false) });
    return boardView(ctx, true);
  },
};

function boardView(ctx, live) {
  const { round, local } = ctx;
  const me = ctx.uid;
  const last = round.last;
  const now = ctx.now();
  const busy = now < (round.busyUntil || 0);
  const myTurn = live && round.turn === me && !round.done;
  const turnPlayer = ctx.room.players[round.turn];
  if (last) {
    cue(`sl:${round.id}:${last.n}`, 'pop');
    if (LADDERS[last.land]) setTimeout(() => cue(`sl:${round.id}:${last.n}:up`, 'score'), 800);
    if (SNAKES[last.land]) setTimeout(() => cue(`sl:${round.id}:${last.n}:down`, 'whoosh'), 800);
  }
  if (myTurn && !busy) cue(`sl:${round.id}:turn:${last?.n || 0}`, 'ding');
  // Redraw when the move finishes, so the Roll button wakes up straight away.
  if (busy) { clearTimeout(local.wake); local.wake = setTimeout(ctx.rerender, round.busyUntil - now + 30); }

  const who = id => (id === me ? 'You' : ctx.room.players[id]?.name || 'Someone');
  const news = !last ? `${myTurn ? 'You go' : `${turnPlayer?.name || 'Someone'} goes`} first.`
    : `${who(last.by)} rolled ${last.roll}${LADDERS[last.land] ? ' and climbed a ladder!' : SNAKES[last.land] ? ' and slid down a snake!' : '.'}`;
  const left = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const line = !live || !round.order.includes(me) ? ''
    : turnLine(myTurn && !busy, { mine: `Tap Roll! (${left})`, waiting: busy ? 'Moving…' : `Waiting for ${turnPlayer?.name || 'the next player'} to roll…` });

  const numbers = [];
  for (let s = 1; s <= 100; s++) {
    const [x, y] = centre(s);
    numbers.push(svg`<text class="sl-num" x=${x - 4.2} y=${y - 2.3}>${s}</text>`);
  }
  const lines = [];
  for (let i = 1; i < 10; i++) lines.push(`M${i * 10} 0 V100 M0 ${i * 10} H100`);

  return html`<div class="cr sl" style="--ratio: 1">
    ${scores(ctx, round.order, { turn: round.done ? null : round.turn, value: i => round.pos[round.order[i]] })}
    ${live ? status(news, line) : nothing}
    <svg class="cr-board sl-board" viewBox="-1 -1 102 102" role="img" aria-label="Snakes and ladders board">
      <rect class="cr-paper" x="0" y="0" width="100" height="100" rx="1" />
      ${[...Array(100).keys()].filter(i => (Math.floor(i / 10) + i) % 2).map(i => svg`<rect class="sl-tint" x=${(i % 10) * 10} y=${Math.floor(i / 10) * 10} width="10" height="10" />`)}
      <path class="cr-grid" d=${lines.join(' ')} />
      ${numbers}
      ${Object.entries(LADDERS).map(([a, b]) => ladder(+a, b))}
      ${Object.entries(SNAKES).map(([a, b], k) => snake(+a, b, k))}
      ${repeat(round.order.filter(id => ctx.room.players[id]), id => id, id => token(ctx, id, live))}
    </svg>
    ${myTurn ? button(busy ? 'Moving…' : 'Roll!', () => rollDice(ctx).catch(() => toast("That didn't go through. Try again?")), { disabled: busy }) : nothing}
  </div>`;
}

// A counter: the player's face in a ring of their ink. The one that just moved hops to the square it
// landed on, then climbs or slides to where it ends up. Counters sharing a square sit side by side.
function token(ctx, id, live) {
  const { round } = ctx;
  const k = round.order.indexOf(id);
  const off = [((k % 4) - 1.5) * 2.1, (Math.floor(k / 4) % 3 - 1) * 2.1];
  const at = s => centre(s).map((v, i) => v + off[i]);
  const p = ctx.room.players[id];
  const move = live && round.last?.by === id && ctx.now() < (round.busyUntil || 0) ? round.last : null;
  const [x, y] = at(round.pos[id]);
  const style = move
    ? `--x0: ${at(move.from)[0]}px; --y0: ${at(move.from)[1]}px; --x1: ${at(move.land)[0]}px; --y1: ${at(move.land)[1]}px; --x2: ${x}px; --y2: ${y}px`
    : `transform: translate(${x}px, ${y}px)`;
  const piece = svg`<g class="sl-token ${move ? 'sl-token--moving' : ''}" style=${style}>
    <circle r="3.4" fill="#fff" stroke=${inkOf(k)} stroke-width=${id === ctx.uid ? 1 : 0.7} />
    ${p ? svg`<svg x="-2.7" y="-3.1" width="5.4" height="5.85" viewBox="0 0 48 52">${avatar(p, 48)}</svg>` : nothing}
  </g>`;
  return move ? keyed(`${round.last.n}`, piece) : piece;
}

function ladder(a, b) {
  const [x1, y1] = centre(a);
  const [x2, y2] = centre(b);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / len * 1.8, (x2 - x1) / len * 1.8];
  const rungs = [];
  for (let d = 2.5; d < len - 1; d += 3.2) {
    const [px, py] = [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
    rungs.push(`M${px + nx} ${py + ny} L${px - nx} ${py - ny}`);
  }
  return svg`<g class="sl-ladder"><path d="M${x1 + nx} ${y1 + ny} L${x2 + nx} ${y2 + ny} M${x1 - nx} ${y1 - ny} L${x2 - nx} ${y2 - ny} ${rungs.join(' ')}" /></g>`;
}

const SNAKE_INKS = ['#3fae6a', '#9b5fd0', '#e0609f', '#1fa5a5', '#d99a1e', '#4a8fd8', '#e05a4f'];
function snake(a, b, k) {
  const [x1, y1] = centre(a);
  const [x2, y2] = centre(b);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / len, (x2 - x1) / len];
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const wave = Math.sin(t * Math.PI * Math.max(2, Math.round(len / 9))) * 2.6 * Math.sin(t * Math.PI);
    pts.push(`${x1 + (x2 - x1) * t + nx * wave} ${y1 + (y2 - y1) * t + ny * wave}`);
  }
  const ink = SNAKE_INKS[k % SNAKE_INKS.length];
  return svg`<g class="sl-snake">
    <path class="sl-snake__outline" d="M${pts.join(' L')}" />
    <path class="sl-snake__body" d="M${pts.join(' L')}" stroke=${ink} />
    <circle cx=${x1} cy=${y1} r="2.3" fill=${ink} stroke="#222" stroke-width="0.5" />
    <circle cx=${x1 - 0.8} cy=${y1 - 0.5} r="0.45" fill="#222" /><circle cx=${x1 + 0.8} cy=${y1 - 0.5} r="0.45" fill="#222" />
  </g>`;
}

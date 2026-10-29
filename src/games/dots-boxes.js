import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, action, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { roomRef } from '../room.js';
import { backToLobbyButton, endScreen, endTitle } from './common.js';
import { cue } from '../sound.js';

const GAP = 10; // board units between dots
// Each player's pen, in turn order.
const INKS = ['#e05a4f', '#4a8fd8', '#3fae6a', '#d99a1e'];

// Lines are "h_x_y" (from dot x,y to the right) and "v_x_y" (from dot x,y downwards).
// A box is named by its top-left dot, and is closed when all four of its sides are drawn.
const sidesOf = (x, y) => [`h_${x}_${y}`, `h_${x}_${y + 1}`, `v_${x}_${y}`, `v_${x + 1}_${y}`];
const lineCount = n => 2 * n * (n + 1);
// The boxes either side of a line.
function boxesBeside(line, n) {
  const [t, x, y] = line.split('_');
  const bx = +x, by = +y;
  const near = t === 'h' ? [[bx, by - 1], [bx, by]] : [[bx - 1, by], [bx, by]];
  return near.filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n);
}
const inkOf = (round, id) => INKS[Math.max(0, round.order.indexOf(id)) % INKS.length];
const scoreOf = (round, id) => Object.values(round.boxes || {}).filter(b => b === id).length;
// The next player still in the room after `id`.
function nextAfter(round, id, players) {
  const here = round.order.filter(p => players[p]);
  if (!here.length) return id;
  const start = round.order.indexOf(id);
  for (let i = 1; i <= round.order.length; i++) {
    const p = round.order[(start + i) % round.order.length];
    if (players[p]) return p;
  }
  return id;
}

// Draws a line. Close a box and it's yours, and you go again; otherwise it's the next player's turn.
// A transaction, so two taps can't both land on one turn.
function draw(ctx, line) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid || round.lines?.[line]) return undefined;
    round.lines = { ...round.lines, [line]: ctx.uid };
    const closed = boxesBeside(line, round.n).filter(([x, y]) => sidesOf(x, y).every(s => round.lines[s]));
    closed.forEach(([x, y]) => { round.boxes = { ...round.boxes, [`${x}_${y}`]: ctx.uid }; });
    round.last = { line, by: ctx.uid, boxes: closed.length, n: Object.keys(round.lines).length };
    if (Object.keys(round.lines).length >= lineCount(round.n)) round.done = true;
    else if (!closed.length) round.turn = nextAfter(round, ctx.uid, ctx.room.players);
    return round;
  });
}

export default {
  id: 'dots-boxes',
  name: 'Dots and Boxes',
  twoLines: true,
  color: 'peach',
  players: '2–4',
  blurb: 'Take turns joining dots. Close a box to claim it.',
  rules: [
    'Take turns drawing a line between two dots next to each other.',
    'Draw the fourth side of a box and it\'s yours. Then you go again.',
    'Careful not to draw the third side of a box, or the next player can take it.',
    'When every line is drawn, whoever has the most boxes wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round">
    <rect x="12" y="10" width="20" height="18" fill="#f7b3a8" stroke="none" />
    <path d="M12 10 h20 v18 h-20 z M32 10 h20 M52 28 v18 M12 28 v18" stroke="#e05a4f" />
    <path d="M32 28 h20 M32 46 h20" stroke="#4a8fd8" />
    <g fill="#222" stroke="none">${[10, 28, 46].map(y => [12, 32, 52].map(x => svg`<circle cx=${x} cy=${y} r="2.6" />`))}</g>
  </g></svg>`,

  defaults: () => ({ n: 5 }),

  settingsView(ctx, s, set) {
    return selectField('Board', s.n, [[3, '3 × 3 boxes (quick)'], [4, '4 × 4 boxes'], [5, '5 × 5 boxes'], [6, '6 × 6 boxes'], [7, '7 × 7 boxes (long)']], v => set({ n: +v }), !ctx.isHost);
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 4 ? '4 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    return { phase: 'play', round: { n: Math.min(7, Math.max(3, s.n || 5)), order, turn: order[Math.floor(Math.random() * order.length)] } };
  },

  // If it's someone's turn and they've left, skip them. If only one player is left, the game ends.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const here = round.order.filter(id => ctx.room.players[id]);
    if (here.length < 2) return { 'round/done': true, 'round/forfeit': true };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextAfter(round, round.turn, ctx.room.players) };
    return null;
  },

  view(ctx) {
    return ctx.round.done ? finished(ctx) : playing(ctx);
  },
};

// Everyone's boxes so far, with a pencil line under whoever's turn it is.
function scores(ctx, { turn } = {}) {
  const { round } = ctx;
  return html`<div class="db-scores">${round.order.map(id => {
    const p = ctx.room.players[id];
    return html`<div class="db-score ${id === turn ? 'db-score--turn' : ''} ${p ? '' : 'db-score--gone'}" style="--ink: ${inkOf(round, id)}">
      ${p ? avatar(p, 28) : nothing}<span class="db-score__name">${p ? (id === ctx.uid ? 'You' : p.name) : 'Left'}</span><b>${scoreOf(round, id)}</b>
    </div>`;
  })}</div>`;
}

// The board. `pick` makes it tappable: a tap draws the free line nearest to it.
function board(ctx, { pick, hover, onHover } = {}) {
  const { round } = ctx;
  const n = round.n;
  const span = n * GAP;
  const lines = round.lines || {};
  const all = [];
  for (let y = 0; y <= n; y++) for (let x = 0; x < n; x++) all.push(`h_${x}_${y}`);
  for (let y = 0; y < n; y++) for (let x = 0; x <= n; x++) all.push(`v_${x}_${y}`);
  const ends = line => { const [t, x, y] = line.split('_').map((v, i) => (i ? +v * GAP : v)); return t === 'h' ? [x, y, x + GAP, y] : [x, y, x, y + GAP]; };
  const path = line => { const [x1, y1, x2, y2] = ends(line); return `M${x1} ${y1} L${x2} ${y2}`; };

  // The free line closest to where the pointer is, if it's near enough to one.
  const nearest = e => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const vb = el.viewBox.baseVal;
    const px = vb.x + ((e.clientX - r.left) / r.width) * vb.width;
    const py = vb.y + ((e.clientY - r.top) / r.height) * vb.height;
    let best = null, dist = GAP * 0.45;
    for (const line of all) {
      if (lines[line]) continue;
      const [x1, y1, x2, y2] = ends(line);
      const cx = Math.max(Math.min(x1, x2), Math.min(px, Math.max(x1, x2)));
      const cy = Math.max(Math.min(y1, y2), Math.min(py, Math.max(y1, y2)));
      const d = Math.hypot(px - cx, py - cy);
      if (d < dist) { dist = d; best = line; }
    }
    return best;
  };

  const last = round.last?.line;
  return html`<svg class="db-board ${pick ? 'db-board--mine' : ''}" viewBox="${-5} ${-5} ${span + 10} ${span + 10}" role="img" aria-label="The board"
    @click=${pick ? e => { const line = nearest(e); if (line) pick(line); } : null}
    @pointermove=${onHover ? e => onHover(nearest(e)) : null} @pointerleave=${onHover ? () => onHover(null) : null}>
    ${Object.entries(round.boxes || {}).map(([b, id]) => {
      const [x, y] = b.split('_').map(Number);
      const p = ctx.room.players[id];
      return svg`<rect class="db-box" x=${x * GAP + 0.6} y=${y * GAP + 0.6} width=${GAP - 1.2} height=${GAP - 1.2} rx="1" fill=${inkOf(round, id)} />
        ${p ? svg`<svg class="db-box__who" x=${x * GAP + 1.6} y=${y * GAP + 1.4} width=${GAP - 3.2} height=${GAP - 2.8} viewBox="0 0 48 52">${avatar(p, 48)}</svg>` : nothing}`;
    })}
    ${pick ? all.filter(l => !lines[l]).map(l => svg`<path class="db-guide" d=${path(l)} />`) : nothing}
    ${hover && !lines[hover] ? svg`<path class="db-line db-line--ghost" d=${path(hover)} stroke=${inkOf(round, ctx.uid)} />` : nothing}
    ${Object.entries(lines).map(([l, id]) => svg`<path class="db-line ${l === last ? 'db-line--last' : ''}" d=${path(l)} stroke=${inkOf(round, id)} />`)}
    ${[...Array(n + 1).keys()].map(y => [...Array(n + 1).keys()].map(x => svg`<circle class="db-dot" cx=${x * GAP} cy=${y * GAP} r="1.1" />`))}
  </svg>`;
}

function playing(ctx) {
  const { round, local } = ctx;
  const myTurn = round.turn === ctx.uid;
  const turnPlayer = ctx.room.players[round.turn];
  const last = round.last;
  const lastBy = last && ctx.room.players[last.by];
  const playing = round.order.includes(ctx.uid);

  if (last) cue(`db:${round.id}:${last.n}`, last.boxes ? 'score' : 'pop');
  if (myTurn) cue(`db:${round.id}:turn:${last?.n || 0}`, 'ding');

  const news = !last ? `${myTurn ? 'You go' : `${turnPlayer?.name || 'Someone'} goes`} first.`
    : last.boxes ? `${last.by === ctx.uid ? 'You' : lastBy?.name || 'Someone'} closed ${last.boxes === 2 ? 'two boxes' : 'a box'} and ${last.by === ctx.uid ? 'go' : 'goes'} again!`
      : `${myTurn ? 'Your turn.' : `${turnPlayer?.name || 'Someone'}'s turn.`}`;
  const hint = myTurn ? 'Tap between two dots to draw a line.' : playing ? `Waiting for ${turnPlayer?.name || 'the next player'}…` : '';

  return html`<div class="db" style="--n: ${round.n}">
    ${scores(ctx, { turn: round.turn })}
    <p class="db-status center"><b>${news}</b><br>${hint}</p>
    ${board(ctx, myTurn ? {
      pick: line => { local.hover = null; draw(ctx, line).catch(() => toast("That line didn't go through. Try again?")); },
      hover: local.hover,
      onHover: line => { if (line !== local.hover) { local.hover = line; ctx.rerender(); } },
    } : {})}
  </div>`;
}

function finished(ctx) {
  const { round } = ctx;
  const counts = round.order.map(id => scoreOf(round, id));
  const best = Math.max(...counts);
  const winners = round.order.filter((id, i) => counts[i] === best && ctx.room.players[id]);
  const me = round.order.includes(ctx.uid);
  const win = me ? winners.includes(ctx.uid) : null;
  const names = winners.map(id => (id === ctx.uid ? 'You' : ctx.room.players[id]?.name || 'Someone'));
  const headline = round.forfeit ? 'Everyone else left.' : winners.length > 1 ? `A tie: ${names.join(' & ')}!` : `${names[0]} ${names[0] === 'You' ? 'win' : 'wins'}!`;
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: winners.length > 1 ? 'You tied for first!' : 'You win!', watching: headline }),
      note: `${best} box${best === 1 ? '' : 'es'} ${winners.length > 1 ? 'each' : ''}`.trim() })}
    <div class="db" style="--n: ${round.n}">
      ${scores(ctx)}
      ${board(ctx)}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

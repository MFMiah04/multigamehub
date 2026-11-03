import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, timer, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { CELL, xy, at, inkOf, scores, status, turnLine, nextTurn, ring, finish } from './grid-kit.js';

// Maze Race: everyone starts round the edge and races for the middle square. On your turn, either
// take a step or put up a wall (a line two squares long between squares). A wall can never cut
// anyone off from the middle completely.
const sizeFor = players => (players <= 4 ? 9 : 11);

// Walls sit where grid lines cross: "h_x_y" lies along line y, across columns x-1 and x;
// "v_x_y" lies along line x, across rows y-1 and y. (x and y run from 1 to n-1.)
const parse = w => { const [t, x, y] = w.split('_'); return [t, +x, +y]; };
const clash = (a, b) => {
  const [ta, xa, ya] = parse(a);
  const [tb, xb, yb] = parse(b);
  if (xa === xb && ya === yb) return true; // same spot, or crossing
  if (ta !== tb) return false;
  return ta === 'h' ? ya === yb && Math.abs(xa - xb) === 1 : xa === xb && Math.abs(ya - yb) === 1;
};
// The pairs of squares a wall separates.
function cuts(w, n) {
  const [t, x, y] = parse(w);
  return t === 'h'
    ? [[at(x - 1, y - 1, n, n), at(x - 1, y, n, n)], [at(x, y - 1, n, n), at(x, y, n, n)]]
    : [[at(x - 1, y - 1, n, n), at(x, y - 1, n, n)], [at(x - 1, y, n, n), at(x, y, n, n)]];
}
const blockedSet = (walls, n) => new Set(walls.flatMap(w => cuts(w, n)).flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));
function steps(i, n, blocked) {
  const [x, y] = xy(i, n);
  return [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => at(x + dx, y + dy, n, n)).filter(j => j >= 0 && !blocked.has(`${i}:${j}`));
}
// How many steps each square is from the middle, going round walls (missing if it can't get there).
function distances(walls, n) {
  const blocked = blockedSet(walls, n);
  const goal = (n * n - 1) / 2;
  const far = new Map([[goal, 0]]);
  const queue = [goal];
  while (queue.length) {
    const i = queue.shift();
    steps(i, n, blocked).forEach(j => { if (!far.has(j)) { far.set(j, far.get(i) + 1); queue.push(j); } });
  }
  return far;
}
// Whether every player can still reach the middle.
const allCanReach = (walls, n, from) => { const far = distances(walls, n); return from.every(i => far.has(i)); };
// Whether a new wall is allowed on top of the ones already there.
const wallOk = (w, walls, n, from) => !walls.some(o => clash(o, w)) && allCanReach([...walls, w], n, from);

const standing = (ctx, round = ctx.round) => round.order.filter(id => ctx.room.players[id]);

// Your turn: a step (to a square) or a wall. A transaction, so turns can't cross.
function act(ctx, { m, w }) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.done || round.turn !== ctx.uid) return undefined;
    const { n } = round;
    const walls = round.walls || [];
    if (w !== undefined) {
      if (!wallOk(w, walls, n, standing(ctx, round).map(id => round.pos[id]))) return undefined;
      round.walls = [...walls, w];
    } else {
      if (!steps(round.pos[ctx.uid], n, blockedSet(walls, n)).includes(m)) return undefined;
      round.pos = { ...round.pos, [ctx.uid]: m };
    }
    round.last = { by: ctx.uid, ...(w !== undefined ? { w } : { m }), n: (round.last?.n || 0) + 1 };
    if (round.pos[ctx.uid] === (n * n - 1) / 2) { round.done = true; round.winners = [ctx.uid]; return round; }
    round.turn = nextTurn(ctx, round.order, round.order.indexOf(ctx.uid));
    round.endsAt = ctx.now() + round.secs * 1000;
    return round;
  });
}

export default {
  id: 'maze-race',
  name: 'Maze Race',
  color: 'gold',
  players: '2–8',
  blurb: 'Race to the middle. On your turn, take a step or put a wall in someone\'s way.',
  rules: [
    'Everyone starts on the edge. First to reach the star in the middle wins.',
    'On your turn, either take one step to a square next to you, or put up a wall.',
    'A wall is a line two squares long between squares. Nobody can walk through it. Put as many up as you like.',
    'A wall can\'t cross another wall, and can\'t cut anyone off from the middle completely.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <path d="M6 6 h52 v44 h-52 z" stroke-width="1.4" stroke="#9db7d6" />
    <path d="M32 22 l2.4 4.8 5.3 0.8 -3.8 3.7 0.9 5.3 -4.8 -2.5 -4.8 2.5 0.9 -5.3 -3.8 -3.7 5.3 -0.8 z" fill="#ffd04d" />
    <path d="M18 14 v18 M40 40 h14" stroke-width="3.4" />
    <circle cx="11" cy="45" r="3.6" fill="#e05a4f" /><circle cx="53" cy="11" r="3.6" fill="#4a8fd8" />
  </g></svg>`,

  defaults: () => ({ secs: 30 }),
  settingsView: (ctx, s, set) => selectField('Time for each turn', s.secs, [[15, '15 seconds'], [30, '30 seconds'], [60, '1 minute']], v => set({ secs: +v }), !ctx.isHost),
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const n = sizeFor(order.length);
    // Spread everyone evenly round the edge.
    const edge = [];
    for (let x = 0; x < n - 1; x++) edge.push(x);
    for (let y = 0; y < n - 1; y++) edge.push(y * n + n - 1);
    for (let x = n - 1; x > 0; x--) edge.push((n - 1) * n + x);
    for (let y = n - 1; y > 0; y--) edge.push(y * n);
    const offset = Math.floor(Math.random() * edge.length);
    const pos = Object.fromEntries(order.map((id, k) => [id, edge[(offset + Math.floor((k * edge.length) / order.length)) % edge.length]]));
    const secs = s.secs || 30;
    return { phase: 'play', round: { n, order, secs, pos, turn: order[Math.floor(Math.random() * order.length)], endsAt: ctx.now() + secs * 1000 } };
  },

  // Skip anyone who's left, or who runs out of time. If only one player is left, they win.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const here = standing(ctx);
    if (here.length < 2) return { 'round/done': true, 'round/winners': here };
    if (!ctx.room.players[round.turn] || ctx.now() >= round.endsAt) {
      return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)), 'round/endsAt': ctx.now() + round.secs * 1000 };
    }
    return null;
  },

  view(ctx) {
    const { round } = ctx;
    if (round.done) return finish(ctx, round.order, { winners: round.winners || [], body: field(ctx, false) });
    return field(ctx, true);
  },
};

// Where a tap lands: the nearest wall spot (for walls) and the square (for steps).
function wallNear(px, py, n) {
  const ix = Math.min(n - 1, Math.max(1, Math.round(px)));
  const iy = Math.min(n - 1, Math.max(1, Math.round(py)));
  return Math.abs(px - ix) < Math.abs(py - iy) ? `v_${ix}_${iy}` : `h_${ix}_${iy}`;
}
function wallPath(w) {
  const [t, x, y] = parse(w);
  return t === 'h' ? `M${(x - 1) * CELL} ${y * CELL} H${(x + 1) * CELL}` : `M${x * CELL} ${(y - 1) * CELL} V${(y + 1) * CELL}`;
}

function field(ctx, live) {
  const { round, local } = ctx;
  const { n, order, last } = round;
  const me = ctx.uid;
  const walls = round.walls || [];
  const myTurn = live && round.turn === me;
  const mine = round.pos[me];
  // Forget a half-made choice once the turn moves on.
  if (local.n !== (last?.n || 0)) Object.assign(local, { n: last?.n || 0, w: undefined, mode: local.mode || 'step' });
  const blocked = blockedSet(walls, n);
  const from = standing(ctx).map(id => round.pos[id]);
  const go = choice => { local.w = undefined; local.hover = null; act(ctx, choice).catch(() => toast("That didn't go through. Try again?")); };

  const point = e => {
    const el = e.currentTarget, r = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
    return [(vb.x + ((e.clientX - r.left) / r.width) * vb.width) / CELL, (vb.y + ((e.clientY - r.top) / r.height) * vb.height) / CELL];
  };
  // On a computer, the wall you'd place follows the mouse (grey if it can go there, red if not).
  const hover = e => {
    if (!myTurn || local.mode !== 'wall' || e.pointerType === 'touch') return;
    const w = wallNear(...point(e), n);
    if (w !== local.hover) { local.hover = w; ctx.rerender(); }
  };
  const unhover = () => { if (local.hover) { local.hover = null; ctx.rerender(); } };
  // A step happens straight away. A wall needs a second tap (or the button) to go up, so a slip of
  // the finger doesn't waste your turn; with a mouse, the hover shows it first, so one click does it.
  const tap = e => {
    if (!myTurn) return;
    const [px, py] = point(e);
    if (local.mode === 'wall') {
      const w = wallNear(px, py, n);
      if (!wallOk(w, walls, n, from)) return toast(walls.some(o => clash(o, w)) ? 'That crosses another wall.' : 'That would cut someone off from the middle.');
      if (local.w === w || (e.pointerType === 'mouse' && local.hover === w)) return go({ w });
      local.w = w;
      return ctx.rerender();
    }
    const i = at(Math.floor(px), Math.floor(py), n, n);
    if (i < 0 || !steps(mine, n, blocked).includes(i)) return toast('Step to a glowing square (not through a wall).');
    go({ m: i });
  };

  const goal = (n * n - 1) / 2;
  const [gx, gy] = xy(goal, n).map(v => v * CELL + 5);
  const lines = [];
  for (let i = 1; i < n; i++) lines.push(`M${i * CELL} 0 V${n * CELL} M0 ${i * CELL} H${n * CELL}`);
  const options = myTurn && local.mode === 'step' ? steps(mine, n, blocked) : [];
  const layers = svg`
    <path class="mr-star" d="M${gx} ${gy - 4} l1.2 2.4 2.7 0.4 -1.9 1.9 0.4 2.6 -2.4 -1.3 -2.4 1.3 0.4 -2.6 -1.9 -1.9 2.7 -0.4 z" />
    ${options.map(i => { const [x, y] = xy(i, n); return svg`<rect class="mr-option" x=${x * CELL + 1} y=${y * CELL + 1} width=${CELL - 2} height=${CELL - 2} rx="2" />`; })}
    ${last?.m !== undefined ? ring(last.m, n, order.indexOf(last.by)) : nothing}
    ${walls.map(w => svg`<path class="mr-wall ${w === last?.w ? 'mr-wall--new' : ''}" d=${wallPath(w)} />`)}
    ${myTurn && local.mode === 'wall' && local.hover && local.hover !== local.w
      ? svg`<path class="mr-wall mr-wall--hover ${wallOk(local.hover, walls, n, from) ? '' : 'mr-wall--bad'}" d=${wallPath(local.hover)} />` : nothing}
    ${myTurn && local.w ? svg`<path class="mr-wall mr-wall--plan" d=${wallPath(local.w)} />` : nothing}
    ${repeat(order.filter(id => ctx.room.players[id]), id => id, id => {
      const [x, y] = xy(round.pos[id], n).map(v => v * CELL + 5);
      const k = order.indexOf(id);
      const p = ctx.room.players[id];
      const share = order.filter(o => ctx.room.players[o] && round.pos[o] === round.pos[id]);
      const nudge = share.length > 1 ? (share.indexOf(id) - (share.length - 1) / 2) * 2.4 : 0;
      return svg`<g class="sb-player" style="transform: translate(${x + nudge}px, ${y}px)">
        <circle r="4.2" fill="#fff" stroke=${inkOf(k)} stroke-width=${id === me ? 1.1 : 0.7} />
        ${p ? svg`<svg x="-3.3" y="-3.9" width="6.6" height="7.15" viewBox="0 0 48 52">${avatar(p, 48)}</svg>` : nothing}
      </g>`;
    })}`;

  if (last) cue(`mr:${round.id}:${last.n}`, last.w ? 'buzz' : 'pop');
  if (myTurn) cue(`mr:${round.id}:turn:${last?.n || 0}`, 'ding');

  const name = id => (id === me ? 'You' : ctx.room.players[id]?.name || 'Someone');
  const turnPlayer = ctx.room.players[round.turn];
  const news = !last ? `${myTurn ? 'You go' : `${turnPlayer?.name || 'Someone'} goes`} first.` : `${name(last.by)} ${last.w ? 'put up a wall!' : 'took a step.'}`;
  const hint = local.mode === 'wall' ? (local.w ? 'Tap it again (or Place wall) to put it up.' : 'Tap a line between squares.') : 'Tap a glowing square to step.';
  const line = !live || !order.includes(me) ? '' : turnLine(myTurn, { mine: hint, waiting: `Waiting for ${turnPlayer?.name || 'the next player'}…` });

  return html`<div class="cr mr" style="--ratio: 1">
    ${scores(ctx, order, { turn: live ? round.turn : null, value: () => '' })}
    ${live ? status(news, line) : nothing}
    ${live ? timer(round.endsAt, 5) : nothing}
    <svg class="cr-board mr-board ${myTurn ? 'cr-board--mine turn-glow' : ''}" viewBox="-1 -1 ${n * CELL + 2} ${n * CELL + 2}" role="img" aria-label="The maze" @click=${tap} @pointermove=${hover} @pointerleave=${unhover}>
      <rect class="cr-paper" x="0" y="0" width=${n * CELL} height=${n * CELL} rx="1" />
      <path class="cr-grid" d=${lines.join(' ')} />
      ${layers}
    </svg>
    ${myTurn ? html`<div class="sb-controls">
      <div class="sb-throws">
        <button class="bg-fuse wobble ${local.mode === 'step' ? 'bg-fuse--on' : ''}" @click=${() => { Object.assign(local, { mode: 'step', w: undefined }); ctx.rerender(); }}>Step</button>
        <button class="bg-fuse wobble ${local.mode === 'wall' ? 'bg-fuse--on' : ''}" @click=${() => { local.mode = 'wall'; ctx.rerender(); }}>Wall</button>
      </div>
      ${local.w ? button('Place wall', () => go({ w: local.w }), { kind: 'mint' }) : nothing}
    </div>` : nothing}
  </div>`;
}

import { html, nothing, button, selectField, timer, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { cue } from '../sound.js';
import { CELL, xy, at, inkOf, scores, status, finish } from './grid-kit.js';

// Maze Race: everyone starts round the edge and races for the middle square. Each round, everyone
// secretly picks one thing: a step, or a wall (a line two squares long between squares). Then it
// all happens at once. A wall can never cut anyone off from the middle completely.
const WALLS_EACH = 4;
const SHOW_MS = 1400;
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
// Whether every player can still reach the middle.
function allCanReach(walls, n, from) {
  const blocked = blockedSet(walls, n);
  const goal = (n * n - 1) / 2;
  const seen = new Set([goal]);
  const queue = [goal];
  while (queue.length) steps(queue.shift(), n, blocked).forEach(j => { if (!seen.has(j)) { seen.add(j); queue.push(j); } });
  return from.every(i => seen.has(i));
}
// Whether a new wall is allowed on top of the ones already there.
const wallOk = (w, walls, n, from) => !walls.some(o => clash(o, w)) && allCanReach([...walls, w], n, from);

const standing = ctx => ctx.round.order.filter(id => ctx.room.players[id]);

export default {
  id: 'maze-race',
  name: 'Maze Race',
  color: 'gold',
  players: '2–8',
  blurb: 'Race to the middle. Each round, step or drop a wall in someone\'s way. Everyone at once.',
  rules: [
    'Everyone starts on the edge. First to reach the star in the middle wins.',
    `Each round, everyone secretly picks one thing: a step to a square next to them, or a wall (you have ${WALLS_EACH}). Then it all happens at once.`,
    'A wall is a line two squares long between squares. Nobody can walk through it. Walls go up before anyone steps, so you can block someone\'s step.',
    'A wall can\'t cut anyone off from the middle completely, and can\'t cross another wall. If it would, it doesn\'t go up and you keep it.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <path d="M6 6 h52 v44 h-52 z" stroke-width="1.4" stroke="#9db7d6" />
    <path d="M32 22 l2.4 4.8 5.3 0.8 -3.8 3.7 0.9 5.3 -4.8 -2.5 -4.8 2.5 0.9 -5.3 -3.8 -3.7 5.3 -0.8 z" fill="#ffd04d" />
    <path d="M18 14 v18 M40 40 h14" stroke-width="3.4" />
    <circle cx="11" cy="45" r="3.6" fill="#e05a4f" /><circle cx="53" cy="11" r="3.6" fill="#4a8fd8" />
  </g></svg>`,

  defaults: () => ({ secs: 15 }),
  settingsView: (ctx, s, set) => selectField('Time to plan each round', s.secs, [[10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds']], v => set({ secs: +v }), !ctx.isHost),
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
    return {
      phase: 'play',
      round: { n, order, secs: s.secs || 15, pos, left: Object.fromEntries(order.map(id => [id, WALLS_EACH])), no: 1, stage: 'plan', endsAt: ctx.now() + (s.secs || 15) * 1000 },
    };
  },

  // When everyone's locked in (or time's up): walls go up first, in a random order, skipping any
  // that clash or would trap someone; then everyone steps.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const now = ctx.now();
    const ids = standing(ctx);
    const { n } = round;
    if (round.stage === 'plan') {
      const plans = round.plans || {};
      if (now < round.endsAt && !ids.every(id => plans[id]?.ready)) return null;
      const walls = [...(round.walls || [])];
      const left = { ...round.left };
      const built = [];
      const from = ids.map(id => round.pos[id]);
      ids.filter(id => plans[id]?.w && left[id] > 0).sort(() => Math.random() - 0.5).forEach(id => {
        if (wallOk(plans[id].w, walls, n, from)) { walls.push(plans[id].w); left[id] -= 1; built.push({ by: id, w: plans[id].w }); }
      });
      const blocked = blockedSet(walls, n);
      const pos = { ...round.pos };
      const stepped = [];
      ids.forEach(id => {
        const to = plans[id]?.m;
        if (to === undefined || to === pos[id]) return;
        if (steps(round.pos[id], n, blocked).includes(to)) { pos[id] = to; stepped.push(id); }
      });
      const goal = (n * n - 1) / 2;
      const winners = ids.filter(id => pos[id] === goal);
      return { 'round/stage': 'show', 'round/plans': null, 'round/walls': walls, 'round/left': left, 'round/pos': pos, 'round/built': built,
        'round/stepped': stepped, 'round/showUntil': now + SHOW_MS, ...(winners.length ? { 'round/winners': winners } : {}) };
    }
    if (now < round.showUntil) return null;
    if (round.winners?.length || ids.length < 2) return { 'round/done': true, 'round/winners': round.winners?.length ? round.winners : ids };
    return { 'round/stage': 'plan', 'round/no': round.no + 1, 'round/built': null, 'round/stepped': null, 'round/endsAt': now + round.secs * 1000 };
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
  const { n, order } = round;
  const me = ctx.uid;
  const walls = round.walls || [];
  const playing = order.includes(me) && ctx.room.players[me];
  const planning = live && playing && round.stage === 'plan';
  const ready = !!round.plans?.[me]?.ready;
  const mine = round.pos[me];
  const wallsLeft = round.left?.[me] || 0;
  if (local.no !== round.no) Object.assign(local, { no: round.no, m: undefined, w: undefined, mode: 'step' });
  const save = () => ctx.update({ [`round/plans/${me}`]: { ...(local.m !== undefined ? { m: local.m } : {}), ...(local.w ? { w: local.w } : {}), ready: false } }).catch(() => {});
  const blocked = blockedSet(walls, n);
  const from = standing(ctx).map(id => round.pos[id]);

  const tap = e => {
    if (!planning || ready) return;
    const el = e.currentTarget, r = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
    const px = (vb.x + ((e.clientX - r.left) / r.width) * vb.width) / CELL;
    const py = (vb.y + ((e.clientY - r.top) / r.height) * vb.height) / CELL;
    if (local.mode === 'wall') {
      if (!wallsLeft) return toast('You\'re out of walls.');
      const w = wallNear(px, py, n);
      if (!wallOk(w, walls, n, from)) return toast(walls.some(o => clash(o, w)) ? 'That crosses another wall.' : 'That would cut someone off from the middle.');
      Object.assign(local, { w, m: undefined });
    } else {
      const i = at(Math.floor(px), Math.floor(py), n, n);
      if (i < 0 || !steps(mine, n, blocked).includes(i)) return toast('Step to a square next to you (not through a wall).');
      Object.assign(local, { m: i, w: undefined });
    }
    save();
    ctx.rerender();
  };

  const goal = (n * n - 1) / 2;
  const [gx, gy] = xy(goal, n).map(v => v * CELL + 5);
  const lines = [];
  for (let i = 1; i < n; i++) lines.push(`M${i * CELL} 0 V${n * CELL} M0 ${i * CELL} H${n * CELL}`);
  const built = new Set((round.built || []).map(b => b.w));
  const options = planning && !ready && local.mode === 'step' ? steps(mine, n, blocked) : [];
  const layers = svg`
    <path class="mr-star" d="M${gx} ${gy - 4} l1.2 2.4 2.7 0.4 -1.9 1.9 0.4 2.6 -2.4 -1.3 -2.4 1.3 0.4 -2.6 -1.9 -1.9 2.7 -0.4 z" />
    ${options.map(i => { const [x, y] = xy(i, n); return svg`<rect class="mr-option ${local.m === i ? 'mr-option--on' : ''}" x=${x * CELL + 1} y=${y * CELL + 1} width=${CELL - 2} height=${CELL - 2} rx="2" />`; })}
    ${walls.map(w => svg`<path class="mr-wall ${built.has(w) ? 'mr-wall--new' : ''}" d=${wallPath(w)} />`)}
    ${planning && !ready && local.w ? svg`<path class="mr-wall mr-wall--plan" d=${wallPath(local.w)} />` : nothing}
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

  if (round.stage === 'show' && live) cue(`mr:${round.id}:${round.no}:show`, (round.built || []).length ? 'buzz' : 'pop');
  else if (planning) cue(`mr:${round.id}:${round.no}:plan`, 'ding');

  const lockedIn = standing(ctx).filter(id => round.plans?.[id]?.ready).length;
  const name = id => (id === me ? 'You' : ctx.room.players[id]?.name || 'Someone');
  const news = round.stage === 'show' && live
    ? ((round.built || []).length ? `${(round.built || []).map(b => name(b.by)).join(', ')} put up ${(round.built || []).length === 1 ? 'a wall' : 'walls'}!` : 'Everyone moves…')
    : `Round ${round.no}`;
  const line = !playing || !live ? ''
    : round.stage === 'show' ? 'Here we go…'
      : ready ? `Locked in. Waiting for ${standing(ctx).length - lockedIn} more…`
        : html`<span class="turn-line turn-line--mine"><b>Your move!</b> ${local.mode === 'wall' ? 'Tap a line between squares.' : 'Tap a glowing square.'}</span>`;

  return html`<div class="cr mr" style="--ratio: 1">
    ${scores(ctx, order, { value: i => `${'▮'.repeat(round.left?.[order[i]] || 0)}` || '0' })}
    ${live ? status(news, line) : nothing}
    ${live && round.stage === 'plan' ? timer(round.endsAt, 5) : nothing}
    <svg class="cr-board mr-board ${planning && !ready ? 'cr-board--mine turn-glow' : ''}" viewBox="-1 -1 ${n * CELL + 2} ${n * CELL + 2}" role="img" aria-label="The maze" @click=${tap}>
      <rect class="cr-paper" x="0" y="0" width=${n * CELL} height=${n * CELL} rx="1" />
      <path class="cr-grid" d=${lines.join(' ')} />
      ${layers}
    </svg>
    ${planning ? html`<div class="sb-controls">
      <div class="sb-throws">
        <button class="bg-fuse wobble ${local.mode === 'step' ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.mode = 'step'; ctx.rerender(); }}>Step</button>
        <button class="bg-fuse wobble ${local.mode === 'wall' ? 'bg-fuse--on' : ''}" ?disabled=${ready || !wallsLeft} @click=${() => { local.mode = 'wall'; ctx.rerender(); }}>Wall (${wallsLeft} left)</button>
      </div>
      ${ready ? button('Change my move', () => ctx.update({ [`round/plans/${me}/ready`]: false }), { kind: 'white', small: true })
        : button(local.m === undefined && !local.w ? 'Stay put' : 'Lock it in', () => ctx.update({ [`round/plans/${me}`]: { ...(local.m !== undefined ? { m: local.m } : {}), ...(local.w ? { w: local.w } : {}), ready: true } }), { kind: 'mint' })}
    </div>` : nothing}
  </div>`;
}

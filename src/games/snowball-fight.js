import { html, nothing, button, selectField, timer, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { keyed } from 'lit-html/directives/keyed.js';
import { cue } from '../sound.js';
import { CELL, DIRS, xy, at, around, inkOf, scores, status, grid, finish, leaders } from './grid-kit.js';

// Snowball Fight: everyone plans at the same time, in secret: a step to take (or stay put) and a
// direction to throw. Then all the moves happen at once and the snowballs fly. Three hits and you're out.
const HP = 3;
const SHOW_MS = 2600; // how long each round's moves and throws are shown
const MAX_ROUNDS = 20;
const sizeFor = players => (players <= 4 ? 7 : 9);
const ARROWS = ['→', '←', '↓', '↑']; // in the same order as DIRS: right, left, down, up
const ARROW_NAMES = ['right', 'left', 'down', 'up'];

const alive = (round, id) => (round.hp?.[id] || 0) > 0;
const standing = ctx => ctx.round.order.filter(id => alive(ctx.round, id) && ctx.room.players[id]);

// Where everyone ends up. Two people heading for the same square, or swapping places, both stay put,
// and so does anyone walking into someone who isn't moving.
function settle(round, plans, ids) {
  const target = Object.fromEntries(ids.map(id => {
    const m = plans[id]?.m;
    const ok = m === round.pos[id] || (around(round.pos[id], round.n, round.n).includes(m) && round.walls[m] !== '1');
    return [id, ok ? m : round.pos[id]];
  }));
  for (let changed = true, guard = 0; changed && guard < 30; guard++) {
    changed = false;
    for (const a of ids) {
      if (target[a] === round.pos[a]) continue;
      const blocked = ids.some(b => b !== a && (target[b] === target[a] || (target[b] === round.pos[a] && round.pos[b] === target[a]) || (round.pos[b] === target[a] && target[b] === round.pos[b])));
      if (blocked) { target[a] = round.pos[a]; changed = true; }
    }
  }
  return target;
}

// A snowball's flight from a square in a direction: it stops at a wall, the edge, or the first person.
function flight(round, from, dir, where, thrower) {
  const [x, y] = xy(from, round.n);
  const [dx, dy] = DIRS[dir];
  for (let k = 1; ; k++) {
    const j = at(x + dx * k, y + dy * k, round.n, round.n);
    if (j < 0 || round.walls[j] === '1') return { to: at(x + dx * (k - 1), y + dy * (k - 1), round.n, round.n), hit: null };
    const victim = Object.keys(where).find(id => id !== thrower && where[id] === j);
    if (victim) return { to: j, hit: victim };
  }
}

export default {
  id: 'snowball-fight',
  name: 'Snowball Fight',
  color: 'blue',
  players: '2–8',
  blurb: 'Everyone moves at once, in secret. Dodge and throw. Three hits and you\'re out.',
  rules: [
    'Each round, everyone secretly picks a square to step to (or stays put) and a direction to throw.',
    'Then everyone moves at once and the snowballs fly in straight lines until they hit someone, a snow wall or the edge.',
    'Two people stepping into the same square both stay where they were.',
    `${HP} hits and you're out. Last one standing wins.`,
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <circle cx="14" cy="38" r="8" fill="#fff" /><circle cx="14" cy="24" r="5.5" fill="#fff" />
    <circle cx="46" cy="22" r="4.5" fill="#eaf4ff" /><path d="M24 30 q10 -10 18 -8" stroke-dasharray="3 3" />
    <path d="M52 38 l4 -4 M54 44 l6 0 M50 46 l3 5" stroke="#4a8fd8" />
  </g></svg>`,

  defaults: () => ({ secs: 20 }),
  settingsView: (ctx, s, set) => selectField('Time to plan each round', s.secs, [[10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds']], v => set({ secs: +v }), !ctx.isHost),
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const n = sizeFor(order.length);
    // Spread everyone round the edge.
    const edge = [];
    for (let x = 0; x < n - 1; x++) edge.push(x);
    for (let y = 0; y < n - 1; y++) edge.push(y * n + n - 1);
    for (let x = n - 1; x > 0; x--) edge.push((n - 1) * n + x);
    for (let y = n - 1; y > 0; y--) edge.push(y * n);
    const offset = Math.floor(Math.random() * edge.length);
    const pos = Object.fromEntries(order.map((id, k) => [id, edge[(offset + Math.floor((k * edge.length) / order.length)) % edge.length]]));
    // A few snow walls to hide behind, never on or next to where someone starts.
    const near = new Set(Object.values(pos).flatMap(i => [i, ...around(i, n, n)]));
    const walls = Array(n * n).fill('0');
    const spots = [...Array(n * n).keys()].filter(i => !near.has(i)).sort(() => Math.random() - 0.5);
    spots.slice(0, Math.round(n * n * 0.1)).forEach(i => { walls[i] = '1'; });
    return {
      phase: 'play',
      round: { n, order, secs: s.secs || 20, walls: walls.join(''), pos, hp: Object.fromEntries(order.map(id => [id, HP])), no: 1, stage: 'plan', endsAt: ctx.now() + (s.secs || 20) * 1000 },
    };
  },

  // The host runs the clock: when everyone's locked in (or time's up) the round plays out, then the next one starts.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const now = ctx.now();
    const ids = standing(ctx);
    if (round.stage === 'plan') {
      const plans = round.plans || {};
      if (now < round.endsAt && !ids.every(id => plans[id]?.ready)) return null;
      const target = settle(round, plans, ids);
      const throws = ids.filter(id => plans[id]?.t >= 0 && plans[id]?.t < 4).map(id => ({ by: id, from: target[id], dir: plans[id].t, ...flight(round, target[id], plans[id].t, target, id) }));
      const hp = { ...round.hp };
      throws.forEach(t => { if (t.hit) hp[t.hit] = Math.max(0, hp[t.hit] - 1); });
      return { 'round/stage': 'show', 'round/plans': null, 'round/from': round.pos, 'round/pos': { ...round.pos, ...target }, 'round/hp': hp,
        'round/throws': throws.map(t => ({ ...t, hit: t.hit || '' })), 'round/showUntil': now + SHOW_MS };
    }
    if (now < round.showUntil) return null;
    const left = standing(ctx);
    if (left.length <= 1 || round.no >= MAX_ROUNDS) {
      // Nobody left means the last ones went down together: they share the win.
      const winners = left.length ? leaders(left, i => round.hp[left[i]]) : (round.throws || []).map(t => t.hit).filter(Boolean).filter((id, i, all) => all.indexOf(id) === i);
      return { 'round/done': true, 'round/winners': winners.length ? winners : round.order.filter(id => ctx.room.players[id]) };
    }
    return { 'round/stage': 'plan', 'round/no': round.no + 1, 'round/throws': null, 'round/from': null, 'round/endsAt': now + round.secs * 1000 };
  },

  view(ctx) {
    const { round } = ctx;
    if (round.done) return finish(ctx, round.order, { winners: round.winners || [], body: arena(ctx, false) });
    return arena(ctx, true);
  },
};

function arena(ctx, live) {
  const { round, local } = ctx;
  const { n, order } = round;
  const me = ctx.uid;
  const inGame = order.includes(me) && alive(round, me);
  const planning = live && round.stage === 'plan' && inGame;
  const plan = round.plans?.[me];
  const ready = !!plan?.ready;
  // What you've picked so far this round (kept on your screen, and saved as you go).
  if (local.no !== round.no) { local.no = round.no; local.m = round.pos[me]; local.t = -1; }
  const save = changes => {
    Object.assign(local, changes);
    ctx.update({ [`round/plans/${me}`]: { m: local.m, t: local.t, ready: false } }).catch(() => {});
    ctx.rerender();
  };

  const showing = round.stage === 'show' || !live;
  const box = i => xy(i, n).map(v => v * CELL);
  const layers = svg`
    ${[...round.walls].map((w, i) => { if (w !== '1') return nothing; const [x, y] = box(i); return svg`<path class="sb-wall" d="M${x + 1} ${y + 8.5} q0 -6 4 -6.5 q4 0.5 4 6.5 z" />`; })}
    ${planning && !ready ? planMarks(round, me, local) : nothing}
    ${repeat(order.filter(id => alive(round, id) || (showing && round.throws?.some(t => t.hit === id))), id => id, id => player(ctx, id, box))}
    ${showing && live ? keyed(`${round.no}`, svg`${(round.throws || []).map(t => throwMark(round, t, box))}`) : nothing}`;

  if (round.stage === 'show' && live) {
    cue(`sb:${round.id}:${round.no}:throw`, 'whoosh');
    if ((round.throws || []).some(t => t.hit === me)) cue(`sb:${round.id}:${round.no}:ouch`, 'buzz');
  } else if (planning) cue(`sb:${round.id}:${round.no}:plan`, 'ding');

  const lockedIn = standing(ctx).filter(id => round.plans?.[id]?.ready).length;
  const hits = (round.throws || []).filter(t => t.hit);
  const news = round.stage === 'show'
    ? (hits.length ? hits.map(t => `${name(ctx, t.by)} hit ${name(ctx, t.hit, true)}`).join(', ') + '!' : 'Everyone missed!')
    : `Round ${round.no}: plan your move.`;
  const line = !inGame ? (order.includes(me) ? 'You\'re out. Watch the rest!' : '')
    : round.stage === 'show' ? 'Here it comes…'
      : ready ? `Locked in. Waiting for ${standing(ctx).length - lockedIn} more…`
        : html`<span class="turn-line turn-line--mine"><b>Plan your move!</b> Step (or stay), then throw.</span>`;

  return html`<div class="cr sb" style="--ratio: 1">
    ${scores(ctx, order, { value: i => '❄'.repeat(round.hp?.[order[i]] || 0), out: i => !alive(round, order[i]) })}
    ${live ? status(news, line) : nothing}
    ${live && round.stage === 'plan' ? timer(round.endsAt, 5) : nothing}
    ${grid({ w: n, h: n, layers, onTap: planning && !ready ? i => {
      const here = round.pos[me];
      if (i !== here && !(around(here, n, n).includes(i) && round.walls[i] !== '1')) return toast('Step one square (not into a wall), or tap yourself to stay.');
      save({ m: i });
    } : null })}
    ${planning ? html`<div class="sb-controls">
      <div class="sb-throws" role="radiogroup" aria-label="Throw">
        ${ARROWS.map((a, d) => html`<button class="bg-fuse wobble ${local.t === d ? 'bg-fuse--on' : ''}" role="radio" aria-checked=${local.t === d} aria-label="Throw ${ARROW_NAMES[d]}"
          ?disabled=${ready} @click=${() => save({ t: d })}>${a}</button>`)}
        <button class="bg-fuse wobble ${local.t < 0 ? 'bg-fuse--on' : ''}" role="radio" aria-checked=${local.t < 0} ?disabled=${ready} @click=${() => save({ t: -1 })}>No throw</button>
      </div>
      ${ready ? button('Change my move', () => ctx.update({ [`round/plans/${me}/ready`]: false }), { kind: 'white', small: true })
        : button('Lock it in', () => ctx.update({ [`round/plans/${me}`]: { m: local.m, t: local.t, ready: true } }), { kind: 'mint' })}
    </div>` : nothing}
  </div>`;
}

const name = (ctx, id, lower) => (id === ctx.uid ? (lower ? 'you' : 'You') : ctx.room.players[id]?.name || 'someone');

// Your own plan on the board: where you'll step, and the line your snowball would take from there.
function planMarks(round, me, local) {
  const [x, y] = xy(local.m, round.n).map(v => v * CELL + 5);
  const moving = local.m !== round.pos[me];
  let aim = nothing;
  if (local.t >= 0) {
    const others = Object.fromEntries(Object.entries(round.pos).filter(([id]) => alive(round, id)));
    const { to } = flight(round, local.m, local.t, { ...others, [me]: local.m }, me);
    const [tx, ty] = xy(to, round.n).map(v => v * CELL + 5);
    aim = svg`<path class="sb-aim" d="M${x} ${y} L${tx} ${ty}" />`;
  }
  return svg`${moving ? svg`<circle class="sb-step" cx=${x} cy=${y} r="4.2" />` : nothing}${aim}`;
}

// A player, standing on their square with their hits left. Moves slide across (a CSS transition).
function player(ctx, id, box) {
  const { round } = ctx;
  const p = ctx.room.players[id];
  const i = round.order.indexOf(id);
  const [x, y] = box(round.pos[id]);
  const hp = round.hp?.[id] || 0;
  const hurt = round.stage === 'show' && (round.throws || []).some(t => t.hit === id);
  return svg`<g class="sb-player ${hurt ? 'sb-player--hit' : ''} ${hp ? '' : 'sb-player--out'}" style="transform: translate(${x}px, ${y}px)">
    <circle cx="5" cy="5.2" r="4.6" fill="#fff" stroke=${inkOf(i)} stroke-width=${id === ctx.uid ? 1.1 : 0.7} />
    ${p ? svg`<svg x="1.4" y="0.8" width="7.2" height="7.8" viewBox="0 0 48 52">${avatar(p, 48, hurt ? 'shock' : null)}</svg>` : nothing}
    ${[...Array(hp)].map((_, k) => svg`<circle cx=${3 + k * 2} cy="9.6" r="0.75" class="sb-hp" />`)}
  </g>`;
}

// A snowball's path this round, drawn as it flies, with a splat where it lands.
function throwMark(round, t, box) {
  const [fx, fy] = box(t.from).map(v => v + 5);
  const [tx, ty] = box(t.to).map(v => v + 5);
  return svg`<g class="sb-throw">
    <path class="sb-trail" d="M${fx} ${fy} L${tx} ${ty}" style="--len: ${Math.hypot(tx - fx, ty - fy) + 1}" />
    <circle class="sb-ball" cx=${tx} cy=${ty} r="1.5" />
    ${t.hit ? svg`<path class="sb-splat" d="M${tx - 3} ${ty} l1.2 -0.6 M${tx + 3} ${ty} l-1.2 0.6 M${tx} ${ty - 3} l0.6 1.2 M${tx} ${ty + 3} l-0.6 -1.2" />` : nothing}
  </g>`;
}

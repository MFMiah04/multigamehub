import { html, nothing, button, selectField, timer, avatar } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { keyed } from 'lit-html/directives/keyed.js';
import { cue } from '../sound.js';
import { inkOf, scores, status, finish, leaders } from './grid-kit.js';

// Snowball Fight: an open snowy field. Each round everyone secretly picks where to run (anywhere
// within reach) and which way to throw (any angle). Then everyone runs at once and the snowballs fly.
// Three hits and you're out.
const SIZE = 100; // the field is 100 × 100
const HP = 3;
const MOVE = 24; // how far you can run in a round
const RANGE = 75; // how far a snowball flies
const BODY = 4.6; // a player's radius
const EDGE = 5; // how close to the edge you can stand
const SHOW_MS = 2800;
const MAX_ROUNDS = 20;

const alive = (round, id) => (round.hp?.[id] || 0) > 0;
const standing = ctx => ctx.round.order.filter(id => alive(ctx.round, id) && ctx.room.players[id]);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const round1 = v => Math.round(v * 10) / 10;
const inWall = (round, p, pad = 0) => (round.walls || []).some(w => dist(p, w) < w[2] + pad);

// Where you actually end up: no further than you can run, inside the field, and stopped by any
// snow wall in the way.
function runTo(round, from, to) {
  let [dx, dy] = [to[0] - from[0], to[1] - from[1]];
  const len = Math.hypot(dx, dy);
  if (len > MOVE) { dx *= MOVE / len; dy *= MOVE / len; }
  let end = from;
  for (let k = 1; k <= 30; k++) {
    const p = [Math.min(SIZE - EDGE, Math.max(EDGE, from[0] + (dx * k) / 30)), Math.min(SIZE - EDGE, Math.max(EDGE, from[1] + (dy * k) / 30))];
    if (inWall(round, p, BODY)) break;
    end = p;
  }
  return end.map(round1);
}

// A snowball's flight from a spot at an angle: it stops at a wall, the edge of the field, or the first person.
function fly(round, from, angle, where, thrower) {
  const [cx, cy] = [Math.cos(angle), Math.sin(angle)];
  let end = from;
  for (let d = BODY + 0.5; d <= RANGE; d += 0.5) {
    const p = [from[0] + cx * d, from[1] + cy * d];
    if (p[0] < 0 || p[1] < 0 || p[0] > SIZE || p[1] > SIZE || inWall(round, p)) break;
    end = p;
    const victim = Object.keys(where).find(id => id !== thrower && dist(where[id], p) < BODY + 0.8);
    if (victim) return { to: p.map(round1), hit: victim };
  }
  return { to: end.map(round1), hit: '' };
}

export default {
  id: 'snowball-fight',
  name: 'Snowball Fight',
  color: 'blue',
  players: '2–8',
  blurb: 'Everyone runs and throws at once, in secret. Dodge, aim, and don\'t get hit three times.',
  rules: [
    'Each round, everyone secretly picks where to run (anywhere inside their dashed circle) and which way to throw (any angle).',
    'Then everyone runs at once, and the snowballs fly in straight lines until they hit someone, a snow wall or the edge.',
    'So aim where you think people will be, not where they are now!',
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
    // Everyone starts in a ring round the middle; a few snow walls go in the gaps.
    const turn = Math.random() * Math.PI * 2;
    const pos = Object.fromEntries(order.map((id, k) => {
      const a = turn + (k * Math.PI * 2) / order.length;
      return [id, [round1(50 + 36 * Math.cos(a)), round1(50 + 36 * Math.sin(a))]];
    }));
    const walls = [];
    for (let tries = 0; walls.length < 7 && tries < 300; tries++) {
      const w = [round1(15 + Math.random() * 70), round1(15 + Math.random() * 70), round1(4 + Math.random() * 2.5)];
      if (Object.values(pos).every(p => dist(p, w) > 15) && walls.every(o => dist(o, w) > 14)) walls.push(w);
    }
    return {
      phase: 'play',
      round: { order, secs: s.secs || 20, walls, pos, hp: Object.fromEntries(order.map(id => [id, HP])), no: 1, stage: 'plan', endsAt: ctx.now() + (s.secs || 20) * 1000 },
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
      const target = Object.fromEntries(ids.map(id => [id, plans[id]?.m ? runTo(round, round.pos[id], plans[id].m) : round.pos[id]]));
      const throws = ids.filter(id => typeof plans[id]?.a === 'number').map(id => ({ by: id, from: target[id], ...fly(round, target[id], plans[id].a, target, id) }));
      const hp = { ...round.hp };
      throws.forEach(t => { if (t.hit) hp[t.hit] = Math.max(0, hp[t.hit] - 1); });
      return { 'round/stage': 'show', 'round/plans': null, 'round/pos': { ...round.pos, ...target }, 'round/hp': hp, 'round/throws': throws, 'round/showUntil': now + SHOW_MS };
    }
    if (now < round.showUntil) return null;
    const left = standing(ctx);
    if (left.length <= 1 || round.no >= MAX_ROUNDS) {
      // Nobody left means the last ones went down together: they share the win.
      const winners = left.length ? leaders(left, i => round.hp[left[i]]) : [...new Set((round.throws || []).map(t => t.hit).filter(Boolean))];
      return { 'round/done': true, 'round/winners': winners.length ? winners : round.order.filter(id => ctx.room.players[id]) };
    }
    return { 'round/stage': 'plan', 'round/no': round.no + 1, 'round/throws': null, 'round/endsAt': now + round.secs * 1000 };
  },

  view(ctx) {
    const { round } = ctx;
    if (round.done) return finish(ctx, round.order, { winners: round.winners || [], body: field(ctx, false) });
    return field(ctx, true);
  },
};

function field(ctx, live) {
  const { round, local } = ctx;
  const { order } = round;
  const me = ctx.uid;
  const inGame = order.includes(me) && alive(round, me);
  const planning = live && round.stage === 'plan' && inGame;
  const ready = !!round.plans?.[me]?.ready;
  const here = round.pos[me];
  // Your plan for this round: where you'll run (m) and the throw's angle (a, or null for no throw).
  if (local.no !== round.no) Object.assign(local, { no: round.no, m: here, a: null, mode: 'move' });
  const save = () => ctx.update({ [`round/plans/${me}`]: { m: local.m, a: local.a, ready: false } }).catch(() => {});

  // Tap or drag on the field: in "run" mode it moves your marker, in "aim" mode it points your throw.
  const pointAt = e => {
    const el = e.currentTarget.ownerSVGElement || e.currentTarget, r = el.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
  };
  const apply = p => {
    if (local.mode === 'move') local.m = runTo(round, here, p);
    else local.a = Math.atan2(p[1] - local.m[1], p[0] - local.m[0]);
    ctx.rerender();
  };
  const down = e => {
    if (!planning || ready) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    local.dragging = true;
    apply(pointAt(e));
  };
  const move = e => { if (local.dragging) apply(pointAt(e)); };
  const up = () => {
    if (!local.dragging) return;
    local.dragging = false;
    if (local.mode === 'move' && local.a === null) local.mode = 'aim'; // straight on to aiming
    save();
    ctx.rerender();
  };

  const showing = round.stage === 'show' || !live;
  const lines = [];
  for (let i = 10; i < SIZE; i += 10) lines.push(`M${i} 0 V${SIZE} M0 ${i} H${SIZE}`);
  let plan = nothing;
  if (planning && !ready) {
    const aim = local.a === null ? null : fly(round, local.m, local.a, {}, me).to;
    plan = svg`
      <circle class="sb-reach" cx=${here[0]} cy=${here[1]} r=${MOVE} />
      ${dist(here, local.m) > 0.5 ? svg`<path class="sb-route" d="M${here[0]} ${here[1]} L${local.m[0]} ${local.m[1]}" /><circle class="sb-step" cx=${local.m[0]} cy=${local.m[1]} r=${BODY} />` : nothing}
      ${aim ? svg`<path class="sb-aim" d="M${local.m[0]} ${local.m[1]} L${aim[0]} ${aim[1]}" /><circle class="sb-aim-end" cx=${aim[0]} cy=${aim[1]} r="1.4" />` : nothing}`;
  }
  const layers = svg`
    ${(round.walls || []).map(([x, y, r]) => svg`<path class="sb-wall" d="M${x - r} ${y + r * 0.55} Q${x - r} ${y - r} ${x} ${y - r} Q${x + r} ${y - r} ${x + r} ${y + r * 0.55} Z" />`)}
    ${plan}
    ${repeat(order.filter(id => alive(round, id) || (showing && round.throws?.some(t => t.hit === id))), id => id, id => player(ctx, id))}
    ${showing && live ? keyed(`${round.no}`, svg`${(round.throws || []).map(throwMark)}`) : nothing}`;

  if (round.stage === 'show' && live) {
    cue(`sb:${round.id}:${round.no}:throw`, 'whoosh');
    if ((round.throws || []).some(t => t.hit === me)) cue(`sb:${round.id}:${round.no}:ouch`, 'buzz');
  } else if (planning) cue(`sb:${round.id}:${round.no}:plan`, 'ding');

  const lockedIn = standing(ctx).filter(id => round.plans?.[id]?.ready).length;
  const hits = (round.throws || []).filter(t => t.hit);
  const news = round.stage === 'show'
    ? (hits.length ? hits.map(t => `${name(ctx, t.by)} hit ${name(ctx, t.hit, true)}`).join(', ') + '!' : 'Everyone missed!')
    : `Round ${round.no}`;
  const line = !inGame ? (order.includes(me) ? 'You\'re out. Watch the rest!' : '')
    : round.stage === 'show' ? 'Here it comes…'
      : ready ? `Locked in. Waiting for ${standing(ctx).length - lockedIn} more…`
        : html`<span class="turn-line turn-line--mine"><b>Your move!</b> ${local.mode === 'move' ? 'Drag where to run.' : 'Tap where to throw.'}</span>`;

  return html`<div class="cr sb" style="--ratio: 1">
    ${scores(ctx, order, { value: i => '❄'.repeat(round.hp?.[order[i]] || 0), out: i => !alive(round, order[i]) })}
    ${live ? status(news, line) : nothing}
    ${live && round.stage === 'plan' ? timer(round.endsAt, 5) : nothing}
    <svg class="cr-board sb-field ${planning && !ready ? 'cr-board--mine turn-glow' : ''}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="The snowy field"
      @pointerdown=${down} @pointermove=${move} @pointerup=${up} @pointercancel=${up}>
      <rect class="cr-paper" x="0" y="0" width=${SIZE} height=${SIZE} rx="1" />
      <path class="cr-grid" d=${lines.join(' ')} />
      ${layers}
    </svg>
    ${planning ? html`<div class="sb-controls">
      <div class="sb-throws">
        <button class="bg-fuse wobble ${local.mode === 'move' ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.mode = 'move'; ctx.rerender(); }}>Run</button>
        <button class="bg-fuse wobble ${local.mode === 'aim' ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.mode = 'aim'; ctx.rerender(); }}>Aim</button>
        <button class="bg-fuse wobble ${local.a === null ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.a = null; local.mode = 'move'; save(); ctx.rerender(); }}>Don't throw</button>
      </div>
      ${ready ? button('Change my move', () => ctx.update({ [`round/plans/${me}/ready`]: false }), { kind: 'white', small: true })
        : button('Lock it in', () => ctx.update({ [`round/plans/${me}`]: { m: local.m, a: local.a, ready: true } }), { kind: 'mint' })}
    </div>` : nothing}
  </div>`;
}

const name = (ctx, id, lower) => (id === ctx.uid ? (lower ? 'you' : 'You') : ctx.room.players[id]?.name || 'someone');

// A player on the field with their hits left. When they run, they slide there (a CSS transition).
function player(ctx, id) {
  const { round } = ctx;
  const p = ctx.room.players[id];
  const [x, y] = round.pos[id];
  const hp = round.hp?.[id] || 0;
  const hurt = round.stage === 'show' && (round.throws || []).some(t => t.hit === id);
  return svg`<g class="sb-player ${hurt ? 'sb-player--hit' : ''} ${hp ? '' : 'sb-player--out'}" style="transform: translate(${x}px, ${y}px)">
    <circle r=${BODY} fill="#fff" stroke=${inkOf(round.order.indexOf(id))} stroke-width=${id === ctx.uid ? 1.1 : 0.7} />
    ${p ? svg`<svg x="-3.6" y="-4.3" width="7.2" height="7.8" viewBox="0 0 48 52">${avatar(p, 48, hurt ? 'shock' : null)}</svg>` : nothing}
    ${[...Array(hp)].map((_, k) => svg`<circle cx=${(k - (hp - 1) / 2) * 2} cy="5.9" r="0.75" class="sb-hp" />`)}
  </g>`;
}

// A snowball's path this round, drawn as it flies, with a splat where it hits someone.
function throwMark(t) {
  const [fx, fy] = t.from;
  const [tx, ty] = t.to;
  return svg`<g class="sb-throw">
    <path class="sb-trail" d="M${fx} ${fy} L${tx} ${ty}" style="--len: ${Math.hypot(tx - fx, ty - fy) + 1}" />
    <circle class="sb-ball" cx=${tx} cy=${ty} r="1.5" />
    ${t.hit ? svg`<path class="sb-splat" d="M${tx - 3} ${ty} l1.2 -0.6 M${tx + 3} ${ty} l-1.2 0.6 M${tx} ${ty - 3} l0.6 1.2 M${tx} ${ty + 3} l-0.6 -1.2" />` : nothing}
  </g>`;
}

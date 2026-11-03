import { html, nothing, button, selectField, timer, avatar } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { cue } from '../sound.js';
import { inkOf, scores, status, finish, leaders } from './grid-kit.js';

// Sumo Ring: everyone is a sumo in a ring that shrinks every round. Each round, everyone secretly
// picks a direction to charge, or braces to stand firm. Then everyone moves at once and bumps into
// each other. Pushed out of the ring and you're out. Last one in wins.
const SIZE = 100;
const MID = 50;
const BODY = 5; // a sumo's radius
const SPEED = 56; // a charge's starting speed; friction slows it, so it carries about 16 units
const BRACE_MASS = 3; // bracing makes you three times as hard to shift
const STEPS = 48; // physics steps per round
const FRAMES = 16; // positions saved for the replay
const SHOW_MS = 1900;
const MAX_ROUNDS = 15;
const ringFor = no => Math.max(16, 42 - (no - 1) * 2.5);

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const r1 = v => Math.round(v * 10) / 10;
const inRing = (p, ring) => dist(p, [MID, MID]) <= ring;
const standing = ctx => ctx.round.order.filter(id => ctx.round.pos?.[id] && ctx.room.players[id]);

// Everyone moves at once. Charging sumos head off at speed, slowing as they go; when two touch they
// bounce apart like snooker balls (a bracing sumo is much heavier). Returns where everyone ends up,
// plus a few in-between positions so every screen can replay the shove.
function shove(pos, plans, ids) {
  const s = Object.fromEntries(ids.map(id => {
    const plan = plans[id];
    const a = typeof plan?.a === 'number' && !plan.brace ? plan.a : null;
    return [id, { p: [...pos[id]], v: a === null ? [0, 0] : [Math.cos(a) * SPEED, Math.sin(a) * SPEED], m: plan?.brace ? BRACE_MASS : 1 }];
  }));
  const frames = Object.fromEntries(ids.map(id => [id, []]));
  const dt = 1 / STEPS;
  for (let step = 1; step <= STEPS; step++) {
    ids.forEach(id => { const b = s[id]; b.p[0] += b.v[0] * dt; b.p[1] += b.v[1] * dt; b.v = b.v.map(v => v * 0.93); });
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const A = s[ids[i]], B = s[ids[j]];
      const d = dist(A.p, B.p);
      if (d >= BODY * 2 || d === 0) continue;
      const n = [(B.p[0] - A.p[0]) / d, (B.p[1] - A.p[1]) / d];
      // Push them apart so they don't overlap, the lighter one further.
      const overlap = BODY * 2 - d;
      A.p[0] -= n[0] * overlap * (B.m / (A.m + B.m)); A.p[1] -= n[1] * overlap * (B.m / (A.m + B.m));
      B.p[0] += n[0] * overlap * (A.m / (A.m + B.m)); B.p[1] += n[1] * overlap * (A.m / (A.m + B.m));
      // A bouncy bump along the line between them.
      const closing = (A.v[0] - B.v[0]) * n[0] + (A.v[1] - B.v[1]) * n[1];
      if (closing <= 0) continue;
      const impulse = (1.9 * closing) / (1 / A.m + 1 / B.m);
      A.v[0] -= (impulse / A.m) * n[0]; A.v[1] -= (impulse / A.m) * n[1];
      B.v[0] += (impulse / B.m) * n[0]; B.v[1] += (impulse / B.m) * n[1];
    }
    if (step % (STEPS / FRAMES) === 0) ids.forEach(id => frames[id].push(s[id].p.map(r1)));
  }
  return { end: Object.fromEntries(ids.map(id => [id, s[id].p.map(r1)])), frames };
}

export default {
  id: 'sumo-ring',
  name: 'Sumo Ring',
  color: 'peach',
  players: '2–8',
  blurb: 'Charge or brace, all at once. Shove everyone out of a shrinking ring.',
  rules: [
    'Each round, everyone secretly picks a direction to charge (any angle), or braces to stand firm. Then everyone moves at once.',
    'Bump into someone to send them flying. Bracing makes you much harder to push, but you don\'t move.',
    'Pushed out of the ring and you\'re out. The ring shrinks every round.',
    'Last sumo in the ring wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g stroke="#222" stroke-width="2" stroke-linecap="round" fill="none">
    <circle cx="32" cy="29" r="22" stroke="#c9a46a" stroke-width="3" stroke-dasharray="5 3" />
    <circle cx="25" cy="30" r="7" fill="#f7c9c3" /><circle cx="40" cy="27" r="7" fill="#c6dcf4" />
    <path d="M12 30 h6 M14 26 l4 4 l-4 4" stroke="#e05a4f" />
  </g></svg>`,

  defaults: () => ({ secs: 12 }),
  settingsView: (ctx, s, set) => selectField('Time to plan each round', s.secs, [[8, '8 seconds'], [12, '12 seconds'], [20, '20 seconds']], v => set({ secs: +v }), !ctx.isHost),
  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const turn = Math.random() * Math.PI * 2;
    const spread = ringFor(1) * 0.6;
    const pos = Object.fromEntries(order.map((id, k) => {
      const a = turn + (k * Math.PI * 2) / order.length;
      return [id, [r1(MID + spread * Math.cos(a)), r1(MID + spread * Math.sin(a))]];
    }));
    return { phase: 'play', round: { order, secs: s.secs || 12, pos, no: 1, stage: 'plan', endsAt: ctx.now() + (s.secs || 12) * 1000 } };
  },

  // The host runs the clock: when everyone's locked in (or time's up) the shove plays out, then the
  // ring shrinks and the next round starts.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    const now = ctx.now();
    const ids = standing(ctx);
    if (round.stage === 'plan') {
      const plans = round.plans || {};
      if (now < round.endsAt && !ids.every(id => plans[id]?.ready)) return null;
      const { end, frames } = shove(round.pos, plans, ids);
      const ring = ringFor(round.no);
      const out = ids.filter(id => !inRing(end[id], ring));
      const pos = Object.fromEntries(ids.map(id => [id, end[id]]));
      return { 'round/stage': 'show', 'round/plans': null, 'round/frames': frames, 'round/pos': pos, 'round/out': out, 'round/start': now, 'round/showUntil': now + SHOW_MS };
    }
    if (now < round.showUntil) return null;
    // Anyone outside the ring leaves the field now the shove's over.
    const ring = ringFor(round.no);
    const left = ids.filter(id => inRing(round.pos[id], ring));
    const pos = Object.fromEntries(left.map(id => [id, round.pos[id]]));
    if (left.length <= 1 || round.no >= MAX_ROUNDS) {
      // Nobody left means the last ones went out together: they share the win. After the last
      // round, whoever's nearest the middle wins.
      const winners = left.length === 1 ? left
        : left.length ? leaders(left, i => -dist(pos[left[i]], [MID, MID]))
          : round.out || [];
      return { 'round/done': true, 'round/pos': pos, 'round/winners': winners.length ? winners : ids };
    }
    return { 'round/stage': 'plan', 'round/no': round.no + 1, 'round/pos': pos, 'round/frames': null, 'round/out': null, 'round/endsAt': now + round.secs * 1000 };
  },

  view(ctx) {
    const { round } = ctx;
    if (round.done) return finish(ctx, round.order, { winners: round.winners || [], body: ringView(ctx, false) });
    return ringView(ctx, true);
  },
};

function ringView(ctx, live) {
  const { round, local } = ctx;
  const { order } = round;
  const me = ctx.uid;
  const now = ctx.now();
  const inGame = !!round.pos?.[me];
  const planning = live && round.stage === 'plan' && inGame;
  const ready = !!round.plans?.[me]?.ready;
  const here = round.pos?.[me];
  const ring = ringFor(round.no);
  const showing = live && round.stage === 'show';
  if (local.no !== round.no) Object.assign(local, { no: round.no, a: null, brace: false });
  const save = ready => ctx.update({ [`round/plans/${me}`]: { ...(local.a !== null ? { a: local.a } : {}), brace: local.brace, ready } }).catch(() => {});

  // Replaying the shove: everyone slides through the saved positions. Redraw quickly while it plays.
  const frame = showing ? Math.min(FRAMES - 1, Math.floor(((now - round.start) / (SHOW_MS * 0.7)) * FRAMES)) : -1;
  if (showing) { clearTimeout(local.anim); local.anim = setTimeout(ctx.rerender, 40); }
  const posOf = id => (frame >= 0 && round.frames?.[id] ? round.frames[id][frame] : round.pos[id]);

  // Drag (or tap) anywhere to aim your charge from where you stand.
  const aim = e => {
    if (!planning || ready) return;
    const el = e.currentTarget, r = el.getBoundingClientRect();
    const p = [((e.clientX - r.left) / r.width) * SIZE, ((e.clientY - r.top) / r.height) * SIZE];
    if (dist(p, here) < 1) return;
    local.a = Math.atan2(p[1] - here[1], p[0] - here[0]);
    local.brace = false;
    ctx.rerender();
  };
  const down = e => { if (!planning || ready) return; e.preventDefault(); e.currentTarget.setPointerCapture?.(e.pointerId); local.dragging = true; aim(e); };
  const move = e => { if (local.dragging) aim(e); };
  const up = () => { if (local.dragging) { local.dragging = false; save(false); } };

  const shown = order.filter(id => (showing ? round.frames?.[id] : round.pos?.[id]));
  const falling = new Set(showing ? round.out || [] : []);
  if (showing) cue(`sumo:${round.id}:${round.no}:go`, 'whoosh');
  if (showing && falling.size) setTimeout(() => cue(`sumo:${round.id}:${round.no}:out`, 'buzz'), SHOW_MS * 0.6);
  if (planning) cue(`sumo:${round.id}:${round.no}:plan`, 'ding');

  const lockedIn = standing(ctx).filter(id => round.plans?.[id]?.ready).length;
  const name = id => (id === me ? 'You' : ctx.room.players[id]?.name || 'Someone');
  const news = showing ? (falling.size ? `${[...falling].map(name).join(', ')} ${falling.size === 1 && !falling.has(me) ? 'is' : 'are'} out!` : 'Shove!') : `Round ${round.no}${round.no > 1 ? ': the ring shrinks!' : ''}`;
  const line = !live || !order.includes(me) ? ''
    : !inGame ? 'You\'re out. Watch the rest!'
      : showing ? 'Here we go…'
        : ready ? `Locked in. Waiting for ${standing(ctx).length - lockedIn} more…`
          : html`<span class="turn-line turn-line--mine"><b>Your move!</b> Drag to aim a charge, or brace.</span>`;

  let plan = nothing;
  if (planning && !ready && here) {
    if (local.brace) plan = svg`<circle class="sumo-brace" cx=${here[0]} cy=${here[1]} r=${BODY + 2} />`;
    else if (local.a !== null) {
      const tip = [here[0] + Math.cos(local.a) * 16, here[1] + Math.sin(local.a) * 16];
      const side = a => [tip[0] - Math.cos(local.a + a) * 3, tip[1] - Math.sin(local.a + a) * 3];
      plan = svg`<path class="sumo-aim" d="M${here[0]} ${here[1]} L${tip[0]} ${tip[1]} M${side(0.5).join(' ')} L${tip.join(' ')} L${side(-0.5).join(' ')}" />`;
    }
  }

  return html`<div class="cr sb sumo" style="--ratio: 1">
    ${scores(ctx, order, { value: () => '', out: i => !round.pos?.[order[i]] && !(showing && round.frames?.[order[i]]) })}
    ${live ? status(news, line) : nothing}
    ${live && round.stage === 'plan' ? timer(round.endsAt, 3) : nothing}
    <svg class="cr-board sb-field ${planning && !ready ? 'cr-board--mine turn-glow' : ''}" viewBox="0 0 ${SIZE} ${SIZE}" role="img" aria-label="The sumo ring"
      @pointerdown=${down} @pointermove=${move} @pointerup=${up} @pointercancel=${up}>
      <rect class="sumo-floor" x="0" y="0" width=${SIZE} height=${SIZE} rx="1" />
      <circle class="sumo-ring" cx=${MID} cy=${MID} r=${ring} />
      ${round.no > 1 && !round.done ? svg`<circle class="sumo-was" cx=${MID} cy=${MID} r=${ringFor(round.no - 1)} />` : nothing}
      ${plan}
      ${repeat(shown, id => id, id => {
        const [x, y] = posOf(id);
        const k = order.indexOf(id);
        const p = ctx.room.players[id];
        return svg`<g class="sumo-player ${falling.has(id) && frame >= FRAMES - 1 ? 'sumo-player--out' : ''}" style="transform: translate(${x}px, ${y}px)">
          <circle r=${BODY} fill="#fff" stroke=${inkOf(k)} stroke-width=${id === me ? 1.3 : 0.9} />
          ${p ? svg`<svg x="-3.9" y="-4.5" width="7.8" height="8.45" viewBox="0 0 48 52">${avatar(p, 48, falling.has(id) && frame >= FRAMES - 1 ? 'shock' : null)}</svg>` : nothing}
        </g>`;
      })}
    </svg>
    ${planning ? html`<div class="sb-controls">
      <div class="sb-throws">
        <button class="bg-fuse wobble ${!local.brace ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.brace = false; save(false); ctx.rerender(); }}>Charge</button>
        <button class="bg-fuse wobble ${local.brace ? 'bg-fuse--on' : ''}" ?disabled=${ready} @click=${() => { local.brace = true; save(false); ctx.rerender(); }}>Brace</button>
      </div>
      ${ready ? button('Change my move', () => ctx.update({ [`round/plans/${me}/ready`]: false }), { kind: 'white', small: true })
        : button(local.brace || local.a !== null ? 'Lock it in' : 'Stand still', () => save(true), { kind: 'mint' })}
    </div>` : nothing}
  </div>`;
}

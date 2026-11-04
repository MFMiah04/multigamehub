import { runTransaction } from 'firebase/database';
import { html, nothing, button, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { repeat } from 'lit-html/directives/repeat.js';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { cue } from '../sound.js';
import { inkOf, scores, status, turnLine, nextTurn, finish } from './grid-kit.js';

// Snakes and Ladders with power-ups: take turns rolling and walking your counter along the board.
// Land on a ladder's foot to climb it, on a snake's head to slide down. End a move on a "?" to pick
// up a power-up (hold two, use the oldest first, on your turn before you roll). First to 100 wins.
const TURN_MS = 15000; // time to roll before the dice roll themselves
const SPIN_MS = 750; // the dice tumbles for this long before it lands
const STEP_MS = 190; // each square a counter walks
const SLIDE_MS = 650; // climbing a ladder or sliding down a snake
const QUICK_MS = 700; // swaps, push-backs and moved snakes and ladders
const MAX_ITEMS = 2;
const BOXES = 3; // power-up squares on the board
const START_LADDERS = [[3, 22], [8, 30], [28, 55], [46, 66], [58, 77], [71, 92], [80, 99]];
const START_SNAKES = [[17, 7], [37, 19], [54, 34], [64, 41], [87, 57], [93, 73], [98, 79]];

const POWERS = {
  double: { name: 'Double dice', note: 'Your next roll uses two dice.', colour: '#9ad0f5' },
  again: { name: 'Roll again', note: 'Take another turn after this one.', colour: '#b4f8c8' },
  boost: { name: 'Jump 3', note: 'Hop forward 3 squares now.', colour: '#ffe066' },
  shield: { name: 'Snake shield', note: 'The next snake you land on can\'t bite you.', colour: '#c3b1e1' },
  swap: { name: 'Swap', note: 'Swap places with another player.', pick: 'player', colour: '#ffaebc' },
  push: { name: 'Push back', note: 'Send a player back 5 squares.', pick: 'player', colour: '#ffc48c' },
  shift: { name: 'Move it', note: 'Move a snake or ladder: pick one, then where it starts.', pick: 'link', colour: '#d4e79e' },
};
// The further behind the leader you are, the better your chances of the strong ones.
function pickPower(gap) {
  const far = gap >= 20, behind = gap >= 8;
  const weights = { swap: far ? 5 : behind ? 2 : 0, double: behind ? 4 : 2, boost: behind ? 4 : 1, again: 2, shield: 2, push: behind ? 1 : 3, shift: 2 };
  let roll = Math.random() * Object.values(weights).reduce((a, b) => a + b, 0);
  return Object.keys(weights).find(k => (roll -= weights[k]) < 0) || 'double';
}

// Square 1 is bottom left; the numbers snake back and forth up the board.
function centre(s) {
  const row = Math.floor((s - 1) / 10);
  const col = row % 2 ? 9 - ((s - 1) % 10) : (s - 1) % 10;
  return [col * 10 + 5, (9 - row) * 10 + 5];
}
const dice = () => 1 + Math.floor(Math.random() * 6);
const links = round => [...(round.ladders || []), ...(round.snakes || [])];
const taken = (round, extra = []) => new Set([1, 100, ...links(round).flat(), ...(round.boxes || []), ...extra]);
// A random empty square, between lo and hi if there's room there.
const freeSquare = (round, extra, lo = 2, hi = 99) => {
  const used = taken(round, extra);
  const open = [...Array(98).keys()].map(i => i + 2).filter(s => !used.has(s));
  const near = open.filter(s => s >= lo && s <= hi);
  const pool = near.length ? near : open;
  return pool[Math.floor(Math.random() * pool.length)];
};

// A "?" everyone has left well behind (BEHIND squares or more) fades out over its last round, then
// turns up again a little ahead of whoever's last, so there's always one worth aiming for.
const BEHIND = 6;
const ROUNDS_LEFT_BEHIND = 2;
const playersHere = (ctx, round) => round.order.filter(id => ctx.room.players[id]);
const lastPlace = (ctx, round) => Math.min(...playersHere(ctx, round).map(id => round.pos[id] || 1));
const aheadOfLast = (ctx, round) => { const last = lastPlace(ctx, round); return [last + 3, last + 30]; };
function ageBoxes(ctx, round) {
  const here = playersHere(ctx, round);
  const last = lastPlace(ctx, round);
  const limit = here.length * ROUNDS_LEFT_BEHIND;
  const stale = { ...round.stale };
  round.boxes = (round.boxes || []).map(b => {
    const key = `b${b}`; // letter keys, so the database keeps this an object
    if (last - b < BEHIND) { delete stale[key]; return b; }
    stale[key] = (stale[key] || 0) + 1;
    if (stale[key] < limit) return b;
    delete stale[key];
    return freeSquare(round, Object.values(round.pos), ...aheadOfLast(ctx, round));
  });
  round.stale = stale;
}
// Every few rounds the snakes and ladders all jump to new places.
const SHUFFLE_ROUNDS = 3;
const turnsPerShuffle = (ctx, round) => playersHere(ctx, round).length * SHUFFLE_ROUNDS;
function shuffleBoard(ctx, round) {
  const players = new Set(Object.values(round.pos));
  for (let tries = 0; tries < 50; tries++) {
    const used = new Set([1, 100, ...(round.boxes || [])]);
    const place = (count, up) => {
      const list = [];
      for (let k = 0; list.length < count && k < 400; k++) {
        const len = 8 + Math.floor(Math.random() * 24);
        const start = up ? 2 + Math.floor(Math.random() * (98 - len)) : len + 2 + Math.floor(Math.random() * (98 - len - 1));
        const end = up ? start + len : start - len;
        // Ends can't share a square with anything, and a start can't be under someone's counter.
        if (end < 2 || end > 99 || used.has(start) || used.has(end) || players.has(start)) continue;
        // Keep each one spanning at least one row, so none are flat.
        if (Math.floor((start - 1) / 10) === Math.floor((end - 1) / 10)) continue;
        used.add(start); used.add(end);
        list.push([start, end]);
      }
      return list;
    };
    const ladders = place(7, true);
    const snakes = place(7, false);
    if (ladders.length === 7 && snakes.length === 7) { round.ladders = ladders; round.snakes = snakes; return true; }
  }
  return false;
}

const fading = (ctx, round, b) => {
  const here = playersHere(ctx, round).length;
  return (round.stale?.[`b${b}`] || 0) >= here * (ROUNDS_LEFT_BEHIND - 1);
};

// How long the last thing that happened takes to show.
function lengthOf(last) {
  if (!last) return 0;
  if (last.kind !== 'roll' && last.kind !== 'boost') return QUICK_MS;
  return (last.kind === 'roll' ? SPIN_MS : 0) + (last.land - last.from) * STEP_MS + (last.to !== last.land ? SLIDE_MS : 0) + 250;
}

// Walks a player forward, then climbs, slides (unless shielded) and picks up any power-up where they stop.
function walk(ctx, round, id, steps, kind, roll) {
  const now = ctx.now();
  const from = round.pos[id];
  const land = Math.min(100, from + steps);
  let to = land;
  let shielded = false;
  const ladder = (round.ladders || []).find(([a]) => a === land);
  const snake = (round.snakes || []).find(([a]) => a === land);
  if (ladder) to = ladder[1];
  else if (snake && round.effects?.[id]?.shield) { shielded = true; round.effects[id].shield = null; }
  else if (snake) to = snake[1];
  round.pos = { ...round.pos, [id]: to };
  let got = null;
  const items = round.items?.[id] || [];
  if ((round.boxes || []).includes(to) && items.length < MAX_ITEMS) {
    const lead = Math.max(...round.order.map(o => round.pos[o] || 1));
    got = pickPower(lead - to);
    round.items = { ...round.items, [id]: [...items, got] };
    round.boxes = round.boxes.map(b => (b === to ? freeSquare(round, Object.values(round.pos), ...aheadOfLast(ctx, round)) : b));
  }
  round.last = { kind, by: id, from, land, to, ...(roll ? { roll } : {}), ...(shielded ? { shielded } : {}), ...(got ? { got } : {}), n: (round.last?.n || 0) + 1, t: now };
  round.busyUntil = now + lengthOf(round.last);
  if (to >= 100) { round.done = true; round.winners = [id]; }
  return round;
}

// Rolls the dice for whoever's turn it is (the host does it for anyone who runs out of time).
function rollFor(ctx, id) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    const now = ctx.now();
    if (!round || round.done || round.turn !== id || now < (round.busyUntil || 0)) return undefined;
    if (id !== ctx.uid && now < round.endsAt) return undefined; // only the host's timeout roll gets here
    round.effects ||= {};
    const fx = round.effects[id] || {};
    const roll = fx.double ? [dice(), dice()] : [dice()];
    round.effects[id] = { ...fx, double: null };
    walk(ctx, round, id, roll.reduce((a, b) => a + b, 0), 'roll', roll);
    if (round.done) return round;
    ageBoxes(ctx, round);
    round.turns = (round.turns || 0) + 1;
    if (round.turns % turnsPerShuffle(ctx, round) === 0 && shuffleBoard(ctx, round)) {
      round.shuffles = (round.shuffles || 0) + 1;
      round.last.shuffle = true;
    }
    if (fx.again) round.effects[id].again = null;
    else round.turn = nextTurn(ctx, round.order, round.order.indexOf(id));
    round.endsAt = round.busyUntil + TURN_MS;
    return round;
  });
}

// Uses your oldest power-up. `target` is a player (swap, push) or { from, at } to move a snake or ladder.
function usePower(ctx, target) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    const now = ctx.now();
    const me = ctx.uid;
    const items = round?.items?.[me] || [];
    if (!round || round.done || round.turn !== me || now < (round.busyUntil || 0) || !items.length) return undefined;
    const power = items[0];
    round.items = { ...round.items, [me]: items.slice(1) };
    round.effects ||= {};
    const fx = { ...round.effects[me] };
    const note = { kind: power, by: me, n: (round.last?.n || 0) + 1, t: now };
    if (power === 'double' || power === 'again' || power === 'shield') {
      fx[power] = true;
      round.effects[me] = fx;
      round.last = note;
      round.busyUntil = now + QUICK_MS;
    } else if (power === 'boost') {
      walk(ctx, round, me, 3, 'boost');
    } else if (power === 'swap' || power === 'push') {
      if (!round.pos[target] || target === me) return undefined;
      if (power === 'swap') round.pos = { ...round.pos, [me]: round.pos[target], [target]: round.pos[me] };
      else round.pos = { ...round.pos, [target]: Math.max(1, round.pos[target] - 5) };
      round.last = { ...note, target };
      round.busyUntil = now + QUICK_MS;
    } else if (power === 'shift') {
      const kind = (round.ladders || []).some(([a]) => a === target?.from) ? 'ladders' : 'snakes';
      const list = round[kind] || [];
      const old = list.find(([a]) => a === target?.from);
      if (!old) return undefined;
      const start = target.at, end = target.at + (old[1] - old[0]);
      const others = { ...round, [kind]: list.filter(l => l !== old) };
      if (start < 2 || start > 99 || end < 2 || end > 99 || taken(others).has(start) || taken(others).has(end)) return undefined;
      round[kind] = list.map(l => (l === old ? [start, end] : l));
      round.last = { ...note, link: [start, end], moved: kind === 'ladders' ? 'ladder' : 'snake' };
      round.busyUntil = now + QUICK_MS;
    }
    round.endsAt = Math.max(round.endsAt || 0, round.busyUntil + TURN_MS);
    return round;
  });
}

export default {
  id: 'snakes-ladders',
  name: 'Snakes and Ladders',
  twoLines: true,
  color: 'lime',
  players: '2–12',
  blurb: 'Roll, climb, slide, and grab power-ups to swap places or move the snakes.',
  rules: [
    'Take turns rolling the dice and walking your counter along the board. The arrows at the ends of the rows show the way.',
    'Land at the foot of a ladder to climb it, or on a snake\'s head to slide down its tail.',
    `Stop on a "?" to pick up a power-up. Hold up to ${MAX_ITEMS}, and use the oldest one first, on your turn before you roll. The further behind you are, the better they get.`,
    'Power-ups: double dice, roll again, jump 3, snake shield, swap places, push someone back, or move a snake or ladder.',
    `Every ${SHUFFLE_ROUNDS} rounds the snakes and ladders all jump to new places.`,
    `First to square 100 wins. If you don't roll within ${TURN_MS / 1000} seconds, the dice roll themselves.`,
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
    const round = { order, pos: Object.fromEntries(order.map(id => [id, 1])), ladders: START_LADDERS, snakes: START_SNAKES, boxes: [] };
    for (let i = 0; i < BOXES; i++) round.boxes.push(freeSquare(round));
    return { phase: 'play', round: { ...round, turn: order[Math.floor(Math.random() * order.length)], endsAt: ctx.now() + TURN_MS } };
  },

  // The host rolls for anyone who takes too long, and skips anyone who's left.
  tick(ctx) {
    const { round } = ctx;
    if (round.done) return null;
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(ctx, round.order, round.order.indexOf(round.turn)) };
    if (ctx.now() >= round.endsAt && ctx.now() >= (round.busyUntil || 0)) rollFor(ctx, round.turn).catch(() => {});
    return null;
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
  const items = round.items?.[me] || [];
  const fx = round.effects?.[me] || {};
  // Redraw smoothly while something's moving, and once more when it stops.
  if (busy) { clearTimeout(local.anim); local.anim = setTimeout(ctx.rerender, 45); }
  if (!myTurn || busy) local.mode = null;

  // The dice tumbles through the air for a moment after each roll, then lands.
  const isRoll = last?.kind === 'roll';
  const spinning = isRoll && now - last.t < SPIN_MS;

  if (last) {
    cue(`sl:${round.id}:${last.n}`, last.kind === 'roll' || last.kind === 'boost' ? 'pop' : 'whoosh');
    const walked = lengthOf(last) - 250 - (last.to !== last.land ? SLIDE_MS : 0);
    if (last.to > last.land) setTimeout(() => cue(`sl:${round.id}:${last.n}:up`, 'score'), walked);
    if (last.to < last.land) setTimeout(() => cue(`sl:${round.id}:${last.n}:down`, 'buzz'), walked);
    if (last.got && last.by === me) setTimeout(() => cue(`sl:${round.id}:${last.n}:got`, 'ding'), lengthOf(last) - 200);
  }
  if (myTurn && !busy) cue(`sl:${round.id}:turn:${last?.n || 0}`, 'ding');

  const who = (id, lower) => (id === me ? (lower ? 'you' : 'You') : ctx.room.players[id]?.name || 'Someone');
  const news = !last ? `${myTurn ? 'You go' : `${turnPlayer?.name || 'Someone'} goes`} first.` : newsFor(last, who, spinning, busy);
  const left = Math.max(0, Math.ceil((round.endsAt - now) / 1000));
  const mode = local.mode;
  const hint = mode?.pick === 'player' ? `Pick who to ${mode.power === 'swap' ? 'swap with' : 'push back'}.`
    : mode?.pick === 'link' ? (mode.from ? 'Now tap the square it should start on.' : 'Tap the head of a snake or the foot of a ladder.')
      : `Tap the dice to roll${fx.double ? ' (two dice!)' : ''}. (${left})`;
  const line = !live || !round.order.includes(me) ? ''
    : turnLine(myTurn && !busy, { mine: hint, waiting: busy ? 'Moving…' : `Waiting for ${turnPlayer?.name || 'the next player'} to roll…` });

  // Moving a snake or ladder: tap one's start, then the square where it should start instead.
  const tapBoard = e => {
    if (mode?.pick !== 'link') return;
    const el = e.currentTarget, r = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
    const x = Math.floor((vb.x + ((e.clientX - r.left) / r.width) * vb.width) / 10);
    const y = Math.floor((vb.y + ((e.clientY - r.top) / r.height) * vb.height) / 10);
    if (x < 0 || y < 0 || x > 9 || y > 9) return;
    const row = 9 - y;
    const s = row * 10 + (row % 2 ? 9 - x : x) + 1;
    if (!mode.from) {
      if (!links(round).some(([a]) => a === s)) return toast('Tap the head of a snake or the foot of a ladder.');
      local.mode = { ...mode, from: s };
      return ctx.rerender();
    }
    local.mode = null;
    usePower(ctx, { from: mode.from, at: s }).then(r => { if (!r.committed) toast('It doesn\'t fit there. Try another square.'); }).catch(() => toast("That didn't go through. Try again?"));
  };

  const use = () => {
    const power = POWERS[items[0]];
    if (power.pick) { local.mode = { power: items[0], pick: power.pick }; return ctx.rerender(); }
    usePower(ctx).catch(() => toast("That didn't go through. Try again?"));
  };

  const numbers = [];
  for (let s = 1; s <= 100; s++) {
    const [x, y] = centre(s);
    numbers.push(svg`<text class="sl-num" x=${x - 4.2} y=${y - 2.3}>${s}</text>`);
  }
  const lines = [];
  for (let i = 1; i < 10; i++) lines.push(`M${i * 10} 0 V100 M0 ${i * 10} H100`);
  const movedLink = last?.kind === 'shift' && busy ? last.link?.[0] : null;

  return html`<div class="cr sl" style="--ratio: 1">
    ${scores(ctx, round.order, { turn: round.done ? null : round.turn, value: i => {
      const id = round.order[i];
      const held = (round.items?.[id] || []).length;
      return html`${round.pos[id]}${(round.items?.[id] || []).map(it => html`<span class="sl-held" title=${POWERS[it].name}>${icon(it)}</span>`)}`;
    } })}
    ${live ? status(news, line) : nothing}
    <svg class="cr-board sl-board ${mode?.pick === 'link' ? 'sl-board--pick' : ''}" viewBox="-1 -1 102 102" role="img" aria-label="Snakes and ladders board" @click=${tapBoard}>
      <rect class="cr-paper" x="0" y="0" width="100" height="100" rx="1" />
      ${[...Array(100).keys()].filter(i => (Math.floor(i / 10) + i) % 2).map(i => svg`<rect class="sl-tint" x=${(i % 10) * 10} y=${Math.floor(i / 10) * 10} width="10" height="10" />`)}
      <path class="cr-grid" d=${lines.join(' ')} />
      ${numbers}
      ${turnArrows()}
      ${(round.boxes || []).map(s => keyed(`box${s}`, box(s, fading(ctx, round, s))))}
      ${keyed(`board${round.shuffles || 0}`, svg`<g class=${round.shuffles ? 'sl-shuffled' : ''}>
        ${(round.ladders || []).map(([a, b]) => ladder(a, b, a === movedLink))}
        ${(round.snakes || []).map(([a, b], k) => snake(a, b, k, a === movedLink))}</g>`)}
      ${mode?.pick === 'link' ? links(round).map(([a]) => { const [x, y] = centre(a); return svg`<circle class="sl-pickable ${mode.from === a ? 'sl-pickable--on' : ''}" cx=${x} cy=${y} r="4.3" />`; }) : nothing}
      ${repeat(round.order.filter(id => ctx.room.players[id]), id => id, id => token(ctx, id, live))}
    </svg>
    <div class="sl-roll">
      ${diceButton(ctx, { ready: myTurn && !busy && !mode, double: fx.double, last, isRoll, spinning })}
      ${mode ? button('Cancel', () => { local.mode = null; ctx.rerender(); }, { kind: 'white', small: true }) : nothing}
    </div>
    ${live ? (() => {
      const every = turnsPerShuffle(ctx, round);
      const left = every - ((round.turns || 0) % every);
      return html`<p class="note sl-shuffle ${left <= playersHere(ctx, round).length ? 'sl-shuffle--soon' : ''}">The snakes and ladders shuffle in ${left} turn${left === 1 ? '' : 's'}.</p>`;
    })() : nothing}
    ${live && round.order.includes(me) ? html`<div class="sl-items">
      ${items.length ? items.map((it, i) => keyed(`${it}:${i}:${(round.items?.[me] || []).length}`, card(it, {
        next: i > 0, usable: !i && myTurn && !busy && !mode, onUse: use,
      }))) : html`<p class="note">Stop on a <b class="sl-q">?</b> to get a power-up.</p>`}
      ${['double', 'again', 'shield'].filter(k => fx[k]).map(k => html`<span class="sl-active" style="--c: ${POWERS[k].colour}">${icon(k)} ${k === 'double' ? 'Two dice next roll' : k === 'again' ? 'Rolling again after this' : 'Shield up'}</span>`)}
    </div>` : nothing}
    ${last?.got && last.by === me && now < round.busyUntil + 1800 && now > round.busyUntil - 300 ? keyed(`got${last.n}`, html`<div class="sl-got" style="--c: ${POWERS[last.got].colour}" role="status">
      ${icon(last.got)}<span>You got <b>${POWERS[last.got].name}</b>!</span></div>`) : nothing}
    ${mode?.pick === 'player' ? html`<div class="sl-targets">${round.order.filter(id => id !== me && ctx.room.players[id]).map(id => button(`${ctx.room.players[id].name} (${round.pos[id]})`, () => {
      local.mode = null;
      usePower(ctx, id).catch(() => toast("That didn't go through. Try again?"));
    }, { kind: 'white', small: true }))}</div>` : nothing}
  </div>`;
}

function newsFor(last, who, spinning, busy) {
  const name = who(last.by);
  if (last.kind === 'roll') {
    if (spinning) return `${name} ${name === 'You' ? 'are' : 'is'} rolling…`;
    const total = last.roll.reduce((a, b) => a + b, 0);
    const what = last.to > last.land ? ' and climbed a ladder!' : last.to < last.land ? ' and slid down a snake!' : last.shielded ? '. The shield blocked a snake!' : '.';
    const got = last.got && !busy ? ` Got ${POWERS[last.got].name}!` : '';
    const shuffle = last.shuffle && !busy ? ' The board shuffled!' : '';
    return `${name} rolled ${last.roll.length > 1 ? `${last.roll.join(' + ')} = ${total}` : total}${what}${got}${shuffle}`;
  }
  if (last.kind === 'boost') return `${name} jumped 3${last.to > last.land ? ' and climbed a ladder!' : last.to < last.land ? ' and slid down a snake!' : '!'}`;
  if (last.kind === 'swap') return `${name} swapped places with ${who(last.target, true)}!`;
  if (last.kind === 'push') return `${name} pushed ${who(last.target, true)} back 5!`;
  if (last.kind === 'shift') return `${name} moved a ${last.moved}!`;
  return `${name} used ${POWERS[last.kind].name}!`;
}

// A counter: the player's face in a ring of their ink. After a roll it walks square by square along
// the board's path (across, up at the row's end, back across), then climbs or slides.
function token(ctx, id, live) {
  const { round } = ctx;
  const k = round.order.indexOf(id);
  const off = [((k % 4) - 1.5) * 1.4, (Math.floor(k / 4) % 3 - 1) * 1.6]; // small, so counters stay on the board
  const at = s => centre(s).map((v, i) => v + off[i]);
  const p = ctx.room.players[id];
  const last = round.last;
  const now = ctx.now();
  let [x, y] = at(round.pos[id]);
  let walking = false;
  if (live && last?.by === id && (last.kind === 'roll' || last.kind === 'boost') && now < round.busyUntil) {
    walking = true;
    let e = now - last.t - (last.kind === 'roll' ? SPIN_MS : 0);
    const steps = last.land - last.from;
    if (e < 0) [x, y] = at(last.from);
    else if (e < steps * STEP_MS) {
      const i = Math.floor(e / STEP_MS), f = (e % STEP_MS) / STEP_MS;
      const [ax, ay] = at(last.from + i), [bx, by] = at(last.from + i + 1);
      [x, y] = [ax + (bx - ax) * f, ay + (by - ay) * f - Math.sin(Math.PI * f) * 2.2];
    } else if (last.to !== last.land && (e -= steps * STEP_MS) < SLIDE_MS) {
      const f = e / SLIDE_MS, [ax, ay] = at(last.land), [bx, by] = at(last.to);
      [x, y] = [ax + (bx - ax) * f, ay + (by - ay) * f];
    } else if (last.to !== last.land || e >= 0) [x, y] = at(last.to);
  }
  return svg`<g class="sl-token ${walking ? 'sl-token--walking' : ''}" style="transform: translate(${x}px, ${y}px)">
    <circle r="3.4" fill="#fff" stroke=${inkOf(k)} stroke-width=${id === ctx.uid ? 1 : 0.7} />
    ${p ? svg`<svg x="-2.7" y="-3.1" width="5.4" height="5.85" viewBox="0 0 48 52">${avatar(p, 48)}</svg>` : nothing}
  </g>`;
}

// Hand-drawn arrows at the end of each row: up the edge, then across into the next row's direction.
function turnArrows() {
  return svg`${[...Array(9).keys()].map(row => {
    const right = row % 2 === 0;
    const X = x => (right ? x : 100 - x); // drawn for the right edge, mirrored for the left
    const yc = (9 - row) * 10 + 7, yUp = yc - 9.2;
    return svg`<path class="sl-turn" d="M${X(97.6)} ${yc} Q${X(98.7)} ${yc - 4.6} ${X(97.9)} ${yUp + 1.3} Q${X(97.6)} ${yUp - 0.2} ${X(96.1)} ${yUp} L${X(93.4)} ${yUp + 0.4}
      M${X(94.9)} ${yUp - 1.1} L${X(93.4)} ${yUp + 0.4} L${X(95)} ${yUp + 1.8}" />`;
  })}`;
}

// A power-up square: a doodled box with a question mark.
function box(s, fades) {
  const [x, y] = centre(s);
  return svg`<g class="sl-box ${fades ? 'sl-box--fading' : ''}"><rect x=${x - 3.6} y=${y - 3} width="7.2" height="7.2" rx="1.4" /><text x=${x} y=${y + 2.6}>?</text></g>`;
}

// A 3D dice: six faces on a cube. A roll tosses it up, spins it over and over, and lands it with
// the rolled number facing out.
const PIPS = { 1: [[12, 12]], 2: [[7, 7], [17, 17]], 3: [[7, 7], [12, 12], [17, 17]], 4: [[7, 7], [17, 7], [7, 17], [17, 17]],
  5: [[7, 7], [17, 7], [12, 12], [7, 17], [17, 17]], 6: [[7, 7], [17, 7], [7, 12], [17, 12], [7, 17], [17, 17]] };
const FACING = { 1: [0, 0], 2: [-90, 0], 3: [0, -90], 4: [0, 90], 5: [90, 0], 6: [0, 180] }; // turns that bring each face to the front
function cube(n, rolling, i) {
  const [fx, fy] = FACING[n];
  const style = `--fx: ${fx}deg; --fy: ${fy}deg; --sx: ${fx + 720 + i * 90}deg; --sy: ${fy - 540 + i * 180}deg; --delay: ${i * 90}ms`;
  return html`<span class="sl-cube-wrap ${rolling ? 'sl-cube-wrap--roll' : ''}" style=${style}>
    <span class="sl-cube">${[1, 2, 3, 4, 5, 6].map(f => html`<span class="sl-face sl-face--${f}"><svg viewBox="0 0 24 24" aria-hidden="true">
      ${PIPS[f].map(([x, y]) => svg`<circle cx=${x} cy=${y} r="2.1" fill="#222" />`)}</svg></span>`)}</span>
    <span class="sl-shadow"></span>
  </span>`;
}

// The dice is the roll button: on your turn it bobs and glows, and tapping it rolls.
function diceButton(ctx, { ready, double, last, isRoll, spinning }) {
  const shown = ready ? Array(double ? 2 : 1).fill(isRoll ? last.roll[0] : 1) : isRoll ? last.roll : [1];
  const label = ready ? 'Roll the dice' : spinning ? 'Rolling' : `Rolled ${shown.join(' and ')}`;
  return keyed(isRoll && !ready ? last.n : `ready:${ready}:${shown.length}`, html`<button class="sl-dice ${ready ? 'sl-dice--ready' : ''}" ?disabled=${!ready}
    aria-label=${label} @click=${() => rollFor(ctx, ctx.uid).catch(() => toast("That didn't go through. Try again?"))}>
    ${shown.map((v, i) => cube(v, isRoll && !ready, i))}</button>`);
}

// Doodled icons for the power-ups.
const ICONS = {
  double: svg`<rect x="2.5" y="7" width="11" height="11" rx="2.5" fill="#fff" /><rect x="10.5" y="3" width="11" height="11" rx="2.5" fill="#fff" />
    <circle cx="6" cy="10.5" r="1.1" fill="#222" stroke="none" /><circle cx="10" cy="14.5" r="1.1" fill="#222" stroke="none" /><circle cx="16" cy="8.5" r="1.1" fill="#222" stroke="none" />`,
  again: svg`<path d="M19 12 a7 7 0 1 1 -2.2 -5.1" fill="none" /><path d="M17.6 2.8 l-0.6 4.4 l-4.4 -0.4" fill="none" />`,
  boost: svg`<path d="M3 19 q5 -14 11 -6 q3 4 7 -6" fill="none" /><path d="M17.5 6.5 l3.8 0.4 l-0.3 3.8" fill="none" /><text x="6" y="22.5" class="sl-icon-num">3</text>`,
  shield: svg`<path d="M12 2.8 l7.5 3 v5.5 c0 5 -3.5 8.2 -7.5 10 c-4 -1.8 -7.5 -5 -7.5 -10 v-5.5 z" fill="#fff" /><path d="M8.3 12 l2.6 2.7 l4.8 -5.2" fill="none" />`,
  swap: svg`<path d="M4 8.5 h14 M14.5 4.8 l3.8 3.7 l-3.8 3.7 M20 15.5 h-14 M9.5 11.8 l-3.8 3.7 l3.8 3.7" fill="none" />`,
  push: svg`<path d="M20 12 h-14 M10 7.5 l-4.5 4.5 l4.5 4.5" fill="none" /><text x="14.5" y="21.5" class="sl-icon-num">5</text>`,
  shift: svg`<path d="M7 3 v18 M13 3 v18 M7 7.5 h6 M7 12 h6 M7 16.5 h6" fill="none" /><path d="M17 9 l3 3 l-3 3 M20 12 h-4" fill="none" />`,
};
const icon = kind => html`<svg class="sl-icon" viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[kind]}</g></svg>`;

// A power-up card. The one you can use right now is a button: tap the card to play it.
function card(kind, { next, usable, onUse }) {
  const p = POWERS[kind];
  const inner = html`<span class="sl-card__icon">${icon(kind)}</span><b>${p.name}</b><small>${next ? 'Next up' : p.note}</small>${usable ? html`<span class="sl-card__go">Tap to use</span>` : nothing}`;
  return usable
    ? html`<button class="sl-card sl-card--ready wobble" style="--c: ${p.colour}" @click=${onUse}>${inner}</button>`
    : html`<div class="sl-card ${next ? 'sl-card--next' : ''} wobble" style="--c: ${p.colour}">${inner}</div>`;
}

function ladder(a, b, fresh) {
  const [x1, y1] = centre(a);
  const [x2, y2] = centre(b);
  const len = Math.hypot(x2 - x1, y2 - y1);
  const [nx, ny] = [-(y2 - y1) / len * 1.8, (x2 - x1) / len * 1.8];
  const rungs = [];
  for (let d = 2.5; d < len - 1; d += 3.2) {
    const [px, py] = [x1 + ((x2 - x1) * d) / len, y1 + ((y2 - y1) * d) / len];
    rungs.push(`M${px + nx} ${py + ny} L${px - nx} ${py - ny}`);
  }
  return svg`<g class="sl-ladder ${fresh ? 'sl-fresh' : ''}"><path d="M${x1 + nx} ${y1 + ny} L${x2 + nx} ${y2 + ny} M${x1 - nx} ${y1 - ny} L${x2 - nx} ${y2 - ny} ${rungs.join(' ')}" /></g>`;
}

const SNAKE_INKS = ['#3fae6a', '#9b5fd0', '#e0609f', '#1fa5a5', '#d99a1e', '#4a8fd8', '#e05a4f'];
function snake(a, b, k, fresh) {
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
  return svg`<g class="sl-snake ${fresh ? 'sl-fresh' : ''}">
    <path class="sl-snake__outline" d="M${pts.join(' L')}" />
    <path class="sl-snake__body" d="M${pts.join(' L')}" stroke=${ink} />
    <circle cx=${x1} cy=${y1} r="2.3" fill=${ink} stroke="#222" stroke-width="0.5" />
    <circle cx=${x1 - 0.8} cy=${y1 - 0.5} r="0.45" fill="#222" /><circle cx=${x1 + 0.8} cy=${y1 - 0.5} r="0.45" fill="#222" />
  </g>`;
}

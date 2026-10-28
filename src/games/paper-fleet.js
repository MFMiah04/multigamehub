import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, action, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { roomRef } from '../room.js';
import { backToLobbyButton, endScreen, endTitle, sideResult } from './common.js';
import { cue } from '../sound.js';

// Ship lengths for each board size.
const FLEETS = { 8: [4, 3, 3, 2, 2], 10: [5, 4, 3, 3, 2] };
const CELL = 10; // board units per square; the svg scales to fit

const cellsOf = ship => Array.from({ length: ship.len }, (_, i) => [ship.x + (ship.down ? 0 : i), ship.y + (ship.down ? i : 0)]);
const key = (x, y) => `${x}_${y}`;
const opponentOf = (round, id) => round.order.find(p => p !== id);

// Whether a ship fits on the board without touching another (not even at the corners).
function fits(ship, others, size) {
  const cells = cellsOf(ship);
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= size || y >= size)) return false;
  return others.every(o => cellsOf(o).every(([ox, oy]) => cells.every(([x, y]) => Math.abs(x - ox) > 1 || Math.abs(y - oy) > 1)));
}

function randomFleet(size) {
  for (;;) {
    const fleet = [];
    for (const len of FLEETS[size]) {
      for (let tries = 0; tries < 200; tries++) {
        const ship = { len, down: Math.random() < 0.5, x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
        if (fits(ship, fleet, size)) { fleet.push(ship); break; }
      }
    }
    if (fleet.length === FLEETS[size].length) return fleet;
  }
}

// What's been fired at a fleet: hits, misses and the ships that are sunk.
function damage(fleet = [], shots = {}) {
  const sunk = fleet.filter(ship => cellsOf(ship).every(([x, y]) => shots[key(x, y)]));
  const hit = new Set(fleet.flatMap(cellsOf).map(([x, y]) => key(x, y)));
  return { sunk, hit, allSunk: fleet.length > 0 && sunk.length === fleet.length };
}

// Fires at a square. A transaction, so a double tap can't fire twice or out of turn.
function fire(ctx, x, y) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.winner || round.stage !== 'battle' || round.turn !== ctx.uid) return undefined;
    const target = opponentOf(round, ctx.uid);
    const shots = round.shots?.[ctx.uid] || {};
    if (shots[key(x, y)]) return undefined;
    shots[key(x, y)] = true;
    round.shots = { ...round.shots, [ctx.uid]: shots };
    const fleet = round.fleets[target];
    const ship = fleet.find(s => cellsOf(s).some(([cx, cy]) => cx === x && cy === y));
    const sank = ship && cellsOf(ship).every(([cx, cy]) => shots[key(cx, cy)]);
    round.last = { by: ctx.uid, x, y, hit: !!ship, sank: sank ? ship.len : 0, n: Object.keys(shots).length };
    if (damage(fleet, shots).allSunk) round.winner = ctx.uid;
    else round.turn = target;
    return round;
  });
}

// Locks in your fleet. Whoever is ready second starts the battle.
function ready(ctx, fleet) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.stage !== 'place') return undefined;
    round.fleets = { ...round.fleets, [ctx.uid]: fleet };
    if (round.order.every(id => round.fleets[id])) round.stage = 'battle';
    return round;
  });
}

export default {
  id: 'paper-fleet',
  name: 'Paper Fleet',
  color: 'cyan',
  players: '2',
  blurb: 'Hide your ships on the grid and sink the other fleet first.',
  rules: [
    'Each of you hides a fleet of ships on your own grid. Ships can\'t touch.',
    'Take turns firing at a square on the other grid. You\'ll see a splash for a miss, or a cross for a hit.',
    'Hit every square of a ship to sink it.',
    'Sink the whole fleet first to win.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8 h52 v42 h-52 z M19 8 v42 M32 8 v42 M45 8 v42 M6 22 h52 M6 36 h52" stroke-width="1.4" stroke="#7a9cc6" />
    <rect x="9" y="24" width="33" height="10" rx="5" fill="#c9d3de" />
    <path d="M48 11 l7 7 M55 11 l-7 7" stroke="#e05a4f" stroke-width="2.6" />
    <circle cx="51" cy="43" r="3.5" stroke="#4a8fd8" /><circle cx="25" cy="15" r="3.5" stroke="#4a8fd8" />
  </g></svg>`,

  defaults: () => ({ size: 10 }),

  settingsView(ctx, s, set) {
    return selectField('Grid', s.size, [[10, '10 × 10 (5 ships)'], [8, '8 × 8 (quicker)']], v => set({ size: +v }), !ctx.isHost);
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 2 ? 'Just 2 players for this one' : null),

  start(ctx, s) {
    const order = ctx.players.map(p => p.id);
    const size = FLEETS[s.size] ? s.size : 10;
    return { phase: 'play', round: { stage: 'place', size, order, turn: order[Math.floor(Math.random() * 2)] } };
  },

  // If one player leaves, the other wins.
  tick(ctx) {
    const { round } = ctx;
    if (round.winner) return null;
    const left = round.order.filter(id => !ctx.room.players[id]);
    if (left.length !== 1) return null;
    return { 'round/winner': opponentOf(round, left[0]), 'round/forfeit': true };
  },

  view(ctx) {
    const { round } = ctx;
    if (!round.order?.includes(ctx.uid)) return watching(ctx);
    if (round.winner) return finished(ctx);
    return round.stage === 'place' ? placing(ctx) : battle(ctx);
  },
};

// ----- drawing a board -----

const SPLASH = (x, y) => svg`<circle class="pf-miss" cx=${x * CELL + 5} cy=${y * CELL + 5} r="1.7" />`;
const CROSS = (x, y) => svg`<path class="pf-hit" d="M${x * CELL + 2.3} ${y * CELL + 2.3} l5.4 5.4 M${x * CELL + 7.7} ${y * CELL + 2.3} l-5.4 5.4" />`;
const shipShape = (ship, cls = '') => svg`<rect class="pf-ship ${cls}" x=${ship.x * CELL + 1.3} y=${ship.y * CELL + 1.3}
  width=${(ship.down ? 1 : ship.len) * CELL - 2.6} height=${(ship.down ? ship.len : 1) * CELL - 2.6} rx="3.6" />`;

// One grid. `ships` are drawn, `shots` are marked, and `onCell` makes the squares tappable.
function board({ size, ships = [], shots = {}, hits, sunk = [], onCell, can = () => true, last, cls = '', label }) {
  const span = size * CELL;
  const squares = [];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const open = onCell && !shots[key(x, y)] && can(x, y);
    squares.push(svg`<rect class="pf-cell ${open ? 'pf-cell--open' : ''}" x=${x * CELL} y=${y * CELL} width=${CELL} height=${CELL} />`);
  }
  // Works out the square from where the tap landed on the board.
  const tap = e => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.floor((((e.clientX - r.left) / r.width) * (span + 2) - 1) / CELL);
    const y = Math.floor((((e.clientY - r.top) / r.height) * (span + 2) - 1) / CELL);
    if (x >= 0 && y >= 0 && x < size && y < size && !shots[key(x, y)] && can(x, y)) onCell(x, y);
  };
  return html`<svg class="pf-board ${cls}" viewBox="-1 -1 ${span + 2} ${span + 2}" role="img" aria-label=${label} @click=${onCell ? tap : null}>
    <rect class="pf-water" x="0" y="0" width=${span} height=${span} rx="1" />
    ${squares}
    ${ships.map(s => shipShape(s.ship || s, s.cls))}
    ${sunk.map(s => shipShape(s, 'pf-ship--sunk'))}
    ${Object.keys(shots).map(k => { const [x, y] = k.split('_').map(Number); return hits.has(k) ? CROSS(x, y) : SPLASH(x, y); })}
    ${last ? svg`<rect class="pf-last" x=${last.x * CELL + 0.5} y=${last.y * CELL + 0.5} width=${CELL - 1} height=${CELL - 1} rx="2" />` : nothing}
  </svg>`;
}

// The other fleet's ships, crossed out once sunk.
const fleetLeft = (size, sunk) => {
  const left = [...sunk.map(s => s.len)];
  return html`<div class="pf-tally" aria-label="Ships left">${FLEETS[size].map(len => {
    const gone = left.indexOf(len) >= 0 && left.splice(left.indexOf(len), 1);
    return html`<span class="pf-tally__ship ${gone ? 'pf-tally__ship--sunk' : ''}" style="--len: ${len}"></span>`;
  })}</div>`;
};

// ----- placing ships -----

function placing(ctx) {
  const { round, local } = ctx;
  const size = round.size;
  const mine = round.fleets?.[ctx.uid];
  const other = ctx.room.players[opponentOf(round, ctx.uid)];
  if (mine) {
    return html`<p class="pf-status center">Waiting for ${other?.name || 'the other player'} to hide their ships…</p>
      <div class="pf-solo">${board({ size, ships: mine, hits: new Set(), label: 'Your fleet' })}</div>`;
  }
  local.fleet ||= randomFleet(size);
  const fleet = local.fleet;
  const pick = local.pick;
  const set = next => { local.fleet = next; ctx.rerender(); };
  // Tap a ship to pick it up, then tap a square to move it there. Tap it again to turn it.
  const tap = (x, y) => {
    const at = fleet.findIndex(s => cellsOf(s).some(([cx, cy]) => cx === x && cy === y));
    if (pick === undefined) { if (at >= 0) { local.pick = at; ctx.rerender(); } return; }
    const others = fleet.filter((_, i) => i !== pick);
    const ship = fleet[pick];
    const moved = at === pick ? { ...ship, down: !ship.down } : { ...ship, x, y };
    if (fits(moved, others, size)) { local.pick = at === pick ? pick : undefined; set(fleet.map((s, i) => (i === pick ? moved : s))); }
    else if (at >= 0 && at !== pick) { local.pick = at; ctx.rerender(); }
    else { local.pick = undefined; ctx.rerender(); }
  };
  return html`<p class="pf-status center">${pick === undefined ? 'Hide your ships. Tap one to move it.' : 'Tap a square to move it there, or tap it again to turn it.'}</p>
    <div class="pf-solo">${board({ size, ships: fleet.map((ship, i) => ({ ship, cls: i === pick ? 'pf-ship--picked' : '' })), hits: new Set(), onCell: tap, label: 'Your fleet' })}</div>
    <div class="pf-actions">
      ${button('Shuffle', () => { local.pick = undefined; set(randomFleet(size)); }, { kind: 'white' })}
      ${button('Ready', action(() => ready(ctx, fleet)), { kind: 'mint' })}
    </div>`;
}

// ----- the battle -----

function battle(ctx) {
  const { round } = ctx;
  const size = round.size;
  const themId = opponentOf(round, ctx.uid);
  const them = ctx.room.players[themId];
  const myTurn = round.turn === ctx.uid;
  const myShots = round.shots?.[ctx.uid] || {};
  const theirShots = round.shots?.[themId] || {};
  const atThem = damage(round.fleets[themId], myShots);
  const atMe = damage(round.fleets[ctx.uid], theirShots);
  const last = round.last;
  const name = them?.name || 'They';

  if (last) cue(`pf:${round.order}:${last.by}:${last.n}`, last.sank ? 'score' : last.hit ? 'buzz' : 'pop');
  if (myTurn) cue(`pf:${round.order}:turn:${Object.keys(myShots).length}`, 'ding');

  const news = !last ? (myTurn ? 'You go first.' : `${name} goes first.`)
    : last.by === ctx.uid ? (last.sank ? `You sank a ${last.sank}-square ship!` : last.hit ? 'Hit!' : 'Miss.')
      : (last.sank ? `${name} sank your ${last.sank}-square ship!` : last.hit ? `${name} hit you!` : `${name} missed.`);

  // On phones the board that matters this turn is big and the other is small. Side by side on wider screens.
  return html`<p class="pf-status center"><b>${news}</b> ${myTurn ? 'Your turn: tap a square to fire.' : `Waiting for ${name}…`}</p>
    <div class="pf-boards ${myTurn ? 'pf-boards--attack' : 'pf-boards--defend'}">
      <section class="pf-side pf-side--them ${myTurn ? 'pf-side--active' : ''}">
        <h3 class="pf-side__title">${them ? avatar(them, 22) : nothing} ${name}'s waters</h3>
        ${board({ size, shots: myShots, hits: atThem.hit, sunk: atThem.sunk, onCell: myTurn ? (x, y) => fire(ctx, x, y).catch(() => toast("That shot didn't go through. Try again?")) : null,
          last: last?.by === ctx.uid ? last : null, cls: myTurn ? 'pf-board--aim' : '', label: `${name}'s grid` })}
        ${fleetLeft(size, atThem.sunk)}
      </section>
      <section class="pf-side pf-side--me ${myTurn ? '' : 'pf-side--active'}">
        <h3 class="pf-side__title">${avatar(ctx.me, 22)} Your fleet</h3>
        ${board({ size, ships: round.fleets[ctx.uid], shots: theirShots, hits: atMe.hit, last: last?.by === themId ? last : null, label: 'Your grid' })}
        ${fleetLeft(size, atMe.sunk)}
      </section>
    </div>`;
}

// ----- someone who isn't one of the two players -----

function watching(ctx) {
  const { round } = ctx;
  const [a, b] = round.order.map(id => ctx.room.players[id]);
  return html`<p class="pf-status center">${a?.name || 'Someone'} and ${b?.name || 'someone'} are at sea.</p>
    ${round.winner ? backToLobbyButton(ctx) : nothing}`;
}

// ----- the end: both fleets on show -----

function finished(ctx) {
  const { round } = ctx;
  const themId = opponentOf(round, ctx.uid);
  const them = ctx.room.players[themId];
  const name = them?.name || 'They';
  const won = round.winner === ctx.uid;
  const win = sideResult(ctx, () => won);
  const myShots = round.shots?.[ctx.uid] || {};
  const theirShots = round.shots?.[themId] || {};
  const atThem = damage(round.fleets?.[themId], myShots);
  const atMe = damage(round.fleets?.[ctx.uid], theirShots);
  const accuracy = shots => { const n = Object.keys(shots).length; return n ? Math.round(100 * Object.keys(shots).filter(k => (shots === myShots ? atThem : atMe).hit.has(k)).length / n) : 0; };
  const note = round.forfeit ? `${name} left the game.` : `You hit ${accuracy(myShots)}% of your shots. ${name} hit ${accuracy(theirShots)}%.`;
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: 'You sank their fleet!', lost: 'Your fleet sank!' }), note })}
    <div class="pf-boards pf-boards--end">
      <section class="pf-side">
        <h3 class="pf-side__title">${them ? avatar(them, 22) : nothing} ${name}'s fleet</h3>
        ${board({ size: round.size, ships: (round.fleets?.[themId] || []).filter(s => !atThem.sunk.includes(s)).map(ship => ({ ship, cls: 'pf-ship--revealed' })),
          shots: myShots, hits: atThem.hit, sunk: atThem.sunk, label: `${name}'s grid` })}
      </section>
      <section class="pf-side">
        <h3 class="pf-side__title">${avatar(ctx.me, 22)} Your fleet</h3>
        ${board({ size: round.size, ships: round.fleets?.[ctx.uid] || [], shots: theirShots, hits: atMe.hit, label: 'Your grid' })}
      </section>
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

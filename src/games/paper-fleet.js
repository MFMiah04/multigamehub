import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, action, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { roomRef } from '../room.js';
import { backToLobbyButton, endScreen, endTitle, sideResult } from './common.js';
import { cue } from '../sound.js';

// The ships, and which go to sea on each size of grid.
const SHIPS = { carrier: 5, battleship: 4, cruiser: 3, submarine: 3, destroyer: 2 };
const FLEETS = { 10: ['carrier', 'battleship', 'cruiser', 'submarine', 'destroyer'], 8: ['battleship', 'cruiser', 'submarine', 'destroyer'] };
const CELL = 10; // board units per square; the svg scales to fit
const MARGIN = 8; // room for the A–J and 1–10 labels
const LETTERS = 'ABCDEFGHIJ';

// A ship is its stern square (x, y) and the way its bow points: 0 right, 1 down, 2 left, 3 up.
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
const cellsOf = s => Array.from({ length: s.len }, (_, i) => [s.x + DIRS[s.d][0] * i, s.y + DIRS[s.d][1] * i]);
const key = (x, y) => `${x}_${y}`;
const opponentOf = (round, id) => round.order.find(p => p !== id);

// Whether a ship is on the board without overlapping another. Random fleets also keep ships apart.
function fits(ship, others, size, apart = false) {
  const cells = cellsOf(ship);
  if (cells.some(([x, y]) => x < 0 || y < 0 || x >= size || y >= size)) return false;
  return others.every(o => cellsOf(o).every(([ox, oy]) => cells.every(([x, y]) =>
    (apart ? Math.max(Math.abs(x - ox), Math.abs(y - oy)) > 1 : x !== ox || y !== oy))));
}

function randomFleet(size) {
  for (;;) {
    const fleet = [];
    for (const t of FLEETS[size]) {
      for (let tries = 0; tries < 200; tries++) {
        const ship = { t, len: SHIPS[t], d: Math.floor(Math.random() * 4), x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size), placed: true };
        if (fits(ship, fleet, size, true)) { fleet.push(ship); break; }
      }
    }
    if (fleet.length === FLEETS[size].length) return fleet;
  }
}

// A quarter turn clockwise, around the middle of the ship. If that doesn't fit, it tries
// turning around the other squares, so a ship by the edge still turns.
function turned(fleet, i, size) {
  const s = fleet[i];
  const others = fleet.filter((o, j) => j !== i && o.placed);
  const mid = Math.floor((s.len - 1) / 2);
  const pivots = [...Array(s.len).keys()].sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
  const d = (s.d + 1) % 4;
  for (const p of pivots) {
    const px = s.x + DIRS[s.d][0] * p, py = s.y + DIRS[s.d][1] * p;
    const next = { ...s, d, x: px - DIRS[d][0] * p, y: py - DIRS[d][1] * p };
    if (fits(next, others, size)) return next;
  }
  return null;
}

// What's been fired at a fleet: the squares hit and the ships sunk.
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
    round.last = { by: ctx.uid, x, y, hit: !!ship, sank: sank ? ship.t : null, n: Object.keys(shots).length };
    if (damage(fleet, shots).allSunk) round.winner = ctx.uid;
    else round.turn = target;
    return round;
  });
}

// Locks in your fleet. Whoever is ready second starts the battle.
function ready(ctx, fleet) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.stage !== 'place') return undefined;
    round.fleets = { ...round.fleets, [ctx.uid]: fleet.map(({ t, len, x, y, d }) => ({ t, len, x, y, d })) };
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
    'Each of you hides a fleet on your own grid: drag the ships into place, and tap one to turn it.',
    'Take turns firing at a square on the other grid. A splash is a miss, a cross is a hit.',
    'Hit every square of a ship to sink it.',
    'Sink the whole fleet first to win.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 8 h52 v42 h-52 z M19 8 v42 M32 8 v42 M45 8 v42 M6 22 h52 M6 36 h52" stroke-width="1.4" stroke="#7a9cc6" />
    <path d="M9 25 H34 C39 25 42 27.5 42.5 29 C42 30.5 39 33 34 33 H9 Z" fill="#c9d3de" />
    <circle cx="16" cy="29" r="2.4" fill="#aab6c3" stroke-width="1.6" /><circle cx="33" cy="29" r="2.4" fill="#aab6c3" stroke-width="1.6" />
    <path d="M48 11 l7 7 M55 11 l-7 7" stroke="#e05a4f" stroke-width="2.6" />
    <circle cx="51" cy="43" r="3.5" stroke="#4a8fd8" /><circle cx="25" cy="15" r="3.5" stroke="#4a8fd8" />
  </g></svg>`,

  defaults: () => ({ size: 10 }),

  settingsView(ctx, s, set) {
    return selectField('Grid', s.size, [[10, '10 × 10 (5 ships)'], [8, '8 × 8 (4 ships, quicker)']], v => set({ size: +v }), !ctx.isHost);
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

// ----- the ships, seen from above -----

// Each is drawn pointing right, centred on its stern square, `len` squares long.
const bowAt = len => len * CELL - 5;
const hull = len => { const e = bowAt(len); return svg`<path class="pf-hull" d="M-4.2 -3.4 H${e - 8} Q${e - 2.5} -3.2 ${e - 0.3} 0 Q${e - 2.5} 3.2 ${e - 8} 3.4 H-4.2 Q-4.8 3.4 -4.8 2.6 V-2.6 Q-4.8 -3.4 -4.2 -3.4 Z" />`; };
const turret = (cx, dir = 1) => svg`<path class="pf-line" d="M${cx} -0.6 h${3.4 * dir} M${cx} 0.6 h${3.4 * dir}" /><circle class="pf-detail" cx=${cx} cy="0" r="1.8" />`;
const bridge = (x, w) => svg`<rect class="pf-detail" x=${x} y="-2" width=${w} height="4" rx="1" />`;
const plane = x => svg`<path class="pf-line" d="M${x} -0.8 h4 M${x + 2.6} -2.6 v3.6 M${x + 0.4} -1.8 v2" />`;
const ART = {
  carrier: () => svg`<path class="pf-hull" d="M-4.6 -4 H${bowAt(5) - 4} L${bowAt(5) - 0.4} -1.8 V1.8 L${bowAt(5) - 4} 4 H-4.6 Z" />
    <path class="pf-line pf-runway" d="M-2 1.2 H${bowAt(5) - 3}" /><path class="pf-line" d="M4 3 L22 -0.6" />
    <rect class="pf-detail" x="20" y="-3.8" width="8" height="2.4" rx="0.6" />${plane(4)}${plane(31)}`,
  battleship: () => svg`${hull(4)}${turret(1, -1)}${bridge(7, 9)}<rect class="pf-detail" x="9" y="-1.2" width="5" height="2.4" rx="0.6" />
    <circle class="pf-detail" cx="19" cy="0" r="1.4" />${turret(23.5)}${turret(29)}`,
  cruiser: () => svg`${hull(3)}${turret(1, -1)}${bridge(6, 7)}${turret(18.5)}`,
  submarine: () => svg`<path class="pf-hull pf-hull--sub" d="M-3 -2.6 H19 C23 -2.6 24.5 -1 24.5 0 C24.5 1 23 2.6 19 2.6 H-3 C-4.4 2.6 -4.8 1 -4.8 0 C-4.8 -1 -4.4 -2.6 -3 -2.6 Z" />
    <path class="pf-line" d="M-4.4 -3.8 L-1.6 -2.6 M-4.4 3.8 L-1.6 2.6" /><rect class="pf-detail" x="7" y="-1.4" width="6.5" height="2.8" rx="1.4" />`,
  destroyer: () => svg`${hull(2)}${bridge(-1.5, 5)}<circle class="pf-detail" cx="6" cy="0" r="1.1" />${turret(10.5)}`,
};
const shipArt = s => svg`<g class="pf-art" transform="translate(${s.x * CELL + 5} ${s.y * CELL + 5}) rotate(${s.d * 90})">${ART[s.t]()}</g>`;

// One ship on its own, for the dock, the tallies and the one being dragged.
function shipSvg(s, cellPx) {
  const [dx, dy] = DIRS[s.d || 0];
  const minX = Math.min(0, dx * (s.len - 1)), minY = Math.min(0, dy * (s.len - 1));
  const w = Math.abs(dx) * (s.len - 1) + 1, h = Math.abs(dy) * (s.len - 1) + 1;
  return html`<svg class="pf-one" viewBox="${minX * CELL} ${minY * CELL} ${w * CELL} ${h * CELL}" aria-hidden="true"
    style=${cellPx ? `width: ${w * cellPx}px; height: ${h * cellPx}px` : ''}>${shipArt({ ...s, x: 0, y: 0, d: s.d || 0 })}</svg>`;
}

// ----- drawing a board -----

const SPLASH = (x, y) => svg`<circle class="pf-miss" cx=${x * CELL + 5} cy=${y * CELL + 5} r="1.7" />`;
const CROSS = (x, y) => svg`<path class="pf-hit" d="M${x * CELL + 2.3} ${y * CELL + 2.3} l5.4 5.4 M${x * CELL + 7.7} ${y * CELL + 2.3} l-5.4 5.4" />`;

// The square of the board under a pointer, or null off the grid.
function cellAt(board, e, size) {
  if (!board) return null;
  const r = board.getBoundingClientRect();
  const vb = board.viewBox.baseVal;
  const x = Math.floor((vb.x + ((e.clientX - r.left) / r.width) * vb.width) / CELL);
  const y = Math.floor((vb.y + ((e.clientY - r.top) / r.height) * vb.height) / CELL);
  return x >= 0 && y >= 0 && x < size && y < size ? [x, y] : null;
}

// One grid with its letters and numbers. `ships` are { ship, cls } to draw; `shots` are marked;
// `onCell` makes the squares tappable.
function board({ size, ships = [], shots = {}, hits = new Set(), onCell, onDown, last, cls = '', label }) {
  const span = size * CELL;
  const lines = [];
  for (let i = 1; i < size; i++) lines.push(`M${i * CELL} 0 V${span} M0 ${i * CELL} H${span}`);
  const tap = e => { const c = cellAt(e.currentTarget, e, size); if (c && !shots[key(...c)]) onCell(...c); };
  return html`<svg class="pf-board ${cls}" viewBox="${-MARGIN} ${-MARGIN} ${span + MARGIN + 1} ${span + MARGIN + 1}" role="img" aria-label=${label}
    @click=${onCell ? tap : null} @pointerdown=${onDown || null}>
    <rect class="pf-water" x="0" y="0" width=${span} height=${span} rx="1" />
    <path class="pf-grid" d=${lines.join(' ')} />
    ${[...Array(size).keys()].map(i => svg`<text class="pf-label" x=${i * CELL + 5} y="-2.6">${i + 1}</text>
      <text class="pf-label" x="-4" y=${i * CELL + 6.8}>${LETTERS[i]}</text>`)}
    <svg x="0" y="0" width=${span} height=${span} viewBox="0 0 ${span} ${span}">${ships.map(({ ship, cls: c = '' }) => svg`<g class="pf-ship ${c}">${shipArt(ship)}</g>`)}</svg>
    ${Object.keys(shots).map(k => { const [x, y] = k.split('_').map(Number); return hits.has(k) ? CROSS(x, y) : SPLASH(x, y); })}
    ${last ? svg`<rect class="pf-last" x=${last.x * CELL + 0.5} y=${last.y * CELL + 0.5} width=${CELL - 1} height=${CELL - 1} rx="2" />` : nothing}
  </svg>`;
}

// A fleet's ships stacked beside its board, crossed out once sunk.
const tally = (size, sunk) => {
  const gone = new Set(sunk.map(s => s.t));
  return html`<div class="pf-tally" aria-label="Ships">${FLEETS[size].map(t => html`<span class="pf-tally__ship ${gone.has(t) ? 'pf-tally__ship--sunk' : ''}" title=${t} style="--len: ${SHIPS[t]}">
    ${shipSvg({ t, len: SHIPS[t], d: 0 })}</span>`)}</div>`;
};

// A board with its title above and its fleet to the right. These stay put for the whole battle.
const row = ({ title, grid, side, active }) => html`<section class="pf-row ${active ? 'pf-row--active' : ''}">
  <div class="pf-row__board"><h3 class="pf-row__title">${title}</h3>${grid}</div>${side}</section>`;

// ----- placing ships -----

function placing(ctx) {
  const { round, local } = ctx;
  const size = round.size;
  const mine = round.fleets?.[ctx.uid];
  const other = ctx.room.players[opponentOf(round, ctx.uid)];
  if (mine) {
    return html`<div class="pf-place" style="--n: ${size}">
      <p class="pf-status center">Waiting for ${other?.name || 'the other player'} to hide their ships…</p>
      ${board({ size, ships: mine.map(ship => ({ ship })), label: 'Your fleet' })}
    </div>`;
  }

  local.fleet ||= FLEETS[size].map(t => ({ t, len: SHIPS[t], d: 0, x: 0, y: 0, placed: false }));
  const fleet = local.fleet;
  const drag = local.drag;
  const othersOf = i => fleet.filter((s, j) => j !== i && s.placed);
  const gridEl = () => document.querySelector('.pf-place .pf-board');
  // Where a dragged ship would land: the square under the pointer is the bit of the ship you grabbed.
  const landing = (d, [hx, hy]) => { const s = fleet[d.i]; return { ...s, x: hx - DIRS[s.d][0] * d.k, y: hy - DIRS[s.d][1] * d.k, placed: true }; };

  const turn = i => {
    const next = turned(fleet, i, size);
    if (next) { fleet[i] = next; return; }
    local.nope = i; // no room to turn: the ship flashes
    setTimeout(() => { local.nope = null; ctx.rerender(); }, 450);
  };

  // Press on a ship to drag it. A press that doesn't move is a tap, which turns a ship on the grid.
  const begin = (i, k, from, e) => {
    e.preventDefault();
    const g = gridEl().getBoundingClientRect();
    local.drag = { i, k, from, sx: e.clientX, sy: e.clientY, px: e.clientX, py: e.clientY, moved: false, hover: null,
      cellPx: (g.width / gridEl().viewBox.baseVal.width) * CELL };
    const move = ev => {
      const d = local.drag;
      if (!d) return;
      d.px = ev.clientX; d.py = ev.clientY;
      d.moved ||= Math.hypot(d.px - d.sx, d.py - d.sy) > 6;
      d.hover = d.moved ? cellAt(gridEl(), ev, size) : null;
      ctx.rerender();
    };
    const end = ev => {
      ['pointermove', 'pointerup', 'pointercancel'].forEach((t, n) => window.removeEventListener(t, n ? end : move));
      const d = local.drag;
      local.drag = null;
      if (!d || ev.type === 'pointercancel') return ctx.rerender();
      if (!d.moved) { if (d.from === 'board') turn(d.i); return ctx.rerender(); }
      const r = gridEl().getBoundingClientRect();
      const offGrid = ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
      if (d.hover) {
        const next = landing(d, d.hover);
        if (fits(next, othersOf(d.i), size)) fleet[d.i] = next;
      } else if (offGrid && d.from === 'board') {
        fleet[d.i] = { ...fleet[d.i], placed: false, d: 0 }; // dropped off the grid: back to the dock
      }
      ctx.rerender();
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
    ctx.rerender();
  };
  const pressGrid = e => {
    const c = cellAt(e.currentTarget, e, size);
    const i = c ? fleet.findIndex(s => s.placed && cellsOf(s).some(([x, y]) => x === c[0] && y === c[1])) : -1;
    if (i >= 0) begin(i, cellsOf(fleet[i]).findIndex(([x, y]) => x === c[0] && y === c[1]), 'board', e);
  };
  const pressDock = i => e => {
    const r = e.currentTarget.getBoundingClientRect();
    begin(i, Math.min(fleet[i].len - 1, Math.floor(((e.clientX - r.left) / r.width) * fleet[i].len)), 'dock', e);
  };

  const lifted = i => drag?.moved && drag.i === i;
  const ships = fleet.map((ship, i) => ({ ship, i })).filter(o => o.ship.placed)
    .map(({ ship, i }) => ({ ship, cls: lifted(i) ? 'pf-ship--lifted' : local.nope === i ? 'pf-ship--nope' : '' }));
  if (drag?.moved && drag.hover) {
    const next = landing(drag, drag.hover);
    ships.push({ ship: next, cls: fits(next, othersOf(drag.i), size) ? 'pf-ship--preview' : 'pf-ship--bad' });
  }
  // Off the grid, the ship follows your finger, held where you grabbed it.
  let ghost = nothing;
  if (drag?.moved && !drag.hover) {
    const s = fleet[drag.i];
    const [dx, dy] = DIRS[s.d];
    const ox = drag.k * dx - Math.min(0, dx * (s.len - 1)), oy = drag.k * dy - Math.min(0, dy * (s.len - 1));
    ghost = html`<div class="pf-ghost" style="left: ${drag.px - (ox + 0.5) * drag.cellPx}px; top: ${drag.py - (oy + 0.5) * drag.cellPx}px">${shipSvg(s, drag.cellPx)}</div>`;
  }
  const allPlaced = fleet.every(s => s.placed);

  return html`<div class="pf-place" style="--n: ${size}">
    <p class="pf-status center">${allPlaced ? 'Tap a ship to turn it, or drag it somewhere else.' : 'Drag your ships onto the grid. Tap one to turn it.'}</p>
    ${board({ size, ships, onDown: pressGrid, cls: 'pf-board--place', label: 'Your grid' })}
    <div class="pf-dock">
      ${fleet.map((s, i) => (s.placed
        ? html`<span class="pf-dock__slot" style="--len: ${s.len}"></span>`
        : html`<span class="pf-dock__ship ${lifted(i) ? 'pf-dock__ship--lifted' : ''}" style="--len: ${s.len}" title=${s.t}
            @pointerdown=${pressDock(i)}>${shipSvg({ ...s, d: 0 })}</span>`))}
    </div>
    <div class="pf-actions">
      ${button('Random', () => { local.fleet = randomFleet(size); ctx.rerender(); }, { kind: 'white' })}
      ${button('Ready', action(() => ready(ctx, fleet)), { kind: 'mint', disabled: !allPlaced })}
    </div>
    ${ghost}
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
    : last.by === ctx.uid ? (last.sank ? `You sank their ${last.sank}!` : last.hit ? 'Hit!' : 'Miss.')
      : (last.sank ? `${name} sank your ${last.sank}!` : last.hit ? `${name} hit you!` : `${name} missed.`);

  // Their grid on top, yours underneath, like the real thing. Neither moves during the game.
  return html`<div class="pf-play" style="--n: ${size}">
    <p class="pf-status center"><b>${news}</b><br>${myTurn ? `Your turn: fire at ${name}'s grid.` : `Waiting for ${name} to fire…`}</p>
    ${row({ title: html`${them ? avatar(them, 22) : nothing} ${name}'s waters`, active: myTurn, side: tally(size, atThem.sunk),
      grid: board({ size, ships: atThem.sunk.map(ship => ({ ship, cls: 'pf-ship--sunk' })), shots: myShots, hits: atThem.hit,
        onCell: myTurn ? (x, y) => fire(ctx, x, y).catch(() => toast("That shot didn't go through. Try again?")) : null,
        last: last?.by === ctx.uid ? last : null, cls: myTurn ? 'pf-board--aim' : '', label: `${name}'s grid` }) })}
    ${row({ title: html`${avatar(ctx.me, 22)} Your fleet`, active: !myTurn, side: tally(size, atMe.sunk),
      grid: board({ size, ships: round.fleets[ctx.uid].map(ship => ({ ship, cls: atMe.sunk.includes(ship) ? 'pf-ship--sunk' : '' })),
        shots: theirShots, hits: atMe.hit, last: last?.by === themId ? last : null, label: 'Your grid' }) })}
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
  const size = round.size;
  const themId = opponentOf(round, ctx.uid);
  const them = ctx.room.players[themId];
  const name = them?.name || 'They';
  const won = round.winner === ctx.uid;
  const win = sideResult(ctx, () => won);
  const myShots = round.shots?.[ctx.uid] || {};
  const theirShots = round.shots?.[themId] || {};
  const atThem = damage(round.fleets?.[themId], myShots);
  const atMe = damage(round.fleets?.[ctx.uid], theirShots);
  const accuracy = (shots, hit) => { const all = Object.keys(shots); return all.length ? Math.round((100 * all.filter(k => hit.has(k)).length) / all.length) : 0; };
  const note = round.forfeit ? `${name} left the game.` : `You hit ${accuracy(myShots, atThem.hit)}% of your shots. ${name} hit ${accuracy(theirShots, atMe.hit)}%.`;
  const shipsOf = (fleet = [], sunk) => fleet.map(ship => ({ ship, cls: sunk.includes(ship) ? 'pf-ship--sunk' : '' }));
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: 'You sank their fleet!', lost: 'Your fleet sank!' }), note })}
    <div class="pf-play" style="--n: ${size}">
      ${row({ title: html`${them ? avatar(them, 22) : nothing} ${name}'s fleet`, side: tally(size, atThem.sunk),
        grid: board({ size, ships: shipsOf(round.fleets?.[themId], atThem.sunk), shots: myShots, hits: atThem.hit, label: `${name}'s grid` }) })}
      ${row({ title: html`${avatar(ctx.me, 22)} Your fleet`, side: tally(size, atMe.sunk),
        grid: board({ size, ships: shipsOf(round.fleets?.[ctx.uid], atMe.sunk), shots: theirShots, hits: atMe.hit, label: 'Your grid' }) })}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

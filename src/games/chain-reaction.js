import { runTransaction } from 'firebase/database';
import { html, nothing, button, action, avatar, toast } from '../ui.js';
import { svg } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef } from '../room.js';
import { backToLobbyButton, endScreen, endTitle } from './common.js';
import { cue } from '../sound.js';

const CELL = 10; // board units per square
// Each player's ink, in turn order.
const INKS = ['#e05a4f', '#4a8fd8', '#3fae6a', '#d99a1e', '#9b5fd0', '#1fa5a5', '#e0609f', '#8a5a3c'];
// Bigger groups get a bigger board.
const sizeFor = players => (players <= 3 ? [7, 7] : players <= 5 ? [8, 8] : [9, 9]);

// The board is a string, two characters a square: the owner's turn-order number (or "-") and how many dots.
const decode = s => Array.from({ length: s.length / 2 }, (_, i) => ({ o: s[2 * i] === '-' ? -1 : +s[2 * i], n: +s[2 * i + 1] }));
const encode = cells => cells.map(c => (c.n ? `${c.o}${c.n}` : '-0')).join('');
const neighbours = (i, w, h) => {
  const x = i % w, y = Math.floor(i / w);
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < w && b < h).map(([a, b]) => b * w + a);
};
// A square bursts when it holds as many dots as it has neighbours: 2 in a corner, 3 on an edge, 4 in the middle.
const capOf = (i, w, h) => neighbours(i, w, h).length;

// Plays a dot and works out the whole chain: each wave, every full square bursts at once, sending a dot to each
// neighbour and taking it over. Returns the board after each wave, so every screen can replay it in step.
// Stops early once one player owns every dot (when that ends the game), or after a very long chain.
function play(board, w, h, at, p, decided) {
  const cells = decode(board);
  cells[at] = { o: p, n: cells[at].n + 1 };
  const frames = [encode(cells)];
  const waves = [];
  for (let guard = 0; guard < 400; guard++) {
    const full = cells.map((c, i) => i).filter(i => cells[i].n >= capOf(i, w, h));
    if (!full.length) break;
    waves.push(full);
    full.forEach(i => {
      cells[i].n -= capOf(i, w, h);
      if (!cells[i].n) cells[i].o = -1;
      neighbours(i, w, h).forEach(j => { cells[j] = { o: p, n: cells[j].n + 1 }; });
    });
    frames.push(encode(cells));
    if (decided && cells.every(c => !c.n || c.o === p)) break;
  }
  return { frames, waves, board: frames.at(-1) };
}

// How long each wave of a chain takes to show. Long chains speed up so they don't drag on.
const waveMs = waves => (waves <= 8 ? 320 : Math.max(90, 2600 / waves));
const owners = board => new Set(decode(board).filter(c => c.n).map(c => c.o));

// Whether a player is still in: they haven't had a turn yet, or they still have dots on the board.
const alive = (round, i) => !round.played?.[round.order[i]] || owners(round.board).has(i);

function nextTurn(round, from, players) {
  for (let step = 1; step <= round.order.length; step++) {
    const i = (from + step) % round.order.length;
    if (players[round.order[i]] && alive(round, i)) return round.order[i];
  }
  return round.order[from];
}

// Adds a dot to a square. A transaction, so turns can't cross, and nobody can play while a chain is still going off.
function drop(ctx, at) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    const now = ctx.now();
    if (!round || round.winner || round.turn !== ctx.uid || now < (round.busyUntil || 0)) return undefined;
    const p = round.order.indexOf(ctx.uid);
    const cell = decode(round.board)[at];
    if (!cell || (cell.n && cell.o !== p)) return undefined;
    round.played = { ...round.played, [ctx.uid]: true };
    const everyoneHasPlayed = round.order.every(id => round.played[id] || !ctx.room.players[id]);
    const { waves, board } = play(round.board, round.w, round.h, at, p, everyoneHasPlayed);
    round.prev = round.board;
    round.board = board;
    round.move = { at, p, t: now, n: (round.move?.n || 0) + 1 };
    round.busyUntil = now + waves.length * waveMs(waves.length) + 120;
    const left = round.order.filter((id, i) => ctx.room.players[id] && alive(round, i));
    if (everyoneHasPlayed && left.length <= 1) round.winner = left[0] || ctx.uid;
    else round.turn = nextTurn(round, p, ctx.room.players);
    return round;
  });
}

export default {
  id: 'chain-reaction',
  name: 'Chain Reaction',
  color: 'lilac',
  players: '2–8',
  blurb: 'Fill squares until they pop, and take over everything around them.',
  rules: [
    'Take turns adding a dot to an empty square or one of your own.',
    'A square pops when it\'s full: 2 dots in a corner, 3 on an edge, 4 in the middle. Its dots fly into the squares next to it, and those become yours.',
    'Pops can set off more pops, in a chain across the board. Squares that are about to pop shake.',
    'Once everyone has had a turn, anyone left with no dots is out. The last colour on the board wins.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.2" stroke-linecap="round">
    <path d="M6 8 h52 v42 h-52 z M23 8 v42 M41 8 v42 M6 22 h52 M6 36 h52" stroke-width="1.3" stroke="#9db7d6" />
    <g fill="#9b5fd0" stroke-width="1.6"><circle cx="29" cy="27" r="3.4" /><circle cx="35" cy="27" r="3.4" /><circle cx="32" cy="32.5" r="3.4" /></g>
    <g fill="#e05a4f" stroke-width="1.6"><circle cx="14.5" cy="15" r="3.6" /><circle cx="50" cy="43" r="3.2" /><circle cx="47" cy="15" r="3.2" /></g>
    <path d="M32 18 v-5 M24 22 l-3 -3 M40 22 l3 -3 M32 41 v5" stroke-width="2" />
  </g></svg>`,

  defaults: () => ({}),

  settingsView: ctx => html`<p class="note">The board gets bigger with more players: ${sizeFor(ctx.players.length).join(' × ')} squares for ${ctx.players.length}.</p>`,

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : ctx.players.length > 8 ? '8 players max' : null),

  start(ctx) {
    const order = ctx.players.map(p => p.id);
    const [w, h] = sizeFor(order.length);
    return { phase: 'play', round: { w, h, order, board: '-0'.repeat(w * h), turn: order[Math.floor(Math.random() * order.length)] } };
  },

  // Skip anyone who's left. If only one player is left, they win.
  tick(ctx) {
    const { round } = ctx;
    if (round.winner) return null;
    const left = round.order.filter((id, i) => ctx.room.players[id] && alive(round, i));
    if (left.length === 1 && round.order.filter(id => ctx.room.players[id]).length === 1) return { 'round/winner': left[0], 'round/forfeit': true };
    if (!ctx.room.players[round.turn]) return { 'round/turn': nextTurn(round, round.order.indexOf(round.turn), ctx.room.players) };
    return null;
  },

  view(ctx) {
    const { round } = ctx;
    return round.winner && ctx.now() >= (round.busyUntil || 0) ? finished(ctx) : playing(ctx);
  },
};

// ----- drawing -----

// Steady pseudo-random numbers per square, so each spins and shakes a little differently, and keeps doing so.
const rand = (i, salt) => { const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453; return v - Math.floor(v); };
// Where the dots sit around a square's middle.
const SPOTS = { 1: [[0, 0]], 2: [[-1.75, 0], [1.75, 0]], 3: [[0, -1.9], [-1.7, 1.05], [1.7, 1.05]] };
const spots = n => SPOTS[n] || Array.from({ length: n }, (_, k) => [2.2 * Math.cos((k * 2 * Math.PI) / n), 2.2 * Math.sin((k * 2 * Math.PI) / n)]);

function board(ctx, { cells, flying = nothing, onTap, key }) {
  const { round } = ctx;
  const { w, h } = round;
  const lines = [];
  for (let i = 1; i < w; i++) lines.push(`M${i * CELL} 0 V${h * CELL}`);
  for (let i = 1; i < h; i++) lines.push(`M0 ${i * CELL} H${w * CELL}`);
  const tap = e => {
    const el = e.currentTarget, r = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
    const x = Math.floor((vb.x + ((e.clientX - r.left) / r.width) * vb.width) / CELL);
    const y = Math.floor((vb.y + ((e.clientY - r.top) / r.height) * vb.height) / CELL);
    if (x >= 0 && y >= 0 && x < w && y < h) onTap(y * w + x);
  };
  return html`<svg class="cr-board ${onTap ? 'cr-board--mine' : ''}" viewBox="-1 -1 ${w * CELL + 2} ${h * CELL + 2}" role="img" aria-label="The board"
    style="--ratio: ${w / h}" @click=${onTap ? tap : null}>
    <rect class="cr-paper" x="0" y="0" width=${w * CELL} height=${h * CELL} rx="1" />
    <path class="cr-grid" d=${lines.join(' ')} />
    ${cells.map((c, i) => {
      const cx = (i % w) * CELL + 5, cy = Math.floor(i / w) * CELL + 5;
      const hot = c.n && c.n === capOf(i, w, h) - 1;
      // Every square turns slowly. One that's about to pop spins faster and shakes, each in its own way.
      const style = `transform-origin: ${cx}px ${cy}px; --slow: ${7 + rand(i, 1) * 5}s; --fast: ${1.1 + rand(i, 2) * 0.9}s;
        --spin-dir: ${rand(i, 3) < 0.5 ? 'normal' : 'reverse'}; --delay: ${-rand(i, 4) * 10}s;
        --shake: cr-shake${1 + Math.floor(rand(i, 5) * 3)}; --shake-time: ${0.33 + rand(i, 6) * 0.3}s`;
      return svg`<g class="cr-cell ${hot ? 'cr-cell--hot' : ''}" style=${style}><g class="cr-spin">
        ${c.n ? spots(c.n).map(([dx, dy]) => svg`<circle class="cr-dot" cx=${cx + dx} cy=${cy + dy} r=${c.n === 1 ? 2.6 : c.n > 3 ? 1.7 : 2.1} fill=${INKS[c.o % INKS.length]} />`) : nothing}
      </g></g>`;
    })}
    ${keyed(key, flying)}
  </svg>`;
}

// Everyone's dot count, underlined for whoever's turn it is; players who are out are faded.
function scores(ctx, cells) {
  const { round } = ctx;
  return html`<div class="db-scores">${round.order.map((id, i) => {
    const p = ctx.room.players[id];
    const dots = cells.filter(c => c.o === i).reduce((n, c) => n + c.n, 0);
    const out = !p || (round.played?.[id] && !dots);
    return html`<div class="db-score ${id === round.turn && !round.winner ? 'db-score--turn' : ''} ${out ? 'db-score--gone' : ''}" style="--ink: ${INKS[i % INKS.length]}">
      ${p ? avatar(p, 28) : nothing}<span class="db-score__name">${p ? (id === ctx.uid ? 'You' : p.name) : 'Left'}</span><b>${out && p ? 'out' : dots}</b>
    </div>`;
  })}</div>`;
}

function playing(ctx) {
  const { round, local } = ctx;
  const now = ctx.now();
  const move = round.move;
  const myTurn = round.turn === ctx.uid;
  const turnPlayer = ctx.room.players[round.turn];

  // Replaying the last move's chain, wave by wave.
  let cells = decode(round.board);
  let flying = nothing;
  let key = 'still';
  let chain = 0;
  if (move && round.prev) {
    // A chain only stops early when it won the game, so the winner tells us whether this one did.
    const run = play(round.prev, round.w, round.h, move.at, move.p, !!round.winner);
    chain = run.waves.length;
    const per = waveMs(chain);
    const k = Math.floor((now - move.t) / per);
    if (k < chain) {
      const bursting = run.waves[k];
      cells = decode(run.frames[k]);
      bursting.forEach(i => { cells[i] = { ...cells[i], n: cells[i].n - capOf(i, round.w, round.h) }; });
      key = `${move.n}:${k}`;
      flying = svg`${bursting.flatMap(i => neighbours(i, round.w, round.h).map(j => {
        const cx = (i % round.w) * CELL + 5, cy = Math.floor(i / round.w) * CELL + 5;
        return svg`<circle class="cr-dot cr-fly" cx=${cx} cy=${cy} r="2.1" fill=${INKS[move.p % INKS.length]}
          style="--dx: ${((j % round.w) - (i % round.w)) * CELL}; --dy: ${(Math.floor(j / round.w) - Math.floor(i / round.w)) * CELL}; --t: ${per}ms" />`;
      }))}`;
      if (k < 10) cue(`cr:${move.t}:${k}`, 'pop');
      // Redraw at the start of the next wave, not just on the usual half-second tick.
      clearTimeout(local.waveTimer);
      local.waveTimer = setTimeout(ctx.rerender, Math.max(16, move.t + (k + 1) * per - now));
    } else if (chain >= 3) cue(`cr:${move.t}:done`, 'score');
  }
  if (move && !chain) cue(`cr:${move.t}:drop`, 'tap');
  if (myTurn) cue(`cr:${round.move?.n || 0}:turn`, 'ding');

  const busy = now < (round.busyUntil || 0);
  const mover = move && ctx.room.players[round.order[move.p]];
  const moverName = mover ? (mover.id === ctx.uid ? 'You' : mover.name) : 'Someone';
  const news = busy && chain >= 2 ? `${moverName} set off a chain!` : chain >= 3 ? `A ${chain}-pop chain from ${moverName}!` : myTurn ? 'Your turn.' : `${turnPlayer?.name || 'Someone'}'s turn.`;
  const hint = myTurn ? 'Tap an empty square or one of yours.' : round.order.includes(ctx.uid) ? `Waiting for ${turnPlayer?.name || 'the next player'}…` : '';

  const me = round.order.indexOf(ctx.uid);
  const tap = i => {
    const c = decode(round.board)[i];
    if (c.n && c.o !== me) return toast('That square is someone else\'s.');
    drop(ctx, i).catch(() => toast("That didn't go through. Try again?"));
  };

  return html`<div class="cr" style="--ratio: ${round.w / round.h}">
    ${scores(ctx, cells)}
    <p class="db-status center"><b>${news}</b><br>${hint}</p>
    ${board(ctx, { cells, flying, key, onTap: myTurn && !busy ? tap : null })}
  </div>`;
}

function finished(ctx) {
  const { round } = ctx;
  const cells = decode(round.board);
  const winner = ctx.room.players[round.winner];
  const me = round.order.includes(ctx.uid);
  const win = me ? round.winner === ctx.uid : null;
  const name = winner ? winner.name : 'Someone';
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: 'You took over the board!', lost: `${name} wins!`, watching: `${name} wins!` }),
      note: round.forfeit ? 'Everyone else left.' : win ? 'Every last dot is yours.' : `${name} took over the board.` })}
    <div class="cr" style="--ratio: ${round.w / round.h}">
      ${scores(ctx, cells)}
      ${board(ctx, { cells, key: 'end' })}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

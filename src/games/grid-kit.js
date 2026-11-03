import { html, nothing, button, action, avatar } from '../ui.js';
import { svg } from 'lit-html';
import { backToLobbyButton, endScreen, endTitle, turnLine } from './common.js';

// Shared bits for the grid battle games (Flip Grab, Connect 4,
// Snowball Fight): player inks, the score row, a tappable grid, turn order and the end screen.

export const CELL = 10; // board units per square
export const INKS = ['#e05a4f', '#4a8fd8', '#3fae6a', '#d99a1e', '#9b5fd0', '#1fa5a5', '#e0609f', '#8a5a3c'];
export const inkOf = i => INKS[i % INKS.length];
export const xy = (i, w) => [i % w, Math.floor(i / w)];
export const at = (x, y, w, h) => (x >= 0 && y >= 0 && x < w && y < h ? y * w + x : -1);
export const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const around = (i, w, h) => DIRS.map(([dx, dy]) => at(i % w + dx, Math.floor(i / w) + dy, w, h)).filter(j => j >= 0);

// The next player after `from` (an index into order) who is still in the room and still playing.
export function nextTurn(ctx, order, from, stillIn = () => true) {
  for (let step = 1; step <= order.length; step++) {
    const i = (from + step) % order.length;
    if (ctx.room.players[order[i]] && stillIn(i)) return order[i];
  }
  return order[from];
}

// Everyone's score in their ink, underlined for whoever's turn it is; players who are out are faded.
export function scores(ctx, order, { turn, value, out = () => false }) {
  return html`<div class="db-scores">${order.map((id, i) => {
    const p = ctx.room.players[id];
    const gone = !p || out(i);
    return html`<div class="db-score ${id === turn ? 'db-score--turn' : ''} ${gone ? 'db-score--gone' : ''}" style="--ink: ${inkOf(i)}">
      ${p ? avatar(p, 28) : nothing}<span class="db-score__name">${p ? (id === ctx.uid ? 'You' : p.name) : 'Left'}</span><b>${p && out(i) ? 'out' : value(i)}</b>
    </div>`;
  })}</div>`;
}

// The news line and whose turn it is, in a fixed-height block so the board below never jumps.
export const status = (news, line) => html`<p class="db-status center"><b>${news}</b><br>${line}</p>`;
export { turnLine };

// A w × h sheet of grid paper. `layers` is drawn on top; a tap anywhere calls onTap(square).
export function grid({ w, h, layers, onTap, cls = '' }) {
  const lines = [];
  for (let i = 1; i < w; i++) lines.push(`M${i * CELL} 0 V${h * CELL}`);
  for (let i = 1; i < h; i++) lines.push(`M0 ${i * CELL} H${w * CELL}`);
  const tap = e => {
    const el = e.currentTarget, r = el.getBoundingClientRect(), vb = el.viewBox.baseVal;
    const x = Math.floor((vb.x + ((e.clientX - r.left) / r.width) * vb.width) / CELL);
    const y = Math.floor((vb.y + ((e.clientY - r.top) / r.height) * vb.height) / CELL);
    const i = at(x, y, w, h);
    if (i >= 0) onTap(i);
  };
  return html`<svg class="cr-board ${onTap ? 'cr-board--mine turn-glow' : ''} ${cls}" viewBox="-1 -1 ${w * CELL + 2} ${h * CELL + 2}" role="img" aria-label="The board"
    @click=${onTap ? tap : null}>
    <rect class="cr-paper" x="0" y="0" width=${w * CELL} height=${h * CELL} rx="1" />
    <path class="cr-grid" d=${lines.join(' ')} />
    ${layers}
  </svg>`;
}

// A dot of ink in the middle of a square.
export const dot = (i, w, owner, r = 3.2, cls = '') => {
  const [x, y] = xy(i, w);
  return svg`<circle class="cr-dot ${cls}" cx=${x * CELL + 5} cy=${y * CELL + 5} r=${r} fill=${inkOf(owner)} />`;
};
// A dashed ring around a square: the last move, until the next one.
export const ring = (i, w, owner, cls = 'cr-played') => {
  const [x, y] = xy(i, w);
  return svg`<rect class=${cls} x=${x * CELL + 0.6} y=${y * CELL + 0.6} width=${CELL - 1.2} height=${CELL - 1.2} rx="1.5" stroke=${inkOf(owner)} />`;
};

// The end of a game: who won (or tied), the final board, then play again / back to the lobby.
export function finish(ctx, order, { winners, note, body }) {
  const me = order.includes(ctx.uid);
  const win = me && winners.length ? winners.includes(ctx.uid) : null; // a draw is nobody's loss
  const names = winners.map(id => (id === ctx.uid ? 'You' : ctx.room.players[id]?.name || 'Someone'));
  const headline = !names.length ? "It's a draw!" : names.length > 1 ? `A tie: ${names.join(' & ')}!` : `${names[0]} ${names[0] === 'You' ? 'win' : 'wins'}!`;
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: winners.length > 1 ? 'You tied for first!' : 'You win!', watching: headline }), note: note || (win === null ? null : headline !== 'You win!' ? headline : null) })}
    ${body}
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

// Who has the most of something: everyone tied on the top score.
export function leaders(order, valueOf, here = () => true) {
  const best = Math.max(...order.map((id, i) => (here(id) ? valueOf(i) : -Infinity)));
  return order.filter((id, i) => here(id) && valueOf(i) === best);
}

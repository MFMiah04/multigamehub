import { html, nothing } from '../ui.js';
import { backToLobbyButton } from './common.js';
import '../draw/board.js';

// A shared drawing board for trying out drawing on phones and computers before the real drawing games.
export default {
  id: 'sketch',
  name: 'Sketch Pad',
  color: 'lilac',
  players: '1–16',
  blurb: 'A shared drawing board. Everyone can doodle at once.',
  rules: [
    'Everyone draws on the same board at the same time.',
    'Pick a colour and a brush size, or the eraser. Clear wipes the board for everyone.',
    'The line under the board shows how much data your drawing is using, and the delay before others see it.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="6" y="8" width="44" height="36" rx="3" fill="#fff" />
    <path d="M12 34 q8 -16 14 -4 t14 -10" stroke="#d23c5f" stroke-width="3" />
    <path d="M44 46 L58 18 l4 2 L48 48 l-5 2 z" fill="#ffe066" />
    <path d="M44 46 l4 2" />
  </g></svg>`,

  defaults: () => ({}),
  settingsView: () => html`<p class="note center">No settings. It's just a board to draw on.</p>`,
  canStart: () => null,
  start: () => ({ phase: 'draw', round: { started: true } }),

  view(ctx) {
    return html`
      <h2 class="center">Draw together</h2>
      <sketch-board room=${ctx.room.code} uid=${ctx.uid}></sketch-board>
      <div class="push"></div>
      ${ctx.isHost ? backToLobbyButton(ctx) : nothing}`;
  },
};

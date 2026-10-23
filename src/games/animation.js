import { html, selectField } from '../ui.js';
import { makeChainGame, timeField } from './chain.js';

// Animation: everyone draws the first frame of their own animation, then passes it on. Each turn you
// draw the next frame of someone else's, with their last frame faded behind yours.
export default makeChainGame({
  id: 'animation',
  name: 'Animation',
  color: 'blue',
  players: '2–12',
  mode: 'animation',
  blurb: 'Everyone starts an animation, then pass it round adding one frame each.',
  rules: [
    'Everyone draws the first frame of their own animation.',
    'Then the animations are passed on. Draw the next frame of the one you get: the previous frame is faded behind yours to trace from.',
    'You can hide the last frame or your own to compare. Press "I\'m done" when you finish, or wait for the timer.',
    'At the end each animation is played back, frame by frame with who drew it, then as a loop. Download any of them as a GIF.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="12" width="22" height="18" rx="2" fill="#fff" transform="rotate(-6 15 21)" />
    <rect x="20" y="18" width="22" height="18" rx="2" fill="#fff" />
    <rect x="36" y="24" width="22" height="18" rx="2" fill="#fff" transform="rotate(6 47 33)" />
    <circle cx="13" cy="21" r="3" fill="#ffd04d" /><circle cx="31" cy="25" r="3" fill="#ffd04d" /><circle cx="48" cy="31" r="3" fill="#ffd04d" />
    <path d="M10 46 q20 8 42 -2 M48 41 l4 3 l-4 3" />
  </g></svg>`,
  texts: {
    stepLabel: (n, total) => `Frame ${n} of ${total}`,
    first: 'Draw the first frame of an animation!',
    next: 'Draw the next frame',
    chainLabel: 'Animation',
    thing: 'animation',
    revealNote: 'Frame by frame…',
    endTitle: 'All the animations!',
  },
  defaults: () => ({ frames: 'each', time: 45 }),
  stepsFor: (players, s) => (s.frames === 'twice' ? players * 2 : s.frames === 'each' ? players : Math.max(players, +s.frames)),
  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    const n = ctx.players.length;
    return html`
      ${selectField('Frames in each animation', s.frames, [['each', `One each (${n})`], ['twice', `Two each (${n * 2})`], ['8', '8 frames'], ['12', '12 frames'], ['16', '16 frames']], v => set({ frames: v }), disabled)}
      ${timeField(s, set, disabled, 'Time for each frame')}`;
  },
});

import { html, selectField } from '../ui.js';
import { makeChainGame, timeField } from './chain.js';

// Complementary: everyone starts a drawing, then passes it on. Each turn you add to someone else's
// picture, on top of everything drawn before, so every drawing gets better (or stranger) as it goes round.
export default makeChainGame({
  id: 'complementary',
  name: 'Complementary',
  color: 'mint',
  players: '2–12',
  mode: 'stack',
  blurb: 'Start a drawing, then pass it round so everyone adds to it.',
  rules: [
    'Everyone starts their own drawing. Anything you like!',
    'Then the drawings are passed on. Add whatever you want to the one you get, on top of what\'s already there.',
    'Press "I\'m done" when you finish, or wait for the timer. It keeps going until everyone has added to every drawing.',
    'At the end each drawing is played back step by step with who added what, then as a loop. Download any of them as a GIF.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="6" width="40" height="32" rx="3" fill="#fff" />
    <path d="M14 30 q6 -14 12 -4" stroke="#3b82c4" stroke-width="3" />
    <circle cx="36" cy="16" r="5" fill="#ffd04d" />
    <path d="M28 32 h14" stroke="#3fae5b" stroke-width="3" />
    <path d="M44 50 L56 28 l4 2 L48 52 l-5 2 z" fill="#ffaebc" />
    <path d="M6 48 q8 -4 14 0 t14 0" />
  </g></svg>`,
  texts: {
    stepLabel: (n, total) => `Turn ${n} of ${total}`,
    first: 'Start a drawing. Anything you like!',
    next: 'Add something to this drawing',
    chainLabel: 'Drawing',
    thing: 'drawing',
    revealNote: 'Step by step…',
    endTitle: 'All the drawings!',
  },
  defaults: () => ({ laps: 1, time: 60 }),
  stepsFor: (players, s) => players * (s.laps || 1),
  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Times round', s.laps, [[1, 'Once (everyone adds once)'], [2, 'Twice']], v => set({ laps: +v }), disabled)}
      ${timeField(s, set, disabled)}`;
  },
});

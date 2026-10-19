import { html, svg } from 'lit-html';

// Body colours and patterns. Patterns are defined once in index.html (#pat-*).
export const BODIES = [
  ['#a0e7e5', null], ['#ffaebc', 'stripes'], ['#ffe066', 'dots'], ['#b4f8c8', 'zigzag'],
  ['#c3b1e1', null], ['#ffc48c', 'hstripes'], ['#9ad0f5', 'dots'], ['#f7a8d8', 'check'],
  ['#d4e79e', 'stripes'], ['#f5b7a1', null], ['#b8c0ff', 'zigzag'], ['#ffd6a5', 'check'],
];

const dot = (x, y, r = 2.4) => svg`<circle cx=${x} cy=${y} r=${r} fill="#222" stroke="none" />`;

// Eyes sit around (18.5, 18.5) and (29.5, 18.5) on the round face.
export const EYES = [
  svg`${dot(18.5, 18.5)}${dot(29.5, 18.5)}`,
  svg`<circle cx="18.5" cy="18.5" r="4.6" fill="#fff" /><circle cx="29.5" cy="18.5" r="4.6" fill="#fff" />${dot(19.6, 19.3, 2)}${dot(30.6, 19.3, 2)}`,
  svg`<path d="M15 19 h7 M26 19 h7" />`,
  svg`<path d="M15 20 q3.5 -5 7 0 M26 20 q3.5 -5 7 0" />`,
  svg`${dot(18.5, 18.5)}<path d="M26 20 q3.5 -5 7 0" />`,
  svg`<circle cx="18.5" cy="18.5" r="5.2" fill="#fff" /><circle cx="29.5" cy="18.5" r="5.2" fill="#fff" /><path d="M23.7 18.3 h0.6" />${dot(18.5, 18.5, 1.8)}${dot(29.5, 18.5, 1.8)}`,
  svg`<path d="M16 16 l5 5 M21 16 l-5 5 M27 16 l5 5 M32 16 l-5 5" />`,
  svg`<path d="M14 13.5 l6.5 2.5 M34 13.5 l-6.5 2.5" />${dot(18.5, 19.5, 2.3)}${dot(29.5, 19.5, 2.3)}`,
];

// Mouths are centred on x = 24, around y = 27.
export const MOUTHS = [
  svg`<path d="M17.5 25.5 q6.5 5.5 13 0" />`,
  svg`<path d="M16.5 24.5 h15 q-1.5 7.5 -7.5 7.5 q-6 0 -7.5 -7.5 z" fill="#fff" />`,
  svg`<path d="M18.5 27.5 h11" />`,
  svg`<circle cx="24" cy="27.5" r="3" fill="#fff" />`,
  svg`<path d="M20.5 28.2 q3.5 6.5 7 0 z" fill="#ff8fab" stroke-width="1.8" /><path d="M17.5 25.5 q6.5 5.5 13 0" />`,
  svg`<path d="M18.5 28 q7 1.5 11 -3.5" />`,
  svg`<path d="M17.5 30 q6.5 -5.5 13 0" />`,
  svg`<path d="M17 25.5 q3.5 4 7 0 q3.5 4 7 0" />`,
];

export const PARTS = { e: EYES.length, m: MOUTHS.length, b: BODIES.length };

export const randomLook = () => ({
  e: Math.floor(Math.random() * EYES.length),
  m: Math.floor(Math.random() * MOUTHS.length),
  b: Math.floor(Math.random() * BODIES.length),
});

// A big round face with small shoulders peeking out underneath.
const BODY = 'M9 55 C9 42, 15 34, 24 34 C33 34, 39 42, 39 55 Z';
const HEAD = 'M8.5 20.5 C8 0, 40 -0.5, 39.5 20 C39.5 40.5, 9 41, 8.5 20.5 Z';

// Older players only had a colour index, so fall back to that.
const lookOf = player => player?.look || { e: 0, m: 0, b: player?.color ?? 0 };

export function avatar(player, size = 40) {
  const look = lookOf(player);
  const [color, pattern] = BODIES[look.b % BODIES.length];
  return html`<svg class="avatar ${player?.online === false ? 'avatar--away' : ''}" width=${size} height=${Math.round(size * 52 / 48)} viewBox="0 0 48 52" aria-hidden="true">
    ${svg`<g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d=${BODY} fill=${color} />
      ${pattern ? svg`<path d=${BODY} fill="url(#pat-${pattern})" stroke="none" />` : ''}
      <path d=${HEAD} fill=${color} />
      ${EYES[look.e % EYES.length]}
      ${MOUTHS[look.m % MOUTHS.length]}
    </g>`}
  </svg>`;
}

import { html, svg } from 'lit-html';

// Body colours and patterns. Patterns are defined once in index.html (#pat-*).
export const BODIES = [
  ['#a0e7e5', null], ['#ffaebc', 'stripes'], ['#ffe066', 'dots'], ['#b4f8c8', 'zigzag'],
  ['#c3b1e1', null], ['#ffc48c', 'hstripes'], ['#9ad0f5', 'dots'], ['#f7a8d8', 'check'],
  ['#d4e79e', 'stripes'], ['#f5b7a1', null], ['#b8c0ff', 'zigzag'], ['#ffd6a5', 'check'],
];

const dot = (x, y, r = 1.7) => svg`<circle cx=${x} cy=${y} r=${r} fill="#222" stroke="none" />`;

export const EYES = [
  svg`${dot(19, 17)}${dot(29, 17)}`,
  svg`<circle cx="19" cy="17" r="3.4" fill="#fff" /><circle cx="29" cy="17" r="3.4" fill="#fff" />${dot(19.8, 17.6, 1.4)}${dot(29.8, 17.6, 1.4)}`,
  svg`<path d="M16 17.5 h5 M27 17.5 h5" />`,
  svg`<path d="M16 18.5 q2.5 -3.5 5 0 M27 18.5 q2.5 -3.5 5 0" />`,
  svg`${dot(19, 17)}<path d="M27 18 q2.5 -3.5 5 0" />`,
  svg`<circle cx="19" cy="17" r="4.2" fill="#fff" /><circle cx="29" cy="17" r="4.2" fill="#fff" /><path d="M23.2 17 h1.6" />${dot(19, 17, 1.3)}${dot(29, 17, 1.3)}`,
  svg`<path d="M17 15 l4 4 M21 15 l-4 4 M27 15 l4 4 M31 15 l-4 4" />`,
  svg`<path d="M15.5 12.5 l5 2 M32.5 12.5 l-5 2" />${dot(19, 17.5)}${dot(29, 17.5)}`,
];

export const MOUTHS = [
  svg`<path d="M19 23.5 q5 4 10 0" />`,
  svg`<path d="M18 23 h12 q-1 6 -6 6 q-5 0 -6 -6 z" fill="#fff" />`,
  svg`<path d="M20 25 h8" />`,
  svg`<circle cx="24" cy="25" r="2.3" fill="#fff" />`,
  svg`<path d="M23 25.5 q1.5 4 3.5 0 z" fill="#ff8fab" /><path d="M19 23.5 q5 4 10 0" />`,
  svg`<path d="M20 25 q5 1 8 -2.5" />`,
  svg`<path d="M19 26.5 q5 -4 10 0" />`,
  svg`<path d="M19 23.5 q2.5 3 5 0 q2.5 3 5 0" />`,
];

export const PARTS = { e: EYES.length, m: MOUTHS.length, b: BODIES.length };

export const randomLook = () => ({
  e: Math.floor(Math.random() * EYES.length),
  m: Math.floor(Math.random() * MOUTHS.length),
  b: Math.floor(Math.random() * BODIES.length),
});

// Shoulders tuck up under the head so it reads as one little bust.
const BODY = 'M5 54 C5 39, 13 28.5, 24 28.5 C35 28.5, 43 39, 43 54 Z';

// Older players only had a colour index, so fall back to that.
const lookOf = player => player?.look || { e: 0, m: 0, b: player?.color ?? 0 };

export function avatar(player, size = 40) {
  const look = lookOf(player);
  const [color, pattern] = BODIES[look.b % BODIES.length];
  return html`<svg class="avatar ${player?.online === false ? 'avatar--away' : ''}" width=${size} height=${Math.round(size * 52 / 48)} viewBox="0 0 48 52" aria-hidden="true">
    ${svg`<g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d=${BODY} fill=${color} />
      ${pattern ? svg`<path d=${BODY} fill="url(#pat-${pattern})" stroke="none" />` : ''}
      <path d="M11 18 C11 5.5, 37 5.5, 37 18 C37 30.5, 11 31, 11 18 Z" fill=${color} />
      ${EYES[look.e % EYES.length]}
      ${MOUTHS[look.m % MOUTHS.length]}
    </g>`}
  </svg>`;
}

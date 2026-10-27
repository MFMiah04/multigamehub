import { html, svg } from 'lit-html';

// A character is a look: { b: colour, p: pattern, h: hat, e: eyes, m: mouth }, each an index into the lists below.

// Body colours. The first twelve are the original ones, so older characters keep their colour.
export const COLOURS = [
  '#a0e7e5', '#ffaebc', '#ffe066', '#b4f8c8', '#c3b1e1', '#ffc48c', '#9ad0f5', '#f7a8d8',
  '#d4e79e', '#f5b7a1', '#b8c0ff', '#ffd6a5', '#7fd6b4', '#e9a0a0', '#f4d35e', '#8fb3e8',
  '#d9b8f0', '#d0d0d0',
];

// Patterns over the body colour. Each is defined once in index.html (#pat-*).
export const PATTERNS = [null, 'stripes', 'hstripes', 'dots', 'zigzag', 'check', 'stars', 'hearts', 'waves', 'spots', 'split'];

// Before patterns were a separate choice, each colour came with its own. Characters from then keep it.
const OLD_PATTERNS = [null, 'stripes', 'dots', 'zigzag', null, 'hstripes', 'dots', 'check', 'stripes', null, 'zigzag', 'check'];

const dot = (x, y, r = 2.4) => svg`<circle cx=${x} cy=${y} r=${r} fill="#222" stroke="none" />`;
const star = (x, y, r) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const k = i % 2 ? r * 0.45 : r;
    return `${(x + k * Math.cos(a)).toFixed(1)} ${(y + k * Math.sin(a)).toFixed(1)}`;
  });
  return `M${pts.join(' L')} Z`;
};
const heart = (x, y) => `M${x} ${y + 3.5} C${x - 5.5} ${y}, ${x - 4} ${y - 4.5}, ${x} ${y - 2} C${x + 4} ${y - 4.5}, ${x + 5.5} ${y}, ${x} ${y + 3.5} Z`;

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
  svg`<path d=${heart(18.5, 18.5)} fill="#e8496b" stroke-width="1.6" /><path d=${heart(29.5, 18.5)} fill="#e8496b" stroke-width="1.6" />`,
  svg`<path d=${star(18.5, 18.5, 4.6)} fill="#ffd23f" stroke-width="1.5" /><path d=${star(29.5, 18.5, 4.6)} fill="#ffd23f" stroke-width="1.5" />`,
  svg`<path d="M14.5 17.5 q4 4 8 0 M25.5 17.5 q4 4 8 0" /><path d="M15 20.5 l-1 1.5 M33 20.5 l1 1.5" stroke-width="1.6" />`,
  svg`<path d="M12 15 h10 q0 7 -5 7 q-5 0 -5 -7 z M26 15 h10 q0 7 -5 7 q-5 0 -5 -7 z" fill="#222" /><path d="M22 16 h4" /><path d="M14.2 17 l2 -1" stroke="#fff" stroke-width="1.4" />`,
];
// Eyes that are really accessories (sunglasses). Reactions leave them on.
const ACCESSORY_EYES = new Set([11]);

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
  svg`<path d="M18 26 h12" /><path d="M22 26.5 v4 q2 2.4 4 0 v-4" fill="#ff8fab" stroke-width="1.8" />`,
  svg`<path d="M17.5 25.5 q6.5 5.5 13 0" /><path d="M19.6 27 l1.3 3 l1.3 -2.2 M28.4 27 l-1.3 3 l-1.3 -2.2" fill="#fff" stroke-width="1.5" />`,
  svg`<path d="M17.5 25.5 q6.5 5 13 0" /><path d="M21.5 27.5 h5 v3 h-5 z M24 27.5 v3" fill="#fff" stroke-width="1.5" />`,
  // 11 to 15 are facial hair, drawn from FACIAL_HAIR below.
  svg``, svg``, svg``, svg``, svg``,
];

// Facial hair, picked from the mouth row. Some hide the mouth (it's under the moustache), some keep
// a smile showing. It stays on through reactions: the reaction's mouth shows just below the moustache.
const moustache = (fill, big = false) => svg`<path d=${big
  ? 'M24 23.5 C20.5 20.5, 14 21, 12.5 26.5 C16 24.5, 20 27, 24 25 C28 27, 32 24.5, 35.5 26.5 C34 21, 27.5 20.5, 24 23.5 Z'
  : 'M24 24.5 C21 22, 16.5 22.5, 15.5 26 C18.5 25, 21 26.5, 24 25.5 C27 26.5, 29.5 25, 32.5 26 C31.5 22.5, 27 22, 24 24.5 Z'} fill=${fill} stroke-width="1.6" />`;
const STUBBLE = [[14, 27], [15.5, 30.5], [17.5, 33.5], [20.5, 35.5], [24, 36.5], [27.5, 35.5], [30.5, 33.5], [32.5, 30.5], [34, 27], [19, 32], [24, 33.5], [29, 32], [16.5, 28.5], [31.5, 28.5]];
const FACIAL_HAIR = {
  11: { front: moustache('#5a3b2a') },
  12: { back: svg`${STUBBLE.map(([x, y]) => svg`<circle cx=${x} cy=${y} r="0.75" fill="#5a4a40" stroke="none" />`)}`, mouth: 0 },
  13: { back: svg`<path d="M20.5 31.5 Q24 39 27.5 31.5 Q24 33.5 20.5 31.5 Z" fill="#6b4a33" stroke-width="1.6" />`, mouth: 0 },
  14: {
    back: svg`<path d="M9.5 21 C10 34, 15.5 42.5, 24 43.5 C32.5 42.5, 38 34, 38.5 21 C36.5 26.5, 33.5 30, 30 30.5 C27 32, 21 32, 18 30.5 C14.5 30, 11.5 26.5, 9.5 21 Z" fill="#6b4a33" stroke-width="1.8" />`,
    front: moustache('#5a3b2a'),
  },
  15: {
    back: svg`<path d="M9 19.5 C8 35, 13 49, 24 53 C35 49, 40 35, 39 19.5 C37 26.5, 33.5 30.5, 30 31 C27 32.5, 21 32.5, 18 31 C14.5 30.5, 11 26.5, 9 19.5 Z" fill="#f6f6f2" stroke-width="1.8" />
      <path d="M17 38 q2 4 0 7 M24 41 q2 4 0 8 M31 38 q-2 4 0 7" stroke="#c9c9c2" stroke-width="1.4" />`,
    front: moustache('#f6f6f2', true),
  },
};

// Hats and other things on top. Drawn after the head; kept within the frame above it.
export const HATS = [
  null,
  svg`<path d="M9.5 13 Q10 -1 24 -1 Q38 -1 38.5 13 Z" fill="#e85d5d" /><path d="M30 13 h15 q0 3 -4 3 h-11 z" fill="#e85d5d" />`,
  svg`<path d="M9 14 Q9 -4 24 -4 Q39 -4 39 14 Z" fill="#6aa9e9" /><path d="M8 11 h32 v5 h-32 z" fill="#fff" /><circle cx="24" cy="-6.5" r="3.2" fill="#fff" />`,
  svg`<path d="M15 9 L24 -9 L33 9 Z" fill="#ffe066" /><path d="M19 2 l8 3 M21.5 -3.5 l4.5 2" stroke="#e85d9a" stroke-width="2.2" /><circle cx="24" cy="-9.5" r="2.8" fill="#e85d9a" />`,
  svg`<path d="M11 10 L11 -3 L17.5 3 L24 -6 L30.5 3 L37 -3 L37 10 Z" fill="#f2c94c" /><circle cx="24" cy="5" r="1.8" fill="#e85d5d" />`,
  svg`<path d="M15 8 V-10 H33 V8 Z" fill="#333" /><path d="M15 3 H33" stroke="#e85d5d" stroke-width="3" /><path d="M7 9 Q24 13 41 9 Q24 6 7 9 Z" fill="#333" />`,
  svg`<path d="M14 7 Q13 -7 24 -4 Q35 -7 34 7 Z" fill="#b07a4a" /><path d="M2 8 Q8 14 24 12 Q40 14 46 8 Q40 6 24 7 Q8 6 2 8 Z" fill="#b07a4a" />`,
  svg`<path d="M12 9 L28 -11 L36 9 Z" fill="#8e5bd1" /><path d="M8 10 Q24 14 40 10 Q24 7 8 10 Z" fill="#8e5bd1" /><path d=${star(25, 2.5, 3.4)} fill="#ffe066" stroke-width="1" />`,
  svg`<path d="M13 10 V4 Q7 2 9.5 -4 Q12.5 -9 18 -6.5 Q22 -11 28 -7 Q34 -9.5 37.5 -4 Q40 2 35 4 V10 Z" fill="#fff" /><path d="M13 7 H35" />`,
  svg`<g transform="rotate(18 30 3)"><path d="M30 3 L22 -3 L22 9 Z M30 3 L38 -3 L38 9 Z" fill="#f7a8c4" /></g><circle cx="30" cy="3" r="2.4" fill="#e85d9a" />`,
  svg`<g transform="translate(15 4)"><circle cx="0" cy="-5" r="3.2" fill="#fff" /><circle cx="5" cy="-1" r="3.2" fill="#fff" /><circle cx="3" cy="5" r="3.2" fill="#fff" /><circle cx="-3" cy="5" r="3.2" fill="#fff" /><circle cx="-5" cy="-1" r="3.2" fill="#fff" /><circle cx="0" cy="0.5" r="2.6" fill="#ffe066" /></g>`,
  svg`<path d="M8 19 Q8 -3 24 -3 Q40 -3 40 19" stroke-width="3.4" /><rect x="4" y="13" width="7" height="11" rx="3" fill="#e85d5d" /><rect x="37" y="13" width="7" height="11" rx="3" fill="#e85d5d" />`,
  svg`<ellipse cx="24" cy="-5" rx="12" ry="3.4" stroke="#e0b030" stroke-width="3" />`,
  svg`<path d="M12 7 Q8 -2 9 -7 Q13 -1 17 4 Z M36 7 Q40 -2 39 -7 Q35 -1 31 4 Z" fill="#e85d5d" />`,
  svg`<path d="M24 5 V-5" /><circle cx="24" cy="-7.5" r="3" fill="#5ed17a" />`,
  svg`<path d="M15 7 Q10 -11 17 -11 Q22 -10 20 6 Z M33 7 Q38 -11 31 -11 Q26 -10 28 6 Z" fill="#fff" /><path d="M16.5 3 Q14.5 -6 17 -8 M31.5 3 Q33.5 -6 31 -8" stroke="#f7a8c4" stroke-width="2" />`,
];

export const PARTS = { b: COLOURS.length, p: PATTERNS.length, h: HATS.length, e: EYES.length, m: MOUTHS.length };
const pick = n => Math.floor(Math.random() * n);
export const randomLook = () => Object.fromEntries(Object.entries(PARTS).map(([k, n]) => [k, pick(n)]));

// A big round face with small shoulders peeking out underneath, drawn a touch smaller than the
// frame so hats fit above it.
const BODY = 'M9 55 C9 42, 15 34, 24 34 C33 34, 39 42, 39 55 Z';
const HEAD = 'M8.5 20.5 C8 0, 40 -0.5, 39.5 20 C39.5 40.5, 9 41, 8.5 20.5 Z';
const FIT = 'translate(5.8 10.5) scale(0.76)';

// Fills in anything an older character doesn't have yet (they only had eyes, mouth and a colour).
export function lookOf(player) {
  const look = player?.look || { e: 0, m: 0, b: player?.color ?? 0 };
  return {
    b: look.b ?? 0,
    p: look.p ?? Math.max(0, PATTERNS.indexOf(OLD_PATTERNS[look.b % OLD_PATTERNS.length] ?? null)),
    h: look.h ?? 0,
    e: look.e ?? 0,
    m: look.m ?? 0,
  };
}

// A mood swaps in a reaction face for a moment: a big grin, a gasp or a frown. Anything worn
// (sunglasses, a moustache, hats) stays on: shock behind sunglasses shows as raised brows and a
// bead of sweat instead.
const MOODS = {
  happy: { m: 1 },
  shock: { e: 5, m: 3 },
  sad: { m: 6 },
};
const BROWS = svg`<path d="M13 10.5 q4 -2.5 8 0 M27 10.5 q4 -2.5 8 0" stroke-width="2" />`;
const SWEAT = svg`<path d="M38 21 q2.6 4 0 5.6 q-2.6 -1.6 0 -5.6 z" fill="#7fd1e8" stroke-width="1.5" />`;
const TEAR = svg`<path d="M15 23 q2 3.4 0 4.6 q-2 -1.2 0 -4.6 z" fill="#7fd1e8" stroke-width="1.4" />`;

export function avatar(player, size = 40, mood = null) {
  const look = lookOf(player);
  const feel = MOODS[mood] || {};
  const wornEyes = ACCESSORY_EYES.has(look.e % EYES.length);
  const eyes = feel.e !== undefined && !wornEyes ? feel.e : look.e;
  const hair = FACIAL_HAIR[look.m % MOUTHS.length];
  // With facial hair the mouth is the hair's own (or none, under a moustache) unless a reaction shows one.
  const mouth = hair ? (feel.m ?? hair.mouth) : (feel.m ?? look.m);
  const lowered = hair?.front && feel.m !== undefined; // a reaction under a moustache sits a little lower
  const color = COLOURS[look.b % COLOURS.length];
  const pattern = PATTERNS[look.p % PATTERNS.length];
  const hat = HATS[look.h % HATS.length];
  return html`<svg class="avatar ${player?.online === false ? 'avatar--away' : ''} ${mood ? 'avatar--mood' : ''}" width=${size} height=${Math.round(size * 52 / 48)} viewBox="0 0 48 52" aria-hidden="true">
    ${svg`<g transform=${FIT} fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
      <path d=${BODY} fill=${color} />
      ${pattern ? svg`<path d=${BODY} fill="url(#pat-${pattern})" stroke="none" />` : ''}
      <path d=${HEAD} fill=${color} />
      ${EYES[eyes % EYES.length]}
      ${hair?.back || ''}
      ${mouth === undefined ? '' : lowered ? svg`<g transform="translate(0 3)">${MOUTHS[mouth]}</g>` : MOUTHS[mouth % MOUTHS.length]}
      ${hair?.front || ''}
      ${wornEyes && mood === 'shock' ? svg`${BROWS}${SWEAT}` : ''}
      ${wornEyes && mood === 'sad' ? TEAR : ''}
      ${hat || ''}
    </g>`}
  </svg>`;
}

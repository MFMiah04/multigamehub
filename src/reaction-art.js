import { html, svg } from 'lit-html';

// Hand-drawn reactions in the same ink-and-pastel style as the avatars.
const FACE = 'M24 4 C36.5 3.5, 44.5 12, 44 24.5 C43.5 36.5, 35.5 44.5, 23.5 44 C11.5 43.5, 3.5 35.5, 4 23.5 C4.5 11.5, 12 4.5, 24 4 Z';
const YELLOW = '#ffe066';
const SKIN = '#ffd6a5';
const BLUE = '#9ad0f5';
// A teardrop with its point at the top, turned to fly off the face.
const TEAR = 'M0 -7 C3.5 -1.5, 4.5 2.5, 3.2 4.8 C1.8 7.2, -1.8 7.2, -3.2 4.8 C-4.5 2.5, -3.5 -1.5, 0 -7 Z';
const dot = (x, y, r = 2.4) => svg`<circle cx=${x} cy=${y} r=${r} fill="#222" stroke="none" />`;

const ART = {
  laugh: svg`
    <path d=${FACE} fill=${YELLOW} />
    <path d="M13 19 q4 -5 8 0 M27 19 q4 -5 8 0" />
    <path d="M12.5 25.5 h23 q-1.5 12 -11.5 12 q-10 0 -11.5 -12 z" fill="#fff" />
    <path d="M17 31.5 q7 3 14 0" stroke-width="1.8" />
    <path d=${TEAR} fill=${BLUE} stroke-width="1.8" transform="translate(6.5 22) rotate(62)" />
    <path d=${TEAR} fill=${BLUE} stroke-width="1.8" transform="translate(41.5 22) rotate(-62)" />`,

  shock: svg`
    <path d=${FACE} fill=${YELLOW} />
    <path d="M11 11.5 q4.5 -4 9 -1.5 M28 10 q4.5 -2.5 9 1.5" />
    <circle cx="17" cy="19.5" r="4.8" fill="#fff" /><circle cx="31" cy="19.5" r="4.8" fill="#fff" />
    ${dot(17, 19.5, 1.8)}${dot(31, 19.5, 1.8)}
    <ellipse cx="24" cy="33" rx="4.5" ry="6.5" fill="#fff" />`,

  thumbs: svg`
    <path d="M13 41 L13 23 C15 18, 17 12, 18.5 7.5 C20 3.5, 26.5 4.5, 25.5 9.5 L24 21 H34 C38.5 21, 39.5 26, 36 27.5 C39.5 28.5, 39.5 33.5, 36 34 C39 35.5, 38.5 41, 34 41 Z" fill=${SKIN} />
    <path d="M25 27.5 H36 M25 34 H36" stroke-width="1.8" />
    <rect x="5" y="19.5" width="9" height="23.5" rx="2.5" fill=${BLUE} />
    <path d="M33 4 l1.5 4 M41 8.5 l-4 2 M39.5 2.5 l-2 3.5" />`,

  fire: svg`
    <path d="M24 44.5 C12.5 44.5, 7.5 35, 10.5 26.5 C12.5 21, 17 18.5, 16 11 C22.5 14, 25.5 19.5, 24.5 25.5 C27.5 23.5, 28.5 19.5, 28 14.5 C35.5 20, 40.5 28, 38.5 35.5 C37 41, 31.5 44.5, 24 44.5 Z" fill="#ff9a5c" />
    <path d="M24 42 C19 42, 17 37.5, 18.8 33.5 C20 31, 22 30, 22 27 C26 29, 28.5 33, 27.5 36.5 C29 35.5, 30 34, 30.2 32.5 C32.5 35.5, 31.5 42, 24 42 Z" fill=${YELLOW} />`,

  curious: svg`
    <path d="M22 9 C33 8.5, 40 15.5, 39.5 26.5 C39 37, 32 44, 21.5 43.5 C11 43, 4 36, 4.5 25.5 C5 15, 11.5 9.5, 22 9 Z" fill=${YELLOW} />
    <path d="M10 18 l7 -1.5 M25 14 l7 3" />
    ${dot(14, 23)}${dot(28.5, 23)}
    <path d="M16 33.5 q5 -2.5 11 0.5" />
    <path d="M37.5 7 q0 -4.5 4 -4.5 q4 0 4 3.8 q0 2.5 -3.5 3.8 v2.4 M42 16.2 v0.4" stroke-width="2.4" />`,

  cry: svg`
    <path d=${FACE} fill=${YELLOW} />
    <path d="M11 15 q4 -1 8 -4 M37 15 q-4 -1 -8 -4" />
    <path d="M12.5 21.5 q4 3.5 8 0 M27.5 21.5 q4 3.5 8 0" />
    <path d="M14.5 24 v17 q0 2.5 -2.5 2.5 M33.5 24 v17 q0 2.5 2.5 2.5" stroke=${BLUE} stroke-width="3.6" />
    <path d="M18 36 q6 -6 12 0" />`,

  poop: svg`
    <path d="M17.5 24.5 C14 22.5, 15.5 17.5, 19.5 17 C21.5 12.5, 26 9.5, 30.5 8 C28.5 12, 32 15, 31 18 C34.5 19, 34.5 23.5, 31 24.5 Z" fill="#b98159" />
    <path d="M12.5 33 C8 32, 8.5 25.5, 13.5 24.5 H34.5 C39.5 25.5, 40 32, 35.5 33 Z" fill="#b98159" />
    <path d="M8.5 42 C3.5 41.5, 3.5 34, 9 33 H39 C44.5 34, 44.5 41.5, 39.5 42 Z" fill="#b98159" />
    <circle cx="19" cy="28.5" r="3" fill="#fff" stroke-width="1.8" /><circle cx="29" cy="28.5" r="3" fill="#fff" stroke-width="1.8" />
    ${dot(19.5, 29, 1.3)}${dot(29.5, 29, 1.3)}
    <path d="M18 36.5 q6 4 12 0" />`,

  angry: svg`
    <path d=${FACE} fill="#ff9b9b" />
    <path d="M11 14 l9 4.5 M37 14 l-9 4.5" stroke-width="2.6" />
    ${dot(16.5, 22.5)}${dot(31.5, 22.5)}
    <path d="M16.5 35 q7.5 -6 15 0" />
    <path d="M37 3 l2.5 3 M45 3 l-2.5 3 M37 11 l2.5 -3 M45 11 l-2.5 -3" stroke="#d23c5f" stroke-width="2.2" />`,
};

export const REACTION_NAMES = Object.keys(ART);

export const reactionArt = (name, size = 40) => html`<svg class="reaction-art" width=${size} height=${size} viewBox="0 0 48 48" aria-hidden="true">${svg`
  <g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${ART[name]}</g>`}</svg>`;

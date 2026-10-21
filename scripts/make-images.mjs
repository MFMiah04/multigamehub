// Draws the link-preview image and app icons as PNGs, in the same doodle style as the site.
// Run with "npm run images" after changing any game's sticky-note drawing.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const font = { fontFiles: ['scripts/fonts/Kalam-Bold.ttf', 'scripts/fonts/Kalam-Regular.ttf'], loadSystemFonts: false, defaultFontFamily: 'Kalam' };
const png = (svg, width) => new Resvg(svg, { font, fitTo: { mode: 'width', value: width } }).render().asPng();

// Pull a game's sticky-note drawing straight out of its module so these always match the site.
const artOf = file => readFileSync(`src/games/${file}.js`, 'utf8').match(/art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true">([\s\S]*?)<\/svg>`/)[1];

const INK = '#222';
const PAPER = '#fdf8ec';
const LINE = '#c7d4e8';
const ruled = (w, h, gap) => Array.from({ length: Math.ceil(h / gap) }, (_, i) => `<path d="M0 ${i * gap + gap - 8} H${w}" stroke="${LINE}" stroke-width="2" />`).join('');
const wobble = (x, y, w, h, fill, tilt) =>
  `<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})"><rect x="${x + 5}" y="${y + 5}" width="${w}" height="${h}" rx="10" fill="rgba(0,0,0,0.13)" />
   <path d="M${x + 6} ${y + 2} Q${x + w / 2} ${y - 3} ${x + w - 4} ${y + 4} Q${x + w + 3} ${y + h / 2} ${x + w - 3} ${y + h - 3} Q${x + w / 2} ${y + h + 3} ${x + 4} ${y + h - 2} Q${x - 3} ${y + h / 2} ${x + 6} ${y + 2} Z" fill="${fill}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" /></g>`;

// ----- link preview (what shows up when an invite link is pasted into a chat) -----
const notes = [
  ['spyfall', 'Spyfall', '#a0e7e5', -3], ['avalon', 'Avalon', '#f3d38b', 2.5], ['herd-mentality', 'Herd Mentality', '#b4f8c8', -2],
  ['fake-answer', 'Fake Answer', '#ffe066', 3], ['number-climb', 'Number Climb', '#ffc48c', -2.5], ['imposter', 'Imposter', '#ffaebc', 2],
];
const noteW = 165, noteH = 180, gapX = 22, startX = (1200 - (notes.length * noteW + (notes.length - 1) * gapX)) / 2, noteY = 268;
const stickies = notes.map(([file, name, color, tilt], i) => {
  const x = startX + i * (noteW + gapX);
  return `${wobble(x, noteY, noteW, noteH, color, tilt)}
    <g transform="rotate(${tilt} ${x + noteW / 2} ${noteY + noteH / 2})">
      <svg x="${x + 18}" y="${noteY + 18}" width="129" height="113" viewBox="0 0 64 56">${artOf(file)}</svg>
      <text x="${x + noteW / 2}" y="${noteY + 160}" font-size="${name.length > 11 ? 22 : 26}" font-weight="700" text-anchor="middle" fill="${INK}">${name}</text>
    </g>`;
}).join('');

const og = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${PAPER}" />${ruled(1200, 630, 44)}
  <text x="600" y="128" font-size="96" font-weight="700" text-anchor="middle" fill="${INK}">MultigameHub</text>
  <path d="M300 150 C420 142, 620 156, 900 146 M318 166 C500 160, 700 170, 884 162" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round" />
  <text x="600" y="224" font-size="38" text-anchor="middle" fill="#5a5650">Free party games to play together, on phones or computers</text>
  ${stickies}
  <text x="600" y="560" font-size="34" font-weight="700" text-anchor="middle" fill="${INK}">Make a room, share the code, play!</text>
  <text x="600" y="602" font-size="26" text-anchor="middle" fill="#5a5650">multigame-hub.web.app</text>
</svg>`;
writeFileSync('public/og-image.png', png(og, 1200));

// ----- app icon: a little doodle character on notebook paper -----
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${PAPER}" />${ruled(512, 512, 64)}
  <g transform="translate(96 76) scale(6.6)" fill="none" stroke="${INK}" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M9 55 C9 42, 15 34, 24 34 C33 34, 39 42, 39 55 Z" fill="#ffe066" />
    <path d="M8.5 20.5 C8 0, 40 -0.5, 39.5 20 C39.5 40.5, 9 41, 8.5 20.5 Z" fill="#ffe066" />
    <circle cx="18.5" cy="18.5" r="2.4" fill="${INK}" stroke="none" /><circle cx="29.5" cy="18.5" r="2.4" fill="${INK}" stroke="none" />
    <path d="M17.5 25.5 q6.5 5.5 13 0" />
  </g>
</svg>`;
writeFileSync('public/icon-512.png', png(icon, 512));
writeFileSync('public/icon-192.png', png(icon, 192));
writeFileSync('public/apple-touch-icon.png', png(icon, 180));
console.log('Wrote public/og-image.png, icon-512.png, icon-192.png, apple-touch-icon.png');

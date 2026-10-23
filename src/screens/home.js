import { html, nothing, button, action, toast, confirmDialog, avatar } from '../ui.js';
import { PARTS, randomLook } from '../avatar.js';
import { gameList } from '../games/index.js';
import { randomPlaceholderName } from '../data/placeholder-names.js';

const NAME_KEY = 'mgh:name';
const LOOK_KEY = 'mgh:look';
const PLACEHOLDER_NAME = randomPlaceholderName();

function savedLook() {
  try {
    const look = JSON.parse(localStorage.getItem(LOOK_KEY));
    if (look && ['e', 'm', 'b'].every(k => Number.isInteger(look[k]))) return look;
  } catch { /* fall through to a random character */ }
  return randomLook();
}

export const homeState = {
  name: localStorage.getItem(NAME_KEY) || '',
  look: savedLook(),
  joining: false,
  code: '',
};

function readName() {
  const name = document.getElementById('name').value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) { toast('Pop your name in first (at least 2 letters).'); return null; }
  localStorage.setItem(NAME_KEY, name);
  homeState.name = name;
  return name;
}

// A game's name for its note. Some are split over two lines (at the space nearest the middle)
// so the notes look even.
export function noteName(game) {
  const name = game.name;
  if (!game.twoLines || !name.includes(' ')) return name;
  const spaces = [...name].map((ch, i) => (ch === ' ' ? i : -1)).filter(i => i >= 0);
  const cut = spaces.reduce((best, i) => (Math.abs(i - name.length / 2) < Math.abs(best - name.length / 2) ? i : best));
  return html`${name.slice(0, cut)} <br>${name.slice(cut + 1)}`; // the space keeps the name readable as text
}

export function showRules(game) {
  return confirmDialog(html`<h2>${game.name}</h2><p class="note">${game.blurb} ${game.players} players.</p>
    <ol class="rules">${game.rules.map(r => html`<li>${r}</li>`)}</ol>`, 'Got it', 'yellow', false);
}

const arrow = (dir, part, label, onClick) => html`<button class="arrow wobble" aria-label="${dir < 0 ? 'Previous' : 'Next'} ${label}" title=${label} @click=${() => onClick(part, dir)}>
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d=${dir < 0 ? 'M15 5 L8 12 L15 19' : 'M9 5 L16 12 L9 19'} fill="none" stroke="#222" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" /></svg>
</button>`;

// Remembers your character on this device, for the home page and next time.
export function saveLook(look) {
  homeState.look = look;
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* not saved */ }
}

// The arrows-either-side character creator, used on the home page and in the lobby.
export function creator(look, onChange) {
  const cycle = (part, dir) => onChange({ ...look, [part]: (look[part] + dir + PARTS[part]) % PARTS[part] });
  const parts = [['e', 'eyes'], ['m', 'mouth'], ['b', 'colour']];
  return html`<section class="creator" aria-label="Your character">
    <div class="creator__arrows">${parts.map(([p, label]) => arrow(-1, p, label, cycle))}</div>
    <div class="creator__figure">${avatar({ look }, 74)}</div>
    <div class="creator__arrows">${parts.map(([p, label]) => arrow(1, p, label, cycle))}</div>
  </section>`;
}

export function homeView({ onHost, onJoin, rerender, rejoin, onRejoin, onForget }) {
  const s = homeState;
  const host = async () => { const name = readName(); if (name) await onHost(name, s.look); };
  const join = async () => {
    const name = readName();
    if (!name) return;
    const code = document.getElementById('code').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) return toast('Room codes are 4 letters.');
    await onJoin(code, name, s.look);
  };
  const enter = fn => e => e.key === 'Enter' && action(fn)();

  return html`
    <main class="page home">
      <h1 class="title">MultigameHub</h1>
      <p class="note center">Party games to play together, on phones or computers. Get everyone in the same room (or on a call) and play.</p>

      ${rejoin ? html`<div class="rejoin wobble">
        <span>You're still in room <b>${rejoin.code}</b>${rejoin.where ? html` <small>(${rejoin.where})</small>` : nothing}</span>
        ${button('Jump back in', action(onRejoin), { kind: 'mint', small: true })}
        <button class="kick rejoin__close" aria-label="Hide this" @click=${onForget}>×</button>
      </div>` : nothing}

      <label class="line-field"><span>Your name:</span>
        <input id="name" maxlength="16" autocomplete="nickname" .value=${s.name} placeholder=${PLACEHOLDER_NAME}
          @keydown=${enter(s.joining ? join : host)}></label>

      ${creator(s.look, look => { saveLook(look); rerender(); })}

      ${s.joining
        ? html`<label class="line-field"><span>Room code:</span>
            <input id="code" class="code-input" maxlength="4" autocomplete="off" autocapitalize="characters" .value=${s.code}
              placeholder="ABCD" @input=${e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); s.code = e.target.value; }}
              @keydown=${enter(join)}></label>
          <div class="home-actions">
            ${button('Join the room', action(join), { kind: 'mint' })}
            ${button('Back', () => { s.joining = false; rerender(); }, { kind: 'white' })}
          </div>`
        : html`<div class="home-actions">
            ${button('Host a game', action(host))}
            ${button('Join with a code', () => { s.joining = true; rerender(); setTimeout(() => document.getElementById('code')?.focus()); }, { kind: 'white' })}
          </div>`}

      <h2 class="section-title">The rules</h2>
      <div class="notes">
        ${gameList.map(g => html`<button class="sticky sticky--${g.color} ${g.name.length > 30 ? 'sticky--long-name' : ''} wobble" @click=${() => showRules(g)} aria-label="How to play ${g.name}">
          <b>${noteName(g)}</b>${g.art}<small>${g.players} players</small>
        </button>`)}
      </div>
      <p class="note center">More games coming soon.</p>
    </main>`;
}

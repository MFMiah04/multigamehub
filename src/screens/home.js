import { html, button, action, toast, confirmDialog } from '../ui.js';
import { gameList } from '../games/index.js';

const NAME_KEY = 'mgh:name';

export const homeState = {
  name: localStorage.getItem(NAME_KEY) || '',
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

export function showRules(game) {
  return confirmDialog(html`<h2>${game.name}</h2><p class="note">${game.players} players</p>
    <ol class="rules">${game.rules.map(r => html`<li>${r}</li>`)}</ol>`, 'Got it', 'yellow', false);
}

export function homeView({ onHost, onJoin, rerender }) {
  const s = homeState;
  const host = async () => { const name = readName(); if (name) await onHost(name); };
  const join = async () => {
    const name = readName();
    if (!name) return;
    const code = document.getElementById('code').value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) return toast('Room codes are 4 letters.');
    await onJoin(code, name);
  };
  const enter = fn => e => e.key === 'Enter' && action(fn)();

  return html`
    <main class="page home">
      <header class="home__title">
        <h1 class="logo">Multi<span class="hl">game</span><br>Hub</h1>
        <p class="note">Party games for your phone. Get everyone in the same room (or call) and play.</p>
      </header>

      <label class="field"><span>Your name</span>
        <input id="name" class="wobble" maxlength="16" autocomplete="nickname" .value=${s.name} placeholder="Mo"
          @keydown=${enter(s.joining ? join : host)}></label>

      ${s.joining
        ? html`<label class="field"><span>Room code</span>
            <input id="code" class="wobble code-input" maxlength="4" autocomplete="off" autocapitalize="characters" .value=${s.code}
              placeholder="ABCD" @input=${e => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z]/g, ''); s.code = e.target.value; }}
              @keydown=${enter(join)}></label>
          ${button('Join the room', action(join), { kind: 'mint' })}
          ${button('Back', () => { s.joining = false; rerender(); }, { kind: 'white' })}`
        : html`${button('Host a game', action(host))}
          ${button('Join with a code', () => { s.joining = true; rerender(); setTimeout(() => document.getElementById('code')?.focus()); }, { kind: 'white' })}`}

      <h2 class="section-title">The games</h2>
      <div class="notes">
        ${gameList.map(g => html`<button class="sticky sticky--${g.color} wobble" @click=${() => showRules(g)}>
          <b>${g.name}</b><small>${g.blurb}</small><small class="sticky__meta">${g.players} players · how to play</small>
        </button>`)}
      </div>
      <p class="note center footer-note">More games coming soon.</p>
    </main>`;
}

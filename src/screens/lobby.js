import qrcode from 'qrcode-generator';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { repeat } from 'lit-html/directives/repeat.js';
import { html, nothing, button, action, avatar, toast, confirmDialog } from '../ui.js';
import { kickPlayer } from '../room.js';
import { gameList } from '../games/index.js';
import { showRules, creator, saveLook, homeState } from './home.js';
import { cue } from '../sound.js';

export const inviteLink = code => `${location.origin}/?room=${code}`;

async function copyText(text, done) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Older browsers, or pages not served over https: copy via a hidden text box instead.
    const box = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(box);
    box.select();
    const ok = document.execCommand('copy');
    box.remove();
    if (!ok) return toast(`Couldn't copy. It's ${text}`);
  }
  toast(done);
}

export const copyCode = code => copyText(code, `Room code ${code} copied!`);
export const copyInviteLink = code => copyText(inviteLink(code), 'Invite link copied!');

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
}

// Games you can play with this many people come first; the rest are greyed out at the end.
function byPlayable(count) {
  const rated = gameList.map(game => {
    const [min, max] = (game.players.match(/\d+/g) || []).map(Number);
    const problem = count < min ? `needs ${min - count} more` : max && count > max ? `${max} players max` : null;
    return { game, problem };
  });
  return [...rated.filter(r => !r.problem), ...rated.filter(r => r.problem)];
}

// Whether the "change your look" panel is open. Kept outside ctx.local so picking a game doesn't close it.
let editingLook = false;

function lookEditor(ctx) {
  const look = ctx.me.look || homeState.look;
  const change = next => {
    saveLook(next);
    ctx.update({ [`players/${ctx.uid}/look`]: next }).catch(() => toast("Couldn't save your look. Try again?"));
  };
  return html`<section class="look-editor wobble" aria-label="Change your look">
    <p class="note center">Change your look. Everyone sees it straight away.</p>
    ${creator(look, change)}
    ${button('Done', () => { editingLook = false; ctx.rerender(); }, { kind: 'white', small: true })}
  </section>`;
}

export function lobbyView(ctx) {
  const { room, local, isHost } = ctx;
  const game = ctx.game;
  const settings = game ? { ...game.defaults(ctx), ...ctx.settings } : null;
  const reason = game ? game.canStart(ctx, settings) : 'Pick a game first';
  const host = room.players[room.hostId];

  const pickGame = async g => {
    await ctx.update({ game: g.id, ...(room.settings?.[g.id] ? {} : { [`settings/${g.id}`]: g.defaults(ctx) }) });
    // Bring the game's settings into view once they've rendered.
    requestAnimationFrame(() => document.getElementById('settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const setSetting = changes => ctx.update(Object.fromEntries(Object.entries(changes).map(([k, v]) => [`settings/${game.id}/${k}`, v])));
  const kick = async p => { if (await confirmDialog(`Remove ${p.name} from the room?`, 'Remove')) await kickPlayer(room, p.id); };

  // A little two-note pop when someone new walks in.
  ctx.players.forEach(p => cue(`join:${ctx.room.code}:${p.id}`, 'join', { at: p.joinedAt, now: ctx.now(), late: 4000 }));
  return html`
    <section class="invite wobble ${local.qr ? 'invite--qr' : ''}">
      <small>Room code (tap to copy)</small>
      <div class="code" role="button" tabindex="0" title="Copy room code" aria-label="Room code ${room.code}. Copy it"
        @click=${ctx.copyCode} @keydown=${e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ctx.copyCode())}
        >${[...room.code].map(c => html`<span class="wobble">${c}</span>`)}</div>
      <div class="row">
        ${button('Copy invite link', () => ctx.share(), { kind: 'white', small: true })}
        ${button(local.qr ? 'Hide QR code' : 'Show QR code', () => { local.qr = !local.qr; ctx.rerender(); }, { kind: 'white', small: true })}
      </div>
      ${local.qr ? html`<div class="qr">${unsafeHTML(qrSvg(inviteLink(room.code)))}</div>` : nothing}
    </section>

    <h2 class="section-title">Players <small>(${ctx.players.length})</small></h2>
    <div class="lineup">
      ${repeat(ctx.players, p => p.id, p => html`<div class="lineup__player ${p.online === false ? 'lineup__player--away' : ''}">
        ${p.id === ctx.uid
          ? html`<button class="lineup__me" aria-label="Change your look" title="Change your look" aria-expanded=${editingLook ? 'true' : 'false'}
              @click=${() => { editingLook = !editingLook; ctx.rerender(); }}>${avatar(p, 56)}<span class="lineup__edit" aria-hidden="true">✎</span></button>`
          : avatar(p, 56)}
        <span>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</span>
        ${p.id === room.hostId ? html`<small class="hl">host</small>` : nothing}
        ${p.online === false ? html`<small>away</small>` : nothing}
        ${isHost && p.id !== ctx.uid ? html`<button class="kick" aria-label="Remove ${p.name}" @click=${action(() => kick(p))}>×</button>` : nothing}
      </div>`)}
    </div>
    ${editingLook ? lookEditor(ctx) : nothing}

    <h2 class="section-title">${isHost ? 'Pick a game' : 'The game'}</h2>
    <div class="notes">
      ${byPlayable(ctx.players.length).map(({ game: g, problem }) => html`<div class="sticky sticky--${g.color} ${g.name.length > 30 ? 'sticky--long-name' : ''} wobble ${room.game === g.id ? 'sticky--picked' : ''} ${!isHost && room.game !== g.id ? 'sticky--faded' : ''} ${problem ? 'sticky--unplayable' : ''}">
        <button class="sticky__pick" ?disabled=${!isHost} @click=${action(() => pickGame(g))}>
          <b>${g.name}</b>${g.art}<small>${problem || `${g.players} players`}</small>
        </button>
        <button class="sticky__rules" aria-label="How to play ${g.name}" title="How to play" @click=${() => showRules(g)}>?</button>
      </div>`)}
    </div>

    ${game ? html`
      <h2 class="section-title" id="settings">Settings</h2>
      <div class="settings">${game.settingsView(ctx, settings, setSetting)}</div>` : nothing}

    <div class="push"></div>
    ${isHost
      ? button(reason || `Start ${game.name}`, action(ctx.startGame), { disabled: !!reason })
      : html`<p class="note center">Waiting for ${host?.name || 'the host'} to ${game ? 'start' : 'pick a game'}…</p>`}`;
}

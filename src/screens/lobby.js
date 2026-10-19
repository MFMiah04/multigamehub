import qrcode from 'qrcode-generator';
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';
import { html, nothing, button, action, avatar, toast, confirmDialog } from '../ui.js';
import { kickPlayer } from '../room.js';
import { gameList } from '../games/index.js';
import { showRules } from './home.js';

export const inviteLink = code => `${location.origin}/?room=${code}`;

export async function shareInvite(code) {
  const url = inviteLink(code);
  if (navigator.share) {
    try { await navigator.share({ title: 'Join my MultigameHub room', text: `Room code ${code}`, url }); return; } catch { /* closed or unsupported: fall back to copying */ }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast('Invite link copied!');
  } catch {
    toast(`Share this link: ${url}`);
  }
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
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

  return html`
    <section class="invite wobble ${local.qr ? 'invite--qr' : ''}">
      <small>Room code</small>
      <div class="code">${[...room.code].map(c => html`<span class="wobble">${c}</span>`)}</div>
      <div class="row">
        ${button('Share invite', () => ctx.share(), { kind: 'white', small: true })}
        ${button(local.qr ? 'Hide QR code' : 'Show QR code', () => { local.qr = !local.qr; ctx.rerender(); }, { kind: 'white', small: true })}
      </div>
      ${local.qr ? html`<div class="qr">${unsafeHTML(qrSvg(inviteLink(room.code)))}</div>` : nothing}
    </section>

    <h2 class="section-title">Players <small>(${ctx.players.length})</small></h2>
    <div class="lineup">
      ${ctx.players.map(p => html`<div class="lineup__player ${p.online === false ? 'lineup__player--away' : ''}">
        ${avatar(p, 56)}
        <span>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</span>
        ${p.id === room.hostId ? html`<small class="hl">host</small>` : nothing}
        ${p.online === false ? html`<small>away</small>` : nothing}
        ${isHost && p.id !== ctx.uid ? html`<button class="kick" aria-label="Remove ${p.name}" @click=${action(() => kick(p))}>×</button>` : nothing}
      </div>`)}
    </div>

    <h2 class="section-title">${isHost ? 'Pick a game' : 'The game'}</h2>
    <div class="notes">
      ${gameList.map(g => html`<div class="sticky sticky--${g.color} wobble ${room.game === g.id ? 'sticky--picked' : ''} ${!isHost && room.game !== g.id ? 'sticky--faded' : ''}">
        <button class="sticky__pick" ?disabled=${!isHost} @click=${action(() => pickGame(g))}>
          <b>${g.name}</b>${g.art}<small>${g.players} players</small>
        </button>
        <button class="sticky__rules" @click=${() => showRules(g)}>how to play</button>
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

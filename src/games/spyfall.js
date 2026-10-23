import { html, nothing, button, timer, selectField, action } from '../ui.js';
import { randomItem, shuffle } from '../room.js';
import { minutes, counts, startVoting, isTimeUp, voteRequestBar, voteRequestsPassed, voteView, votedCount, tally, mostVoted, voteResults, toResults, endScreen, endTitle, sideResult, spotlight, revealButton, backToLobbyButton } from './common.js';
import locations from '../data/spyfall-locations.json';

const enabledLocations = settings => locations.filter((_, i) => !settings.off?.[i]);

export default {
  id: 'spyfall',
  name: 'Spyfall',
  color: 'cyan',
  players: '3–12',
  blurb: "One of you is a spy who doesn't know where you are.",
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M18 27 C19 13, 25 10, 32 13 C39 10, 45 13, 46 27" fill="#5a5650" />
    <path d="M19 23 C27 26, 37 26, 45 23" stroke="#fdf8ec" stroke-width="3" />
    <path d="M7 29 C20 23, 44 23, 57 29 C46 32, 18 32, 7 29 Z" fill="#5a5650" />
    <path d="M15 37 h13 c0 6 -3 9 -6.5 9 S15 43 15 37 Z M36 37 h13 c0 6 -3 9 -6.5 9 S36 43 36 37 Z" fill="#222" />
    <path d="M28 38 q4 -2 8 0" />
  </g></svg>`,
  rules: [
    'Everyone gets the same secret location and a role there, except the spy.',
    'Take turns asking each other questions about the location.',
    'Be vague enough that the spy can\'t work it out, but specific enough to prove you know it.',
    'When you think you know who the spy is, vote. The spy wins if they aren\'t caught.',
  ],

  defaults: () => ({ spies: 1, time: 480, voteTime: 90, off: {} }),

  settingsView(ctx, s, set) {
    const off = s.off || {};
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Spies', s.spies, counts(1, ctx.players.length >= 5 ? 2 : 1, 'spy').map(([v]) => [v, v === 1 ? '1 spy' : '2 spies']), v => set({ spies: +v }), disabled)}
      ${selectField('Round length', s.time, minutes(3, 15), v => set({ time: +v }), disabled)}
      ${selectField('Time to vote', s.voteTime, [[60, '1 min'], [90, '1½ min'], [120, '2 min'], [180, '3 min']], v => set({ voteTime: +v }), disabled)}
      <details class="field">
        <summary>Locations (${enabledLocations(s).length} of ${locations.length} on)</summary>
        <div class="checklist">
          ${locations.map((l, i) => html`<label><input type="checkbox" .checked=${!off[i]} ?disabled=${disabled}
            @change=${e => set({ [`off/${i}`]: e.target.checked ? null : true })}> ${l.location}</label>`)}
        </div>
      </details>`;
  },

  canStart(ctx, s) {
    if (ctx.players.length < 3) return `Need ${3 - ctx.players.length} more to play`;
    if (!enabledLocations(s).length) return 'Turn on at least one location';
    return null;
  },

  start(ctx, s) {
    const place = randomItem(enabledLocations(s));
    const ids = shuffle(ctx.players.map(p => p.id));
    const spyCount = Math.min(s.spies || 1, ids.length >= 5 ? 2 : 1);
    const roles = shuffle(place.roles);
    const assigned = Object.fromEntries(ids.map((id, i) => [id, i < spyCount ? 'spy' : roles[(i - spyCount) % roles.length]]));
    return {
      phase: 'playing',
      round: { location: place.location, roles: assigned, spyCount, first: randomItem(ids), endsAt: ctx.now() + s.time * 1000 },
    };
  },

  tick(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'playing' && (isTimeUp(ctx) || voteRequestsPassed(ctx))) return startVoting(ctx, s.voteTime);
    if (phase === 'voting' && (isTimeUp(ctx) || votedCount(ctx, ctx.inGame) === ctx.inGame.length)) return toResults(ctx);
    return null;
  },

  view(ctx, s) {
    const { round } = ctx;
    if (ctx.room.phase === 'playing') return playing(ctx, s);
    if (ctx.room.phase === 'voting') {
      return voteView(ctx, {
        candidates: ctx.inGame, voters: ctx.inGame, max: round.spyCount,
        prompt: round.spyCount > 1 ? 'Who are the spies?' : 'Who is the spy?',
      });
    }
    return results(ctx);
  },
};

function playing(ctx, s) {
  const { round, local } = ctx;
  const role = round.roles?.[ctx.uid];
  const isSpy = role === 'spy';
  local.crossed ??= new Set();
  const cross = name => { local.crossed.has(name) ? local.crossed.delete(name) : local.crossed.add(name); ctx.rerender(); };
  const first = ctx.room.players[round.first];

  return html`
    ${timer(round.endsAt, 60)}
    <button class="secret wobble ${local.show ? '' : 'secret--hidden'} ${isSpy ? 'secret--spy' : ''}" @click=${() => { local.show = !local.show; ctx.rerender(); }}>
      ${!local.show ? html`<b>Tap to see your secret</b><small>Keep your screen hidden!</small>`
        : isSpy ? html`<small>Shh…</small><b>You're the spy!</b><small>Work out the location without giving yourself away.</small>`
        : html`<small>The location is</small><b>${round.location}</b><small>You're the ${role}.</small>`}
    </button>
    ${first ? html`<p class="note center">${first.name} asks the first question.</p>` : nothing}
    <details class="field">
      <summary>Possible locations (tap to cross off)</summary>
      <div class="cross-grid">
        ${enabledLocations(s).map(l => html`<button class="cross ${local.crossed.has(l.location) ? 'cross--out' : ''}" @click=${() => cross(l.location)}>${l.location}</button>`)}
      </div>
    </details>
    <div class="push"></div>
    ${voteRequestBar(ctx)}`;
}

function results(ctx) {
  const { round } = ctx;
  const rows = tally(ctx, ctx.inGame, ctx.inGame);
  const spies = ctx.inGame.filter(p => round.roles?.[p.id] === 'spy').map(p => p.id);
  const suspects = mostVoted(rows, round.spyCount);
  const caught = spies.filter(id => suspects.includes(id)).length;
  const headline = caught === spies.length
    ? (spies.length > 1 ? 'Both spies caught!' : 'Spy caught!')
    : caught > 0 ? 'One spy caught, one got away!' : (spies.length > 1 ? 'The spies got away!' : 'The spy got away!');

  const goodWins = caught === spies.length;
  const win = sideResult(ctx, id => (spies.includes(id) ? !goodWins : goodWins));
  return voteResults(ctx, rows, {
    headline,
    outcome: { win, title: endTitle(win, { won: 'Victory!', lost: 'Defeat!', watching: headline }), note: headline },
    question: spies.length > 1 ? 'So, who were the spies?' : 'So, who was the spy?',
    badge: p => (round.roles?.[p.id] === 'spy' ? 'spy' : null),
    detail: p => (round.revealed && round.roles?.[p.id] !== 'spy' ? html`<small>${round.roles?.[p.id]}</small>` : nothing),
    mood: p => (round.roles?.[p.id] === 'spy' ? (suspects.includes(p.id) ? 'shock' : 'happy') : null),
    top: html`${spotlight(ctx.inGame.filter(p => spies.includes(p.id)), spies.length > 1 ? 'were the spies!' : 'was the spy!', goodWins ? 'shock' : 'happy')}
      ${round.revealed ? html`<div class="secret wobble pop-in"><small>The location was</small><b>${round.location}</b></div>` : nothing}
      ${revealButton(ctx, round.revealed, 'Reveal the location', 'revealed')}`,
    bottom: html`
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame), { kind: 'yellow' }) : nothing}
    ${backToLobbyButton(ctx)}`,
  });
}

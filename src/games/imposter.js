import { html, nothing, button, timer, selectField, action, playerTag } from '../ui.js';
import { randomItem, shuffle } from '../room.js';
import { minutes, counts, startVoting, isTimeUp, voteRequestBar, voteRequestsPassed, voteView, votedCount, tally, mostVoted, voteResults, toResults, revealButton, backToLobbyButton } from './common.js';
import words from '../data/imposter-words.json';

const maxImposters = count => Math.max(1, Math.floor((count - 1) / 2));

export default {
  id: 'imposter',
  name: 'Imposter',
  color: 'pink',
  players: '3–12',
  blurb: 'Everyone knows the secret word, except the imposter.',
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path fill="#fff" fill-rule="evenodd" d="M32 28 C28 25.5, 25 24, 20 24 C13 24, 8 22, 5 18.5 C5.5 23, 7 27, 10.5 29.5 C8 30, 5 29, 2.5 26 C5 33, 12 38.5, 22 38.5 C26 38.5, 29 37.5, 32 36.8 C35 37.5, 38 38.5, 42 38.5 C52 38.5, 59 33, 61.5 26 C59 29, 56 30, 53.5 29.5 C57 27, 58.5 23, 59 18.5 C56 22, 51 24, 44 24 C39 24, 36 25.5, 32 28 Z
      M14 29.5 C14 27, 20.5 27, 26.5 31.5 C22.5 35, 15 35, 14 29.5 Z M50 29.5 C50 27, 43.5 27, 37.5 31.5 C41.5 35, 49 35, 50 29.5 Z" />
  </g></svg>`,
  rules: [
    'Everyone sees the same secret word. The imposter only gets a one-word hint.',
    'Go round in the turn order. Each person says one word linked to the secret word.',
    "Don't make it too obvious, or the imposter will work out the word.",
    'Vote for who you think the imposter is. The imposter wins if they blend in.',
  ],

  defaults: () => ({ imposters: 1, time: 300, voteTime: 90 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Imposters', s.imposters, counts(1, maxImposters(ctx.players.length), 'imposter'), v => set({ imposters: +v }), disabled)}
      ${selectField('Round length', s.time, minutes(1, 10), v => set({ time: +v }), disabled)}
      ${selectField('Time to vote', s.voteTime, [[60, '1 min'], [90, '1½ min'], [120, '2 min'], [180, '3 min']], v => set({ voteTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const pick = randomItem(words);
    const ids = shuffle(ctx.players.map(p => p.id));
    const count = Math.min(s.imposters || 1, maxImposters(ids.length));
    const hints = shuffle(pick.hints);
    const imposters = Object.fromEntries(ids.slice(0, count).map((id, i) => [id, hints[i % hints.length]]));
    return {
      phase: 'playing',
      round: { word: pick.word, imposters, count, order: shuffle(ids), endsAt: ctx.now() + s.time * 1000 },
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
        candidates: ctx.inGame, voters: ctx.inGame, max: round.count,
        prompt: round.count > 1 ? 'Who are the imposters?' : 'Who is the imposter?',
      });
    }
    return results(ctx);
  },
};

function playing(ctx, s) {
  const { round, local } = ctx;
  const hint = round.imposters?.[ctx.uid];
  const order = (round.order || []).map(id => ctx.room.players[id] && { id, ...ctx.room.players[id] }).filter(Boolean);

  return html`
    ${timer(round.endsAt, 60)}
    <button class="secret wobble ${local.show ? '' : 'secret--hidden'} ${hint ? 'secret--spy' : ''}" @click=${() => { local.show = !local.show; ctx.rerender(); }}>
      ${!local.show ? html`<b>Tap to see your word</b><small>Keep your screen hidden!</small>`
        : hint ? html`<small>You're the imposter! Your hint is</small><b>${hint}</b><small>Blend in.</small>`
        : html`<small>The secret word is</small><b>${round.word}</b><small>Don't make it too easy.</small>`}
    </button>
    <h3>Turn order</h3>
    <ol class="turns">
      ${order.map(p => html`<li>${playerTag(p, { you: p.id === ctx.uid })}</li>`)}
    </ol>
    <div class="push"></div>
    ${voteRequestBar(ctx, s.voteTime)}`;
}

function results(ctx) {
  const { round } = ctx;
  const rows = tally(ctx, ctx.inGame, ctx.inGame);
  const imposters = ctx.inGame.filter(p => round.imposters?.[p.id]).map(p => p.id);
  const suspects = mostVoted(rows, round.count);
  const caught = imposters.filter(id => suspects.includes(id)).length;
  const headline = caught === imposters.length ? 'Imposter caught!' : caught > 0 ? 'Some imposters caught!' : 'The imposter fooled you!';

  return voteResults(ctx, rows, {
    headline,
    question: imposters.length > 1 ? 'So, who were the imposters?' : 'So, who was the imposter?',
    badge: p => (round.imposters?.[p.id] ? 'imposter' : null),
    detail: p => (round.revealed && round.imposters?.[p.id] ? html`<small>Hint: ${round.imposters[p.id]}</small>` : nothing),
    mood: p => (round.imposters?.[p.id] ? (suspects.includes(p.id) ? 'shock' : 'happy') : null),
    top: html`${round.revealed ? html`<div class="secret wobble pop-in"><small>The word was</small><b>${round.word}</b></div>` : nothing}
      ${revealButton(ctx, round.revealed, 'Reveal the word', 'revealed')}`,
    bottom: html`
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame), { kind: 'yellow' }) : nothing}
    ${backToLobbyButton(ctx)}`,
  });
}

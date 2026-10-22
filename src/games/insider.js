import { html, nothing, button, timer, selectField, action, avatar } from '../ui.js';
import { shuffle } from '../room.js';
import { minutes, startVoting, isTimeUp, voteView, votedCount, tally, mostVoted, voteResults, toResults, endScreen, endTitle, sideResult, spotlight, pickUnused, backToLobbyButton } from './common.js';
import words from '../data/one-word-words.json';

const suspectsOf = ctx => ctx.inGame.filter(p => p.id !== ctx.round.master);

export default {
  id: 'insider',
  name: 'Insider',
  color: 'coral',
  players: '4–8',
  blurb: 'Guess the word by asking yes/no questions, then find who secretly knew it.',
  rules: [
    "One player is the Master. Everyone knows who they are. They know the secret word and can only answer \"Yes\", \"No\" or \"I don't know\".",
    'Someone else is the secret Insider. They know the word too, but have to pretend they don\'t.',
    "Everyone fires yes/no questions at the Master, out loud, to work out the word before time runs out. If nobody gets it, everyone loses!",
    'Once the word is guessed, discuss who seemed to know too much, then vote. Catch the Insider to win.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 18 q0 -12 12 -12 q12 0 12 10 q0 7 -9 10 v6 M25 41 v0.5" stroke-width="3.2" />
    <path d="M36 34 C40 26, 58 26, 62 34 C58 42, 40 42, 36 34 Z" fill="#fff" />
    <circle cx="49" cy="34" r="4" fill="#222" />
    <path d="M38 26 l3 3 M49 22 v4 M60 26 l-3 3" />
  </g></svg>`,

  defaults: () => ({ time: 300, voteTime: 120 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Time to guess the word', s.time, minutes(3, 8), v => set({ time: +v }), disabled)}
      ${selectField('Time to discuss and vote', s.voteTime, minutes(1, 5), v => set({ voteTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 4 ? `Need ${4 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const ids = shuffle(ctx.players.map(p => p.id));
    const word = pickUnused(words, ctx.round.used);
    return {
      phase: 'questions',
      round: { master: ids[0], insider: ids[1], word, endsAt: ctx.now() + s.time * 1000 },
    };
  },

  tick(ctx) {
    const { phase } = ctx.room;
    if (phase === 'questions' && isTimeUp(ctx)) return { phase: 'results', 'round/endsAt': null, 'round/timedOut': true };
    if (phase === 'voting' && (isTimeUp(ctx) || votedCount(ctx, ctx.inGame) === ctx.inGame.length)) return toResults(ctx);
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'questions') return questions(ctx, s);
    if (phase === 'voting') {
      const guesser = ctx.room.players[ctx.round.guesser];
      return html`
        <div class="question wobble center"><small>${guesser?.name || 'Someone'} guessed it! The word was</small><b class="hl">${words[ctx.round.word]}</b></div>
        ${voteView(ctx, { candidates: suspectsOf(ctx), voters: ctx.inGame, max: 1, prompt: 'Who is the Insider?' })}`;
    }
    return results(ctx);
  },
};

function questions(ctx, s) {
  const { round, local } = ctx;
  const master = ctx.room.players[round.master];
  const isMaster = ctx.uid === round.master;
  const isInsider = ctx.uid === round.insider;
  const word = words[round.word];

  if (isMaster) {
    local.picking ??= false;
    const gotIt = id => ctx.update({ ...startVoting(ctx, s.voteTime), 'round/guesser': id });
    return html`
      ${timer(round.endsAt, 30)}
      <div class="secret wobble"><small>You're the Master. The word is</small><b>${word}</b><small>Only answer "Yes", "No" or "I don't know".</small></div>
      ${local.picking
        ? html`<h2 class="center">Who guessed it?</h2>
          <div class="vote-grid">
            ${suspectsOf(ctx).map(p => html`<button class="vote-card wobble" @click=${action(() => gotIt(p.id))}>${avatar(p, 48)}<b>${p.name}</b></button>`)}
          </div>
          <button class="link" @click=${() => { local.picking = false; ctx.rerender(); }}>Not yet</button>`
        : html`<div class="push"></div>${button('They got it!', () => { local.picking = true; ctx.rerender(); }, { kind: 'mint' })}`}`;
  }

  return html`
    ${timer(round.endsAt, 30)}
    <button class="secret wobble ${local.show ? '' : 'secret--hidden'} ${isInsider ? 'secret--spy' : ''}" @click=${() => { local.show = !local.show; ctx.rerender(); }}>
      ${!local.show ? html`<b>Tap to see your role</b><small>Keep your screen hidden!</small>`
        : isInsider ? html`<small>You're the Insider! The word is</small><b>${word}</b><small>Help them guess it, but don't get caught.</small>`
        : html`<small>You're a guesser</small><b>???</b><small>Work out the word with yes/no questions.</small>`}
    </button>
    <div class="waiting-card wobble">
      ${avatar(master, 28)}
      <b>${master?.name || 'The Master'} is the Master</b>
      <small>Ask them yes/no questions out loud. They'll tap when someone gets it.</small>
    </div>`;
}

function results(ctx) {
  const { round } = ctx;
  const word = words[round.word];
  const insider = ctx.room.players[round.insider];
  const roleOf = p => (p.id === round.master ? 'master' : p.id === round.insider ? 'insider' : null);

  if (round.timedOut) {
    const lost = sideResult(ctx, () => false);
    return html`
      ${endScreen(ctx, { win: lost, title: endTitle(lost, { lost: 'Defeat!', watching: "Time's up!" }), note: 'Nobody guessed the word, so everyone loses.' })}
      <h1 class="center scribble pop-in">Time's up!</h1>
      <p class="note center">Nobody guessed it, so everyone loses. Even the Insider!</p>
      ${spotlight(insider ? [{ id: round.insider, ...insider }] : [], 'was the Insider!', 'sad')}
      <div class="secret wobble pop-in"><small>The word was</small><b>${word}</b></div>
      <div class="push"></div>
      ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
      ${backToLobbyButton(ctx)}`;
  }

  const rows = tally(ctx, suspectsOf(ctx), ctx.inGame);
  const top = mostVoted(rows, 1);
  const caught = top.length === 1 && top[0] === round.insider;
  const win = sideResult(ctx, id => (id === round.insider ? !caught : caught));
  const headline = caught ? 'Insider caught!' : 'The Insider got away!';
  return voteResults(ctx, rows, {
    headline,
    outcome: { win, title: endTitle(win, { won: 'Victory!', lost: 'Defeat!', watching: headline }), note: headline },
    question: 'So, who was the Insider?',
    badge: roleOf,
    mood: p => (p.id === round.insider ? (caught ? 'shock' : 'happy') : null),
    top: html`${spotlight(insider ? [{ id: round.insider, ...insider }] : [], 'was the Insider!', caught ? 'shock' : 'happy')}
      <p class="note center">The word was <span class="hl">${word}</span>.</p>`,
    bottom: html`
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`,
  });
}


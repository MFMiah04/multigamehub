import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { shuffle } from '../room.js';
import { isTimeUp, isGraceOver, normalize, pickUnused, turnOf, roundsField, secondsOptions, backToLobbyButton } from './common.js';
import words from '../data/one-word-words.json';

const giversOf = ctx => ctx.inGame.filter(p => p.id !== ctx.round.guesser);
const cleanClue = text => text.trim().split(/\s+/)[0]?.slice(0, 20) || '';

// Clues that match each other, or give the word away, are cancelled before the guesser sees them.
function autoCancel(ctx) {
  const word = normalize(words[ctx.round.word]);
  const clues = ctx.round.clues || {};
  const counts = {};
  Object.values(clues).forEach(c => { counts[normalize(c)] = (counts[normalize(c)] || 0) + 1; });
  const cancelled = {};
  Object.entries(clues).forEach(([id, c]) => {
    const n = normalize(c);
    const givesAway = n.length >= 3 && (word.includes(n) || n.includes(word));
    if (counts[n] > 1 || givesAway) cancelled[id] = true;
  });
  return cancelled;
}

const correctCount = round => Object.values(round.results || {}).filter(Boolean).length;

export default {
  id: 'one-word',
  name: 'One Word',
  color: 'lilac',
  players: '3–12',
  blurb: 'Work together to get one player to guess the secret word.',
  rules: [
    'Each round, one player is the guesser. Everyone else sees a secret word.',
    'Each clue-giver writes a single word to help the guesser.',
    "Careful! Any clues that match each other get cancelled, so be original.",
    'The guesser sees the clues that survive and gets one guess. Score as many as you can as a team.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 10 C6 6, 9 5, 13 5 H35 C39 5, 41 7, 41 11 V22 C41 26, 39 27, 35 27 H20 L12 34 L14 27 H12 C8 27, 6 25, 6 21 Z" fill="#fff" />
    <path d="M13 16 q4 -4 7 0 t7 0 t7 0" />
    <path d="M27 31 C27 28, 29 27, 32 27 H52 C56 27, 58 29, 58 32 V42 C58 46, 56 47, 52 47 H50 L52 53 L45 47 H32 C29 47, 27 45, 27 42 Z" fill="#fff" />
    <path d="M36 33 l12 9 M48 33 l-12 9" stroke="#d23c5f" stroke-width="2.6" />
  </g></svg>`,

  defaults: () => ({ rounds: 8, clueTime: 60, guessTime: 60 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${roundsField(s.rounds, set, disabled)}
      ${selectField('Time to write clues', s.clueTime, secondsOptions([30, 45, 60, 90]), v => set({ clueTime: +v }), disabled)}
      ${selectField('Time to guess', s.guessTime, secondsOptions([30, 60, 90]), v => set({ guessTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const order = shuffle(ctx.players.map(p => p.id));
    const word = pickUnused(words);
    return {
      phase: 'clues',
      round: { no: 1, total: s.rounds, order, guesser: order[0], word, used: { [word]: true }, results: {}, endsAt: ctx.now() + s.clueTime * 1000 },
    };
  },

  // Clue-givers: when time runs out, send whatever's typed.
  clientTick(ctx) {
    const { round } = ctx;
    if (ctx.room.phase !== 'clues' || ctx.uid === round.guesser || !isTimeUp(ctx) || round.clues?.[ctx.uid] || ctx.local.autoSent) return null;
    ctx.local.autoSent = true;
    const typed = cleanClue(document.getElementById('clue')?.value || '');
    return typed ? { [`round/clues/${ctx.uid}`]: typed } : null;
  },

  tick(ctx, s) {
    const { round } = ctx;
    const { phase } = ctx.room;
    if (phase !== 'final' && phase !== 'reveal' && !ctx.room.players[round.guesser]) {
      return { phase: 'reveal', 'round/guess': '', 'round/correct': false, [`round/results/${round.no}`]: false, 'round/endsAt': null };
    }
    if (phase === 'clues') {
      const givers = giversOf(ctx);
      if (givers.every(p => round.clues?.[p.id]) || isGraceOver(ctx)) return { phase: 'check', 'round/endsAt': null, 'round/cancelled': autoCancel(ctx) };
    }
    if (phase === 'guess' && isTimeUp(ctx)) {
      return { phase: 'reveal', 'round/guess': '', 'round/correct': false, [`round/results/${round.no}`]: false, 'round/endsAt': null };
    }
    return null;
  },

  view(ctx, s) {
    const views = { clues, check, guess, reveal, final };
    return views[ctx.room.phase]?.(ctx, s) ?? nothing;
  },
};

const header = ctx => html`<p class="note center">Round ${ctx.round.no} of ${ctx.round.total} · ${correctCount(ctx.round)} correct so far</p>`;
const guesserName = ctx => ctx.room.players[ctx.round.guesser]?.name || 'The guesser';

function clues(ctx) {
  const { round } = ctx;
  const givers = giversOf(ctx);
  const status = progress(givers.filter(p => round.clues?.[p.id]).length, givers.length, 'have written a clue');
  if (ctx.uid === round.guesser) {
    return html`${header(ctx)}${timer(round.endsAt, 10)}
      <div class="waiting-card wobble"><b>You're guessing this round!</b><small>Everyone else is writing you a one-word clue. No peeking.</small></div>
      ${status}`;
  }
  const mine = round.clues?.[ctx.uid];
  const submit = async () => {
    const clue = cleanClue(document.getElementById('clue').value);
    if (!clue) return toast('Write a one-word clue first.');
    await ctx.update({ [`round/clues/${ctx.uid}`]: clue });
  };
  return html`${header(ctx)}${timer(round.endsAt, 10)}
    <div class="secret wobble"><small>${guesserName(ctx)} is guessing. The secret word is</small><b>${words[round.word]}</b><small>Give a one-word clue.</small></div>
    ${mine
      ? html`<p class="answer-locked wobble">"${mine}"</p>
        ${button('Change my clue', action(() => ctx.update({ [`round/clues/${ctx.uid}`]: null })), { kind: 'white' })}`
      : html`<label class="field"><span>Your clue (one word)</span>
          <input id="clue" class="wobble" maxlength="20" autocomplete="off" placeholder="One word"
            @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
        ${button('Send clue', action(submit))}`}
    ${status}`;
}

const clueChips = (ctx, { showCancelled, toggle }) => html`<div class="clue-grid">
  ${giversOf(ctx).filter(p => ctx.round.clues?.[p.id]).filter(p => showCancelled || !ctx.round.cancelled?.[p.id]).map(p => {
    const cancelled = ctx.round.cancelled?.[p.id];
    return html`<button class="clue wobble ${cancelled ? 'clue--cancelled' : ''}" ?disabled=${!toggle} @click=${() => toggle?.(p.id, !cancelled)}>
      <b>${ctx.round.clues[p.id]}</b><small>${avatar(p, 18)} ${p.name}</small>
    </button>`;
  })}
</div>`;

function check(ctx, s) {
  if (ctx.uid === ctx.round.guesser) {
    return html`${header(ctx)}
      <div class="waiting-card wobble"><b>Clues are in!</b><small>The others are checking for matching clues…</small></div>`;
  }
  const toggle = (id, cancel) => ctx.update({ [`round/cancelled/${id}`]: cancel || null });
  const show = () => ctx.update({ phase: 'guess', 'round/endsAt': ctx.now() + s.guessTime * 1000 });
  return html`${header(ctx)}
    <h2 class="center">Check the clues</h2>
    <p class="note center">The word is <span class="hl">${words[ctx.round.word]}</span>. Matching clues were crossed out. Tap a clue to cross it out or bring it back.</p>
    ${clueChips(ctx, { showCancelled: true, toggle })}
    <div class="push"></div>
    ${button(`Show ${guesserName(ctx)} the clues`, action(show))}`;
}

function guess(ctx) {
  const { round } = ctx;
  const left = giversOf(ctx).filter(p => round.clues?.[p.id] && !round.cancelled?.[p.id]).length;
  if (ctx.uid !== round.guesser) {
    return html`${header(ctx)}${timer(round.endsAt, 10)}
      <h2 class="center">${guesserName(ctx)} is guessing…</h2>
      ${clueChips(ctx, { showCancelled: false })}`;
  }
  const finish = (text, passed) => ctx.update({
    phase: 'reveal', 'round/endsAt': null, 'round/guess': passed ? '' : text,
    'round/correct': !passed && normalize(text) === normalize(words[round.word]),
    [`round/results/${round.no}`]: !passed && normalize(text) === normalize(words[round.word]),
  });
  const submit = () => {
    const text = document.getElementById('guess').value.trim();
    if (!text) return toast('Type a guess, or pass.');
    return finish(text, false);
  };
  return html`${header(ctx)}${timer(round.endsAt, 10)}
    <h2 class="center">Your clues</h2>
    ${left ? clueChips(ctx, { showCancelled: false }) : html`<p class="note center">Ouch, every clue got cancelled! Take a wild guess.</p>`}
    <label class="field"><span>What's the word?</span>
      <input id="guess" class="wobble" maxlength="30" autocomplete="off" placeholder="Your guess"
        @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
    ${button('Guess', action(submit))}
    <button class="link" @click=${action(() => finish('', true))}>Pass</button>`;
}

function reveal(ctx, s) {
  const { round } = ctx;
  const word = words[round.word];
  const next = () => {
    const nextWord = pickUnused(words, round.used);
    return ctx.update({
      phase: 'clues', 'round/no': round.no + 1, 'round/guesser': turnOf(ctx, round.order, round.no + 1),
      'round/word': nextWord, [`round/used/${nextWord}`]: true, 'round/clues': null, 'round/cancelled': null,
      'round/guess': null, 'round/correct': null, 'round/endsAt': ctx.now() + s.clueTime * 1000,
    });
  };
  const countIt = () => ctx.update({ 'round/correct': true, [`round/results/${round.no}`]: true });
  const headline = round.correct ? 'Got it!' : round.guess ? 'Not quite!' : 'Passed!';
  return html`${header(ctx)}
    <h1 class="center scribble">${headline}</h1>
    <div class="secret wobble"><small>The word was</small><b>${word}</b>${round.guess ? html`<small>${guesserName(ctx)} guessed "${round.guess}"</small>` : nothing}</div>
    ${!round.correct && round.guess && ctx.uid !== round.guesser
      ? html`<button class="link" @click=${action(countIt)}>Close enough? Count it</button>` : nothing}
    ${clueChips(ctx, { showCancelled: true })}
    <div class="push"></div>
    ${ctx.isHost
      ? (round.no < round.total ? button('Next round', action(next)) : button('See the final score', action(() => ctx.update({ phase: 'final' }))))
      : html`<p class="note center">Waiting for the host…</p>`}`;
}

function final(ctx) {
  const { round } = ctx;
  const score = correctCount(round);
  const ratio = score / round.total;
  const verdict = ratio === 1 ? 'Perfect! Are you all reading each other\'s minds?' : ratio >= 0.75 ? 'Amazing teamwork!' : ratio >= 0.5 ? 'Not bad at all!' : ratio > 0 ? 'Room for improvement…' : 'Well, at least you had fun?';
  return html`
    <h1 class="center scribble">${score} out of ${round.total}</h1>
    <p class="note center">${verdict}</p>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

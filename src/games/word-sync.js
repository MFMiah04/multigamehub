import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { isTimeUp, isGraceOver, normalize, secondsOptions, backToLobbyButton } from './common.js';
import { keyed } from 'lit-html/directives/keyed.js';
import { cue } from '../sound.js';

const COUNTDOWN_MS = 3000;

const cleanWord = text => text.trim().replace(/\s+/g, ' ').slice(0, 25);
const wordsOf = (ctx, words) => ctx.inGame.map(p => ({ player: p, word: words?.[p.id] || '' }));
const allMatch = (ctx, words) => {
  const list = wordsOf(ctx, words).map(w => normalize(w.word));
  return list.length > 1 && list.every(w => w && w === list[0]);
};

export default {
  id: 'word-sync',
  name: 'Word Sync',
  color: 'lime',
  players: '2–8',
  blurb: 'Keep linking words until everyone says the same one.',
  rules: [
    'Everyone secretly writes any word, then all the words are revealed together.',
    'Next round, everyone tries to write a word that links the words that were just revealed.',
    'No talking it through! Keep going until everyone writes the exact same word.',
    'You win together. Try to sync in as few rounds as you can.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 22 C4 12, 26 12, 26 22 C26 31, 15 32, 12 31 L7 36 L8 30 C5 28, 4 25, 4 22 Z" fill="#fff" />
    <path d="M38 22 C38 12, 60 12, 60 22 C60 25, 59 28, 56 30 L57 36 L52 31 C49 32, 38 31, 38 22 Z" fill="#fff" />
    <path d="M10 22 q3 -4 6 0 t5 0 M44 22 q3 -4 6 0 t5 0" />
    <path d="M29 20 h6 M29 25 h6" stroke-width="2.6" />
    <path d="M14 44 q18 12 36 0" />
    <path d="M45 41 l5 3 l-4 4" />
  </g></svg>`,

  defaults: () => ({ time: 45, maxRounds: 15 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Time to write each word', s.time, secondsOptions([20, 30, 45, 60, 90]), v => set({ time: +v }), disabled)}
      ${selectField('Give up after', s.maxRounds, [[10, '10 rounds'], [15, '15 rounds'], [20, '20 rounds'], [0, 'Never give up']], v => set({ maxRounds: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

  start(ctx, s) {
    return { phase: 'write', round: { no: 1, endsAt: ctx.now() + s.time * 1000 } };
  },

  // When time runs out, send whatever's typed.
  clientTick(ctx) {
    if (ctx.room.phase !== 'write' || !isTimeUp(ctx) || ctx.round.words?.[ctx.uid] || ctx.local.autoSent) return null;
    ctx.local.autoSent = true;
    const typed = cleanWord(document.getElementById('word')?.value || '');
    return typed ? { [`round/words/${ctx.uid}`]: typed } : null;
  },

  tick(ctx) {
    const { round } = ctx;
    if (ctx.room.phase !== 'write') return null;
    if (ctx.inGame.every(p => round.words?.[p.id]) || isGraceOver(ctx)) {
      return { phase: 'reveal', 'round/endsAt': null, 'round/synced': allMatch(ctx, round.words), 'round/revealAt': ctx.now() + COUNTDOWN_MS };
    }
    return null;
  },

  view(ctx, s) {
    const views = { write, reveal };
    return views[ctx.room.phase]?.(ctx, s) ?? nothing;
  },
};

const lastWords = ctx => {
  const prev = ctx.round.history?.[ctx.round.no - 1];
  return prev ? wordsOf(ctx, prev).filter(w => w.word) : [];
};

// `face` is 'up', 'down' (a card back) or 'flip' (turning over now, one after another).
const wordCards = (list, face = 'up') => html`<div class="clue-grid">
  ${list.map(({ player, word }, i) => face === 'down'
    ? html`<div class="clue clue--back wobble"><b>?</b><small>${avatar(player, 18)} ${player.name}</small></div>`
    : html`<div class="clue clue--lime wobble ${word ? '' : 'clue--cancelled'} ${face === 'flip' ? 'clue--flip' : ''}" style="--i: ${i}">
      <b>${word || '…'}</b><small>${avatar(player, 18)} ${player.name}</small>
    </div>`)}
</div>`;

function history(ctx, upTo) {
  const rows = Object.entries(ctx.round.history || {}).filter(([no]) => +no <= upTo).sort((a, b) => a[0] - b[0]);
  if (!rows.length) return nothing;
  return html`<h3 class="section-title">The story so far</h3>
    <ol class="sync-history">${rows.map(([, words]) => html`<li>${wordsOf(ctx, words).map(w => w.word || '…').join(' · ')}</li>`)}</ol>`;
}

function write(ctx) {
  const { round } = ctx;
  const mine = round.words?.[ctx.uid];
  const previous = lastWords(ctx);
  const written = ctx.inGame.filter(p => round.words?.[p.id]).length;
  const submit = async () => {
    const word = cleanWord(document.getElementById('word').value);
    if (!word) return toast('Write a word first.');
    await ctx.update({ [`round/words/${ctx.uid}`]: word });
  };
  return html`
    <p class="note center">Round ${round.no}</p>
    ${timer(round.endsAt, 10)}
    ${previous.length
      ? html`<h2 class="center">Find a word that links these</h2>${wordCards(previous)}`
      : html`<div class="waiting-card wobble"><b>Write any word!</b><small>Anything at all. Then you'll try to meet in the middle.</small></div>`}
    ${mine
      ? html`<p class="answer-locked wobble">"${mine}"</p>
        ${button('Change my word', action(() => ctx.update({ [`round/words/${ctx.uid}`]: null })), { kind: 'white' })}`
      : html`<label class="field"><span>Your word</span>
          <input id="word" class="wobble" maxlength="25" autocomplete="off" placeholder="${previous.length ? 'Something that links them' : 'Any word'}"
            @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
        ${button('Send word', action(submit))}`}
    ${progress(written, ctx.inGame.length, 'have written a word')}
    ${history(ctx, round.no - 2)}`;
}

function reveal(ctx, s) {
  const { round } = ctx;
  const words = wordsOf(ctx, round.words);
  const outOfRounds = !round.synced && s.maxRounds && round.no >= s.maxRounds;
  const next = () => ctx.update({
    phase: 'write', [`round/history/${round.no}`]: round.words || {}, 'round/no': round.no + 1,
    'round/words': null, 'round/synced': null, 'round/revealAt': null, 'round/endsAt': ctx.now() + s.time * 1000,
  });

  // A 3-2-1 countdown with the cards face down, then they all flip over together.
  const left = round.revealAt ? round.revealAt - ctx.now() : 0;
  if (left > 0) {
    const count = Math.min(3, Math.ceil(left / 1000));
    cue(`ws:${round.revealAt}:${count}`, 'tock', { at: round.revealAt - count * 1000, now: ctx.now(), late: 900 });
    return html`
      <p class="note center">Round ${round.no}</p>
      <h1 class="center scribble">Words in…</h1>
      <div class="countdown">${keyed(count, html`<b class="countdown__number">${count}</b>`)}</div>
      ${wordCards(words, 'down')}`;
  }
  if (round.revealAt) cue(`ws:${round.revealAt}:flip`, round.synced ? 'ding' : 'whoosh', { at: round.revealAt, now: ctx.now() });

  const headline = round.synced
    ? (round.no === 1 ? 'Synced on the first try?!' : `Synced in ${round.no} rounds!`)
    : outOfRounds ? 'Out of rounds!' : 'Not quite…';
  const note = round.synced
    ? (round.no <= 3 ? 'Are you sharing a brain?' : round.no <= 6 ? 'Great minds think alike.' : 'You got there in the end!')
    : outOfRounds ? `You couldn't sync in ${s.maxRounds} rounds. So close, maybe?` : 'Now find a word that links these.';

  return html`
    <p class="note center">Round ${round.no}</p>
    <h1 class="center scribble pop-in">${headline}</h1>
    <p class="note center">${note}</p>
    ${wordCards(words, round.revealAt && ctx.now() - round.revealAt < 4000 ? 'flip' : 'up')}
    ${history(ctx, round.no - 1)}
    <div class="push"></div>
    ${round.synced || outOfRounds
      ? html`${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}${backToLobbyButton(ctx)}`
      : ctx.isHost ? button('Next round', action(next)) : html`<p class="note center">Waiting for the host…</p>`}`;
}

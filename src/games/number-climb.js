import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, action, avatar } from '../ui.js';
import { roomRef, shuffle } from '../room.js';
import { backToLobbyButton } from './common.js';

const COUNTDOWN_MS = 3500;
const maxCards = playerCount => Math.max(2, Math.min(10, Math.floor(100 / Math.max(playerCount, 1))));
const handOf = (round, id) => round.hands?.[id] || [];
const cardsLeft = round => Object.values(round.hands || {}).reduce((n, hand) => n + (hand?.length || 0), 0);

// Plays your lowest card. Runs as a transaction so that if two people tap at once,
// the database decides who was really first and everyone sees the same pile.
function playLowest(ctx) {
  return runTransaction(roomRef(ctx.room.code, 'round'), round => {
    if (!round || round.result || ctx.now() < round.startsAt) return undefined;
    const hand = handOf(round, ctx.uid);
    if (!hand.length) return undefined;
    const card = Math.min(...hand);
    round.hands[ctx.uid] = hand.filter(n => n !== card);
    const log = round.log || [];
    log.push({ n: card, by: ctx.uid, type: 'play' });

    // Anyone still holding a lower card: show and discard those cards, and lose one life.
    const missed = [];
    Object.entries(round.hands).forEach(([id, cards]) => {
      (cards || []).filter(n => n < card).forEach(n => missed.push({ n, by: id, type: 'missed' }));
      round.hands[id] = (cards || []).filter(n => n > card);
    });
    if (missed.length) {
      missed.sort((a, b) => a.n - b.n).forEach(m => log.push(m));
      round.mistakes = (round.mistakes || 0) + 1;
      round.lastMistake = { card, by: ctx.uid, missed };
      if (round.lives > 0) round.lives -= 1;
      else round.result = 'lost';
    }
    round.log = log;
    if (!round.result && cardsLeft(round) === 0) round.result = 'won';
    return round;
  });
}

export default {
  id: 'number-climb',
  name: 'Number Climb',
  color: 'orange',
  players: '2–8',
  blurb: 'Play all your cards from lowest to highest, without talking.',
  rules: [
    'Everyone gets secret number cards between 1 and 100.',
    'Together, play every card onto the pile in order from lowest to highest. Anyone can play at any time.',
    'No talking about your numbers! You just have to feel when it\'s your turn.',
    'If a card is played while someone still has a lower one, the group loses a life and those lower cards are thrown away. Play all the cards to win.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="22" width="20" height="28" rx="3" fill="#fff" transform="rotate(-8 14 36)" />
    <rect x="22" y="14" width="20" height="28" rx="3" fill="#fff" transform="rotate(2 32 28)" />
    <rect x="40" y="6" width="20" height="28" rx="3" fill="#ffc48c" transform="rotate(9 50 20)" />
    <path d="M9 34 l3 -2 v9 M27 24 q3 -3 6 0 q1 3 -6 8 h7 M45 15 q3 -2 6 0 q2 3 -2 5 q4 1 2 5 q-3 2 -6 0" stroke-width="2" />
    <path d="M10 8 q10 -6 20 -4 M26 1 l4 3 l-3 4" />
  </g></svg>`,

  defaults: () => ({ cards: 5, lives: 3 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    const most = maxCards(ctx.players.length);
    const cardOptions = Array.from({ length: most - 1 }, (_, i) => [i + 2, `${i + 2} cards`]);
    return html`
      ${selectField('Cards each', Math.min(s.cards, most), cardOptions, v => set({ cards: +v }), disabled)}
      ${selectField('Lives for the group', s.lives, [[0, '0 (one mistake ends it)'], [1, '1 life'], [2, '2 lives'], [3, '3 lives'], [4, '4 lives'], [5, '5 lives']], v => set({ lives: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

  start(ctx, s) {
    const ids = ctx.players.map(p => p.id);
    const count = Math.min(s.cards || 5, maxCards(ids.length));
    const deck = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
    const hands = Object.fromEntries(ids.map((id, i) => [id, deck.slice(i * count, (i + 1) * count).sort((a, b) => a - b)]));
    return {
      phase: 'play',
      round: { hands, lives: s.lives ?? 3, startLives: s.lives ?? 3, cardsEach: count, mistakes: 0, startsAt: ctx.now() + COUNTDOWN_MS },
    };
  },

  // If someone leaves mid-game, throw their cards away so everyone else can carry on.
  tick(ctx) {
    const { round } = ctx;
    if (round.result) return null;
    const gone = Object.keys(round.hands || {}).filter(id => !ctx.room.players[id] && handOf(round, id).length);
    if (!gone.length) return null;
    const updates = {};
    gone.forEach(id => { updates[`round/hands/${id}`] = null; });
    const remaining = cardsLeft(round) - gone.reduce((n, id) => n + handOf(round, id).length, 0);
    if (remaining === 0) updates['round/result'] = 'won';
    return updates;
  },

  view(ctx) {
    return ctx.round.result ? finished(ctx) : playing(ctx);
  },
};

const hearts = (lives, start) => html`<p class="nc-lives center" aria-label="${lives} lives left">
  ${start === 0 ? html`<span class="note">Sudden death: one mistake ends it</span>`
    : html`${Array.from({ length: start }, (_, i) => html`<span class="nc-heart ${i < lives ? '' : 'nc-heart--lost'}">♥</span>`)}`}
</p>`;

function playing(ctx) {
  const { round } = ctx;
  const countdown = round.startsAt - ctx.now();
  const counting = countdown > 0;
  const plays = (round.log || []).filter(e => e.type === 'play');
  const top = plays.at(-1);
  const topPlayer = top && ctx.room.players[top.by];
  const mine = handOf(round, ctx.uid);
  const mistake = round.lastMistake;
  const showMistake = mistake && plays.at(-1)?.n === mistake.card;

  return html`
    ${hearts(round.lives, round.startLives)}
    <div class="nc-pile wobble ${counting ? 'nc-pile--count' : ''}">
      ${counting
        ? html`<small>Get ready…</small><b>${Math.min(3, Math.max(1, Math.ceil((countdown - 500) / 1000)))}</b>`
        : top
          ? html`<small>Last card</small><b>${top.n}</b><small>${topPlayer ? `played by ${topPlayer.name}` : ''}</small>`
          : html`<small>Go!</small><b>?</b><small>Who has the lowest card?</small>`}
    </div>
    ${showMistake ? html`<p class="nc-oops center">Oops! ${mistake.missed.map(m => `${ctx.room.players[m.by]?.name || 'Someone'} had ${m.n}`).join(', ')}.</p>` : nothing}

    <div class="nc-others">
      ${ctx.inGame.filter(p => p.id !== ctx.uid).map(p => html`<span class="tag wobble">${avatar(p, 22)} ${p.name} <small>${handOf(round, p.id).length} left</small></span>`)}
    </div>

    <div class="push"></div>
    ${mine.length
      ? html`<p class="note center">Your cards</p>
        <div class="nc-hand">
          ${mine.map((n, i) => i === 0
            ? html`<button class="nc-card nc-card--next wobble" ?disabled=${counting} aria-label="Play ${n}" @click=${action(() => playLowest(ctx))}>${n}<small>tap to play</small></button>`
            : html`<span class="nc-card wobble">${n}</span>`)}
        </div>`
      : html`<p class="note center">You're out of cards. Willing the others on…</p>`}`;
}

function finished(ctx) {
  const { round } = ctx;
  const won = round.result === 'won';
  const mistakes = round.mistakes || 0;
  const headline = won
    ? (mistakes === 0 ? 'Perfect climb!' : 'You made it!')
    : 'Game over!';
  const note = won
    ? (mistakes === 0 ? 'Every card in order. Are you all telepathic?' : `All cards played, with ${mistakes} slip${mistakes === 1 ? '' : 's'} on the way.`)
    : `${round.startLives === 0 ? 'Sudden death! One slip ended it' : 'You ran out of lives'} with ${cardsLeft(round)} card${cardsLeft(round) === 1 ? '' : 's'} still to play.`;
  return html`
    <h1 class="center scribble">${headline}</h1>
    <p class="note center">${note}</p>
    <h3 class="section-title">How it went</h3>
    <div class="nc-log">
      ${(round.log || []).map(e => {
        const who = ctx.room.players[e.by];
        return html`<span class="nc-log__card ${e.type === 'missed' ? 'nc-log__card--missed' : ''}" title="${who?.name || ''}">
          <b>${e.n}</b><small>${who?.name || '?'}</small></span>`;
      })}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

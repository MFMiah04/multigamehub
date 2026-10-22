import { runTransaction } from 'firebase/database';
import { html, nothing, button, selectField, action, avatar } from '../ui.js';
import { svg } from 'lit-html';
import { keyed } from 'lit-html/directives/keyed.js';
import { roomRef, shuffle } from '../room.js';
import { backToLobbyButton, endScreen, endTitle, sideResult } from './common.js';
import { cue } from '../sound.js';

const COUNTDOWN_MS = 3500;
// At least one life: losing your last one ends the game. (Older rooms may have 0 saved from before.)
const livesOf = s => Math.min(5, Math.max(1, s.lives ?? 3));
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
      // Losing your last life ends the game.
      round.lives = Math.max(0, (round.lives || 0) - 1);
      if (round.lives === 0) round.result = 'lost';
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
      ${selectField('Lives for the group', livesOf(s), [[1, '1 life (one mistake ends it)'], [2, '2 lives'], [3, '3 lives'], [4, '4 lives'], [5, '5 lives']], v => set({ lives: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

  start(ctx, s) {
    const ids = ctx.players.map(p => p.id);
    const count = Math.min(s.cards || 5, maxCards(ids.length));
    const deck = shuffle(Array.from({ length: 100 }, (_, i) => i + 1));
    const hands = Object.fromEntries(ids.map((id, i) => [id, deck.slice(i * count, (i + 1) * count).sort((a, b) => a - b)]));
    return {
      phase: 'play',
      round: { hands, lives: livesOf(s), startLives: livesOf(s), cardsEach: count, mistakes: 0, startsAt: ctx.now() + COUNTDOWN_MS },
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

// Doodled hearts. A lost heart is cracked down the middle, and the one just lost breaks apart.
const HEART_LEFT = 'M12 21 C5 15, 2 11.5, 2 8 C2 5, 4.5 3, 7 3 C9 3, 11 4.5, 12 6 L10.5 10 L13 13 L11 16.5 Z';
const HEART_RIGHT = 'M12 6 C13 4.5, 15 3, 17 3 C19.5 3, 22 5, 22 8 C22 11.5, 19 15, 12 21 L11 16.5 L13 13 L10.5 10 Z';
const HEART = 'M12 21 C5 15, 2 11.5, 2 8 C2 5, 4.5 3, 7 3 C9 3, 11 4.5, 12 6 C13 4.5, 15 3, 17 3 C19.5 3, 22 5, 22 8 C22 11.5, 19 15, 12 21 Z';
const heart = cls => html`<svg class="nc-heart ${cls}" viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">${svg`
  <g stroke="#222" stroke-width="1.6" stroke-linejoin="round">
    ${cls ? svg`<path class="nc-heart__left" d=${HEART_LEFT} /><path class="nc-heart__right" d=${HEART_RIGHT} />` : svg`<path d=${HEART} />`}
  </g>`}</svg>`;

const hearts = (lives, start) => html`<p class="nc-lives center" aria-label="${lives} lives left">
  ${Array.from({ length: start }, (_, i) => heart(i < lives ? '' : i === lives ? 'nc-heart--lost nc-heart--breaking' : 'nc-heart--lost'))}
  ${lives === 1 ? html`<span class="note nc-last-life">last life!</span>` : nothing}
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
  const count = Math.min(3, Math.max(1, Math.ceil((countdown - 500) / 1000)));
  if (counting) cue(`nc:${round.startsAt}:count:${count}`, 'tock');
  else cue(`nc:${round.startsAt}:go`, 'pop');
  if (plays.length) cue(`nc:${round.startsAt}:play:${plays.length}`, showMistake ? 'buzz' : 'pop');

  return html`
    ${keyed(round.mistakes || 0, html`<div class="${round.mistakes ? 'nc-shake' : ''}">
      ${hearts(round.lives, round.startLives)}
      <div class="nc-pile wobble ${counting ? 'nc-pile--count' : ''} ${showMistake ? 'nc-pile--oops' : ''}">
        ${counting
          ? keyed(`count${count}`, html`<small>Get ready…</small><b>${count}</b>`)
          : top
            ? keyed(`card${plays.length}`, html`<small>Last card</small><b class="nc-slam">${top.n}</b><small>${topPlayer ? `played by ${topPlayer.name}` : ''}</small>`)
            : html`<small>Go!</small><b>?</b><small>Who has the lowest card?</small>`}
      </div>
    </div>`)}
    ${showMistake ? html`<p class="nc-oops center">Oops! ${mistake.missed.map(m => `${ctx.room.players[m.by]?.name || 'Someone'} had ${m.n}`).join(', ')}.</p>` : nothing}

    <div class="nc-others">
      ${ctx.inGame.filter(p => p.id !== ctx.uid).map(p => {
        const left = handOf(round, p.id).length;
        return html`<div class="nc-player ${left ? '' : 'nc-player--out'}">
          <span class="nc-player__name">${avatar(p, 26)} ${p.name}</span>
          <span class="nc-backs" aria-label="${left} cards left">
            ${left ? Array.from({ length: left }, (_, i) => html`<span class="nc-back" style="--i: ${i - (left - 1) / 2}"></span>`) : html`<small>all out!</small>`}
          </span>
        </div>`;
      })}
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

// The end: hearts, a few numbers, then every card in the order it hit the pile, climbing in steps.
function finished(ctx) {
  const { round } = ctx;
  const won = round.result === 'won';
  const mistakes = round.mistakes || 0;
  const log = round.log || [];
  const played = log.filter(e => e.type === 'play').length;
  const total = log.length + cardsLeft(round); // played, thrown away and never played
  const headline = won
    ? (mistakes === 0 ? 'Perfect climb!' : 'You made it!')
    : 'Game over!';
  const note = won
    ? (mistakes === 0 ? 'Every card in order. Are you all telepathic?' : `All cards played, with ${mistakes} slip${mistakes === 1 ? '' : 's'} on the way.`)
    : `${round.startLives <= 1 ? 'One slip ended it' : 'You ran out of lives'} with ${cardsLeft(round)} card${cardsLeft(round) === 1 ? '' : 's'} still to play.`;
  const win = sideResult(ctx, () => won);
  const stat = (value, label, color) => html`<div class="nc-stat sticky--${color}"><b>${value}</b><small>${label}</small></div>`;
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: 'Victory!', lost: 'Failure!', watching: headline }), note })}
    <h1 class="center scribble pop-in">${headline}</h1>
    ${hearts(round.lives || 0, round.startLives || 1)}
    <p class="note center">${note}</p>
    <div class="nc-stats">
      ${stat(`${played}/${total}`, 'cards played', 'orange')}
      ${stat(mistakes, mistakes === 1 ? 'slip' : 'slips', mistakes ? 'pink' : 'mint')}
      ${stat(round.lives || 0, (round.lives || 0) === 1 ? 'life left' : 'lives left', round.lives ? 'mint' : 'blue')}
    </div>
    <h3 class="section-title">The climb</h3>
    <div class="nc-climb">
      ${log.map((e, i) => {
        const who = ctx.room.players[e.by];
        return html`<span class="nc-step ${e.type === 'missed' ? 'nc-step--missed' : ''}" style="--i: ${i}" title=${who ? `${who.name}${e.type === 'missed' ? ' (missed)' : ''}` : ''}>
          <b>${e.n}</b>${who ? avatar(who, 20) : nothing}
        </span>`;
      })}
    </div>
    ${!won && cardsLeft(round) ? html`<p class="note center">Never played: ${Object.entries(round.hands || {}).flatMap(([, cards]) => cards || []).sort((a, b) => a - b).join(', ')}</p>` : nothing}
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

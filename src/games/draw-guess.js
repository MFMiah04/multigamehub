import { ref, push, remove } from 'firebase/database';
import { ref as elementRef } from 'lit-html/directives/ref.js';
import { html, nothing, button, timer, selectField, action, avatar } from '../ui.js';
import { db } from '../firebase.js';
import { roomRef, shuffle } from '../room.js';
import { normalize, pickUnused, roundsField, leaderboard, finalScores, bumpStat, award, plural } from './common.js';
import { cue } from '../sound.js';
import words from '../data/doodle-words.json';
import '../draw/board.js';

// Draw & Guess: one person draws, everyone else races to type the word.
// round.no counts turns from 1; each player draws once per round of the table.

const CHOOSE_MS = 15000;
const REVEAL_MS = 6000;
const CHOICES = 3;

const wordOf = round => words[round.word]?.word || '';
const order = ctx => (ctx.round.order || []).filter(id => ctx.room.players[id]?.inGame);
const drawerOf = ctx => { const o = order(ctx); return o.length ? o[(ctx.round.no - 1) % o.length] : null; };
const guessersOf = ctx => ctx.inGame.filter(p => p.id !== drawerOf(ctx));
const totalTurns = ctx => order(ctx).length * (ctx.round.rounds || 3);
const name = (ctx, id) => ctx.room.players[id]?.name || 'Someone';
const squash = text => normalize(text).replace(/\s+/g, '');

// One letter wrong, missing or extra counts as "close" (only for words long enough for it to mean something).
function isClose(a, b) {
  if (Math.abs(a.length - b.length) > 1 || b.length < 4) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

// Three fresh words for the next artist to choose from.
function choicesFor(used) {
  const picked = {};
  for (let i = 0; i < CHOICES; i++) picked[pickUnused(words, { ...used, ...picked })] = true;
  return Object.keys(picked).map(Number);
}

// The word goes up and the clock starts. The board is wiped first so every turn starts blank.
function startDrawing(ctx, s, word) {
  remove(ref(db, `canvases/${ctx.room.code}`)).catch(() => {});
  const letters = [...wordOf({ word })].map((ch, i) => (ch === ' ' ? null : i)).filter(i => i !== null);
  return {
    phase: 'draw', 'round/word': word, [`round/used/${word}`]: true, 'round/choices': null,
    'round/startedAt': ctx.now(), 'round/endsAt': ctx.now() + s.drawTime * 1000,
    'round/hintOrder': shuffle(letters), 'round/guessed': null, 'round/chat': null, 'round/delta': null,
  };
}

function endTurn(ctx) {
  const { round } = ctx;
  const guessed = round.guessed || {};
  const count = Object.keys(guessed).length;
  const drawer = drawerOf(ctx);
  const delta = { ...guessed };
  const updates = { phase: 'reveal', 'round/endsAt': null, 'round/revealEndsAt': ctx.now() + REVEAL_MS };
  if (drawer && count) {
    delta[drawer] = Math.min(500, count * 100);
    updates[`round/scores/${drawer}`] = (round.scores?.[drawer] || 0) + delta[drawer];
    bumpStat(updates, round, drawer, 'drawn', count);
  }
  updates['round/delta'] = delta;
  return updates;
}

export default {
  id: 'draw-guess',
  name: 'Draw & Guess',
  color: 'cyan',
  canvas: true,
  players: '3–12',
  blurb: 'Take turns drawing a word while everyone races to guess it.',
  rules: [
    'Each turn, one player picks one of three words and draws it. No letters or numbers!',
    'Everyone else types guesses. Get it right to score: the faster you are, the more points.',
    "Letters of the word are revealed as time runs out. If you're one letter off, you'll be told you're close.",
    'The artist scores for every player who guesses their drawing. Everyone draws once per round.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="6" width="38" height="30" rx="3" fill="#fff" />
    <path d="M10 28 q4 -12 9 -4 q5 7 9 -6" stroke="#3b82c4" stroke-width="3" />
    <path d="M36 38 C36 32, 60 32, 60 38 C60 44, 52 45, 47 44 L42 49 L43 43 C38 42, 36 40, 36 38 Z" fill="#ffe066" />
    <path d="M45 37 q3 -4 6 0 M50 38.5 v0.5" stroke-width="2" />
  </g></svg>`,

  defaults: () => ({ rounds: 3, drawTime: 80, hints: 2 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Rounds (everyone draws once a round)', s.rounds, [[1, '1 round'], [2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']], v => set({ rounds: +v }), disabled)}
      ${selectField('Time to draw', s.drawTime, [[45, '45 seconds'], [60, '1 min'], [80, '80 seconds'], [100, '100 seconds'], [120, '2 min']], v => set({ drawTime: +v }), disabled)}
      ${selectField('Letter hints', s.hints, [[0, 'No hints'], [1, '1 letter'], [2, '2 letters'], [3, '3 letters']], v => set({ hints: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    return {
      phase: 'choose',
      round: {
        no: 1, rounds: s.rounds, order: shuffle(ctx.players.map(p => p.id)), scores: {},
        choices: choicesFor({}), chooseEndsAt: ctx.now() + CHOOSE_MS,
      },
    };
  },

  tick(ctx, s) {
    const { round } = ctx;
    const { phase } = ctx.room;
    const drawerHere = !!ctx.room.players[drawerOf(ctx)]?.inGame;
    // The artist didn't pick in time: they get the first word.
    if (phase === 'choose' && (ctx.now() > round.chooseEndsAt || !drawerHere) && round.choices) {
      return drawerHere ? startDrawing(ctx, s, round.choices[0]) : endTurn(ctx);
    }
    if (phase === 'draw') {
      const guessers = guessersOf(ctx);
      const allIn = guessers.length > 0 && guessers.every(p => round.guessed?.[p.id] !== undefined);
      if (ctx.now() >= round.endsAt || allIn || !drawerHere) return endTurn(ctx);
    }
    if (phase === 'reveal' && ctx.now() >= round.revealEndsAt) {
      if (round.no >= totalTurns(ctx)) return { phase: 'final' };
      remove(ref(db, `canvases/${ctx.room.code}`)).catch(() => {});
      return {
        phase: 'choose', 'round/no': round.no + 1, 'round/word': null, 'round/guessed': null, 'round/chat': null,
        'round/choices': choicesFor(round.used || {}), 'round/chooseEndsAt': ctx.now() + CHOOSE_MS,
      };
    }
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'final') {
      return finalScores(ctx, {
        awards: [
          award(ctx, 'drawn', 'Best artist', n => `${plural(n, 'person')} guessed their drawings`.replace('persons', 'people')),
          award(ctx, 'firsts', 'Quickest guesser', n => `First to guess ${plural(n, 'time')}`),
          award(ctx, 'correct', 'Sharp eye', n => `Guessed ${plural(n, 'word')}`),
        ],
      });
    }
    return turn(ctx, s);
  },
};

// ----- the screen for a turn: word bar, board, and the guessing chat -----

// The word as blanks, with a few letters revealed as time goes on.
function wordHint(ctx, s) {
  const { round } = ctx;
  const word = wordOf(round);
  const total = round.endsAt - round.startedAt;
  const progress = total > 0 ? (ctx.now() - round.startedAt) / total : 0;
  const letters = (round.hintOrder || []).length;
  const shown = Math.min(s.hints, Math.max(0, letters - 1), Math.floor(progress * (s.hints + 1)));
  const open = new Set((round.hintOrder || []).slice(0, shown));
  return html`<span class="dg-blanks" aria-label="${letters} letters">
    ${[...word].map((ch, i) => (ch === ' ' ? html`<span class="dg-gap"></span>` : html`<span class="dg-letter">${open.has(i) ? ch : ''}</span>`))}
    <small>${word.split(' ').map(w => w.length).join(' ')}</small>
  </span>`;
}

function wordBar(ctx, s) {
  const { round } = ctx;
  const drawer = drawerOf(ctx);
  const me = ctx.uid;
  const phase = ctx.room.phase;
  const label = html`<small>Round ${Math.ceil(round.no / Math.max(1, order(ctx).length))} of ${round.rounds}</small>`;
  if (phase === 'choose') {
    return html`<div class="dg-bar wobble">${label}<b>${drawer === me ? 'Pick a word to draw' : `${name(ctx, drawer)} is choosing a word…`}</b>${timer(round.chooseEndsAt, 5)}</div>`;
  }
  if (phase === 'reveal') {
    return html`<div class="dg-bar wobble dg-bar--reveal">${label}<span>The word was <b class="hl">${wordOf(round)}</b></span></div>`;
  }
  const guessed = round.guessed?.[me] !== undefined;
  return html`<div class="dg-bar wobble">
    ${label}
    ${drawer === me ? html`<span>Draw: <b class="hl">${wordOf(round)}</b></span>`
      : guessed ? html`<span>You got it: <b class="hl">${wordOf(round)}</b></span>`
      : wordHint(ctx, s)}
    ${timer(round.endsAt, 10)}
  </div>`;
}

let lastChatCount = 0;
function chat(ctx) {
  const { round } = ctx;
  const me = ctx.uid;
  const drawer = drawerOf(ctx);
  const iGuessed = round.guessed?.[me] !== undefined;
  const insider = id => id === drawer || round.guessed?.[id] !== undefined;
  // Wrong guesses are for everyone. Near misses are only shown to whoever made them. Once you've got
  // the word, your chat is only seen by the artist and others who've got it too.
  const messages = Object.entries(round.chat || {}).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([, m]) => m)
    .filter(m => m.k === 'guess' || m.k === 'correct' || (m.k === 'close' && m.u === me) || (m.k === 'inner' && (m.u === me || insider(me))))
    .slice(-60);
  const canType = ctx.room.phase === 'draw' && me !== drawer;

  const send = () => {
    const input = document.getElementById('dg-guess');
    const text = input.value.trim().slice(0, 60);
    if (!text) return null;
    input.value = '';
    const key = push(roomRef(ctx.room.code, 'round/chat')).key;
    const path = `round/chat/${key}`;
    const word = wordOf(round);
    if (iGuessed) return ctx.update({ [path]: { u: me, t: text, k: 'inner' } });
    if (squash(text) === squash(word)) {
      const left = Math.max(0, round.endsAt - ctx.now());
      const points = Math.max(50, Math.round(50 + 450 * left / (round.endsAt - round.startedAt)));
      const updates = { [path]: { u: me, k: 'correct' }, [`round/guessed/${me}`]: points, [`round/scores/${me}`]: (round.scores?.[me] || 0) + points };
      bumpStat(updates, round, me, 'correct');
      if (!Object.keys(round.guessed || {}).length) bumpStat(updates, round, me, 'firsts');
      return ctx.update(updates);
    }
    return ctx.update({ [path]: { u: me, t: text, k: isClose(squash(text), squash(word)) ? 'close' : 'guess' } });
  };

  // Keep the newest message in view, but only scroll when something new arrives.
  const scroll = el => {
    if (el && messages.length !== lastChatCount) { el.scrollTop = el.scrollHeight; lastChatCount = messages.length; }
  };
  const latest = messages.at(-1);
  if (latest) cue(`dg:${round.no}:${messages.length}`, latest.k === 'correct' ? 'ding' : latest.k === 'close' ? 'pop' : 'tap');

  return html`<div class="dg-chat wobble">
    <div class="dg-chat__list" ${elementRef(scroll)}>
      ${messages.length ? messages.map(m => {
        const who = ctx.room.players[m.u];
        if (m.k === 'correct') return html`<p class="dg-msg dg-msg--correct">${who ? avatar(who, 18, 'happy') : nothing} <b>${who?.name || 'Someone'}</b> guessed the word!</p>`;
        return html`<p class="dg-msg ${m.k === 'close' ? 'dg-msg--close' : m.k === 'inner' ? 'dg-msg--inner' : ''}">
          <b>${who?.name || '?'}:</b> ${m.t}${m.k === 'close' ? html` <em>so close!</em>` : nothing}</p>`;
      }) : html`<p class="dg-msg dg-msg--empty">${me === drawer ? 'Guesses will appear here.' : 'Type your guesses below.'}</p>`}
    </div>
    ${canType ? html`<input id="dg-guess" class="dg-chat__input" maxlength="60" autocomplete="off" enterkeyhint="send"
        placeholder=${iGuessed ? 'Chat with the others who got it' : 'Type your guess'} @keydown=${e => e.key === 'Enter' && action(send)()}>` : nothing}
  </div>`;
}

function turn(ctx, s) {
  const { round } = ctx;
  const phase = ctx.room.phase;
  const drawer = drawerOf(ctx);
  const drawing = phase === 'draw' && drawer === ctx.uid;
  if (phase === 'draw') cue(`dg:${round.no}:start`, 'whoosh', { at: round.startedAt, now: ctx.now() });
  if (phase === 'reveal') cue(`dg:${round.no}:reveal`, Object.keys(round.guessed || {}).length ? 'fanfare' : 'sad', { at: round.revealEndsAt - REVEAL_MS, now: ctx.now() });

  const pick = word => ctx.update(startDrawing(ctx, s, word));
  const choosing = phase === 'choose' && drawer === ctx.uid;

  return html`
    ${wordBar(ctx, s)}
    <div class="dg-play">
      ${choosing
        ? html`<div class="dg-choices">${(round.choices || []).map(w => button(words[w]?.word, action(() => pick(w)), { kind: 'white' }))}</div>`
        : html`<sketch-board room=${ctx.room.code} uid=${ctx.uid}
            .config=${drawing ? { stats: false, canDraw: true } : { tools: [], colors: false, sizes: false, undo: false, clear: false, stats: false, canDraw: false }}></sketch-board>`}
      ${phase === 'reveal' ? html`<div class="dg-side">${leaderboard(ctx, round.scores, round.delta)}</div>` : chat(ctx)}
    </div>
    ${scoreStrip(ctx)}`;
}

// Everyone's score, with a tick for those who've guessed this turn and a pencil for the artist.
function scoreStrip(ctx) {
  const { round } = ctx;
  const drawer = drawerOf(ctx);
  return html`<div class="dg-scores">
    ${[...ctx.inGame].sort((a, b) => (round.scores?.[b.id] || 0) - (round.scores?.[a.id] || 0)).map(p => html`
      <span class="dg-score ${round.guessed?.[p.id] !== undefined ? 'dg-score--got' : ''} ${p.id === drawer ? 'dg-score--drawing' : ''}">
        ${avatar(p, 24)}<span>${p.id === ctx.uid ? 'You' : p.name}</span><b>${round.scores?.[p.id] || 0}</b>
        ${p.id === drawer ? html`<i title="Drawing">✎</i>` : round.guessed?.[p.id] !== undefined ? html`<i title="Guessed it">✓</i>` : nothing}
      </span>`)}
  </div>`;
}

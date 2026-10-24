import { runTransaction } from 'firebase/database';
import { html, nothing, button, timer, selectField, action, toast, avatar } from '../ui.js';
import { roomRef, shuffle } from '../room.js';
import {
  isTimeUp, normalize, pickUnused, startVoting, voteRequestBar, voteRequestsPassed, voteView, votingOver,
  tally, mostVoted, voteResults, toResults, endTitle, sideResult, spotlight, backToLobbyButton,
} from './common.js';
import { cue } from '../sound.js';
import words from '../data/doodle-words.json';
import '../draw/board.js';

// Each player draws in their own colour, in turn order.
const INKS = ['#d23c5f', '#3b82c4', '#3fae5b', '#f28c28', '#8e5bd1', '#222222', '#8b5a3c', '#e85d9a', '#1fa3a3', '#c9a227', '#6b7280', '#5b4bdb'];
const LINE_SIZE = 0.012;
const GUESS_MS = 60000;
const DECOYS = 5; // other words shown to the imposter alongside the real one

// A few clues about what the thing is like, without naming it: its size, rough shape, and whether it's alive.
const SIZES = { hand: 'fits in your hand', carry: 'you could carry it', you: 'about as big as a person', big: 'bigger than a person', huge: 'enormous' };
const SHAPES = { round: 'roundish', long: 'long and thin', tall: 'tall', boxy: 'boxy', pointy: 'pointy', wiggly: 'wiggly or wavy', flat: 'flat', lumpy: 'an odd, lumpy shape', spiky: 'spiky or leggy', curved: 'curved', person: 'person-shaped' };
const features = word => {
  const w = words[word] || {};
  return [w.alive ? 'alive' : 'not alive', SHAPES[w.shape], SIZES[w.size]].filter(Boolean);
};
// Only the features the real word shares with every word in the list, so the list never contradicts them.
const sharedFeatures = list => features(list[0]).filter(f => list.every(i => features(i).includes(f)));

// For the hint that gets better: a few words as alike as possible to the real one (same alive-ness,
// shape and size). The real word isn't among them, so the imposter has to work it out from the drawing.
function lookalikes(word) {
  const w = words[word];
  const others = shuffle(words.map((_, i) => i).filter(i => i !== word && words[i].alive === w.alive));
  const same = key => others.filter(i => words[i][key] === w[key]);
  const exact = others.filter(i => words[i].shape === w.shape && words[i].size === w.size);
  // Not enough exact matches? Keep one more feature in common (shape or size, whichever has enough),
  // so the imposter still gets at least two clues.
  const pool = exact.length >= DECOYS ? exact
    : same('shape').length >= DECOYS ? [...exact, ...same('shape').filter(i => !exact.includes(i))]
    : same('size').length >= DECOYS ? [...exact, ...same('size').filter(i => !exact.includes(i))]
    : [...exact, ...same('shape'), ...same('size'), ...others].filter((i, n, list) => list.indexOf(i) === n);
  return shuffle(pool.slice(0, DECOYS));
}

// A few other words from the same category (not the real word itself).
function wordList(word) {
  const { category } = words[word];
  return shuffle(words.map((w, i) => i).filter(i => i !== word && words[i].category === category)).slice(0, DECOYS);
}

const wordOf = round => words[round.word]?.word || '';
const present = ctx => (ctx.round.order || []).filter(id => ctx.room.players[id]?.inGame);
const drawerOf = ctx => { const order = present(ctx); return order.length ? order[(ctx.round.turn || 0) % order.length] : null; };
const totalTurns = ctx => present(ctx).length * (ctx.round.laps || 2);
const name = (ctx, id) => ctx.room.players[id]?.name || 'Someone';

export default {
  id: 'doodle-imposter',
  name: 'Doodle Imposter',
  twoLines: true, // shown over two lines on its note
  color: 'peach',
  canvas: true,
  players: '3–12',
  blurb: 'Take turns adding one line to a drawing of the secret word. One of you is faking it.',
  rules: [
    "Everyone sees the secret word except the imposter. By default they get a few clues about what it's like (alive? what shape? how big?), then a few similar words from the second lap.",
    'Take turns adding one line each to the same drawing. Lift your pen and your turn is over.',
    'Prove you know the word, but not so clearly that the imposter can work it out. Two laps, then vote.',
    "If the imposter isn't caught, they win. If they are, they get one guess at the word to steal the win.",
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="6" width="46" height="36" rx="3" fill="#fff" />
    <path d="M12 32 q6 -14 12 -6" stroke="#d23c5f" stroke-width="3" />
    <path d="M26 30 q6 -12 14 -8" stroke="#3b82c4" stroke-width="3" />
    <path d="M35 46 C33 41, 37 38, 46 38 C55 38, 60 41, 58 46 C56 51, 37 51, 35 46 Z" fill="#fff" />
    <path d="M40 44 q2 -2 4 0 M49 44 q2 -2 4 0" />
    <path d="M46 34 q2 -6 6 -4" stroke-width="2" />
  </g></svg>`,

  defaults: () => ({ laps: 2, turnTime: 30, hint: 'growing', voteTime: 90 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Laps of the table', s.laps, [[1, '1 lap'], [2, '2 laps'], [3, '3 laps']], v => set({ laps: +v }), disabled)}
      ${selectField('Time for each line', s.turnTime, [[15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 min']], v => set({ turnTime: +v }), disabled)}
      ${selectField("Imposter's hint", s.hint, [['growing', 'Gets better: what it\'s like, then a word list'], ['list', `${DECOYS} words from the same category`], ['features', 'What it\'s like (alive? shape? size?)'], ['category', 'The category (like "Animal")'], ['none', 'No hint']], v => set({ hint: v }), disabled)}
      ${selectField('Time to vote', s.voteTime, [[60, '1 min'], [90, '1½ min'], [120, '2 min']], v => set({ voteTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const order = shuffle(ctx.players.map(p => p.id));
    const word = pickUnused(words);
    return {
      phase: 'draw',
      round: {
        word, order, imposter: shuffle(order)[0], laps: s.laps, hint: s.hint, turn: 0,
        choices: s.hint === 'list' ? wordList(word) : s.hint === 'growing' ? lookalikes(word) : null,
        colors: Object.fromEntries(order.map((id, i) => [id, INKS[i % INKS.length]])),
        // A few extra seconds on the first turn to read the word.
        turnEndsAt: ctx.now() + (s.turnTime + 5) * 1000,
      },
    };
  },

  tick(ctx, s) {
    const { round } = ctx;
    const { phase } = ctx.room;
    if (phase === 'draw') {
      if ((round.turn || 0) >= totalTurns(ctx) || voteRequestsPassed(ctx)) return startVoting(ctx, s.voteTime);
      // Out of time: that line is skipped and it's the next person's go.
      if (ctx.now() > round.turnEndsAt + 1500) return { 'round/turn': (round.turn || 0) + 1, 'round/turnEndsAt': ctx.now() + s.turnTime * 1000 };
    }
    if (phase === 'voting' && votingOver(ctx, ctx.inGame)) {
      const top = mostVoted(tally(ctx, ctx.inGame, ctx.inGame), 1);
      const caught = top.length === 1 && top[0] === round.imposter;
      return { ...toResults(ctx), 'round/caught': caught, 'round/guessEndsAt': caught ? ctx.now() + GUESS_MS : null };
    }
    // The caught imposter ran out of time to guess.
    if (phase === 'results' && round.caught && round.guess === undefined && ctx.now() > round.guessEndsAt) return { 'round/guess': '' };
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'draw') return drawing(ctx, s);
    if (phase === 'voting') {
      return html`${turnStrip(ctx, { showTurn: false })}${board(ctx, { canDraw: false, maxHeight: 0.26 })}
        ${voteView(ctx, { candidates: ctx.inGame, voters: ctx.inGame, max: 1, prompt: 'Who was faking it?' })}`;
    }
    return results(ctx);
  },
};

// The shared drawing. Everyone uses just a pencil in their own colour; only the current artist can draw.
const board = (ctx, { canDraw, onStroke, maxHeight }) => html`<sketch-board room=${ctx.room.code} uid=${ctx.uid}
  .config=${{
    tools: ['pen'], colors: false, sizes: false, opacity: false, undo: false, clear: false, stats: false,
    color: ctx.round.colors?.[ctx.uid] || '#222222', size: LINE_SIZE,
    canDraw, oneStroke: true, turnKey: ctx.round.turn || 0, ...(maxHeight ? { maxHeight } : {}),
  }}
  @strokeend=${onStroke || nothing}></sketch-board>`;

function secretCard(ctx) {
  const { round, local } = ctx;
  const imposter = round.imposter === ctx.uid;
  const category = words[round.word]?.category;
  // 'growing': what it's like on the first lap, then the word list from the second lap on.
  const lap = Math.floor((round.turn || 0) / Math.max(1, present(ctx).length)) + 1;
  const list = imposter && round.choices && (round.hint === 'list' || (round.hint === 'growing' && (lap > 1 || ctx.room.phase !== 'draw')));
  const roomy = imposter && local.show && (list || round.hint === 'growing' || round.hint === 'features');
  return html`<button class="secret secret--slim wobble ${local.show ? '' : 'secret--hidden'} ${imposter ? 'secret--spy' : ''} ${roomy ? 'secret--list' : ''}"
    @click=${() => { local.show = !local.show; ctx.rerender(); }}>
    ${!local.show ? html`<b>Tap to see your word</b>`
      : list ? html`<small>You're the imposter! It's something like these (but none of them):</small>
        <span class="di-choices">${round.choices.map(i => html`<span class="di-choice">${words[i]?.word}</span>`)}</span>`
      : imposter && (round.hint === 'growing' || round.hint === 'features') ? html`<small>You're the imposter!${round.hint === 'growing' ? ' More help after this lap.' : ''} It's…</small>
        <span class="di-choices">${(round.hint === 'growing' && round.choices ? sharedFeatures([round.word, ...round.choices]) : features(round.word)).map(f => html`<span class="di-choice">${f}</span>`)}</span>`
      : imposter ? html`<small>You're the imposter!</small><b>${round.hint === 'none' ? 'No hint' : `Hint: ${category}`}</b>`
      : html`<small>The secret word is</small><b>${wordOf(round)}</b>`}
  </button>`;
}

// Everyone in turn order, each ringed in their ink colour, so you can tell at a glance who drew which line.
function turnStrip(ctx, { showTurn = true } = {}) {
  const order = present(ctx);
  const drawer = showTurn ? drawerOf(ctx) : null;
  return html`<div class="di-turns">
    ${order.map(id => html`<span class="di-turn ${id === drawer ? 'di-turn--now' : ''}" style="--ink: ${ctx.round.colors?.[id]}">
      <span class="di-turn__ring">${avatar(ctx.room.players[id], id === drawer ? 34 : 28)}</span>
      <small>${id === ctx.uid ? 'You' : name(ctx, id)}</small>
    </span>`)}
  </div>`;
}

function drawing(ctx, s) {
  const { round } = ctx;
  const order = present(ctx);
  const drawer = drawerOf(ctx);
  const mine = drawer === ctx.uid;
  const timeLeft = round.turnEndsAt - ctx.now();
  const lap = Math.min(round.laps, Math.floor((round.turn || 0) / Math.max(1, order.length)) + 1);
  cue(`di:${round.word}:${round.turn}`, mine ? 'ding' : 'pop');
  // The imposter's better hint arrives at the start of lap 2.
  if (round.hint === 'growing' && round.imposter === ctx.uid && lap === 2 && round.turn === order.length) {
    cue(`di:${round.word}:betterhint`, 'ding');
    if (!ctx.local.toldHint) { ctx.local.toldHint = true; toast('New hint! Tap your card to see a list of possible words.'); }
  }

  // Your line is done: pass the pen on. The transaction makes sure the turn only moves on once.
  const passPen = () => {
    const turn = round.turn || 0;
    runTransaction(roomRef(ctx.room.code, 'round/turn'), t => ((t || 0) === turn ? turn + 1 : undefined))
      .then(r => { if (r.committed) ctx.update({ 'round/turnEndsAt': ctx.now() + s.turnTime * 1000 }); });
  };

  return html`
    <div class="di-top">
      ${secretCard(ctx)}
      <p class="note center">Lap ${lap} of ${round.laps} · ${mine ? html`<b class="di-yours">Your turn! Draw one line.</b>` : `${name(ctx, drawer)} is drawing…`}</p>
      ${timer(round.turnEndsAt, 10)}
    </div>
    ${turnStrip(ctx)}
    ${board(ctx, { canDraw: mine && timeLeft > 0, onStroke: mine ? passPen : null })}
    ${voteRequestBar(ctx)}`;
}

function results(ctx) {
  const { round } = ctx;
  const rows = tally(ctx, ctx.inGame, ctx.inGame);
  const imposter = ctx.room.players[round.imposter] ? { id: round.imposter, ...ctx.room.players[round.imposter] } : null;
  const isImposter = ctx.uid === round.imposter;
  const word = wordOf(round);
  const guessed = round.guess !== undefined;
  const right = guessed && (round.countedIt || (round.guess && normalize(round.guess) === normalize(word)));
  const settled = !round.caught || guessed;
  const imposterWins = !round.caught || right;
  const headline = !round.caught ? 'The imposter got away!'
    : !guessed ? 'Imposter caught!'
    : right ? 'Caught, but they guessed the word!' : 'Imposter caught, and they guessed wrong!';
  const win = sideResult(ctx, id => (id === round.imposter ? imposterWins : !imposterWins));

  const submitGuess = () => {
    const text = document.getElementById('di-guess')?.value.trim();
    if (!text) return toast('Type a guess first.');
    return ctx.update({ 'round/guess': text.slice(0, 40) });
  };

  const guessPart = !round.caught ? nothing
    : !guessed
      ? (isImposter
        ? html`<div class="question wobble"><small>You've been caught! One guess to steal the win</small>What was the secret word?</div>
          ${timer(round.guessEndsAt, 15)}
          <label class="field"><span>Your guess</span>
            <input id="di-guess" class="wobble" maxlength="40" autocomplete="off" placeholder="The secret word"
              @keydown=${e => e.key === 'Enter' && action(submitGuess)()}></label>
          ${button('Guess', action(submitGuess))}`
        : html`<p class="note center">${imposter?.name || 'The imposter'} gets one guess at the word…</p>${timer(round.guessEndsAt, 15)}`)
      : html`<div class="secret wobble pop-in ${right ? '' : 'secret--spy'}">
          <small>${imposter?.name || 'The imposter'} guessed</small><b>${round.guess || '(nothing)'}</b><small>${right ? 'Correct!' : `The word was ${word}`}</small>
        </div>
        ${!right && round.guess && !isImposter ? html`<button class="link" @click=${action(() => ctx.update({ 'round/countedIt': true }))}>Close enough? Count it</button>` : nothing}`;

  return voteResults(ctx, rows, {
    headline,
    question: 'So, who was faking it?',
    outcome: settled ? { win, title: endTitle(win, { won: 'Victory!', lost: 'Defeat!', watching: headline }), note: headline } : undefined,
    badge: p => (p.id === round.imposter ? 'imposter' : null),
    mood: p => (p.id === round.imposter ? (imposterWins && settled ? 'happy' : 'shock') : null),
    top: html`${spotlight(imposter ? [imposter] : [], 'was the imposter!', settled && imposterWins ? 'happy' : 'shock')}
      ${guessPart}
      ${settled && !(guessed && !right) ? html`<p class="note center">The word was <span class="hl">${word}</span>.</p>` : nothing}
      ${turnStrip(ctx, { showTurn: false })}
      ${board(ctx, { canDraw: false })}`,
    bottom: settled ? html`
      <div class="push"></div>
      ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
      ${backToLobbyButton(ctx)}` : nothing,
  });
}

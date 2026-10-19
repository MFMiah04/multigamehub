import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { shuffle } from '../room.js';
import { isTimeUp, pickUnused, turnOf, roundsField, secondsOptions, leaderboard, nextOrFinalButton, finalScores, backToLobbyButton } from './common.js';
import spectrums from '../data/spectrums.json';

// Scoring bands, measured from the target on a 0–100 scale that wraps round at the ends.
const BANDS = [[4, 4], [10, 3], [17, 2]];
const distance = (a, b) => Math.min(Math.abs(a - b), 100 - Math.abs(a - b));
const pointsFor = (guess, target) => BANDS.find(([w]) => distance(guess, target) <= w)?.[1] || 0;

const guessersOf = ctx => ctx.inGame.filter(p => p.id !== ctx.round.psychic);
const newTarget = () => Math.floor(Math.random() * 101);

function scoreRound(ctx) {
  const { round } = ctx;
  const delta = {};
  const guessers = guessersOf(ctx).filter(p => round.guesses?.[p.id] !== undefined);
  guessers.forEach(p => { delta[p.id] = pointsFor(round.guesses[p.id], round.target); });
  if (guessers.length) delta[round.psychic] = Math.round(guessers.reduce((sum, p) => sum + delta[p.id], 0) / guessers.length);
  const updates = { phase: 'reveal', 'round/endsAt': null, 'round/delta': delta };
  Object.entries(delta).forEach(([id, pts]) => { if (pts) updates[`round/scores/${id}`] = (round.scores?.[id] || 0) + pts; });
  return updates;
}

// The scale: labels at each end, optional scoring bands around the target, player markers and a slider.
function scale(ctx, { target, markers = [], slider }) {
  const [left, right] = spectrums[ctx.round.card];
  return html`<div class="spectrum">
    <div class="spectrum__labels"><span>← ${left}</span><span>${right} →</span></div>
    <div class="spectrum__track wobble">
      ${target !== undefined ? BANDS.slice().reverse().flatMap(([w, pts]) =>
        // Draw each zone three times, shifted a full width either way, so it wraps round the edges.
        [-100, 0, 100].map(shift => html`<i class="spectrum__band spectrum__band--${pts}" style="left:${target - w + shift}%;width:${w * 2}%"><span>${pts}</span></i>`)) : nothing}
      ${markers.map(({ value, player }) => html`<span class="spectrum__marker" style="left:${value}%">${avatar(player, 26)}</span>`)}
    </div>
    ${slider || nothing}
  </div>`;
}

export default {
  id: 'spectrum',
  name: 'Spectrum',
  color: 'blue',
  players: '2–12',
  blurb: 'Give a clue that lands on just the right spot between two extremes.',
  rules: [
    'Each round one player is the psychic. They see a scale, like Cold ↔ Hot, and a secret target somewhere on it.',
    'The psychic writes a clue that points to that spot. For something hot, but not very hot, maybe "a warm bath".',
    'Everyone else slides their marker to where they think the target is.',
    "The closer you get, the more points you score. The psychic scores the group's average.",
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 44 A26 26 0 0 1 58 44 Z" fill="#fff" />
    <path d="M32 44 L22.5 19.5 A26 26 0 0 1 41.5 19.5 Z" fill="#ffe066" />
    <path d="M32 44 L28.5 18.3 A26 26 0 0 1 35.5 18.3 Z" fill="#ff8fab" />
    <path d="M32 44 L46 24" stroke-width="3" />
    <circle cx="32" cy="44" r="3" fill="#222" />
  </g></svg>`,

  defaults: () => ({ rounds: 8, clueTime: 90, guessTime: 60 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${roundsField(s.rounds, set, disabled)}
      ${selectField('Time to write a clue', s.clueTime, secondsOptions([45, 60, 90, 120]), v => set({ clueTime: +v }), disabled)}
      ${selectField('Time to guess', s.guessTime, secondsOptions([30, 45, 60, 90]), v => set({ guessTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 2 ? 'Need 1 more to play' : null),

  start(ctx, s) {
    const order = shuffle(ctx.players.map(p => p.id));
    const card = pickUnused(spectrums);
    return {
      phase: 'clue',
      round: { no: 1, total: s.rounds, order, psychic: order[0], card, used: { [card]: true }, target: newTarget(), scores: {}, endsAt: ctx.now() + s.clueTime * 1000 },
    };
  },

  tick(ctx, s) {
    const { round } = ctx;
    const { phase } = ctx.room;
    const psychicGone = !ctx.room.players[round.psychic];
    if (phase === 'clue' && (isTimeUp(ctx) || psychicGone)) {
      return { phase: 'guess', 'round/clue': round.clue || '(no clue, just guess!)', 'round/endsAt': ctx.now() + s.guessTime * 1000 };
    }
    if (phase === 'guess' && (isTimeUp(ctx) || guessersOf(ctx).every(p => round.guesses?.[p.id] !== undefined))) return scoreRound(ctx);
    return null;
  },

  view(ctx, s) {
    const views = { final: isTeam(ctx) ? teamFinal : finalScores, clue, guess, reveal };
    return views[ctx.room.phase]?.(ctx, s) ?? nothing;
  },
};

const header = ctx => html`<p class="note center">Round ${ctx.round.no} of ${ctx.round.total}</p>`;

// With two players you always score the same points, so it's a team game with one shared score.
const isTeam = ctx => ctx.inGame.length === 2;
const teamScore = ctx => Math.max(0, ...ctx.inGame.map(p => ctx.round.scores?.[p.id] || 0));

function teamFinal(ctx) {
  const score = teamScore(ctx);
  const ratio = score / (ctx.round.total * 4);
  const verdict = ratio >= 0.75 ? 'Total mind-readers!' : ratio >= 0.5 ? 'On the same wavelength!' : ratio >= 0.25 ? 'Getting there…' : 'Are you sure you know each other?';
  return html`
    <h1 class="center scribble">Team score: ${score}</h1>
    <p class="note center">Out of a possible ${ctx.round.total * 4}. ${verdict}</p>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

const psychicName = ctx => ctx.room.players[ctx.round.psychic]?.name || 'The psychic';

function clue(ctx, s) {
  const { round } = ctx;
  if (ctx.uid !== round.psychic) {
    return html`${header(ctx)}${timer(round.endsAt, 10)}
      <h2 class="center">${psychicName(ctx)} is thinking of a clue…</h2>
      ${scale(ctx, {})}`;
  }
  const submit = async () => {
    const text = document.getElementById('clue').value.trim().slice(0, 40);
    if (!text) return toast('Write a clue first.');
    await ctx.update({ phase: 'guess', 'round/clue': text, 'round/endsAt': ctx.now() + s.guessTime * 1000 });
  };
  return html`${header(ctx)}${timer(round.endsAt, 10)}
    <h2 class="center">You're the psychic!</h2>
    <p class="note center">Write a clue that points to the bullseye.</p>
    ${scale(ctx, { target: round.target })}
    <label class="field"><span>Your clue</span>
      <input id="clue" class="wobble" maxlength="40" autocomplete="off" placeholder="Something that fits the spot"
        @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
    ${button('Send clue', action(submit))}`;
}

function guess(ctx) {
  const { round, local } = ctx;
  const guessers = guessersOf(ctx);
  const locked = ctx.inGame.filter(p => round.guesses?.[p.id] !== undefined);
  const status = progress(guessers.filter(p => round.guesses?.[p.id] !== undefined).length, guessers.length, 'have locked in');
  const clueCard = html`<div class="question wobble center"><small>${psychicName(ctx)}'s clue</small>"${round.clue}"</div>`;

  if (ctx.uid === round.psychic) {
    return html`${header(ctx)}${timer(round.endsAt, 10)}${clueCard}
      ${scale(ctx, { target: round.target, markers: locked.map(p => ({ value: round.guesses[p.id], player: p })) })}
      ${status}`;
  }
  const mine = round.guesses?.[ctx.uid];
  local.value ??= mine ?? 50;
  const slider = html`<input class="spectrum__slider" type="range" min="0" max="100" step="1" .value=${String(local.value)}
    aria-label="Your guess" ?disabled=${mine !== undefined} @input=${e => { local.value = +e.target.value; ctx.rerender(); }}>`;
  const me = ctx.room.players[ctx.uid];
  return html`${header(ctx)}${timer(round.endsAt, 10)}${clueCard}
    ${scale(ctx, { markers: [{ value: local.value, player: me }], slider })}
    ${mine !== undefined
      ? button('Change my guess', action(() => ctx.update({ [`round/guesses/${ctx.uid}`]: null })), { kind: 'white' })
      : button('Lock in', action(() => ctx.update({ [`round/guesses/${ctx.uid}`]: local.value })))}
    ${status}`;
}

function reveal(ctx, s) {
  const { round } = ctx;
  const guessers = guessersOf(ctx).filter(p => round.guesses?.[p.id] !== undefined);
  const best = Math.max(0, ...guessers.map(p => round.delta?.[p.id] || 0));
  const next = () => {
    const card = pickUnused(spectrums, round.used);
    return ctx.update({
      phase: 'clue', 'round/no': round.no + 1, 'round/psychic': turnOf(ctx, round.order, round.no + 1),
      'round/card': card, [`round/used/${card}`]: true, 'round/target': newTarget(),
      'round/clue': null, 'round/guesses': null, 'round/delta': null, 'round/endsAt': ctx.now() + s.clueTime * 1000,
    });
  };
  return html`${header(ctx)}
    <h1 class="center scribble">${best === 4 ? 'Bullseye!' : best >= 2 ? 'Close!' : 'Way off!'}</h1>
    <div class="question wobble center"><small>${psychicName(ctx)}'s clue</small>"${round.clue}"</div>
    ${scale(ctx, { target: round.target, markers: guessers.map(p => ({ value: round.guesses[p.id], player: p })) })}
    ${isTeam(ctx)
      ? html`<h2 class="section-title center">Team score: ${teamScore(ctx)} <small>(+${round.delta?.[guessers[0]?.id] || 0} this round)</small></h2>`
      : html`<h2 class="section-title">Scores</h2>${leaderboard(ctx, round.scores, round.delta)}`}
    <div class="push"></div>
    ${nextOrFinalButton(ctx, round, next)}`;
}


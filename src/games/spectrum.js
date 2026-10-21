import { svg } from 'lit-html';
import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { shuffle } from '../room.js';
import { isTimeUp, pickUnused, turnOf, roundsField, secondsOptions, leaderboard, nextOrFinalButton, finalScores, backToLobbyButton } from './common.js';
import spectrums from '../data/spectrums.json';

// Scoring bands, measured from the target on a 0–100 scale. Zones past either end are simply cut off.
const BANDS = [[4, 4], [10, 3], [17, 2]];
const pointsFor = (guess, target) => BANDS.find(([w]) => Math.abs(guess - target) <= w)?.[1] || 0;

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

// ----- the wheel: a half-circle dial from 0 (far left) to 100 (far right) -----

const W = 300, H = 172, CX = 150, CY = 160, R = 130;
const BAND_FILL = { 2: '#ffe9a3', 3: '#ffd04d', 4: '#ff8fab' };
const point = (value, radius = R) => {
  const angle = Math.PI * (1 - value / 100);
  return [CX + radius * Math.cos(angle), CY - radius * Math.sin(angle)];
};
const clamp = v => Math.max(0, Math.min(100, v));
function wedge(from, to) {
  const [x1, y1] = point(from);
  const [x2, y2] = point(to);
  return `M${CX} ${CY} L${x1.toFixed(1)} ${y1.toFixed(1)} A${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
}
// Turns a tap or drag on the wheel into a value from 0 to 100.
function valueAt(event) {
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * W - CX;
  const y = CY - ((event.clientY - box.top) / box.height) * H;
  const angle = Math.atan2(Math.max(y, 0), x);
  return Math.round(clamp(100 * (1 - angle / Math.PI)));
}

// The dial: labels at each end, scoring zones around the target, a needle per guess, and an optional slider.
function scale(ctx, { target, markers = [], slider, onPick, covered }) {
  const [left, right] = spectrums[ctx.round.card];
  // Zones near an edge are cut off at the end of the wheel.
  const zones = target === undefined ? [] : BANDS.slice().reverse()
    .map(([w, pts]) => [clamp(target - w), clamp(target + w), pts]).filter(([a, b]) => b - a > 0.5);
  const drag = onPick && {
    down: e => { e.currentTarget.setPointerCapture(e.pointerId); onPick(valueAt(e)); },
    move: e => { if (e.buttons || e.pointerType === 'touch') onPick(valueAt(e)); },
  };
  return html`<div class="spectrum">
    <div class="spectrum__labels"><span>← ${left}</span><span>${right} →</span></div>
    <div class="wheel ${onPick ? 'wheel--live' : ''}">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dial from ${left} to ${right}"
        @pointerdown=${drag?.down ?? nothing} @pointermove=${drag?.move ?? nothing}>
        ${svg`
          <path d=${wedge(0, 100)} fill="#fff" stroke="#222" stroke-width="3.5" stroke-linejoin="round" />
          ${zones.map(([a, b, pts]) => svg`<path d=${wedge(a, b)} fill=${BAND_FILL[pts]} stroke=${pts === 4 ? '#222' : 'none'} stroke-width="2" />`)}
          ${target === undefined ? nothing : [[0, 4], [-7, 3], [7, 3], [-13.5, 2], [13.5, 2]]
            .filter(([offset]) => target + offset >= 1.5 && target + offset <= 98.5)
            .map(([offset, pts]) => {
              const [x, y] = point(target + offset, R * 0.86);
              return svg`<text x=${x} y=${y + 5} text-anchor="middle" font-size="13" font-weight="700" fill="#222">${pts}</text>`;
            })}
          ${Array.from({ length: 11 }, (_, i) => {
            const [x1, y1] = point(i * 10, R);
            const [x2, y2] = point(i * 10, R - (i % 5 === 0 ? 12 : 7));
            return svg`<path d="M${x1} ${y1} L${x2} ${y2}" stroke="#222" stroke-width="2" stroke-linecap="round" />`;
          })}
          ${covered ? svg`<path d=${wedge(0, 100)} fill="url(#wheel-cover)" stroke="#222" stroke-width="3.5" />
            <text x=${CX} y=${CY - 52} text-anchor="middle" font-size="44" font-weight="700" fill="#5a5650">?</text>` : nothing}
          ${markers.map(({ value, mine }) => {
            const [x, y] = point(value, R - 6);
            return svg`<path d="M${CX} ${CY} L${x} ${y}" stroke=${mine ? '#d23c5f' : '#222'} stroke-width=${mine ? 5 : 2.5} stroke-linecap="round" />`;
          })}
          <path d="M${CX - R - 6} ${CY} H${CX + R + 6}" stroke="#222" stroke-width="3.5" stroke-linecap="round" />
          <circle cx=${CX} cy=${CY} r="9" fill="#ffe066" stroke="#222" stroke-width="3" />
          <defs><pattern id="wheel-cover" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill="#fff" /><rect width="6" height="12" fill="#a8d4f7" /></pattern></defs>
        `}
      </svg>
      ${markers.filter(m => m.player && !m.mine).map(({ value, player }) => {
        const [x, y] = point(value, R + 20);
        return html`<span class="wheel__marker" style="left:${(x / W) * 100}%;top:${(y / H) * 100}%">${avatar(player, 24)}</span>`;
      })}
    </div>
    ${slider || nothing}
  </div>`;
}

export default {
  id: 'spectrum',
  name: 'Wavelength',
  color: 'blue',
  players: '2–12',
  blurb: 'Give a clue that lands on just the right spot between two extremes.',
  rules: [
    'Each round one player is the psychic. They see a scale, like Cold ↔ Hot, and a secret target somewhere on it.',
    'The psychic writes a clue that points to that spot. For something hot, but not very hot, maybe "a warm bath".',
    'Everyone else turns the dial to where they think the target is.',
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
      ${scale(ctx, { covered: true })}`;
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
  const pick = v => { if (mine === undefined) { local.value = v; ctx.rerender(); } };
  return html`${header(ctx)}${timer(round.endsAt, 10)}${clueCard}
    <p class="note center">${mine === undefined ? 'Drag the needle round the wheel, or use the slider.' : 'Locked in!'}</p>
    ${scale(ctx, { markers: [{ value: local.value, mine: true }], slider, onPick: mine === undefined ? pick : null })}
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


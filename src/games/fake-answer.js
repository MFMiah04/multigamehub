import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { shuffle } from '../room.js';
import { isTimeUp, isGraceOver, normalize, pickUnused, roundsField, secondsOptions, leaderboard, nextOrFinalButton, finalScores } from './common.js';
import questions from '../data/fake-answer-questions.json';

const TRUTH_POINTS = 1000;
const FOOL_POINTS = 500;

const isTruth = (ctx, text) => normalize(text) === normalize(questions[ctx.round.q].a);
const cleanLie = text => text.trim().replace(/\s+/g, ' ').replace(/[.!?]+$/, '').slice(0, 40);

// Shows the question with its blank drawn as a highlighted gap (or filled in).
function questionText(ctx, fill) {
  const [before, after] = questions[ctx.round.q].q.split('____');
  return html`${before}<span class="blank">${fill || ' '.repeat(10)}</span>${after}`;
}

// The truth plus every distinct fake answer, merged when two players wrote the same one.
function buildOptions(ctx) {
  const options = [];
  ctx.inGame.forEach(p => {
    const lie = ctx.round.lies?.[p.id];
    if (!lie) return;
    const match = options.find(o => normalize(o.text) === normalize(lie));
    if (match) match.authors[p.id] = true;
    else options.push({ text: lie, authors: { [p.id]: true } });
  });
  options.push({ text: questions[ctx.round.q].a, truth: true });
  return shuffle(options);
}

function scoreRound(ctx) {
  const { round } = ctx;
  const delta = {};
  ctx.inGame.forEach(p => {
    const pick = round.options?.[round.picks?.[p.id]];
    if (!pick) return;
    if (pick.truth) delta[p.id] = (delta[p.id] || 0) + TRUTH_POINTS;
    else Object.keys(pick.authors || {}).filter(id => id !== p.id).forEach(id => { delta[id] = (delta[id] || 0) + FOOL_POINTS; });
  });
  const updates = { phase: 'reveal', 'round/endsAt': null, 'round/delta': delta };
  Object.entries(delta).forEach(([id, pts]) => { updates[`round/scores/${id}`] = (round.scores?.[id] || 0) + pts; });
  return updates;
}

export default {
  id: 'fake-answer',
  name: 'Fake Answer',
  color: 'yellow',
  players: '3–12',
  blurb: 'Write a believable lie, then spot the real answer.',
  rules: [
    'Each round shows a strange but true fact with a word missing.',
    'Everyone writes a fake answer that sounds believable.',
    'Then all the fakes and the real answer are shown together. Pick the one you think is true.',
    `Find the truth for ${TRUTH_POINTS} points, and get ${FOOL_POINTS} for every player who falls for your lie.`,
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M8 8 C8 5, 10 4, 13 4 H44 C47 4, 48 6, 48 9 V47 C48 50, 47 52, 44 52 H13 C10 52, 8 50, 8 47 Z" fill="#fff" />
    <path d="M14 14 h18 M14 21 h26" />
    <path d="M13 38 l5 -6 l4 9 l5 -15 l5 18 l4 -10 l4 4" stroke="#d23c5f" />
    <path d="M47 21 q0 -7 7 -7 q7 0 7 6 q0 4 -6 6 v4 M55 36 v0.5" stroke-width="3" />
  </g></svg>`,

  defaults: () => ({ rounds: 8, writeTime: 60, pickTime: 30 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${roundsField(s.rounds, set, disabled)}
      ${selectField('Time to write', s.writeTime, secondsOptions([30, 45, 60, 90]), v => set({ writeTime: +v }), disabled)}
      ${selectField('Time to pick', s.pickTime, secondsOptions([20, 30, 45, 60]), v => set({ pickTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const q = pickUnused(questions);
    return { phase: 'write', round: { no: 1, total: s.rounds, q, used: { [q]: true }, scores: {}, endsAt: ctx.now() + s.writeTime * 1000 } };
  },

  // When time runs out, send whatever lie is typed (unless it's accidentally the truth).
  clientTick(ctx) {
    if (ctx.room.phase !== 'write' || !isTimeUp(ctx) || ctx.round.lies?.[ctx.uid] || ctx.local.autoSent) return null;
    ctx.local.autoSent = true;
    const typed = cleanLie(document.getElementById('lie')?.value || '');
    return typed && !isTruth(ctx, typed) ? { [`round/lies/${ctx.uid}`]: typed } : null;
  },

  tick(ctx) {
    const { round } = ctx;
    const { phase } = ctx.room;
    if (phase === 'write' && (ctx.inGame.every(p => round.lies?.[p.id]) || isGraceOver(ctx))) {
      return { phase: 'pick', 'round/options': buildOptions(ctx), 'round/picks': null, 'round/endsAt': ctx.now() + (ctx.settings.pickTime || 30) * 1000 };
    }
    if (phase === 'pick' && (isTimeUp(ctx) || ctx.inGame.every(p => round.picks?.[p.id] !== undefined))) return scoreRound(ctx);
    return null;
  },

  view(ctx, s) {
    const views = { final: finalScores, write, pick, reveal };
    return views[ctx.room.phase]?.(ctx, s) ?? nothing;
  },
};

const header = ctx => html`<p class="note center">Round ${ctx.round.no} of ${ctx.round.total}</p>`;

function write(ctx) {
  const { round } = ctx;
  const mine = round.lies?.[ctx.uid];
  const written = ctx.inGame.filter(p => round.lies?.[p.id]).length;
  const submit = async () => {
    const lie = cleanLie(document.getElementById('lie').value);
    if (!lie) return toast('Write a fake answer first.');
    if (isTruth(ctx, lie)) return toast("Ha, that's actually the real answer! Write a fake one.");
    await ctx.update({ [`round/lies/${ctx.uid}`]: lie });
  };
  return html`${header(ctx)}${timer(round.endsAt, 10)}
    <div class="question wobble"><small>Fill in the blank with a believable lie</small>${questionText(ctx)}</div>
    ${mine
      ? html`<p class="answer-locked wobble">"${mine}"</p>
        ${button('Change my lie', action(() => ctx.update({ [`round/lies/${ctx.uid}`]: null })), { kind: 'white' })}`
      : html`<label class="field"><span>Your fake answer</span>
          <input id="lie" class="wobble" maxlength="40" autocomplete="off" placeholder="Make it sound real"
            @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
        ${button('Send my lie', action(submit))}`}
    ${progress(written, ctx.inGame.length, 'have written a lie')}`;
}

function pick(ctx) {
  const { round } = ctx;
  const mine = round.picks?.[ctx.uid];
  const picked = ctx.inGame.filter(p => round.picks?.[p.id] !== undefined).length;
  const choose = i => ctx.update({ [`round/picks/${ctx.uid}`]: i });
  return html`${header(ctx)}${timer(round.endsAt, 10)}
    <div class="question wobble"><small>Which one is true?</small>${questionText(ctx)}</div>
    <div class="options">
      ${(round.options || []).map((o, i) => {
        const own = o.authors?.[ctx.uid];
        return html`<button class="option wobble ${mine === i ? 'option--picked' : ''}" ?disabled=${own} @click=${action(() => choose(i))}>
          ${o.text}${own ? html`<small>your lie</small>` : nothing}
        </button>`;
      })}
    </div>
    ${progress(picked, ctx.inGame.length, 'have picked')}`;
}

function reveal(ctx, s) {
  const { round } = ctx;
  const truth = questions[round.q].a;
  const pickersOf = i => ctx.inGame.filter(p => round.picks?.[p.id] === i);
  const names = list => {
    const all = list.map(p => p.name);
    return all.length > 1 ? `${all.slice(0, -1).join(', ')} and ${all.at(-1)}` : all[0] || '';
  };
  const order = (round.options || []).map((o, i) => ({ ...o, i })).sort((a, b) => (a.truth ? 1 : 0) - (b.truth ? 1 : 0));

  const next = () => {
    const q = pickUnused(questions, round.used);
    return ctx.update({
      phase: 'write', 'round/no': round.no + 1, 'round/q': q, [`round/used/${q}`]: true,
      'round/lies': null, 'round/options': null, 'round/picks': null, 'round/delta': null,
      'round/endsAt': ctx.now() + s.writeTime * 1000,
    });
  };

  return html`${header(ctx)}
    <div class="question wobble"><small>The truth</small>${questionText(ctx, truth)}</div>
    <div class="results">
      ${order.map(o => {
        const fooled = pickersOf(o.i);
        const authors = ctx.inGame.filter(p => o.authors?.[p.id]);
        return html`<div class="result wobble ${o.truth ? 'result--truth' : ''}">
          <div class="result__body">
            <span><b>${o.text}</b> ${o.truth ? html`<span class="hl">the truth</span>` : nothing}</span>
            <small>${o.truth ? (fooled.length ? `Found by ${names(fooled)}` : 'Nobody found it!') : `${names(authors)}'s lie${fooled.length ? ` fooled ${names(fooled)}` : ' fooled nobody'}`}</small>
          </div>
          ${fooled.length ? html`<span class="pickers">${fooled.map(p => avatar(p, 24))}</span>` : nothing}
        </div>`;
      })}
    </div>
    <h2 class="section-title">Scores</h2>
    ${leaderboard(ctx, round.scores, round.delta)}
    <div class="push"></div>
    ${nextOrFinalButton(ctx, round, next)}`;
}


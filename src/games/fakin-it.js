import { html, nothing, button, timer, selectField, action, progress, toast } from '../ui.js';
import { shuffle } from '../room.js';
import { minutes, counts, startVoting, isTimeUp, voteView, votedCount, tally, mostVoted, voteResults, toResults, revealButton, backToLobbyButton, hostSkip } from './common.js';

const overseerOf = (ctx, s) => (ctx.room.players[s.overseer] ? s.overseer : ctx.room.hostId);
const maxFakers = count => Math.max(1, Math.floor(count / 2));
const answerers = ctx => ctx.inGame.filter(p => p.id !== ctx.round.overseer);

export default {
  id: 'fakin-it',
  name: "Fakin' It",
  color: 'peach',
  players: '4–12',
  blurb: 'One player gets a different question. Spot the faker.',
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 30 C6 15, 30 15, 30 30 C30 45, 6 46, 6 30 Z" fill="#fff" />
    <path d="M12 25 q2.5 -2 5 0 M20 25 q2.5 -2 5 0" />
    <circle cx="16" cy="27" r="1.4" fill="#222" stroke="none" /><circle cx="24" cy="27" r="1.4" fill="#222" stroke="none" />
    <path d="M13 37 q4 2 8 -1" />
    <path d="M27 30 L57 31 L27 34" fill="#fff" />
    <path d="M46 31 q2 -6 7 -7 q-1 5 -7 7" fill="#b4f8c8" />
    <path d="M42 10 q0 -5 5 -5 q5 0 5 4 q0 3 -4 4 v3 M48 21 v0.5" />
  </g></svg>`,
  rules: [
    "One player is the overseer. They don't play, they write two similar questions.",
    "Everyone answers the real question, except the faker, who secretly gets the other one. They might not even realise!",
    "Then everyone sees all the answers next to the real question.",
    'Vote for whoever you think is faking it. The faker wins if they blend in.',
  ],

  defaults: ctx => ({ overseer: ctx.room.hostId, fakers: 1, answerTime: 180, voteTime: 180 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    const overseer = overseerOf(ctx, s);
    return html`
      ${selectField('Overseer (writes the questions)', overseer, ctx.players.map(p => [p.id, p.name]), v => set({ overseer: v }), disabled)}
      ${selectField('Fakers', s.fakers, counts(1, maxFakers(ctx.players.length - 1), 'faker'), v => set({ fakers: +v }), disabled)}
      ${selectField('Time to answer', s.answerTime, minutes(1, 5), v => set({ answerTime: +v }), disabled)}
      ${selectField('Time to vote', s.voteTime, minutes(1, 10), v => set({ voteTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 4 ? `Need ${4 - ctx.players.length} more (3 players plus the overseer)` : null),

  start(ctx, s) {
    const overseer = overseerOf(ctx, s);
    const ids = shuffle(ctx.players.map(p => p.id).filter(id => id !== overseer));
    const count = Math.min(s.fakers || 1, maxFakers(ids.length));
    return {
      phase: 'questions',
      round: { overseer, count, fakers: Object.fromEntries(ids.slice(0, count).map(id => [id, true])) },
    };
  },

  tick(ctx, s) {
    const { phase } = ctx.room;
    const players = answerers(ctx);
    if (phase === 'answer') {
      const answered = players.filter(p => ctx.round.answers?.[p.id]).length;
      if (isTimeUp(ctx) || answered === players.length) return startVoting(ctx, s.voteTime);
    }
    if (phase === 'voting' && (isTimeUp(ctx) || votedCount(ctx, players) === players.length)) return toResults(ctx);
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'questions') return questions(ctx, s);
    if (phase === 'answer') return answering(ctx);
    if (phase === 'voting') {
      return html`
        <div class="question wobble"><small>The real question</small>${ctx.round.questions?.real}</div>
        ${voteView(ctx, {
          candidates: answerers(ctx), voters: answerers(ctx), max: ctx.round.count,
          prompt: ctx.round.count > 1 ? "Who's faking it? (more than one)" : "Who's faking it?",
          details: p => html`<span class="answer">"${ctx.round.answers?.[p.id] || 'no answer'}"</span>`,
        })}`;
    }
    return results(ctx);
  },
};

function questions(ctx, s) {
  const overseer = ctx.room.players[ctx.round.overseer];
  if (ctx.uid !== ctx.round.overseer) {
    return html`<div class="waiting">
      <h2 class="center">${overseer?.name || 'The overseer'} is writing the questions…</h2>
      <p class="note center">Get ready to answer.</p>
    </div>`;
  }
  const submit = async () => {
    const real = document.getElementById('q-real').value.trim();
    const fake = document.getElementById('q-fake').value.trim();
    if (!real || !fake) return toast('Write both questions first.');
    await ctx.update({ phase: 'answer', 'round/questions': { real, fake }, 'round/endsAt': ctx.now() + s.answerTime * 1000 });
  };
  return html`
    <h2>You're the overseer</h2>
    <p class="note">Write two questions that are similar, but not the same. Keep them short.</p>
    <label class="field"><span>Real question (most players)</span>
      <textarea id="q-real" class="wobble" rows="2" maxlength="140" placeholder="What's the best film ever made?"></textarea></label>
    <label class="field"><span>Faker's question</span>
      <textarea id="q-fake" class="wobble" rows="2" maxlength="140" placeholder="What's the worst film ever made?"></textarea></label>
    <div class="push"></div>
    ${button('Send the questions', action(submit))}`;
}

function answering(ctx) {
  const { round } = ctx;
  const players = answerers(ctx);
  const answered = players.filter(p => round.answers?.[p.id]).length;
  const status = progress(answered, players.length, 'have answered');

  if (ctx.uid === round.overseer) {
    return html`${timer(round.endsAt)}
      <div class="question wobble"><small>Real question</small>${round.questions?.real}</div>
      <div class="question wobble question--fake"><small>Faker's question</small>${round.questions?.fake}</div>
      ${status}
      ${hostSkip(ctx, 'Skip to voting', startVoting(ctx, 180))}`;
  }

  const mine = round.answers?.[ctx.uid];
  const question = round.fakers?.[ctx.uid] ? round.questions?.fake : round.questions?.real;
  const submit = async () => {
    const value = document.getElementById('answer').value.trim();
    if (!value) return toast('Type an answer first.');
    await ctx.update({ [`round/answers/${ctx.uid}`]: value.slice(0, 120) });
  };
  return html`
    ${timer(round.endsAt)}
    <div class="question wobble"><small>Your question</small>${question}</div>
    ${mine
      ? html`<p class="answer-locked wobble">"${mine}"</p>
        ${button('Change my answer', action(() => ctx.update({ [`round/answers/${ctx.uid}`]: null })), { kind: 'white' })}`
      : html`<label class="field"><span>Your answer</span>
          <textarea id="answer" class="wobble" rows="2" maxlength="120" placeholder="Keep it short"></textarea></label>
        ${button('Submit answer', action(submit))}`}
    ${status}
    ${hostSkip(ctx, 'Skip to voting', startVoting(ctx, 180))}`;
}

function results(ctx) {
  const { round } = ctx;
  const players = answerers(ctx);
  const rows = tally(ctx, players, players);
  const fakers = players.filter(p => round.fakers?.[p.id]).map(p => p.id);
  const suspects = mostVoted(rows, round.count);
  const caught = fakers.filter(id => suspects.includes(id)).length;
  const headline = caught === fakers.length ? 'Faker caught!' : caught > 0 ? 'Some fakers caught!' : 'The faker got away with it!';

  return voteResults(ctx, rows, {
    headline,
    question: fakers.length > 1 ? 'So, who were the fakers?' : 'So, who was the faker?',
    badge: p => (round.fakers?.[p.id] ? 'faker' : null),
    detail: p => html`<span class="answer">"${round.answers?.[p.id] || 'no answer'}"</span>`,
    mood: p => (round.fakers?.[p.id] ? (suspects.includes(p.id) ? 'shock' : 'happy') : null),
    top: html`${round.revealed ? html`
        <div class="question wobble pop-in"><small>Real question</small>${round.questions?.real}</div>
        <div class="question wobble question--fake pop-in"><small>Faker's question</small>${round.questions?.fake}</div>` : nothing}
      ${revealButton(ctx, round.revealed, 'Reveal the questions', 'revealed')}`,
    bottom: html`
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame), { kind: 'yellow' }) : nothing}
    ${backToLobbyButton(ctx)}`,
  });
}

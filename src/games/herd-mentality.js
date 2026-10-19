import { html, nothing, button, timer, selectField, action, progress, toast, avatar } from '../ui.js';
import { randomItem } from '../room.js';
import { isTimeUp, backToLobbyButton } from './common.js';
import questions from '../data/herd-questions.json';

const GRACE_MS = 2500;

// "The Beatles!" and "beatles" should land in the same group.
const normalize = answer => answer.toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .replace(/^(the|a|an)\s+/, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/(?<=\w{3})s$/, '');

function pickQuestion(used = {}) {
  const open = questions.map((_, i) => i).filter(i => !used[i]);
  return randomItem(open.length ? open : questions.map((_, i) => i));
}

// Turns { playerId: groupNumber } into groups sorted biggest first, with herd and pink cow worked out.
function groupsOf(ctx) {
  const byGroup = {};
  ctx.inGame.forEach(p => {
    const g = ctx.round.group?.[p.id];
    if (g === undefined) return;
    (byGroup[g] ||= []).push(p);
  });
  const groups = Object.entries(byGroup).map(([key, members]) => ({ key: +key, members })).sort((a, b) => b.members.length - a.members.length);
  const top = groups[0]?.members.length || 0;
  const herd = top > 1 && groups.filter(g => g.members.length === top).length === 1 ? groups[0].key : null;
  const singles = groups.filter(g => g.members.length === 1);
  const cow = singles.length === 1 ? singles[0].members[0].id : null;
  return { groups, herd, cow };
}

function autoGroup(ctx) {
  const keys = [];
  const group = {};
  ctx.inGame.forEach(p => {
    const text = ctx.round.answers?.[p.id];
    const key = text ? normalize(text) : `__none_${p.id}`;
    if (!keys.includes(key)) keys.push(key);
    group[p.id] = keys.indexOf(key);
  });
  return group;
}

const winnerOf = (ctx, s) => {
  if (!s.target) return null;
  return ctx.inGame.find(p => p.id !== ctx.round.cow && (ctx.round.scores?.[p.id] || 0) >= s.target) || null;
};

export default {
  id: 'herd-mentality',
  name: 'Herd Mentality',
  color: 'mint',
  players: '3–12',
  blurb: 'Answer the same as everyone else to score.',
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12 C20 7, 21 4, 24 2 M42 12 C44 7, 43 4, 40 2" />
    <path d="M19 18 C11 14, 5 17, 5 21 C10 24, 16 23, 20 21 M45 18 C53 14, 59 17, 59 21 C54 24, 48 23, 44 21" fill="#fff" />
    <path d="M18 14 C25 8, 39 8, 46 14 C49 23, 48 31, 46 36 C39 40, 25 40, 18 36 C16 31, 15 23, 18 14 Z" fill="#fff" />
    <path d="M25 12 C29 10, 34 13, 32 18 C29 22, 23 19, 25 12 Z" fill="#222" />
    <circle cx="25" cy="25" r="1.8" fill="#222" stroke="none" /><circle cx="39" cy="25" r="1.8" fill="#222" stroke="none" />
    <path d="M17 41 C17 33, 47 33, 47 41 C47 50, 17 50, 17 41 Z" fill="#ffaebc" />
    <path d="M26 41 v2 M38 41 v2" stroke-width="3" />
  </g></svg>`,
  rules: [
    'Everyone answers the same question at the same time.',
    "You score a point if you're in the biggest group with the same answer (the herd).",
    "If you're the only person with an odd answer, you get the pink cow. You can't win while you hold it.",
    'The first player to reach the target score without the pink cow wins.',
  ],

  defaults: () => ({ time: 30, target: 8 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Time to answer', s.time, [10, 20, 30, 45, 60].map(v => [v, `${v} seconds`]), v => set({ time: +v }), disabled)}
      ${selectField('Points to win', s.target, [[5, '5 points'], [8, '8 points'], [10, '10 points'], [15, '15 points'], [0, 'No limit']], v => set({ target: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const q = pickQuestion();
    return { phase: 'question', round: { no: 1, question: q, used: { [q]: true }, scores: {}, endsAt: ctx.now() + s.time * 1000 } };
  },

  // Everyone: when time runs out, send whatever's typed so far.
  clientTick(ctx) {
    if (ctx.room.phase !== 'question' || !isTimeUp(ctx) || ctx.round.answers?.[ctx.uid] || ctx.local.autoSent) return null;
    ctx.local.autoSent = true;
    const typed = document.getElementById('answer')?.value.trim();
    return typed ? { [`round/answers/${ctx.uid}`]: typed.slice(0, 60) } : null;
  },

  tick(ctx) {
    if (ctx.room.phase !== 'question') return null;
    const answered = ctx.inGame.filter(p => ctx.round.answers?.[p.id]).length;
    const graceOver = ctx.round.endsAt && ctx.now() >= ctx.round.endsAt + GRACE_MS;
    if (answered === ctx.inGame.length || graceOver) return { phase: 'reveal', 'round/endsAt': null, 'round/group': autoGroup(ctx) };
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'question') return answering(ctx);
    if (phase === 'reveal') return reveal(ctx);
    return results(ctx, s);
  },
};

const questionCard = ctx => html`<div class="question wobble"><small>Question ${ctx.round.no}</small>${questions[ctx.round.question]}</div>`;

function answering(ctx) {
  const mine = ctx.round.answers?.[ctx.uid];
  const answered = ctx.inGame.filter(p => ctx.round.answers?.[p.id]).length;
  const submit = async () => {
    const value = document.getElementById('answer').value.trim();
    if (!value) return toast('Type an answer first.');
    await ctx.update({ [`round/answers/${ctx.uid}`]: value.slice(0, 60) });
  };
  return html`
    ${timer(ctx.round.endsAt, 5)}
    ${questionCard(ctx)}
    ${mine
      ? html`<p class="answer-locked wobble">"${mine}"</p>
        ${isTimeUp(ctx) ? nothing : button('Change my answer', action(() => ctx.update({ [`round/answers/${ctx.uid}`]: null })), { kind: 'white' })}`
      : html`<label class="field"><span>Your answer</span>
          <input id="answer" class="wobble" maxlength="60" autocomplete="off" placeholder="Think like the herd…"
            @keydown=${e => e.key === 'Enter' && action(submit)()}></label>
        ${button('Submit answer', action(submit), { disabled: isTimeUp(ctx) })}`}
    ${progress(answered, ctx.inGame.length, 'have answered')}`;
}

function reveal(ctx) {
  const { groups, herd, cow } = groupsOf(ctx);
  const moving = ctx.local.moving;
  const pick = id => { ctx.local.moving = moving === id ? null : id; ctx.rerender(); };
  const moveTo = key => ctx.update({ [`round/group/${moving}`]: key }).then(() => { ctx.local.moving = null; ctx.rerender(); });
  const newGroup = () => moveTo(Math.max(...groups.map(g => g.key)) + 1);

  const score = () => {
    const updates = { phase: 'results' };
    const herdGroup = groups.find(g => g.key === herd);
    herdGroup?.members.forEach(p => {
      if (p.id !== ctx.round.cow) updates[`round/scores/${p.id}`] = (ctx.round.scores?.[p.id] || 0) + 1;
    });
    if (cow) updates['round/cow'] = cow;
    updates['round/last'] = herdGroup ? {
      herd: herdGroup.members.map(p => p.id),
      answer: ctx.round.answers?.[herdGroup.members[0].id] || '',
      cowMissedOut: herdGroup.members.some(p => p.id === ctx.round.cow),
    } : null;
    return ctx.update(updates);
  };

  return html`
    ${questionCard(ctx)}
    ${ctx.isHost
      ? html`<p class="note center">${moving ? 'Now tap the group to move them into.' : 'Same answer, different words? Tap a player, then tap their group.'}</p>`
      : html`<p class="note center">The host is checking the groups…</p>`}
    <div class="groups">
      ${groups.map(g => html`
        <div class="group wobble ${g.key === herd ? 'group--herd' : ''} ${g.members[0].id === cow ? 'group--cow' : ''} ${moving && !g.members.some(p => p.id === moving) ? 'group--target' : ''}"
          @click=${() => moving && !g.members.some(p => p.id === moving) && moveTo(g.key)}>
          ${g.key === herd ? html`<span class="group__label hl">the herd</span>` : nothing}
          ${g.members[0].id === cow ? html`<span class="group__label hl hl--pink">pink cow</span>` : nothing}
          ${g.members.map(p => html`
            <button class="group__member ${moving === p.id ? 'group__member--moving' : ''}" ?disabled=${!ctx.isHost}
              @click=${e => { e.stopPropagation(); moving && !g.members.some(m => m.id === moving) ? moveTo(g.key) : pick(p.id); }}>
              ${avatar(p, 22)} <b>${p.name}</b> <span class="answer">"${ctx.round.answers?.[p.id] || 'no answer'}"</span>
            </button>`)}
        </div>`)}
      ${ctx.isHost && moving ? html`<button class="group group--new wobble" @click=${newGroup}>+ Put in a new group</button>` : nothing}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Score this round', action(score)) : nothing}`;
}

function results(ctx, s) {
  const { round } = ctx;
  const winner = winnerOf(ctx, s);
  const herdNames = (round.last?.herd || []).map(id => ctx.room.players[id]?.name).filter(Boolean);
  const board = [...ctx.inGame].sort((a, b) => (round.scores?.[b.id] || 0) - (round.scores?.[a.id] || 0));

  const next = () => {
    const q = pickQuestion(round.used);
    return ctx.update({
      phase: 'question', 'round/no': round.no + 1, 'round/question': q, [`round/used/${q}`]: true,
      'round/answers': null, 'round/group': null, 'round/last': null, 'round/endsAt': ctx.now() + s.time * 1000,
    });
  };

  return html`
    ${winner
      ? html`<h1 class="center scribble">${winner.name} wins!</h1>`
      : html`<h2 class="center">${herdNames.length ? html`The herd said <span class="hl">"${round.last.answer}"</span>` : 'No herd this time!'}</h2>
        ${herdNames.length ? html`<p class="note center">+1 for ${herdNames.join(', ')}${round.last.cowMissedOut ? ' (the pink cow holder misses out)' : ''}</p>` : nothing}`}
    <div class="results">
      ${board.map((p, i) => html`<div class="result wobble ${p.id === round.cow ? 'result--cow' : ''}">
        <span class="rank">${i + 1}</span>${avatar(p, 30)}
        <div class="result__body"><span><b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b>
          ${p.id === round.cow ? html`<span class="hl hl--pink">pink cow</span>` : nothing}</span></div>
        <span class="result__votes">${round.scores?.[p.id] || 0}<small>pts</small></span>
      </div>`)}
    </div>
    ${s.target ? html`<p class="note center">First to ${s.target} points without the pink cow wins.</p>` : nothing}
    <div class="push"></div>
    ${ctx.isHost
      ? (winner ? button('Play again', action(ctx.startGame)) : button('Next question', action(next)))
      : html`<p class="note center">Waiting for the host…</p>`}
    ${winner || ctx.isHost ? backToLobbyButton(ctx) : nothing}`;
}

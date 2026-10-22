import { svg } from 'lit-html';
import { html, nothing, button, avatar, timer, progress, action, confirmDialog } from '../ui.js';
import { cue } from '../sound.js';

export const minutes = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => [(from + i) * 60, `${from + i} min`]);

export const counts = (from, to, noun) =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, `${from + i} ${noun}${from + i === 1 ? '' : 's'}`]);

export function backToLobby(ctx) {
  const updates = { phase: 'lobby', round: null };
  ctx.players.forEach(p => { updates[`players/${p.id}/inGame`] = null; });
  return ctx.update(updates);
}

// Moving to the results starts the reveal clock, so every screen uncovers the votes in step.
export const toResults = ctx => ({ phase: 'results', 'round/endsAt': null, 'round/revealAt': ctx.now() + 400 });

export function startVoting(ctx, seconds) {
  return { phase: 'voting', 'round/endsAt': ctx.now() + seconds * 1000, 'round/votes': null, 'round/voteRequests': null };
}

export const isTimeUp = ctx => ctx.round.endsAt && ctx.now() >= ctx.round.endsAt;

// Extra time after a typing timer ends, so everyone's auto-sent answers arrive first.
export const GRACE_MS = 2500;
export const isGraceOver = ctx => ctx.round.endsAt && ctx.now() >= ctx.round.endsAt + GRACE_MS;

// "The Beatles!" and "beatles" should count as the same answer.
export const normalize = answer => String(answer || '').toLowerCase()
  .replace(/[^\p{L}\p{N}\s]/gu, '')
  .replace(/^(the|a|an)\s+/, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/(?<=\w{2})(ch|sh|x|z|ss)es$/, '$1') // watches → watch, boxes → box
  .replace(/(?<=\w{3})s$/, '');

// Index of a random item not used yet this game (starts over once everything's been used).
export function pickUnused(list, used = {}) {
  const open = list.map((_, i) => i).filter(i => !used[i]);
  const pool = open.length ? open : list.map((_, i) => i);
  return pool[Math.floor(Math.random() * pool.length)];
}

// Whose turn it is in round `no`, skipping anyone who has left.
export function turnOf(ctx, order, no) {
  const present = (order || []).filter(id => ctx.room.players[id]);
  return present.length ? present[(no - 1) % present.length] : null;
}

// ----- scores -----

const ROW_PITCH = 84; // a results row (70px) plus the gap below it
const CROWN = html`<svg class="crown" viewBox="0 0 24 16" aria-hidden="true">${svg`
  <path d="M2.5 14 L3.5 4 L8.5 9 L12 2 L15.5 9 L20.5 4 L21.5 14 Z" fill="#ffd04d" stroke="#222" stroke-width="1.8" stroke-linejoin="round" />`}</svg>`;

const ranked = (players, points) => [...players].sort((a, b) => points(b.id) - points(a.id));

// The scoreboard. Rows slide from where they were before this round to where they are now,
// anyone who scored grins and gets a "+points" pop, and whoever's top wears the crown.
export function leaderboard(ctx, scores = {}, delta = {}, { badge } = {}) {
  const now = id => scores[id] || 0;
  const before = id => now(id) - (delta[id] || 0);
  const board = ranked(ctx.inGame, now);
  const oldOrder = ranked(ctx.inGame, before).map(p => p.id);
  const top = Math.max(0, ...board.map(p => now(p.id)));
  if (Object.values(delta).some(Boolean)) cue(`score:${ctx.room.code}:${JSON.stringify(scores)}`, 'score');
  return html`<div class="results">
    ${board.map((p, i) => {
      const moved = oldOrder.indexOf(p.id) - i;
      const label = badge?.(p);
      return html`<div class="result wobble ${moved ? 'result--moved' : ''} ${label ? 'result--marked' : ''}" style="--from: ${moved * ROW_PITCH}px">
        <span class="rank">${i + 1}</span>
        <span class="avatar-spot">${top > 0 && now(p.id) === top ? CROWN : nothing}${avatar(p, 40, delta[p.id] > 0 ? 'happy' : null)}</span>
        <div class="result__body"><span><b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b> ${label ? html`<span class="hl hl--pink">${label}</span>` : nothing}</span>
          ${delta[p.id] ? html`<small>+${delta[p.id]} this round</small>` : nothing}</div>
        <span class="result__votes">${now(p.id)}<small>pts</small>
          ${delta[p.id] ? html`<span class="delta-pop">+${delta[p.id]}</span>` : nothing}</span>
      </div>`;
    })}
  </div>`;
}

// Adds to a running total for the end-of-game awards, e.g. how many people someone's lies fooled.
export function bumpStat(updates, round, id, key, by = 1) {
  const path = `round/stats/${id}/${key}`;
  updates[path] = (updates[path] ?? round.stats?.[id]?.[key] ?? 0) + by;
}

// An award for whoever has the highest total for `key` (ties share it). Nothing if nobody has any.
export function award(ctx, key, title, note) {
  const stats = ctx.round.stats || {};
  const value = p => stats[p.id]?.[key] || 0;
  const best = Math.max(0, ...ctx.inGame.map(value));
  if (!best) return null;
  return { title, players: ctx.inGame.filter(p => value(p) === best), note: note(best) };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
export { plural };

// Doodled confetti that falls once over the final screen.
const CONFETTI_COLORS = ['#a0e7e5', '#ffaebc', '#ffe066', '#b4f8c8', '#c3b1e1', '#ffc48c', '#9ad0f5'];
const confetti = () => html`<div class="confetti" aria-hidden="true">
  ${Array.from({ length: 36 }, (_, i) => html`<i style="left: ${(i * 37) % 100}%; background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
    --d: ${((i * 13) % 20) / 10}s; --r: ${(i * 47) % 360}deg; --x: ${((i * 29) % 60) - 30}px"></i>`)}
</div>`;

const ordinal = n => ['1st', '2nd', '3rd'][n - 1] || `${n}th`;

// The end of a game: a podium for the top three, awards, then everyone else.
// `winner` overrides who won, for games where the most points doesn't always win.
export function finalScores(ctx, { awards = [], winner } = {}) {
  const scores = ctx.round.scores || {};
  const now = id => scores[id] || 0;
  let board = ranked(ctx.inGame, now);
  if (winner) board = [winner, ...board.filter(p => p.id !== winner.id)];
  const top = winner ? now(winner.id) : Math.max(0, ...board.map(p => now(p.id)));
  const winners = winner ? [winner] : board.filter(p => now(p.id) === top && top > 0);
  const bottom = Math.min(...board.map(p => now(p.id)));
  const place = p => (winner && p.id === winner.id ? 1 : 1 + board.filter(o => now(o.id) > now(p.id) && o.id !== winner?.id).length + (winner && p.id !== winner.id ? 1 : 0));
  const mood = p => (winners.includes(p) ? 'happy' : board.length > 2 && now(p.id) === bottom ? 'sad' : null);
  const podium = board.slice(0, 3);
  const shown = awards.filter(Boolean);
  cue(`final:${ctx.round.id}:${JSON.stringify(scores)}`, winners.length ? 'fanfare' : 'sad');

  return html`
    ${winners.length ? confetti() : nothing}
    <h1 class="center scribble pop-in">${winners.length === 1 ? `${winners[0].name} wins!` : winners.length ? "It's a tie!" : 'Nobody scored!'}</h1>
    <div class="podium">
      ${[1, 0, 2].filter(i => podium[i]).map(i => {
        const p = podium[i];
        return html`<div class="podium__spot podium__spot--${place(p)}" style="--delay: ${[0.9, 0.4, 0.15][i]}s">
          <span class="avatar-spot">${winners.includes(p) ? CROWN : nothing}${avatar(p, i === 0 ? 60 : 46, mood(p))}</span>
          <b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b>
          <div class="podium__block wobble"><span>${ordinal(place(p))}</span><small>${now(p.id)} pts</small></div>
        </div>`;
      })}
    </div>
    ${shown.length ? html`<h2 class="section-title">Awards</h2>
      <div class="awards">
        ${shown.map((a, i) => html`<div class="award sticky--${['pink', 'cyan', 'mint', 'lilac', 'peach'][i % 5]}" style="--delay: ${1.4 + i * 0.35}s">
          <b>${a.title}</b>
          <span class="award__who">${a.players.map(p => avatar(p, 24, 'happy'))} ${a.players.map(p => p.name).join(' & ')}</span>
          <small>${a.note}</small>
        </div>`)}
      </div>` : nothing}
    ${board.length > 3 ? html`<div class="results final-rest">
      ${board.slice(3).map(p => html`<div class="result wobble">
        <span class="rank">${place(p)}</span>${avatar(p, 34, mood(p))}
        <div class="result__body"><span><b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b></span></div>
        <span class="result__votes">${now(p.id)}<small>pts</small></span>
      </div>`)}
    </div>` : nothing}
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

export const roundsField = (value, set, disabled) =>
  html`<label class="field"><span>Rounds</span>
    <select class="wobble" ?disabled=${disabled} @change=${e => set({ rounds: +e.target.value })}>
      ${[5, 8, 10, 12].map(n => html`<option value=${n} ?selected=${n === value}>${n} rounds</option>`)}
    </select></label>`;

export const secondsOptions = list => list.map(v => [v, v >= 60 && v % 60 === 0 ? `${v / 60} min` : `${v} seconds`]);

export function nextOrFinalButton(ctx, round, next) {
  if (!ctx.isHost) return html`<p class="note center">Waiting for the host…</p>`;
  return round.no < round.total
    ? button('Next round', action(next))
    : button('See the final scores', action(() => ctx.update({ phase: 'final' })));
}

// ----- asking the host to start voting -----

export function voteRequestBar(ctx, seconds) {
  const requests = Object.keys(ctx.round.voteRequests || {}).filter(id => ctx.room.players[id]?.inGame);
  const asked = requests.includes(ctx.uid);
  const label = asked ? 'Cancel my vote request' : 'Ready to vote';
  return html`
    ${ctx.isHost
      ? button('Start the vote', action(() => ctx.update(startVoting(ctx, seconds))), { kind: 'pink' })
      : button(label, action(() => ctx.update({ [`round/voteRequests/${ctx.uid}`]: asked ? null : true })), { kind: asked ? 'white' : 'pink' })}
    ${requests.length ? html`<p class="note center">${requests.length} of ${ctx.inGame.length} ready to vote. Voting starts when more than half are ready.</p>` : nothing}`;
}

export function voteRequestsPassed(ctx) {
  const requests = Object.keys(ctx.round.voteRequests || {}).filter(id => ctx.room.players[id]?.inGame);
  return requests.length > ctx.inGame.length / 2;
}

// ----- voting -----

export function myVotes(ctx) {
  return Object.keys(ctx.round.votes?.[ctx.uid] || {});
}

export function votedCount(ctx, voters) {
  return voters.filter(p => ctx.round.votes?.[p.id]).length;
}

export function voteView(ctx, { candidates, voters, max, prompt, details }) {
  const canVote = voters.some(p => p.id === ctx.uid);
  const submitted = myVotes(ctx);
  const locked = submitted.length > 0;
  ctx.local.picks ??= new Set(submitted);
  const picks = ctx.local.picks;

  const toggle = id => {
    if (!canVote || locked || id === ctx.uid) return;
    if (picks.has(id)) picks.delete(id);
    else if (picks.size < max) picks.add(id);
    else if (max === 1) { picks.clear(); picks.add(id); }
    ctx.rerender();
  };
  const submit = () => ctx.update({ [`round/votes/${ctx.uid}`]: Object.fromEntries([...picks].map(id => [id, true])) });
  const change = () => ctx.update({ [`round/votes/${ctx.uid}`]: null });

  return html`
    ${timer(ctx.round.endsAt)}
    <h2 class="center">${prompt}</h2>
    ${canVote ? html`<p class="note center">${locked ? 'Vote locked in. You can still change it.' : `Pick up to ${max}. Tap again to unpick.`}</p>` : html`<p class="note center">You're watching this vote.</p>`}
    <div class="vote-grid">
      ${candidates.map(p => html`
        <button class="vote-card wobble ${picks.has(p.id) ? 'vote-card--picked' : ''} ${p.id === ctx.uid ? 'vote-card--me' : ''}"
          ?disabled=${!canVote || locked || p.id === ctx.uid} @click=${() => toggle(p.id)}>
          ${avatar(p, 48)}
          <b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b>
          ${details ? details(p) : nothing}
        </button>`)}
    </div>
    ${progress(votedCount(ctx, voters), voters.length, 'have voted')}
    ${canVote ? (locked
      ? button('Change my vote', action(change), { kind: 'white' })
      : button('Lock in vote', action(submit), { kind: 'yellow', disabled: picks.size === 0 })) : nothing}
    ${hostSkip(ctx, 'Skip to results', toResults(ctx))}`;
}

export function tally(ctx, candidates, voters) {
  const rows = candidates.map(p => ({ player: p, voters: [] }));
  voters.forEach(v => {
    Object.keys(ctx.round.votes?.[v.id] || {}).forEach(id => rows.find(r => r.player.id === id)?.voters.push(v.name));
  });
  return rows.sort((a, b) => b.voters.length - a.voters.length);
}

// Players with the most votes (ties included), up to `slots` places.
export function mostVoted(rows, slots) {
  const withVotes = rows.filter(r => r.voters.length > 0);
  if (!withVotes.length) return [];
  const cutoff = withVotes[Math.min(slots, withVotes.length) - 1].voters.length;
  return withVotes.filter(r => r.voters.length >= cutoff).map(r => r.player.id);
}

// ----- revealing the votes -----

const VOTE_GAP_MS = 1300;
const SUSPENSE_MS = 2000;

// Players nobody voted for show straight away. Then the rest appear one at a time, fewest votes first,
// and after a pause the answer (who was really the spy, imposter…) is stamped on.
export function voteStage(ctx, rows) {
  const start = ctx.round.revealAt;
  if (!start) return { shown: rows.length, counting: false, done: true };
  const elapsed = ctx.now() - start;
  const voted = rows.filter(r => r.voters.length).length;
  const shownVoted = elapsed < 0 ? 0 : Math.min(voted, Math.floor(elapsed / VOTE_GAP_MS));
  const stage = {
    shown: elapsed < 0 ? 0 : rows.length - voted + shownVoted,
    counting: shownVoted < voted,
    done: elapsed >= voted * VOTE_GAP_MS + SUSPENSE_MS,
  };
  // A pop for each row, a drumroll during the pause, then a ding for the answer.
  const now = ctx.now();
  if (stage.shown > 0) cue(`votes:${start}:${shownVoted}`, 'pop', { at: start + shownVoted * VOTE_GAP_MS, now });
  if (!stage.counting && !stage.done && elapsed >= 0) cue(`votes:${start}:roll`, 'drumroll', { at: start + voted * VOTE_GAP_MS, now, args: [SUSPENSE_MS / 1000] });
  if (stage.done) cue(`votes:${start}:done`, 'ding', { at: start + voted * VOTE_GAP_MS + SUSPENSE_MS, now });
  return stage;
}

// The headline, the votes and whatever comes after, revealed in order.
// `question` is asked during the pause, e.g. "So, who was the spy?"
export function voteResults(ctx, rows, { headline, question, badge, detail, mood, top = nothing, bottom = nothing }) {
  const stage = voteStage(ctx, rows);
  return html`
    <h1 class="center scribble ${stage.done ? 'pop-in' : ''}">${stage.done ? headline : stage.counting ? 'The votes are in…' : question}</h1>
    ${stage.done ? top : nothing}
    ${resultsList(ctx, rows, { badge, detail, mood, stage })}
    ${stage.done ? bottom : nothing}`;
}

export function resultsList(ctx, rows, { badge, detail, mood, stage }) {
  const done = !stage || stage.done;
  return html`<div class="results">
    ${rows.map((r, i) => {
      const hidden = stage && i < rows.length - stage.shown;
      const label = done ? badge(r.player) : null;
      return html`<div class="result wobble ${label ? 'result--marked' : ''} ${hidden ? 'result--hidden' : stage ? 'result--reveal' : ''}">
        ${avatar(r.player, 40, done && mood ? mood(r.player) : null)}
        <div class="result__body">
          <span><b>${r.player.name}${r.player.id === ctx.uid ? ' (you)' : ''}</b> ${label ? html`<span class="hl stamp">${label}</span>` : nothing}</span>
          ${detail ? detail(r.player) : nothing}
          ${r.voters.length ? html`<small>Voted by ${r.voters.join(', ')}</small>` : nothing}
        </div>
        <span class="result__votes">${r.voters.length}<small>${r.voters.length === 1 ? 'vote' : 'votes'}</small></span>
      </div>`;
    })}
  </div>`;
}

// ----- host controls -----

export function hostSkip(ctx, label, updates) {
  if (!ctx.isHost) return nothing;
  return html`<button class="link" @click=${action(async () => {
    if (await confirmDialog(`${label}?`, 'Skip', 'yellow')) await ctx.update(updates);
  })}>${label}</button>`;
}

export function revealButton(ctx, revealed, label, field) {
  if (revealed) return nothing;
  return ctx.isHost
    ? button(label, action(() => ctx.update({ [`round/${field}`]: true })), { kind: 'yellow' })
    : html`<p class="note center">Waiting for the host to reveal…</p>`;
}

export function backToLobbyButton(ctx, kind = 'white') {
  return ctx.isHost
    ? button('Back to the lobby', action(() => backToLobby(ctx)), { kind })
    : html`<p class="note center">The host will take everyone back to the lobby.</p>`;
}

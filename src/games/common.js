import { html, nothing, button, avatar, timer, progress, action, confirmDialog } from '../ui.js';

export const minutes = (from, to) =>
  Array.from({ length: to - from + 1 }, (_, i) => [(from + i) * 60, `${from + i} min`]);

export const counts = (from, to, noun) =>
  Array.from({ length: to - from + 1 }, (_, i) => [from + i, `${from + i} ${noun}${from + i === 1 ? '' : 's'}`]);

export function backToLobby(ctx) {
  const updates = { phase: 'lobby', round: null };
  ctx.players.forEach(p => { updates[`players/${p.id}/inGame`] = null; });
  return ctx.update(updates);
}

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

export function leaderboard(ctx, scores = {}, delta = {}) {
  const board = [...ctx.inGame].sort((a, b) => (scores[b.id] || 0) - (scores[a.id] || 0));
  return html`<div class="results">
    ${board.map((p, i) => html`<div class="result wobble">
      <span class="rank">${i + 1}</span>${avatar(p, 40)}
      <div class="result__body"><span><b>${p.name}${p.id === ctx.uid ? ' (you)' : ''}</b></span>
        ${delta[p.id] ? html`<small>+${delta[p.id]} this round</small>` : nothing}</div>
      <span class="result__votes">${scores[p.id] || 0}<small>pts</small></span>
    </div>`)}
  </div>`;
}

export const roundsField = (value, set, disabled) =>
  html`<label class="field"><span>Rounds</span>
    <select class="wobble" ?disabled=${disabled} @change=${e => set({ rounds: +e.target.value })}>
      ${[5, 8, 10, 12].map(n => html`<option value=${n} ?selected=${n === value}>${n} rounds</option>`)}
    </select></label>`;

export const secondsOptions = list => list.map(v => [v, v >= 60 && v % 60 === 0 ? `${v / 60} min` : `${v} seconds`]);

export function finalScores(ctx) {
  const scores = ctx.round.scores || {};
  const top = Math.max(0, ...ctx.inGame.map(p => scores[p.id] || 0));
  const winners = ctx.inGame.filter(p => (scores[p.id] || 0) === top && top > 0);
  return html`
    <h1 class="center scribble">${winners.length === 1 ? `${winners[0].name} wins!` : winners.length ? "It's a tie!" : 'Nobody scored!'}</h1>
    ${leaderboard(ctx, scores)}
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

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
    ${hostSkip(ctx, 'Skip to results', { phase: 'results', 'round/endsAt': null })}`;
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

export function resultsList(ctx, rows, { badge, detail }) {
  return html`<div class="results">
    ${rows.map(r => {
      const label = badge(r.player);
      return html`<div class="result wobble ${label ? 'result--marked' : ''}">
        ${avatar(r.player, 40)}
        <div class="result__body">
          <span><b>${r.player.name}${r.player.id === ctx.uid ? ' (you)' : ''}</b> ${label ? html`<span class="hl">${label}</span>` : nothing}</span>
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

import { ref, remove } from 'firebase/database';
import { html, nothing, button, timer, selectField, action, avatar, progress, toast } from '../ui.js';
import { db } from '../firebase.js';
import { shuffle } from '../room.js';
import { isTimeUp, pickUnused, leaderboard, finalScores, nextOrFinalButton, bumpStat, award, plural, voteStage } from './common.js';
import { cue } from '../sound.js';
import prompts from '../data/draw-off-prompts.json';
import '../draw/board.js';

// Draw Off: everyone draws the same silly prompt on their own board, then votes for their favourite.
// Each player's drawing lives on its own layer of the board (canvases/{room}/b/{playerId}).

const POINTS_PER_VOTE = 100;
const LABELS = 'ABCDEFGHIJKLMNOP';

const drawers = ctx => ctx.inGame;
const name = (ctx, id) => ctx.room.players[id]?.name || 'Someone';

function startVote(ctx, s) {
  const gallery = shuffle(drawers(ctx).map(p => p.id));
  return { phase: 'vote', 'round/gallery': gallery, 'round/votes': null, 'round/endsAt': ctx.now() + s.voteTime * 1000 };
}

function scoreRound(ctx) {
  const { round } = ctx;
  const delta = {};
  const updates = { phase: 'results', 'round/endsAt': null, 'round/revealAt': ctx.now() + 400 };
  Object.entries(round.votes || {}).forEach(([voter, target]) => {
    if (voter === target || !ctx.room.players[target]) return;
    delta[target] = (delta[target] || 0) + POINTS_PER_VOTE;
    bumpStat(updates, round, target, 'votes');
  });
  Object.entries(delta).forEach(([id, pts]) => { updates[`round/scores/${id}`] = (round.scores?.[id] || 0) + pts; });
  updates['round/delta'] = delta;
  return updates;
}

export default {
  id: 'draw-off',
  name: 'Draw Off',
  color: 'coral',
  canvas: true,
  players: '3–12',
  blurb: 'Everyone draws the same silly prompt. Vote for the best one.',
  rules: [
    'Everyone gets the same prompt, like "The worst superhero", and draws it at the same time.',
    "When time's up (or everyone's done), the drawings are shown without names.",
    "Vote for your favourite. You can't vote for your own!",
    `Every vote is worth ${POINTS_PER_VOTE} points. Most points at the end wins.`,
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="4" y="10" width="24" height="20" rx="2" fill="#fff" transform="rotate(-6 16 20)" />
    <rect x="34" y="8" width="24" height="20" rx="2" fill="#fff" transform="rotate(5 46 18)" />
    <path d="M10 24 q4 -8 8 -2 q3 4 6 -3" stroke="#d23c5f" />
    <path d="M40 20 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0" stroke="#3b82c4" />
    <path d="M32 50 l-4 -8 l8 0 z M32 42 v-6" fill="#ffd04d" />
    <path d="M26 36 l2 -3 M38 36 l-2 -3 M32 33 v-3" />
  </g></svg>`,

  defaults: () => ({ rounds: 3, drawTime: 90, voteTime: 45 }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    return html`
      ${selectField('Rounds', s.rounds, [[2, '2 rounds'], [3, '3 rounds'], [4, '4 rounds'], [5, '5 rounds']], v => set({ rounds: +v }), disabled)}
      ${selectField('Time to draw', s.drawTime, [[60, '1 min'], [90, '1½ min'], [120, '2 min'], [180, '3 min']], v => set({ drawTime: +v }), disabled)}
      ${selectField('Time to vote', s.voteTime, [[30, '30 seconds'], [45, '45 seconds'], [60, '1 min']], v => set({ voteTime: +v }), disabled)}`;
  },

  canStart: ctx => (ctx.players.length < 3 ? `Need ${3 - ctx.players.length} more to play` : null),

  start(ctx, s) {
    const prompt = pickUnused(prompts);
    return { phase: 'draw', round: { no: 1, total: s.rounds, prompt, used: { [prompt]: true }, scores: {}, endsAt: ctx.now() + s.drawTime * 1000 } };
  },

  tick(ctx, s) {
    const { round } = ctx;
    const { phase } = ctx.room;
    if (phase === 'draw' && (isTimeUp(ctx) || drawers(ctx).every(p => round.done?.[p.id]))) return startVote(ctx, s);
    if (phase === 'vote' && (isTimeUp(ctx) || drawers(ctx).every(p => round.votes?.[p.id]))) return scoreRound(ctx);
    return null;
  },

  view(ctx, s) {
    const { phase } = ctx.room;
    if (phase === 'final') {
      return finalScores(ctx, {
        awards: [
          award(ctx, 'votes', 'Crowd favourite', n => `Got ${plural(n, 'vote')} in total`),
        ],
      });
    }
    if (phase === 'draw') return drawing(ctx);
    if (phase === 'vote') return voting(ctx);
    return results(ctx, s);
  },
};

const promptCard = ctx => html`<div class="question wobble center"><small>Round ${ctx.round.no} of ${ctx.round.total} · Draw this</small>${prompts[ctx.round.prompt]}</div>`;

// A small read-only copy of someone's drawing.
const miniBoard = (ctx, id) => html`<sketch-board class="do-mini" room=${ctx.room.code} uid=${ctx.uid} layer=${id}
  .config=${{ tools: [], colors: false, sizes: false, opacity: false, undo: false, clear: false, stats: false, canDraw: false }}></sketch-board>`;

function drawing(ctx) {
  const { round } = ctx;
  const done = !!round.done?.[ctx.uid];
  const finished = drawers(ctx).filter(p => round.done?.[p.id]).length;
  cue(`do:${round.prompt}:start`, 'whoosh');
  return html`
    ${promptCard(ctx)}
    ${timer(round.endsAt, 10)}
    <sketch-board room=${ctx.room.code} uid=${ctx.uid} layer=${ctx.uid} .config=${{ stats: false, canDraw: !done && !isTimeUp(ctx) }}></sketch-board>
    ${done
      ? button('Keep drawing', action(() => ctx.update({ [`round/done/${ctx.uid}`]: null })), { kind: 'white' })
      : button("I'm done", action(() => ctx.update({ [`round/done/${ctx.uid}`]: true })))}
    ${progress(finished, drawers(ctx).length, 'are done')}`;
}

function voting(ctx) {
  const { round } = ctx;
  const mine = round.votes?.[ctx.uid];
  const voted = drawers(ctx).filter(p => round.votes?.[p.id]).length;
  const vote = id => {
    if (id === ctx.uid) return toast("That's yours! Vote for someone else's.");
    return ctx.update({ [`round/votes/${ctx.uid}`]: id });
  };
  return html`
    ${promptCard(ctx)}
    ${timer(round.endsAt, 10)}
    <h2 class="center">Vote for your favourite</h2>
    <div class="do-gallery">
      ${(round.gallery || []).filter(id => ctx.room.players[id]).map((id, i) => html`
        <button class="do-entry wobble ${mine === id ? 'do-entry--picked' : ''} ${id === ctx.uid ? 'do-entry--mine' : ''}" @click=${action(() => vote(id))}>
          ${miniBoard(ctx, id)}
          <span class="do-entry__label">${LABELS[i]}${id === ctx.uid ? html` <small>(yours)</small>` : nothing}${mine === id ? html` <small class="hl">your vote</small>` : nothing}</span>
        </button>`)}
    </div>
    ${progress(voted, drawers(ctx).length, 'have voted')}`;
}

function results(ctx, s) {
  const { round } = ctx;
  const counts = {};
  Object.entries(round.votes || {}).forEach(([voter, target]) => { if (voter !== target) counts[target] = (counts[target] || 0) + 1; });
  const ranked = [...(round.gallery || [])].filter(id => ctx.room.players[id]).sort((a, b) => (counts[b] || 0) - (counts[a] || 0));
  const best = Math.max(0, ...ranked.map(id => counts[id] || 0));
  // Uncover the drawings from fewest votes to most, like the vote reveals in other games.
  const rows = ranked.map(id => ({ player: { id }, voters: Array.from({ length: counts[id] || 0 }) }));
  const stage = voteStage(ctx, rows);

  const next = () => {
    remove(ref(db, `canvases/${ctx.room.code}`)).catch(() => {});
    const prompt = pickUnused(prompts, round.used);
    return ctx.update({
      phase: 'draw', 'round/no': round.no + 1, 'round/prompt': prompt, [`round/used/${prompt}`]: true,
      'round/done': null, 'round/votes': null, 'round/gallery': null, 'round/delta': null, 'round/revealAt': null,
      'round/endsAt': ctx.now() + s.drawTime * 1000,
    });
  };

  return html`
    ${promptCard(ctx)}
    <h1 class="center scribble ${stage.done ? 'pop-in' : ''}">${stage.done ? (best ? 'The votes are in!' : 'Nobody got a vote!') : 'Counting the votes…'}</h1>
    <div class="do-gallery do-gallery--results">
      ${ranked.map((id, i) => {
        const hidden = i < ranked.length - stage.shown;
        const top = stage.done && best > 0 && (counts[id] || 0) === best;
        return html`<div class="do-entry wobble ${hidden ? 'result--hidden' : 'result--reveal'} ${top ? 'do-entry--winner' : ''}">
          ${miniBoard(ctx, id)}
          <span class="do-entry__label">${avatar(ctx.room.players[id], 22, top ? 'happy' : null)} ${name(ctx, id)}
            <b>${counts[id] || 0} ${(counts[id] || 0) === 1 ? 'vote' : 'votes'}</b>${top ? html` <span class="hl stamp">winner</span>` : nothing}</span>
        </div>`;
      })}
    </div>
    ${stage.done ? html`
      <h2 class="section-title">Scores</h2>
      ${leaderboard(ctx, round.scores, round.delta)}
      <div class="push"></div>
      ${nextOrFinalButton(ctx, round, next)}` : nothing}`;
}

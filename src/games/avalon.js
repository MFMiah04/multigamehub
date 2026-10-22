import { html, svg, nothing } from 'lit-html';
import { button, action, avatar, playerTag, confirmDialog } from '../ui.js';
import { cue } from '../sound.js';
import { shuffle } from '../room.js';
import { backToLobbyButton, endScreen, endTitle, sideResult } from './common.js';

// ----- the original game's numbers -----

const EVIL_COUNT = { 5: 2, 6: 2, 7: 3, 8: 3, 9: 3, 10: 4 };
const TEAM_SIZES = {
  5: [2, 3, 2, 3, 3], 6: [2, 3, 4, 3, 4], 7: [2, 3, 3, 4, 4],
  8: [3, 4, 4, 5, 5], 9: [3, 4, 4, 5, 5], 10: [3, 4, 4, 5, 5],
};
const needsTwoFails = (playerCount, quest) => quest === 4 && playerCount >= 7;
const CARD_GAP_MS = 1600;

// ----- roles, each with a little doodle -----

const g = (...parts) => svg`<g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">${parts}</g>`;
const ROLES = {
  merlin: { name: 'Merlin', team: 'good', blurb: 'You know who is Evil. Guide the Good team, but stay hidden: if the Assassin finds you, Evil wins.',
    art: g(svg`<path d="M10 40 L24 6 L38 40 Z" fill="#a8d4f7" />`, svg`<path d="M6 40 h36" />`, svg`<path d="M22 22 l2 -4 l2 4 l4 1 l-3 3 l1 4 l-4 -2 l-4 2 l1 -4 l-3 -3 z" fill="#ffe066" stroke-width="1.6" />`) },
  percival: { name: 'Percival', team: 'good', blurb: 'You know who Merlin is (and Morgana, who looks like Merlin to you). Protect Merlin.',
    art: g(svg`<path d="M10 8 h28 v14 c0 12 -8 18 -14 20 c-6 -2 -14 -8 -14 -20 z" fill="#b4f8c8" />`, svg`<path d="M24 12 v24 M14 22 h20" />`) },
  servant: { name: 'Loyal Knight', team: 'good', blurb: "You're on the Good team. Work out who to trust and get three quests to succeed.",
    art: g(svg`<path d="M12 40 v-18 c0 -10 6 -15 12 -15 s12 5 12 15 v18 z" fill="#d8d2c4" />`, svg`<path d="M16 24 h16 M24 24 v10" stroke-width="3" />`, svg`<path d="M24 7 c4 -4 8 -4 10 -2" />`) },
  assassin: { name: 'Assassin', team: 'evil', blurb: 'You are Evil. If Good wins three quests, you get one guess at who Merlin is. Guess right and Evil wins.',
    art: g(svg`<path d="M24 4 l5 22 h-10 z" fill="#fff" />`, svg`<path d="M14 26 h20" stroke-width="3" />`, svg`<path d="M24 26 v10" stroke-width="4" />`, svg`<circle cx="24" cy="40" r="3" fill="#ffaebc" />`) },
  morgana: { name: 'Morgana', team: 'evil', blurb: 'You are Evil, and to Percival you look just like Merlin. Use it.',
    art: g(svg`<circle cx="24" cy="26" r="12" fill="#c3b1e1" />`, svg`<path d="M14 40 h20 l-3 -4 h-14 z" fill="#fff" />`, svg`<path d="M19 22 q3 -4 6 -1" stroke="#fff" />`) },
  mordred: { name: 'Mordred', team: 'evil', blurb: "You are Evil, and Merlin doesn't know about you.",
    art: g(svg`<path d="M8 36 L10 14 L18 24 L24 10 L30 24 L38 14 L40 36 Z" fill="#5a5650" />`, svg`<circle cx="24" cy="30" r="2.5" fill="#ffaebc" stroke="none" />`) },
  oberon: { name: 'Oberon', team: 'evil', blurb: "You are Evil, but the other Evil players don't know you, and you don't know them.",
    art: g(svg`<path d="M6 20 C14 12 22 14 24 18 C26 14 34 12 42 20 C40 30 32 32 28 29 C26 28 25 26 24 25 C23 26 22 28 20 29 C16 32 8 30 6 20 Z" fill="#fff" />`, svg`<path d="M12 22 q4 -3 8 0 q-4 3 -8 0 Z M28 22 q4 -3 8 0 q-4 3 -8 0 Z" fill="#222" />`) },
  minion: { name: 'Minion of Mordred', team: 'evil', blurb: 'You are Evil. Get three quests to fail without being found out.',
    art: g(svg`<path d="M12 18 l-4 -12 l9 8 M36 18 l4 -12 l-9 8" fill="#ffaebc" />`, svg`<path d="M10 28 c0 -10 6 -14 14 -14 s14 4 14 14 s-6 12 -14 12 s-14 -2 -14 -12 z" fill="#b8e0a0" />`, svg`<path d="M17 26 l4 2 M31 26 l-4 2 M19 34 q5 3 10 0" />`) },
};
const roleArt = (role, size = 48) => html`<svg class="role-art" width=${size} height=${size} viewBox="0 0 48 48" aria-hidden="true">${ROLES[role].art}</svg>`;
const isEvil = role => ROLES[role]?.team === 'evil';

// ----- helpers -----

const present = (ctx, ids) => (ids || []).filter(id => ctx.room.players[id]);
const leaderId = ctx => {
  const order = present(ctx, ctx.round.order);
  return order[(ctx.round.leaderIdx || 0) % order.length];
};
const teamSize = ctx => TEAM_SIZES[Math.min(10, Math.max(5, ctx.round.playerCount))][ctx.round.quest - 1];
const teamOf = ctx => Object.keys(ctx.round.team || {}).filter(id => ctx.room.players[id]);
const questCount = (round, result) => Object.values(round.quests || {}).filter(r => r === result).length;

// What a player is told about everyone else at the start.
function knowledge(ctx, id) {
  const roles = ctx.round.roles || {};
  const others = Object.keys(roles).filter(o => o !== id && ctx.room.players[o]);
  const name = o => ctx.room.players[o];
  switch (roles[id]) {
    case 'merlin': return { label: 'These players are Evil:', players: others.filter(o => isEvil(roles[o]) && roles[o] !== 'mordred').map(name) };
    case 'percival': {
      // Sorted by name so the list doesn't give away which one is really Merlin.
      const candidates = others.filter(o => ['merlin', 'morgana'].includes(roles[o])).map(name).sort((a, b) => a.name.localeCompare(b.name));
      return { label: candidates.length > 1 ? 'One of these is Merlin (the other is Morgana):' : 'This is Merlin:', players: candidates };
    }
    case 'oberon': case 'servant': return null;
    default: return isEvil(roles[id]) ? { label: 'Your fellow Evil players:', players: others.filter(o => isEvil(roles[o]) && roles[o] !== 'oberon').map(name) } : null;
  }
}

function nextLeaderUpdates(ctx) {
  return { 'round/leaderIdx': (ctx.round.leaderIdx || 0) + 1, 'round/team': null, 'round/votes': null };
}

export default {
  id: 'avalon',
  name: 'Avalon',
  color: 'gold',
  players: '5–10',
  blurb: 'Loyal knights versus hidden traitors on five quests.',
  rules: [
    'Everyone is secretly Good or Evil. The Evil players know who each other are. Merlin knows who Evil is, but must stay hidden.',
    'Each round, the leader picks a team for a quest, then everyone secretly votes to approve or reject it. If 5 teams in a row are rejected, Evil wins.',
    'The team secretly plays Success or Fail cards. One Fail and the quest fails (the 4th quest needs two Fails with 7+ players).',
    'Three failed quests and Evil wins. Three successes and Good is about to win, but the Assassin gets one guess at Merlin to steal it.',
  ],
  art: html`<svg class="art" viewBox="0 0 64 56" aria-hidden="true"><g fill="none" stroke="#222" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 50 V24 h8 v-6 h6 v6 h6 v-6 h6 v6 h6 v-6 h6 v6 h6 v26 Z" fill="#fff" />
    <path d="M28 50 v-10 a4 4 0 0 1 8 0 v10" fill="#d8d2c4" />
    <path d="M18 32 h4 M42 32 h4" />
    <path d="M32 18 V4 l10 4 l-10 4" fill="#ff8fab" />
  </g></svg>`,

  defaults: () => ({ percival: false, morgana: false, mordred: false, oberon: false }),

  settingsView(ctx, s, set) {
    const disabled = !ctx.isHost;
    const toggle = (key, label) => html`<label class="toggle"><input type="checkbox" .checked=${!!s[key]} ?disabled=${disabled}
      @change=${e => set({ [key]: e.target.checked })}> ${label}</label>`;
    return html`<div class="field"><span>Extra roles (Merlin and the Assassin are always in)</span>
      <div class="toggles">
        ${toggle('percival', 'Percival (Good): knows who Merlin is')}
        ${toggle('morgana', 'Morgana (Evil): looks like Merlin to Percival')}
        ${toggle('mordred', 'Mordred (Evil): hidden from Merlin')}
        ${toggle('oberon', "Oberon (Evil): unknown to the other Evil players")}
      </div></div>`;
  },

  canStart(ctx, s) {
    const n = ctx.players.length;
    if (n < 5) return `Need ${5 - n} more to play`;
    if (n > 10) return 'Avalon is for up to 10 players';
    const evilExtras = ['morgana', 'mordred', 'oberon'].filter(k => s[k]).length;
    if (evilExtras > EVIL_COUNT[n] - 1) return `Too many Evil roles for ${n} players`;
    return null;
  },

  start(ctx, s) {
    const ids = shuffle(ctx.players.map(p => p.id));
    const n = ids.length;
    const evil = ['assassin', ...['morgana', 'mordred', 'oberon'].filter(k => s[k])];
    while (evil.length < EVIL_COUNT[n]) evil.push('minion');
    const good = ['merlin', ...(s.percival ? ['percival'] : [])];
    while (good.length < n - EVIL_COUNT[n]) good.push('servant');
    const deck = shuffle([...evil, ...good]);
    return {
      phase: 'propose',
      round: {
        roles: Object.fromEntries(ids.map((id, i) => [id, deck[i]])),
        order: shuffle(ids), leaderIdx: 0, quest: 1, rejects: 0, playerCount: n,
      },
    };
  },

  tick(ctx) {
    const { round } = ctx;
    const { phase } = ctx.room;
    const players = present(ctx, round.order);

    if (phase === 'teamvote' && players.every(id => round.votes?.[id] !== undefined)) {
      const approvals = players.filter(id => round.votes[id]).length;
      const approved = approvals > players.length / 2; // a tie is a rejection
      const lastVote = { team: round.team, votes: round.votes, approved, leader: leaderId(ctx), quest: round.quest };
      if (approved) return { phase: 'quest', 'round/lastVote': lastVote, 'round/plays': null, 'round/rejects': 0 };
      const rejects = (round.rejects || 0) + 1;
      if (rejects >= 5) return { phase: 'over', 'round/lastVote': lastVote, 'round/rejects': rejects, 'round/winner': 'evil', 'round/reason': 'rejects' };
      return { phase: 'propose', 'round/lastVote': lastVote, 'round/rejects': rejects, ...nextLeaderUpdates(ctx) };
    }

    if (phase === 'quest') {
      const team = teamOf(ctx);
      if (team.length && team.every(id => round.plays?.[id])) {
        const cards = shuffle(team.map(id => round.plays[id]));
        const fails = cards.filter(c => c === 'F').length;
  if (round.revealAt && shown > 0) cue(`av:${round.revealAt}:${shown}`, cards[shown - 1] === 'F' ? 'buzz' : 'pop', { at: round.revealAt + (shown - 1) * CARD_GAP_MS, now: ctx.now() });
  if (round.revealAt && done) cue(`av:${round.revealAt}:done`, round.questFailed ? 'sad' : 'ding');
        const failed = fails >= (needsTwoFails(round.playerCount, round.quest) ? 2 : 1);
        return { phase: 'reveal', 'round/cards': cards, 'round/questFailed': failed, 'round/revealAt': ctx.now() + 1200, 'round/plays': null };
      }
    }
    return null;
  },

  view(ctx) {
    const views = { propose, teamvote, quest, reveal, assassin, over };
    return html`${questTrack(ctx)}${views[ctx.room.phase]?.(ctx) ?? nothing}`;
  },
};

// ----- shared pieces -----

function questTrack(ctx) {
  const { round } = ctx;
  const sizes = TEAM_SIZES[Math.min(10, Math.max(5, round.playerCount))];
  return html`<div class="quests">
    ${sizes.map((size, i) => {
      const q = i + 1;
      const result = round.quests?.[q];
      return html`<span class="quest wobble ${result ? `quest--${result}` : ''} ${q === round.quest && !result ? 'quest--current' : ''}"
        title="Quest ${q}: team of ${size}${needsTwoFails(round.playerCount, q) ? ', needs 2 fails' : ''}">
        ${result === 'success' ? '✓' : result === 'fail' ? '✗' : size}${needsTwoFails(round.playerCount, q) && !result ? html`<sup>*</sup>` : nothing}
      </span>`;
    })}
  </div>
  <p class="note center">${round.rejects ? html`Rejected teams in a row: <b>${round.rejects} of 5</b>` : 'Five quests. Three wins takes it.'}</p>`;
}

// Whether your role card is showing. Kept for the whole game (not reset each stage),
// so it only ever changes when you tap it.
const roleShown = { game: null, shown: false };

function roleCard(ctx) {
  const role = ctx.round.roles?.[ctx.uid];
  if (!role) return nothing;
  if (roleShown.game !== ctx.round.id) Object.assign(roleShown, { game: ctx.round.id, shown: false });
  const known = knowledge(ctx, ctx.uid);
  const toggle = () => { roleShown.shown = !roleShown.shown; ctx.rerender(); };
  return html`<button class="role-card wobble ${roleShown.shown ? '' : 'role-card--hidden'} ${isEvil(role) ? 'role-card--evil' : 'role-card--good'}"
    aria-pressed=${roleShown.shown} @click=${toggle}>
    ${!roleShown.shown ? html`<b>Tap to see your role</b><small>Keep your screen hidden!</small>` : html`
      ${roleArt(role)}
      <span class="role-card__text">
        <b>${ROLES[role].name}</b> <span class="hl ${isEvil(role) ? 'hl--pink' : ''}">${isEvil(role) ? 'Evil' : 'Good'}</span>
        <small>${ROLES[role].blurb}</small>
        ${known ? html`<small><b>${known.label}</b> ${known.players.length ? known.players.map(p => p.name).join(', ') : 'nobody'}</small>` : nothing}
        <small class="role-card__hint">Tap to hide</small>
      </span>`}
  </button>`;
}

function lastVoteResult(ctx) {
  const vote = ctx.round.lastVote;
  if (!vote || vote.quest !== ctx.round.quest) return nothing;
  const team = Object.keys(vote.team || {}).map(id => ctx.room.players[id]?.name).filter(Boolean);
  return html`<div class="vote-result wobble ${vote.approved ? 'vote-result--yes' : 'vote-result--no'}">
    <b>${vote.approved ? 'Team approved!' : 'Team rejected!'}</b>
    <small>${ctx.room.players[vote.leader]?.name || 'The leader'} picked ${team.join(', ')}</small>
    <div class="vote-result__votes">
      ${Object.entries(vote.votes || {}).map(([id, yes]) => ctx.room.players[id] ? html`<span class="tag wobble ${yes ? 'tag--yes' : 'tag--no'}">${avatar(ctx.room.players[id], 20)} ${ctx.room.players[id].name} <b>${yes ? '✓' : '✗'}</b></span>` : nothing)}
    </div>
  </div>`;
}

// ----- phases -----

function propose(ctx) {
  const { round, local } = ctx;
  const leader = ctx.room.players[leaderId(ctx)];
  const size = teamSize(ctx);
  const isLeader = ctx.uid === leaderId(ctx);
  local.picks ??= new Set();
  const toggle = id => {
    if (local.picks.has(id)) local.picks.delete(id);
    else if (local.picks.size < size) local.picks.add(id);
    ctx.rerender();
  };
  const submit = () => ctx.update({ phase: 'teamvote', 'round/team': Object.fromEntries([...local.picks].map(id => [id, true])), 'round/votes': null });

  return html`
    ${lastVoteResult(ctx)}
    ${roleCard(ctx)}
    <h2 class="center">Quest ${round.quest}: team of ${size}</h2>
    ${isLeader
      ? html`<p class="note center">You're the leader! Pick ${size} players to go on the quest (you can pick yourself).</p>
        <div class="vote-grid">
          ${present(ctx, round.order).map(id => {
            const p = ctx.room.players[id];
            return html`<button class="vote-card wobble ${local.picks.has(id) ? 'vote-card--picked' : ''}" @click=${() => toggle(id)}>
              ${avatar(p, 48)}<b>${p.name}${id === ctx.uid ? ' (you)' : ''}</b></button>`;
          })}
        </div>
        ${button(local.picks.size === size ? 'Propose this team' : `Pick ${size - local.picks.size} more`, action(submit), { disabled: local.picks.size !== size })}`
      : html`<div class="waiting-card wobble">${avatar(leader, 28)}<b>${leader?.name || 'The leader'} is picking a team</b><small>Tell them who you trust (or don't!).</small></div>`}`;
}

function teamvote(ctx) {
  const { round } = ctx;
  const leader = ctx.room.players[leaderId(ctx)];
  const team = teamOf(ctx).map(id => ctx.room.players[id]);
  const mine = round.votes?.[ctx.uid];
  const voted = present(ctx, round.order).filter(id => round.votes?.[id] !== undefined).length;
  const vote = yes => ctx.update({ [`round/votes/${ctx.uid}`]: yes });
  return html`
    ${roleCard(ctx)}
    <h2 class="center">${leader?.name || 'The leader'} wants to send:</h2>
    <div class="nc-others">${team.map(p => playerTag(p, { you: p.id === ctx.uid }))}</div>
    <p class="note center">Votes stay secret until everyone has voted. A tie counts as a rejection.</p>
    <div class="row">
      ${button(mine === true ? 'Approved ✓' : 'Approve', action(() => vote(true)), { kind: mine === true ? 'mint' : 'white' })}
      ${button(mine === false ? 'Rejected ✗' : 'Reject', action(() => vote(false)), { kind: mine === false ? 'pink' : 'white' })}
    </div>
    <p class="note center">${voted} of ${present(ctx, round.order).length} have voted${mine !== undefined ? '. You can still change yours.' : ''}</p>`;
}

function quest(ctx) {
  const { round } = ctx;
  const team = teamOf(ctx);
  const onTeam = team.includes(ctx.uid);
  const mine = round.plays?.[ctx.uid];
  const played = team.filter(id => round.plays?.[id]).length;
  const play = card => ctx.update({ [`round/plays/${ctx.uid}`]: card });
  return html`
    ${lastVoteResult(ctx)}
    ${roleCard(ctx)}
    <h2 class="center">Quest ${round.quest} is underway</h2>
    ${onTeam
      ? html`<p class="note center">You're on the quest. Secretly choose your card. Nobody will see who played what.</p>
        <div class="quest-cards">
          <button class="quest-card quest-card--success wobble ${mine === 'S' ? 'quest-card--picked' : ''}" @click=${action(() => play('S'))}>✓<small>Success</small></button>
          <button class="quest-card quest-card--fail wobble ${mine === 'F' ? 'quest-card--picked' : ''}" @click=${action(() => play('F'))}>✗<small>Fail</small></button>
        </div>
        ${mine ? html`<p class="note center">Card chosen. You can still swap until everyone's played.</p>` : nothing}`
      : html`<div class="waiting-card wobble"><b>The team is on the quest…</b><small>${team.map(id => ctx.room.players[id]?.name).join(', ')}</small></div>`}
    <p class="note center">${played} of ${team.length} cards played</p>`;
}

function reveal(ctx) {
  const { round } = ctx;
  const cards = round.cards || [];
  const elapsed = ctx.now() - (round.revealAt || 0);
  const shown = Math.max(0, Math.min(cards.length, Math.floor(elapsed / CARD_GAP_MS) + 1));
  const done = elapsed > cards.length * CARD_GAP_MS + 600;
  const fails = cards.filter(c => c === 'F').length;

  const carryOn = () => {
    const quests = { ...(round.quests || {}), [round.quest]: round.questFailed ? 'fail' : 'success' };
    const tally = { quests };
    const failsTotal = questCount(tally, 'fail');
    const winsTotal = questCount(tally, 'success');
    const base = { [`round/quests/${round.quest}`]: quests[round.quest], 'round/cards': null, 'round/revealAt': null, 'round/lastVote': null };
    if (failsTotal >= 3) return ctx.update({ ...base, phase: 'over', 'round/winner': 'evil', 'round/reason': 'quests' });
    if (winsTotal >= 3) return ctx.update({ ...base, phase: 'assassin' });
    return ctx.update({ ...base, phase: 'propose', 'round/quest': round.quest + 1, ...nextLeaderUpdates(ctx) });
  };

  return html`
    <h2 class="center">Quest ${round.quest} results</h2>
    <div class="quest-cards">
      ${cards.map((c, i) => i < shown
        ? html`<span class="quest-card quest-card--flipped quest-card--${c === 'F' ? 'fail' : 'success'} wobble">${c === 'F' ? '✗' : '✓'}<small>${c === 'F' ? 'Fail' : 'Success'}</small></span>`
        : html`<span class="quest-card quest-card--back wobble">?</span>`)}
    </div>
    ${done
      ? html`<h1 class="center scribble">${round.questFailed ? 'Quest failed!' : 'Quest succeeded!'}</h1>
        <p class="note center">${fails === 0 ? 'Every card was a Success.' : `${fails} Fail card${fails === 1 ? '' : 's'} played${!round.questFailed ? ', but this quest needed two' : ''}.`}</p>
        <div class="push"></div>
        ${ctx.isHost ? button('Carry on', action(carryOn)) : html`<p class="note center">Waiting for the host…</p>`}`
      : html`<p class="note center">Revealing the cards…</p>`}`;
}

function assassin(ctx) {
  const { round } = ctx;
  const roles = round.roles || {};
  const assassinId = Object.keys(roles).find(id => roles[id] === 'assassin');
  const assassinPlayer = ctx.room.players[assassinId];
  const evilPlayers = Object.keys(roles).filter(id => isEvil(roles[id]) && ctx.room.players[id]).map(id => ctx.room.players[id]);
  const targets = present(ctx, round.order).filter(id => !isEvil(roles[id]));
  const strike = async id => {
    if (!(await confirmDialog(`Is ${ctx.room.players[id]?.name} Merlin?`, 'Strike', 'pink'))) return;
    await ctx.update({ phase: 'over', 'round/target': id, 'round/winner': roles[id] === 'merlin' ? 'evil' : 'good', 'round/reason': 'assassin' });
  };
  return html`
    <h1 class="center scribble">Good won three quests!</h1>
    <p class="note center">But it's not over. Evil, reveal yourselves: ${evilPlayers.map(p => p.name).join(', ')}.</p>
    ${ctx.uid === assassinId || !assassinPlayer
      ? html`<h2 class="center">Assassin, who is Merlin?</h2>
        <div class="vote-grid">
          ${targets.map(id => html`<button class="vote-card wobble" @click=${action(() => strike(id))}>${avatar(ctx.room.players[id], 48)}<b>${ctx.room.players[id].name}</b></button>`)}
        </div>`
      : html`<div class="waiting-card wobble">${avatar(assassinPlayer, 28)}<b>${assassinPlayer.name} is the Assassin</b><small>Evil can talk it over. One guess at Merlin decides the game.</small></div>`}`;
}

function over(ctx) {
  const { round } = ctx;
  const roles = round.roles || {};
  const goodWins = round.winner === 'good';
  const target = ctx.room.players[round.target];
  const why = {
    rejects: 'Five teams in a row were rejected.',
    quests: 'Three quests failed.',
    assassin: goodWins ? `The Assassin struck ${target?.name || 'the wrong player'}, who wasn't Merlin!` : `The Assassin found Merlin: ${target?.name}!`,
  }[round.reason] || '';
  const everyone = Object.keys(roles).filter(id => ctx.room.players[id]).sort((a, b) => Number(isEvil(roles[a])) - Number(isEvil(roles[b])));
  const win = sideResult(ctx, id => (roles[id] ? isEvil(roles[id]) !== goodWins : null));
  return html`
    ${endScreen(ctx, { win, title: endTitle(win, { won: 'Victory!', lost: 'Defeat!', watching: goodWins ? 'Good wins!' : 'Evil wins!' }), note: `${goodWins ? 'Good wins!' : 'Evil wins!'} ${why}` })}
    <h1 class="center scribble">${goodWins ? 'Good wins!' : 'Evil wins!'}</h1>
    <p class="note center">${why}</p>
    <div class="role-list">
      ${everyone.map(id => html`<div class="result wobble ${isEvil(roles[id]) ? 'result--marked' : 'result--truth'}">
        ${roleArt(roles[id], 40)}
        <div class="result__body"><span><b>${ctx.room.players[id].name}${id === ctx.uid ? ' (you)' : ''}</b></span><small>${ROLES[roles[id]].name}</small></div>
        ${avatar(ctx.room.players[id], 34)}
      </div>`)}
    </div>
    <div class="push"></div>
    ${ctx.isHost ? button('Play again', action(ctx.startGame)) : nothing}
    ${backToLobbyButton(ctx)}`;
}

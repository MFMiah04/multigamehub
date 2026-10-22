import { render } from 'lit-html';
import { soundControl } from './sound.js';
import { reactionBar, reactionLayer } from './reactions.js';
import { onValue, get, update } from 'firebase/database';
import { signIn, serverNow } from './firebase.js';
import { roomRef, createRoom, joinRoom, leaveRoom, trackPresence, stopPresence, sortedPlayers, claimHostIfNeeded, touchRoom } from './room.js';
import { html, nothing, toast, confirmDialog, action, avatar } from './ui.js';
import { games } from './games/index.js';
import { backToLobby } from './games/common.js';
import { homeView, homeState } from './screens/home.js';
import { lobbyView, copyCode, copyInviteLink } from './screens/lobby.js';
import './styles.css';

const app = document.getElementById('app');
const state = { uid: null, code: null, room: null, loading: true, rejoin: null };
// The room you were last in, so closing the tab doesn't strand you.
const LAST_ROOM_KEY = 'mgh:lastRoom';
let stopRoom = null;
let stopPresenceTracking = null;
let leaving = false;

// Per-screen scratch state (typed text, picks, toggles). Reset whenever the screen changes.
let local = {};
let localKey = '';
let lastAutoUpdate = '';
let lastHeartbeat = 0;
const HEARTBEAT_MS = 5 * 60 * 1000;

async function boot() {
  try {
    state.uid = await signIn();
    app.replaceChildren(); // drop the static loading message before lit-html takes over
  } catch (err) {
    app.replaceChildren();
    console.error(err);
    render(html`<main class="page"><h1 class="logo">Oops</h1><p>Couldn't connect. Check your internet and refresh.</p></main>`, app);
    return;
  }
  const code = new URLSearchParams(location.search).get('room')?.toUpperCase();
  state.loading = false;
  if (code && /^[A-Z]{4}$/.test(code)) {
    const already = (await get(roomRef(code, `players/${state.uid}`))).exists();
    if (already) return enterRoom(code);
    homeState.joining = true;
    homeState.code = code;
  }
  rerender();
  if (!code) checkLastRoom();
}

// If you closed the tab while in a room and you're still in it, offer a way back.
async function checkLastRoom() {
  let code = null;
  try { code = localStorage.getItem(LAST_ROOM_KEY); } catch { /* no storage */ }
  if (!code || !/^[A-Z]{4}$/.test(code)) return;
  try {
    const [me, game, phase] = await Promise.all(['players/' + state.uid, 'game', 'phase'].map(path => get(roomRef(code, path))));
    if (!me.exists()) return forgetLastRoom();
    if (state.room) return;
    state.rejoin = { code, where: phase.val() === 'lobby' ? 'in the lobby' : games[game.val()]?.name ? `playing ${games[game.val()].name}` : null };
    rerender();
  } catch { /* the room may have been cleaned up */ }
}

function forgetLastRoom() {
  state.rejoin = null;
  try { localStorage.removeItem(LAST_ROOM_KEY); } catch { /* no storage */ }
}

function enterRoom(code) {
  state.code = code;
  state.rejoin = null;
  try { localStorage.setItem(LAST_ROOM_KEY, code); } catch { /* no storage */ }
  history.replaceState(null, '', `/?room=${code}`);
  stopPresenceTracking = trackPresence(code, state.uid);
  stopRoom = onValue(roomRef(code), snap => {
    const room = snap.val();
    if (!room || !room.players?.[state.uid]) {
      const message = leaving ? null : !room ? 'That room has closed.' : room.kicked?.[state.uid] ? 'The host removed you from the room.' : 'You left the room.';
      return exitRoom(message);
    }
    state.room = { ...room, code };
    rerender();
  });
}

function exitRoom(message) {
  forgetLastRoom();
  stopRoom?.();
  stopPresenceTracking?.();
  if (state.code) stopPresence(state.code, state.uid);
  Object.assign(state, { code: null, room: null });
  leaving = false;
  homeState.joining = false;
  history.replaceState(null, '', '/');
  rerender();
  if (message) toast(message);
}

function makeCtx() {
  const room = state.room;
  const players = sortedPlayers(room);
  const game = games[room.game] || null;
  const round = room.round || {};
  const key = `${room.game}:${room.phase}:${round.id}:${round.no}`;
  if (key !== localKey) { local = {}; localKey = key; }

  const ctx = {
    room, players, game, round, local,
    uid: state.uid,
    me: room.players[state.uid],
    isHost: room.hostId === state.uid,
    settings: game ? { ...game.defaults({ room }), ...room.settings?.[game.id] } : {},
    inGame: players.filter(p => p.inGame),
    now: serverNow,
    rerender,
    update: changes => update(roomRef(room.code), changes),
    share: () => copyInviteLink(room.code),
    copyCode: () => copyCode(room.code),
  };
  ctx.startGame = () => {
    const changes = game.start(ctx, ctx.settings);
    changes.round = { ...changes.round, id: Date.now() };
    players.forEach(p => { changes[`players/${p.id}/inGame`] = true; });
    return ctx.update(changes);
  };
  return ctx;
}

// Timed or automatic phase changes. The host drives them; everyone else just watches.
function runAutomaticUpdates(ctx) {
  claimHostIfNeeded(ctx.room, ctx.uid);
  // Heartbeat so a room with people in it is never cleaned up as abandoned.
  if (ctx.isHost && Date.now() - lastHeartbeat > HEARTBEAT_MS) { lastHeartbeat = Date.now(); touchRoom(ctx.room); }
  if (!ctx.game || ctx.room.phase === 'lobby' || !ctx.me.inGame) return;
  const own = ctx.game.clientTick?.(ctx, ctx.settings);
  if (own) ctx.update(own);
  if (!ctx.isHost) return;
  const changes = ctx.game.tick?.(ctx, ctx.settings);
  if (!changes) return;
  // Don't fire the same change twice while waiting for Firebase to echo it back.
  const signature = localKey + JSON.stringify(changes);
  if (signature === lastAutoUpdate) return;
  lastAutoUpdate = signature;
  ctx.update(changes).catch(err => { console.error(err); lastAutoUpdate = ''; });
}

function rerender() {
  if (state.loading) return;
  if (!state.room) {
    render(homeView({
      rerender,
      rejoin: state.rejoin,
      onRejoin: () => enterRoom(state.rejoin.code),
      onForget: () => { forgetLastRoom(); rerender(); },
      onHost: async (name, look) => enterRoom(await createRoom(state.uid, name, look)),
      onJoin: async (code, name, look) => {
        const problem = await joinRoom(code, state.uid, name, look);
        if (problem) return toast(problem);
        enterRoom(code);
      },
    }), app);
    return;
  }
  const ctx = makeCtx();
  render(roomView(ctx), app);
  runAutomaticUpdates(ctx);
}

function roomView(ctx) {
  const { room, game } = ctx;
  const inLobby = room.phase === 'lobby' || !game;
  let body;
  if (inLobby) body = lobbyView(ctx);
  else if (!ctx.me.inGame) body = waitingView(ctx);
  else body = game.view(ctx, ctx.settings);

  return html`
    <main class="page room ${game && !inLobby ? `room--${game.color}` : ''}">
      ${roomHeader(ctx, inLobby)}
      ${body}
    </main>
    ${reactionLayer(ctx)}
    ${reactionBar(ctx)}`;
}

function roomHeader(ctx, inLobby) {
  const leave = async () => {
    if (!(await confirmDialog('Leave this room?', 'Leave'))) return;
    leaving = true;
    await leaveRoom(ctx.room, ctx.uid);
  };
  const endGame = async () => {
    if (await confirmDialog('End the game for everyone and go back to the lobby?', 'End game')) await backToLobby(ctx);
  };
  return html`<header class="room-header">
    <button class="room-header__code" @click=${ctx.copyCode} title="Copy room code">${inLobby ? 'Lobby' : ctx.game.name} · <b>${ctx.room.code}</b></button>
    <span class="room-header__actions">
      ${soundControl(ctx.rerender)}
      ${!inLobby && ctx.isHost ? html`<button class="link" @click=${action(endGame)}>End game</button>` : nothing}
      <button class="link" @click=${action(leave)}>Leave</button>
    </span>
  </header>`;
}

function waitingView(ctx) {
  return html`<div class="waiting">
    <h2 class="center">A round of ${ctx.game.name} is in progress</h2>
    <p class="note center">Sit tight. You'll be in the next one.</p>
    <div class="lineup">${ctx.inGame.map(p => html`<div class="lineup__player">${avatar(p, 34)}<span>${p.name}</span></div>`)}</div>
  </div>`;
}

// Keep timers ticking and catch time-based phase changes.
setInterval(() => { if (state.room) rerender(); }, 500);

boot();

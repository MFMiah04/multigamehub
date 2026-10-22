import { ref, get, set, update, onValue, onDisconnect, serverTimestamp, runTransaction, query, orderByValue, endAt, limitToFirst } from 'firebase/database';
import { db, serverNow } from './firebase.js';

const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const HOST_GRACE_MS = 15000;
// Rooms with no activity for this long get cleaned up (see sweepStaleRooms and database.rules.json).
export const STALE_MS = 30 * 60 * 1000;

export const roomRef = (code, path = '') => ref(db, `rooms/${code}${path ? '/' + path : ''}`);

export const randomItem = list => list[Math.floor(Math.random() * list.length)];
export function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function newPlayer(name, look) {
  return { name, look, joinedAt: serverTimestamp(), online: true };
}

export async function createRoom(uid, name, look) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from({ length: 4 }, () => randomItem(CODE_LETTERS)).join('');
    if ((await get(roomRef(code))).exists()) continue;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(36).padStart(2, '0')).join('');
    await update(ref(db), {
      [`rooms/${code}`]: { hostId: uid, createdAt: serverTimestamp(), phase: 'lobby', game: null, token, players: { [uid]: newPlayer(name, look) } },
      [`roomTokens/${token}`]: code,
      [`roomIndex/${token}`]: serverTimestamp(),
    });
    sweepStaleRooms();
    return code;
  }
  throw new Error('Could not find a free room code');
}

// Returns null on success, or a message explaining why the player can't join.
export async function joinRoom(code, uid, name, look) {
  const snap = await get(roomRef(code));
  if (!snap.exists()) return "That room doesn't exist. Check the code?";
  const room = snap.val();
  if (room.kicked?.[uid]) return 'The host removed you from this room.';
  const players = room.players || {};
  if (players[uid]) {
    await update(roomRef(code, `players/${uid}`), { name, look, online: true });
    return null;
  }
  if (Object.keys(players).length >= 16) return 'That room is full.';
  await set(roomRef(code, `players/${uid}`), newPlayer(name, look));
  touchRoom(room);
  return null;
}

// ----- tidying up abandoned rooms -----
// Each room gets a random token. roomIndex/{token} holds when the room was last active, and the
// host's browser refreshes it every few minutes while anyone's connected. When someone creates a
// room, their browser looks for tokens that have been quiet for 30+ minutes and deletes those rooms.
// The index only shows tokens, and the rules only reveal a token's room code once it's stale,
// so active room codes stay private.

export function touchRoom(room) {
  if (!room?.token) return Promise.resolve();
  return set(ref(db, `roomIndex/${room.token}`), serverTimestamp()).catch(() => {});
}

const deleteRoomUpdates = (code, token) => ({
  ...(code ? { [`rooms/${code}`]: null } : {}),
  ...(token ? { [`roomIndex/${token}`]: null, [`roomTokens/${token}`]: null } : {}),
});

export async function sweepStaleRooms() {
  try {
    const cutoff = serverNow() - STALE_MS - 60 * 1000; // a minute's margin for clock differences
    const stale = await get(query(ref(db, 'roomIndex'), orderByValue(), endAt(cutoff), limitToFirst(10)));
    await Promise.all(Object.keys(stale.val() || {}).map(async token => {
      const code = (await get(ref(db, `roomTokens/${token}`))).val();
      await update(ref(db), deleteRoomUpdates(code, token));
    }).map(p => p.catch(() => {})));
  } catch {
    // Cleanup is best-effort; never let it get in the way of playing.
  }
}

// Keeps `online` accurate, re-registering after every reconnect.
export function trackPresence(code, uid) {
  const meRef = roomRef(code, `players/${uid}`);
  return onValue(ref(db, '.info/connected'), async snap => {
    if (!snap.val()) return;
    await onDisconnect(meRef).update({ online: false, lastSeen: serverTimestamp() });
    const exists = (await get(roomRef(code, `players/${uid}/name`))).exists();
    if (exists) update(meRef, { online: true });
  });
}

export function stopPresence(code, uid) {
  return onDisconnect(roomRef(code, `players/${uid}`)).cancel();
}

export async function leaveRoom(room, uid) {
  await stopPresence(room.code, uid);
  const others = sortedPlayers(room).filter(p => p.id !== uid);
  if (others.length === 0) return update(ref(db), deleteRoomUpdates(room.code, room.token));
  const updates = { [`players/${uid}`]: null, [`reactions/${uid}`]: null };
  if (room.hostId === uid) updates.hostId = (others.find(p => p.online) || others[0]).id;
  return update(roomRef(room.code), updates);
}

export function kickPlayer(room, uid) {
  return update(roomRef(room.code), { [`players/${uid}`]: null, [`reactions/${uid}`]: null, [`kicked/${uid}`]: true });
}

export function sortedPlayers(room) {
  return Object.entries(room.players || {})
    .map(([id, p]) => ({ id, ...p }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
}

// If the host has been offline for a while, the longest-standing online player takes over.
export function claimHostIfNeeded(room, uid) {
  const host = room.players?.[room.hostId];
  const hostGone = !host || (!host.online && serverNow() - (host.lastSeen || 0) > HOST_GRACE_MS);
  if (!hostGone) return;
  const next = sortedPlayers(room).find(p => p.online && p.id !== room.hostId);
  if (next?.id !== uid) return;
  const previous = room.hostId;
  runTransaction(roomRef(room.code, 'hostId'), current => (current === previous ? uid : undefined));
}

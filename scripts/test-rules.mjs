// Checks database.rules.json against the local emulator (run "npm run emulators" first, then "npm run test:rules").
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, query, orderByValue, endAt, limitToFirst, serverTimestamp } from 'firebase/database';

const ADMIN = 'http://127.0.0.1:9000';
const NS = 'demo-multigamehub-default-rtdb';
const admin = (path, method, body) => fetch(`${ADMIN}/${path}.json?ns=${NS}`, { method, headers: { Authorization: 'Bearer owner' }, body: body && JSON.stringify(body) }).then(r => r.json());

function client(name) {
  const app = initializeApp({ projectId: 'demo-multigamehub', apiKey: 'demo', databaseURL: `${ADMIN}?ns=${NS}` }, name);
  const auth = getAuth(app); connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getDatabase(app); connectDatabaseEmulator(db, '127.0.0.1', 9000);
  return { auth, db };
}
let failures = 0;
const expect = async (label, shouldWork, fn) => {
  let ok = true, why = '';
  try { await fn(); } catch (e) { ok = false; why = e.code || e.message; }
  const pass = ok === shouldWork;
  if (!pass) failures++;
  console.log(pass ? 'pass' : 'FAIL', `${ok ? 'allowed' : 'denied '} ${label}${why && !shouldWork ? '' : why ? ` (${why})` : ''}`);
};

const stranger = client('stranger');
await signInAnonymously(stranger.auth);
const old = Date.now() - 45 * 60 * 1000;

// A room inactive for 45 minutes and an active one, set up as the database owner.
await admin('rooms/STAL', 'PUT', { hostId: 'x', phase: 'lobby', token: 'staletoken', players: { x: { name: 'Old' } } });
await admin('roomTokens/staletoken', 'PUT', 'STAL');
await admin('roomIndex/staletoken', 'PUT', old);
await admin('canvases/STAL', 'PUT', { s: { a1: { m: { c: '#222222', w: 0.01, u: 'x' }, k: [{ p: '0000', t: 1 }] } } });
await admin('rooms/FRSH', 'PUT', { hostId: 'y', phase: 'lobby', token: 'freshtoken', players: { y: { name: 'New' } } });
await admin('roomTokens/freshtoken', 'PUT', 'FRSH');
await admin('roomIndex/freshtoken', 'PUT', Date.now());

await expect('list stale index entries', true, async () => {
  const snap = await get(query(ref(stranger.db, 'roomIndex'), orderByValue(), endAt(Date.now() - 31 * 60 * 1000), limitToFirst(10)));
  console.log('      found tokens:', Object.keys(snap.val() || {}));
});
await expect('look up the STALE room code', true, () => get(ref(stranger.db, 'roomTokens/staletoken')));
await expect('look up the ACTIVE room code', false, () => get(ref(stranger.db, 'roomTokens/freshtoken')));
await expect('list every token-to-code mapping', false, () => get(ref(stranger.db, 'roomTokens')));
await expect('backdate an ACTIVE room to get it deleted', false, () => set(ref(stranger.db, 'roomIndex/freshtoken'), old));
await expect('delete the ACTIVE room', false, () => update(ref(stranger.db), { 'rooms/FRSH': null, 'roomIndex/freshtoken': null, 'roomTokens/freshtoken': null }));
await expect('delete the STALE room (and its drawing)', true, () => update(ref(stranger.db), { 'rooms/STAL': null, 'canvases/STAL': null, 'roomIndex/staletoken': null, 'roomTokens/staletoken': null }));

// The normal host flow still works.
const host = client('host');
const { user } = await signInAnonymously(host.auth);
await expect('create a room with token and index', true, () => update(ref(host.db), {
  'rooms/TEST': { hostId: user.uid, phase: 'lobby', token: 'testtoken', players: { [user.uid]: { name: 'Mo' } } },
  'roomTokens/testtoken': 'TEST',
  'roomIndex/testtoken': Date.now(),
}));
await expect('stamp your own clock', true, () => set(ref(host.db, `clock/${user.uid}`), serverTimestamp()));
await expect('stamp a fake time', false, () => set(ref(host.db, `clock/${user.uid}`), 12345));
await expect('stamp someone else’s clock', false, () => set(ref(stranger.db, `clock/${user.uid}`), serverTimestamp()));
await expect('host heartbeat', true, () => set(ref(host.db, 'roomIndex/testtoken'), Date.now()));

// Reactions: one slot per player, no faster than one every 0.7 seconds.
const reaction = e => ({ e, n: Math.random().toString(36).slice(2, 10), at: serverTimestamp() });
await expect('send a reaction', true, () => set(ref(host.db, `rooms/TEST/reactions/${user.uid}`), reaction('laugh')));
await expect('send another straight away (too fast)', false, () => set(ref(host.db, `rooms/TEST/reactions/${user.uid}`), reaction('fire')));
await new Promise(r => setTimeout(r, 800));
await expect('send another after a pause', true, () => set(ref(host.db, `rooms/TEST/reactions/${user.uid}`), reaction('fire')));
await expect('react as someone else', false, () => set(ref(host.db, 'rooms/TEST/reactions/someoneelse'), reaction('clap')));
await expect('react with made-up junk', false, () => set(ref(host.db, `rooms/TEST/reactions/${user.uid}`), { e: '<script>', n: 'abc', at: serverTimestamp() }));
// Drawing: room members can add strokes; nobody else can.
await expect('draw a stroke in your room', true, () => update(ref(host.db), { 'canvases/TEST/s/st1/m': { c: '#222222', w: 0.01, u: user.uid }, 'canvases/TEST/s/st1/k/0': { p: '00aa11bb', t: Date.now() } }));
await expect('undo your own stroke', true, () => set(ref(host.db, 'canvases/TEST/s/st1/x'), true));
await expect('add a bucket fill', true, () => update(ref(host.db), { 'canvases/TEST/s/st4/m': { t: 'f', c: '#3b82c4', w: 0.01, u: user.uid }, 'canvases/TEST/s/st4/k/0': { p: '0a0a', t: Date.now() } }));
await expect('use a made-up tool', false, () => set(ref(host.db, 'canvases/TEST/s/st5/m'), { t: 'zz', c: '#222222', w: 0.01, u: user.uid }));
await expect('draw on your own layer', true, () => update(ref(host.db), { [`canvases/TEST/b/${user.uid}/s/ly1/m`]: { c: '#222222', w: 0.01, u: user.uid }, [`canvases/TEST/b/${user.uid}/s/ly1/k/0`]: { p: '0011', t: Date.now() } }));
await expect('draw as someone else', false, () => set(ref(host.db, 'canvases/TEST/s/st2/m'), { c: '#222222', w: 0.01, u: 'someoneelse' }));
await expect('draw a huge chunk', false, () => set(ref(host.db, 'canvases/TEST/s/st1/k/1'), { p: 'a'.repeat(5000), t: 1 }));
await expect('draw in a room you are not in', false, () => set(ref(stranger.db, 'canvases/TEST/s/st3/k/0'), { p: '0000', t: 1 }));
await expect('wipe another room drawing', false, () => set(ref(stranger.db, 'canvases/TEST'), null));
await expect('react from outside the room', false, () => set(ref(stranger.db, `rooms/TEST/reactions/${stranger.auth.currentUser.uid}`), reaction('cry')));
await expect('stranger heartbeat on that room', false, () => set(ref(stranger.db, 'roomIndex/testtoken'), Date.now()));
await expect('last player leaves (delete everything)', true, () => update(ref(host.db), { 'rooms/TEST': null, 'canvases/TEST': null, 'roomIndex/testtoken': null, 'roomTokens/testtoken': null }));

const left = { stale: await admin('rooms/STAL', 'GET'), fresh: !!(await admin('rooms/FRSH', 'GET')), test: await admin('rooms/TEST', 'GET') };
console.log('after:', left, failures ? `${failures} FAILED` : 'all passed');
for (const p of ['rooms/FRSH', 'roomIndex/freshtoken', 'roomTokens/freshtoken']) await admin(p, 'DELETE');
process.exit(failures ? 1 : 0);

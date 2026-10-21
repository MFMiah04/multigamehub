// Checks database.rules.json against the local emulator (run "npm run emulators" first, then "npm run test:rules").
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInAnonymously } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, get, set, update, query, orderByValue, endAt, limitToFirst } from 'firebase/database';

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
await expect('delete the STALE room', true, () => update(ref(stranger.db), { 'rooms/STAL': null, 'roomIndex/staletoken': null, 'roomTokens/staletoken': null }));

// The normal host flow still works.
const host = client('host');
const { user } = await signInAnonymously(host.auth);
await expect('create a room with token and index', true, () => update(ref(host.db), {
  'rooms/TEST': { hostId: user.uid, phase: 'lobby', token: 'testtoken', players: { [user.uid]: { name: 'Mo' } } },
  'roomTokens/testtoken': 'TEST',
  'roomIndex/testtoken': Date.now(),
}));
await expect('host heartbeat', true, () => set(ref(host.db, 'roomIndex/testtoken'), Date.now()));
await expect('stranger heartbeat on that room', false, () => set(ref(stranger.db, 'roomIndex/testtoken'), Date.now()));
await expect('last player leaves (delete everything)', true, () => update(ref(host.db), { 'rooms/TEST': null, 'roomIndex/testtoken': null, 'roomTokens/testtoken': null }));

const left = { stale: await admin('rooms/STAL', 'GET'), fresh: !!(await admin('rooms/FRSH', 'GET')), test: await admin('rooms/TEST', 'GET') };
console.log('after:', left, failures ? `${failures} FAILED` : 'all passed');
for (const p of ['rooms/FRSH', 'roomIndex/freshtoken', 'roomTokens/freshtoken']) await admin(p, 'DELETE');
process.exit(failures ? 1 : 0);

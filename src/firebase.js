import { initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, browserSessionPersistence, signInAnonymously, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
import { getDatabase, connectDatabaseEmulator, ref, onValue, set, get, remove, serverTimestamp } from 'firebase/database';

const useEmulator = import.meta.env.MODE === 'emulator';

// Web config is public by design; access is controlled by database.rules.json.
const app = initializeApp(useEmulator
  ? { projectId: 'demo-multigamehub', apiKey: 'demo', databaseURL: 'http://127.0.0.1:9000?ns=demo-multigamehub-default-rtdb' }
  : {
      apiKey: 'AIzaSyCx2oCqmMMQ-3kwEztOLGQawCE05Va0-14',
      authDomain: 'multigame-hub.firebaseapp.com',
      databaseURL: 'https://multigame-hub-default-rtdb.europe-west1.firebasedatabase.app',
      projectId: 'multigame-hub',
      appId: '1:1010151762241:web:36c64f3b75515b5dce99c0',
    });

// In emulator mode every browser tab is its own player, which makes local multiplayer testing easy.
export const auth = useEmulator ? initializeAuth(app, { persistence: browserSessionPersistence }) : getAuth(app);
export const db = getDatabase(app);

if (useEmulator) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectDatabaseEmulator(db, '127.0.0.1', 9000);
}

// Anonymous sign-in gives each browser a stable id that survives refreshes,
// which is what lets players reconnect to a room.
export function signIn() {
  return new Promise((resolve, reject) => {
    const stop = onAuthStateChanged(auth, user => {
      if (!user) return;
      stop();
      resolve(user.uid);
    });
    signInAnonymously(auth).catch(reject);
  });
}

// Offset between this device's clock and Firebase's, so timers agree across phones.
// Firebase gives a rough offset when it connects; syncClock() then measures it properly.
let serverOffset = 0;
let measured = false;
onValue(ref(db, '.info/serverTimeOffset'), snap => { if (!measured) serverOffset = snap.val() || 0; });
export const serverNow = () => Date.now() + serverOffset;

// Writes the server's time to a scratch spot a few times and keeps the quickest round trip:
// the server stamped it roughly halfway between sending and hearing back.
export async function syncClock(uid) {
  const spot = ref(db, `clock/${uid}`);
  let best = null;
  try {
    for (let i = 0; i < 4; i++) {
      const sent = Date.now();
      await set(spot, serverTimestamp());
      const back = Date.now();
      const stamped = (await get(spot)).val();
      if (typeof stamped !== 'number') continue;
      const trip = back - sent;
      if (!best || trip < best.trip) best = { trip, offset: stamped - (sent + trip / 2) };
    }
    if (best) { serverOffset = best.offset; measured = true; }
    await remove(spot);
  } catch {
    // Keep Firebase's own estimate.
  }
}

// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getDatabase, ref, set, get, onValue, update, remove, push } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCx2oCqmMMQ-3kwEztOLGQawCE05Va0-14",
  authDomain: "multigame-hub.firebaseapp.com",
  databaseURL: "https://multigame-hub-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "multigame-hub",
  storageBucket: "multigame-hub.firebasestorage.app",
  messagingSenderId: "1010151762241",
  appId: "1:1010151762241:web:36c64f3b75515b5dce99c0",
  measurementId: "G-7XGKGTRDQW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getDatabase(app);

// Helper function to get room reference
export function getRoomRef(roomCode) {
  return ref(db, `rooms/${roomCode}`);
}

// Helper function to get players reference
export function getPlayersRef(roomCode) {
  return ref(db, `rooms/${roomCode}/players`);
}

// Helper function to get settings reference
export function getSettingsRef(roomCode) {
  return ref(db, `rooms/${roomCode}/settings`);
}

// Helper function to update phase
export async function updatePhase(roomCode, phase) {
  const roomRef = getRoomRef(roomCode);
  await update(roomRef, { phase });
}

// Helper function to check if room exists
export async function roomExists(roomCode) {
  const roomRef = getRoomRef(roomCode);
  const snapshot = await get(roomRef);
  return snapshot.exists();
}

// Helper function to create room
export async function createRoom(roomCode, hostId, hostName) {
  const roomRef = getRoomRef(roomCode);
  await set(roomRef, {
    hostId,
    phase: "lobby",
    selectedGame: null,
    settings: {},
    players: {
      [hostId]: {
        name: hostName,
        role: null,
        answer: null,
        votes: null
      }
    }
  });
}

// Helper function to join room
export async function joinRoom(roomCode, playerId, playerName) {
  const playerRef = ref(db, `rooms/${roomCode}/players/${playerId}`);
  await set(playerRef, {
    name: playerName,
    role: null,
    answer: null,
    votes: null
  });
}

// Helper function to listen to room changes
export function listenToRoom(roomCode, callback) {
  const roomRef = getRoomRef(roomCode);
  return onValue(roomRef, callback);
}

export { db, ref, set, get, onValue, update, remove, analytics };

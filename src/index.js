import { createRoom, joinRoom, roomExists } from '../firebase-config.js';
import { generateRoomCode, generatePlayerId, storePlayerData, navigateToPage } from '../utils.js';

const playerNameInput = document.getElementById('playerName');
const hostBtn = document.getElementById('hostBtn');
const joinBtn = document.getElementById('joinBtn');
const joinSection = document.getElementById('joinSection');
const roomCodeInput = document.getElementById('roomCode');
const joinSubmitBtn = document.getElementById('joinSubmitBtn');
const cancelBtn = document.getElementById('cancelBtn');
const errorMessage = document.getElementById('errorMessage');

// Load saved name if exists
const savedName = localStorage.getItem('playerName');
if (savedName) {
  playerNameInput.value = savedName;
}

function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
  setTimeout(() => {
    errorMessage.style.display = 'none';
  }, 3000);
}

function validateName() {
  const name = playerNameInput.value.trim();
  if (name.length < 3) {
    showError('Name must be at least 3 characters');
    return null;
  }
  return name;
}

// Host lobby
hostBtn.addEventListener('click', async () => {
  const playerName = validateName();
  if (!playerName) return;

  try {
    hostBtn.disabled = true;
    hostBtn.textContent = 'Creating...';

    const playerId = generatePlayerId();
    let roomCode = generateRoomCode();

    // Ensure unique room code
    while (await roomExists(roomCode)) {
      roomCode = generateRoomCode();
    }

    await createRoom(roomCode, playerId, playerName);
    storePlayerData(roomCode, playerId, playerName);
    navigateToPage('app.html', roomCode, playerId);
  } catch (error) {
    console.error('Error creating room:', error);
    showError('Failed to create lobby');
    hostBtn.disabled = false;
    hostBtn.textContent = 'Host Lobby';
  }
});

// Show join section
joinBtn.addEventListener('click', () => {
  const playerName = validateName();
  if (!playerName) return;

  joinSection.style.display = 'block';
  hostBtn.parentElement.style.display = 'none';
  roomCodeInput.focus();
});

// Cancel join
cancelBtn.addEventListener('click', () => {
  joinSection.style.display = 'none';
  hostBtn.parentElement.style.display = 'flex';
  roomCodeInput.value = '';
});

// Join room
joinSubmitBtn.addEventListener('click', async () => {
  const playerName = validateName();
  if (!playerName) return;

  const roomCode = roomCodeInput.value.trim().toUpperCase();
  if (roomCode.length !== 5) {
    showError('Room code must be 5 letters');
    return;
  }

  try {
    joinSubmitBtn.disabled = true;
    joinSubmitBtn.textContent = 'Joining...';

    const exists = await roomExists(roomCode);
    if (!exists) {
      showError('Room not found');
      joinSubmitBtn.disabled = false;
      joinSubmitBtn.textContent = 'Join Room';
      return;
    }

    const playerId = generatePlayerId();
    await joinRoom(roomCode, playerId, playerName);
    storePlayerData(roomCode, playerId, playerName);
    navigateToPage('app.html', roomCode, playerId);
  } catch (error) {
    console.error('Error joining room:', error);
    showError('Failed to join room');
    joinSubmitBtn.disabled = false;
    joinSubmitBtn.textContent = 'Join Room';
  }
});

// Auto-uppercase room code input
roomCodeInput.addEventListener('input', (e) => {
  e.target.value = e.target.value.toUpperCase();
});

// Enter key handlers
playerNameInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    hostBtn.click();
  }
});

roomCodeInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    joinSubmitBtn.click();
  }
});

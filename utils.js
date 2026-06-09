// Generate random 5-letter uppercase code
export function generateRoomCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

// Generate UUID for player ID
export function generatePlayerId() {
  return crypto.randomUUID();
}

// Shuffle array (Fisher-Yates)
export function shuffle(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Get URL parameters
export function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    roomCode: params.get('roomCode'),
    playerId: params.get('playerId')
  };
}

// Store player data in localStorage
export function storePlayerData(roomCode, playerId, playerName) {
  localStorage.setItem('roomCode', roomCode);
  localStorage.setItem('playerId', playerId);
  localStorage.setItem('playerName', playerName);
}

// Get player data from localStorage
export function getStoredPlayerData() {
  return {
    roomCode: localStorage.getItem('roomCode'),
    playerId: localStorage.getItem('playerId'),
    playerName: localStorage.getItem('playerName')
  };
}

// Navigate to a page with room and player info
export function navigateToPage(page, roomCode, playerId) {
  window.location.href = `${page}?roomCode=${roomCode}&playerId=${playerId}`;
}

// Select random fakers from player list
export function selectFakers(playerIds, numFakers) {
  const shuffled = shuffle(playerIds);
  return shuffled.slice(0, numFakers);
}

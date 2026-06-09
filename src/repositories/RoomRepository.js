import { ref, set, get, update, remove, onValue } from '../../firebase-config.js';

/**
 * RoomRepository - Handles all room-related database operations
 */
export class RoomRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new room
   * @param {string} roomCode - Room code
   * @param {string} hostId - Host player ID
   * @param {string} hostName - Host player name
   * @returns {Object} Room data
   */
  async create(roomCode, hostId, hostName) {
    const roomRef = ref(this.db, `rooms/${roomCode}`);
    const roomData = {
      hostId,
      phase: 'lobby',
      selectedGame: null,
      settings: {},
      createdAt: Date.now(),
      players: {
        [hostId]: {
          name: hostName,
          role: null,
          answer: null,
          votes: null,
          score: 0,
          inGame: false
        }
      }
    };

    await set(roomRef, roomData);
    return roomData;
  }

  /**
   * Get room data
   * @param {string} roomCode - Room code
   * @returns {Object|null} Room data or null if not found
   */
  async get(roomCode) {
    const roomRef = ref(this.db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);
    return snapshot.val();
  }

  /**
   * Check if room exists
   * @param {string} roomCode - Room code
   * @returns {boolean}
   */
  async exists(roomCode) {
    const data = await this.get(roomCode);
    return data !== null;
  }

  /**
   * Update room phase
   * @param {string} roomCode - Room code
   * @param {string} phase - New phase
   */
  async updatePhase(roomCode, phase) {
    return this.update(roomCode, { phase });
  }

  /**
   * Update room data
   * @param {string} roomCode - Room code
   * @param {Object} updates - Object with key-value pairs to update
   */
  async update(roomCode, updates) {
    const updateObj = {};
    Object.entries(updates).forEach(([key, value]) => {
      updateObj[`rooms/${roomCode}/${key}`] = value;
    });
    await update(ref(this.db), updateObj);
  }

  /**
   * Listen to room changes
   * @param {string} roomCode - Room code
   * @param {Function} callback - Callback function
   * @returns {Function} Unsubscribe function
   */
  listen(roomCode, callback) {
    const roomRef = ref(this.db, `rooms/${roomCode}`);
    return onValue(roomRef, callback);
  }

  /**
   * Delete room
   * @param {string} roomCode - Room code
   */
  async delete(roomCode) {
    const roomRef = ref(this.db, `rooms/${roomCode}`);
    await remove(roomRef);
  }

  /**
   * Set selected game
   * @param {string} roomCode - Room code
   * @param {string} gameId - Game identifier
   */
  async setSelectedGame(roomCode, gameId) {
    await this.update(roomCode, { selectedGame: gameId });
  }

  /**
   * Clear game data
   * @param {string} roomCode - Room code
   */
  async clearGameData(roomCode) {
    await this.update(roomCode, {
      gameData: null,
      selectedGame: null,
      phase: 'lobby'
    });
  }
}

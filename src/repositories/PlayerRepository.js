import { ref, set, update, remove, get } from '../../firebase-config.js';

/**
 * PlayerRepository - Handles all player-related database operations
 */
export class PlayerRepository {
  constructor(db) {
    this.db = db;
  }

  /**
   * Add a player to a room
   * @param {string} roomCode - Room code
   * @param {string} playerId - Player ID
   * @param {Object} playerData - Player data (must include name)
   * @returns {Object} Complete player data
   */
  async add(roomCode, playerId, playerData) {
    const playerRef = ref(this.db, `rooms/${roomCode}/players/${playerId}`);
    const defaultData = {
      name: playerData.name,
      role: null,
      answer: null,
      votes: null,
      score: 0,
      inGame: false,
      ...playerData
    };
    await set(playerRef, defaultData);
    return defaultData;
  }

  /**
   * Update player data
   * @param {string} roomCode - Room code
   * @param {string} playerId - Player ID
   * @param {Object} updates - Fields to update
   */
  async update(roomCode, playerId, updates) {
    const updateObj = {};
    Object.entries(updates).forEach(([key, value]) => {
      updateObj[`rooms/${roomCode}/players/${playerId}/${key}`] = value;
    });
    await update(ref(this.db), updateObj);
  }

  /**
   * Remove a player from a room
   * @param {string} roomCode - Room code
   * @param {string} playerId - Player ID
   */
  async remove(roomCode, playerId) {
    const playerRef = ref(this.db, `rooms/${roomCode}/players/${playerId}`);
    await remove(playerRef);
  }

  /**
   * Get all players in a room
   * @param {string} roomCode - Room code
   * @returns {Object} Players object
   */
  async getAll(roomCode) {
    const roomRef = ref(this.db, `rooms/${roomCode}`);
    const snapshot = await get(roomRef);
    const roomData = snapshot.val();
    return roomData?.players || {};
  }

  /**
   * Get a single player
   * @param {string} roomCode - Room code
   * @param {string} playerId - Player ID
   * @returns {Object|null} Player data
   */
  async get(roomCode, playerId) {
    const playerRef = ref(this.db, `rooms/${roomCode}/players/${playerId}`);
    const snapshot = await get(playerRef);
    return snapshot.val();
  }

  /**
   * Reset game state for all players
   * @param {string} roomCode - Room code
   * @param {Array<string>} playerIds - Array of player IDs
   */
  async resetGameState(roomCode, playerIds) {
    const updates = {};
    playerIds.forEach(pid => {
      updates[`rooms/${roomCode}/players/${pid}/inGame`] = false;
      updates[`rooms/${roomCode}/players/${pid}/answer`] = null;
      updates[`rooms/${roomCode}/players/${pid}/votes`] = null;
      updates[`rooms/${roomCode}/players/${pid}/role`] = null;
    });
    await update(ref(this.db), updates);
  }

  /**
   * Reset all player scores
   * @param {string} roomCode - Room code
   * @param {Array<string>} playerIds - Array of player IDs
   */
  async resetScores(roomCode, playerIds) {
    const updates = {};
    playerIds.forEach(pid => {
      updates[`rooms/${roomCode}/players/${pid}/score`] = 0;
    });
    await update(ref(this.db), updates);
  }

  /**
   * Set players as in-game
   * @param {string} roomCode - Room code
   * @param {Array<string>} playerIds - Array of player IDs
   * @param {boolean} inGame - In-game status
   */
  async setInGame(roomCode, playerIds, inGame = true) {
    const updates = {};
    playerIds.forEach(pid => {
      updates[`rooms/${roomCode}/players/${pid}/inGame`] = inGame;
    });
    await update(ref(this.db), updates);
  }

  /**
   * Batch update multiple players
   * @param {string} roomCode - Room code
   * @param {Object} playerUpdates - Object with playerId: updates pairs
   */
  async batchUpdate(roomCode, playerUpdates) {
    const updates = {};

    Object.entries(playerUpdates).forEach(([playerId, playerData]) => {
      Object.entries(playerData).forEach(([key, value]) => {
        updates[`rooms/${roomCode}/players/${playerId}/${key}`] = value;
      });
    });

    await update(ref(this.db), updates);
  }
}

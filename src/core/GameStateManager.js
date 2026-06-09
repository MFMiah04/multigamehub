import { getRoomRef, listenToRoom, update, ref as dbRef } from '../../firebase-config.js';
import { db } from '../../firebase-config.js';
import { eventBus } from './EventBus.js';

/**
 * GameStateManager - Centralized state management for game rooms
 */
export class GameStateManager {
  constructor(roomCode, playerId) {
    this.roomCode = roomCode;
    this.playerId = playerId;

    this.state = {
      phase: null,
      players: {},
      settings: {},
      gameData: {},
      selectedGame: null,
      hostId: null
    };

    this.listeners = new Map();
    this.unsubscribe = null;
  }

  /**
   * Subscribe to state changes
   * @param {Function} callback - Called with new state on every update
   * @returns {Function} Unsubscribe function
   */
  subscribe(callback) {
    const id = Date.now() + Math.random();
    this.listeners.set(id, callback);

    // Call immediately with current state
    callback(this.state);

    return () => this.listeners.delete(id);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.state);
      } catch (error) {
        console.error('Error in state listener:', error);
      }
    });

    // Emit event bus events
    eventBus.emit('state:change', this.state);
    eventBus.emit(`phase:${this.state.phase}`, this.state);
  }

  /**
   * Initialize Firebase listener
   */
  async init() {
    return new Promise((resolve, reject) => {
      try {
        this.unsubscribe = listenToRoom(this.roomCode, (snapshot) => {
          const data = snapshot.val();

          if (!data) {
            // Room doesn't exist
            eventBus.emit('room:notfound', { roomCode: this.roomCode });
            window.location.href = '/index.html';
            return;
          }

          const previousPhase = this.state.phase;
          this.state = data;

          // Emit phase change event if phase changed
          if (previousPhase !== this.state.phase) {
            eventBus.emit('phase:change', {
              from: previousPhase,
              to: this.state.phase,
              game: this.state.selectedGame
            });
          }

          this.notifyListeners();
          resolve();
        });
      } catch (error) {
        console.error('Error initializing state manager:', error);
        reject(error);
      }
    });
  }

  /**
   * Update specific state path in Firebase
   * @param {string} path - Path relative to room (e.g., 'phase', 'players/123/score')
   * @param {*} value - Value to set
   */
  async updateState(path, value) {
    const updates = {};
    updates[`rooms/${this.roomCode}/${path}`] = value;

    try {
      await update(dbRef(db), updates);
    } catch (error) {
      console.error('Error updating state:', error);
      throw error;
    }
  }

  /**
   * Batch update multiple paths
   * @param {Object} updates - Object with path: value pairs
   */
  async batchUpdate(updates) {
    const firebaseUpdates = {};

    Object.entries(updates).forEach(([path, value]) => {
      firebaseUpdates[`rooms/${this.roomCode}/${path}`] = value;
    });

    try {
      await update(dbRef(db), firebaseUpdates);
    } catch (error) {
      console.error('Error in batch update:', error);
      throw error;
    }
  }

  /**
   * Get current player data
   * @returns {Object|null} Player data
   */
  getCurrentPlayer() {
    return this.state.players?.[this.playerId] || null;
  }

  /**
   * Check if current user is host
   * @returns {boolean}
   */
  isHost() {
    return this.state.hostId === this.playerId;
  }

  /**
   * Get all players
   * @returns {Array} Array of player objects with id
   */
  getAllPlayers() {
    return Object.entries(this.state.players || {}).map(([id, data]) => ({
      id,
      ...data
    }));
  }

  /**
   * Get players currently in game
   * @returns {Array} Array of in-game player objects
   */
  getInGamePlayers() {
    return this.getAllPlayers().filter(player => player.inGame);
  }

  /**
   * Get game-specific data
   * @param {string} gameName - Name of the game
   * @returns {Object} Game data
   */
  getGameData(gameName) {
    return this.state.gameData?.[gameName] || {};
  }

  /**
   * Get game settings
   * @param {string} gameName - Name of the game
   * @returns {Object} Game settings
   */
  getGameSettings(gameName) {
    return this.state.settings?.[gameName] || {};
  }

  /**
   * Clean up listeners
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.listeners.clear();
  }
}

/**
 * BaseGame - Abstract base class for all games
 */
export class BaseGame {
  constructor(roomCode, stateManager) {
    this.roomCode = roomCode;
    this.stateManager = stateManager;
    this.minPlayers = 3;
    this.maxPlayers = 12;
  }

  /**
   * Initialize game (must be implemented by subclasses)
   * Called when game starts
   */
  async initialize() {
    throw new Error('initialize() must be implemented by subclass');
  }

  /**
   * Start a new round (must be implemented by subclasses)
   */
  async startRound() {
    throw new Error('startRound() must be implemented by subclass');
  }

  /**
   * End current round (must be implemented by subclasses)
   */
  async endRound() {
    throw new Error('endRound() must be implemented by subclass');
  }

  /**
   * Calculate scores (must be implemented by subclasses)
   * @param {Object} gameData - Game-specific data
   * @param {Object} players - Players object
   * @returns {Object} Score updates {playerId: points}
   */
  calculateScores(gameData, players) {
    throw new Error('calculateScores() must be implemented by subclass');
  }

  /**
   * Transition to a new phase
   * @param {string} phase - Phase name
   */
  async transitionToPhase(phase) {
    await this.stateManager.updateState('phase', phase);
  }

  /**
   * Get players currently in game
   * @returns {Array} Array of player objects
   */
  getInGamePlayers() {
    return this.stateManager.getInGamePlayers();
  }

  /**
   * Get all players
   * @returns {Array} Array of player objects
   */
  getAllPlayers() {
    return this.stateManager.getAllPlayers();
  }

  /**
   * Check if game can start
   * @returns {boolean}
   */
  canStart() {
    const playerCount = this.getAllPlayers().length;
    return playerCount >= this.minPlayers && playerCount <= this.maxPlayers;
  }

  /**
   * Get game-specific data from state
   * @returns {Object}
   */
  getGameData() {
    const gameName = this.constructor.name.replace('Game', '').toLowerCase();
    return this.stateManager.getGameData(gameName) || {};
  }

  /**
   * Get game settings from state
   * @returns {Object}
   */
  getGameSettings() {
    const gameName = this.constructor.name.replace('Game', '').toLowerCase();
    return this.stateManager.getGameSettings(gameName) || {};
  }

  /**
   * Update game data
   * @param {string} path - Path within gameData/{gameName}
   * @param {*} value - Value to set
   */
  async updateGameData(path, value) {
    const gameName = this.constructor.name.replace('Game', '').toLowerCase();
    await this.stateManager.updateState(`gameData/${gameName}/${path}`, value);
  }

  /**
   * Batch update game data
   * @param {Object} updates - Object with path: value pairs
   */
  async batchUpdateGameData(updates) {
    const gameName = this.constructor.name.replace('Game', '').toLowerCase();
    const firebaseUpdates = {};

    Object.entries(updates).forEach(([path, value]) => {
      firebaseUpdates[`gameData/${gameName}/${path}`] = value;
    });

    await this.stateManager.batchUpdate(firebaseUpdates);
  }

  /**
   * Reset game state
   */
  async reset() {
    const gameName = this.constructor.name.replace('Game', '').toLowerCase();
    await this.stateManager.batchUpdate({
      [`gameData/${gameName}`]: null,
      [`settings/${gameName}`]: {},
      phase: 'lobby'
    });
  }
}

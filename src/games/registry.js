/**
 * Game Registry - Central registry for all available games
 */

export const gameRegistry = {
  'fakin-it': {
    name: 'Fakin\' It',
    emoji: '🎭',
    description: 'Complete secret tasks without being caught',
    minPlayers: 3,
    maxPlayers: 10,
    settings: ['overseer'],
    phases: ['questionInput', 'answer', 'voting', 'results']
  },

  'imposter': {
    name: 'Imposter',
    emoji: '🕵️',
    description: 'Find the imposter among you',
    minPlayers: 3,
    maxPlayers: 12,
    settings: ['imposterCount'],
    phases: ['playing', 'voting', 'results']
  },

  'spyfall': {
    name: 'Spyfall',
    emoji: '🔍',
    description: 'Find the spy who doesn\'t know the location',
    minPlayers: 3,
    maxPlayers: 12,
    settings: ['timer', 'spyCount'],
    phases: ['playing', 'voting', 'results']
  },

  'herd-mentality': {
    name: 'Herd Mentality',
    emoji: '🐄',
    description: 'Think like the herd',
    minPlayers: 3,
    maxPlayers: 12,
    settings: ['timer'],
    phases: ['question', 'reveal', 'results']
  }
};

/**
 * Get game configuration by ID
 * @param {string} gameId - Game identifier
 * @returns {Object|null} Game config or null
 */
export function getGameConfig(gameId) {
  return gameRegistry[gameId] || null;
}

/**
 * Get all available games
 * @returns {Array} Array of game objects with id
 */
export function getAllGames() {
  return Object.entries(gameRegistry).map(([id, config]) => ({
    id,
    ...config
  }));
}

/**
 * Check if game exists
 * @param {string} gameId - Game identifier
 * @returns {boolean}
 */
export function gameExists(gameId) {
  return gameId in gameRegistry;
}

/**
 * Get game class dynamically
 * @param {string} gameId - Game identifier
 * @returns {Promise<Class>} Game class
 */
export async function getGameClass(gameId) {
  try {
    switch(gameId) {
      case 'fakin-it':
        const { FakinItGame } = await import('./fakin-it/FakinItGame.js');
        return FakinItGame;
      case 'imposter':
        const { ImposterGame } = await import('./imposter/ImposterGame.js');
        return ImposterGame;
      case 'spyfall':
        const { SpyfallGame } = await import('./spyfall/SpyfallGame.js');
        return SpyfallGame;
      case 'herd-mentality':
        const { HerdMentalityGame } = await import('./herd-mentality/HerdMentalityGame.js');
        return HerdMentalityGame;
      default:
        throw new Error(`Unknown game: ${gameId}`);
    }
  } catch (error) {
    console.error(`Error loading game class for ${gameId}:`, error);
    throw error;
  }
}

/**
 * Get game view class dynamically
 * @param {string} gameId - Game identifier
 * @returns {Promise<Class>} View class
 */
export async function getGameView(gameId) {
  try {
    switch(gameId) {
      case 'fakin-it':
        const { FakinItView } = await import('../views/games/FakinItView.js');
        return FakinItView;
      case 'imposter':
        const { ImposterView } = await import('../views/games/ImposterView.js');
        return ImposterView;
      case 'spyfall':
        const { SpyfallView } = await import('../views/games/SpyfallView.js');
        return SpyfallView;
      case 'herd-mentality':
        const { HerdMentalityView } = await import('../views/games/HerdMentalityView.js');
        return HerdMentalityView;
      default:
        throw new Error(`Unknown game: ${gameId}`);
    }
  } catch (error) {
    console.error(`Error loading game view for ${gameId}:`, error);
    throw error;
  }
}

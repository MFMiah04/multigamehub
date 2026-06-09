import { GameStateManager } from './core/GameStateManager.js';
import { eventBus } from './core/EventBus.js';
import { getGameView } from './games/registry.js';
import '../styles/main.css';

/**
 * Main Application Class
 */
class App {
  constructor() {
    this.stateManager = null;
    this.currentView = null;
    this.appContainer = document.getElementById('app');
  }

  /**
   * Initialize the application
   */
  async init() {
    // Get URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('roomCode');
    const playerId = urlParams.get('playerId');

    // Validate parameters
    if (!roomCode || !playerId) {
      console.error('Missing roomCode or playerId');
      window.location.href = '/index.html';
      return;
    }

    try {
      // Initialize state manager
      this.stateManager = new GameStateManager(roomCode, playerId);
      await this.stateManager.init();

      // Listen for phase changes
      eventBus.on('phase:change', (data) => {
        this.handlePhaseChange(data);
      });

      // Render initial view based on current phase
      const state = this.stateManager.state;
      this.handlePhaseChange({
        from: null,
        to: state.phase,
        game: state.selectedGame
      });

    } catch (error) {
      console.error('Error initializing app:', error);
      this.showError('Failed to connect to room');
    }
  }

  /**
   * Handle phase transitions
   * @param {Object} data - Phase change data
   */
  async handlePhaseChange(data) {
    const { to: phase, game } = data;

    console.log(`Phase change: ${data.from} -> ${phase}`, { game });

    // Destroy current view
    if (this.currentView) {
      this.currentView.destroy();
      this.currentView = null;
    }

    // Render appropriate view
    if (phase === 'lobby') {
      await this.renderLobby();
    } else if (game) {
      await this.renderGame(game, phase);
    }
  }

  /**
   * Render lobby view
   */
  async renderLobby() {
    try {
      const { LobbyView } = await import('./views/LobbyView.js');
      this.currentView = new LobbyView(this.stateManager);
      this.currentView.render(this.appContainer);
    } catch (error) {
      console.error('Error rendering lobby:', error);
      this.showError('Failed to load lobby');
    }
  }

  /**
   * Render game view
   * @param {string} gameId - Game identifier
   * @param {string} phase - Current phase
   */
  async renderGame(gameId, phase) {
    try {
      const ViewClass = await getGameView(gameId);
      this.currentView = new ViewClass(phase, this.stateManager);
      this.currentView.render(this.appContainer);
    } catch (error) {
      console.error(`Error rendering game ${gameId}:`, error);
      this.showError(`Failed to load ${gameId}`);
    }
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    if (this.appContainer) {
      this.appContainer.innerHTML = `
        <div class="app-wrapper">
          <div class="container">
            <div class="card">
              <div class="card__header">
                <h1 class="card__title">❌ Error</h1>
              </div>
              <div class="card__body">
                <p style="text-align: center; color: var(--color-danger);">
                  ${message}
                </p>
              </div>
              <div class="card__footer">
                <button class="button button--primary button--full" onclick="window.location.href='/index.html'">
                  Return to Home
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }
  }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    app.init();
  });
} else {
  const app = new App();
  app.init();
}

export { App };

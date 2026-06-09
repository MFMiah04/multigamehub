import { auth, signInAnonymously } from '../firebase-config.js';
import { GameStateManager } from './core/GameStateManager.js';
import { Router } from './core/Router.js';
import { LobbyView } from './views/LobbyView.js';
import { getGameView } from './games/registry.js';

/**
 * Main application entry point
 */
class App {
  constructor() {
    this.stateManager = null;
    this.router = null;
    this.currentView = null;
  }

  async init() {
    // Get room and player info from URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomCode = urlParams.get('room');
    const playerId = urlParams.get('player');

    if (!roomCode || !playerId) {
      window.location.href = '/index.html';
      return;
    }

    try {
      // Sign in anonymously
      await signInAnonymously(auth);

      // Initialize state manager
      this.stateManager = new GameStateManager(roomCode, playerId);
      await this.stateManager.init();

      // Setup router
      this.router = new Router(this.stateManager);
      this.setupRoutes();

      // Listen for state changes
      this.stateManager.subscribe((state) => {
        this.handleStateChange(state);
      });

      // Initial render
      this.handleStateChange(this.stateManager.state);

    } catch (error) {
      console.error('Failed to initialize app:', error);
      alert('Failed to connect to room. Please try again.');
      window.location.href = '/index.html';
    }
  }

  setupRoutes() {
    // Lobby route
    this.router.register('lobby', () => new LobbyView(this.stateManager));

    // Herd Mentality routes
    this.router.register('question', async () => {
      const ViewClass = await getGameView('herd-mentality');
      return new ViewClass('question', this.stateManager);
    });

    this.router.register('reveal', async () => {
      const ViewClass = await getGameView('herd-mentality');
      return new ViewClass('reveal', this.stateManager);
    });

    this.router.register('results', async () => {
      const ViewClass = await getGameView('herd-mentality');
      return new ViewClass('results', this.stateManager);
    });
  }

  async handleStateChange(state) {
    const phase = state.phase || 'lobby';

    // Route to appropriate view
    try {
      const newView = await this.router.navigate(phase);

      // Cleanup old view
      if (this.currentView && this.currentView !== newView) {
        this.currentView.destroy();
      }

      this.currentView = newView;

      // Render view
      const appContainer = document.getElementById('app');
      if (appContainer && newView) {
        newView.render(appContainer);
      }
    } catch (error) {
      console.error('Failed to navigate to phase:', phase, error);
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

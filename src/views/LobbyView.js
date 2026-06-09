import { BaseView } from './BaseView.js';
import { Button } from '../components/ui/Button.js';
import { Card } from '../components/ui/Card.js';
import { gameRegistry } from '../games/registry.js';

/**
 * LobbyView - Room lobby with game selection
 */
export class LobbyView extends BaseView {
  constructor(stateManager) {
    super(stateManager);
    this.selectedGame = null;
  }

  template() {
    const { roomCode, players, selectedGame, settings } = this.stateManager.state;
    const currentPlayer = this.stateManager.getCurrentPlayer();
    const isHost = this.stateManager.isHost();

    const playerList = Object.values(players || {})
      .sort((a, b) => (a.isHost ? -1 : 1))
      .map(p => `
        <div class="lobby__player">
          <span class="lobby__player-name">
            ${p.name}
            ${p.isHost ? '<span class="lobby__host-badge">👑 Host</span>' : ''}
          </span>
        </div>
      `).join('');

    const gameCards = Object.entries(gameRegistry).map(([gameId, game]) => {
      const isSelected = selectedGame === gameId;
      return `
        <div class="lobby__game-card ${isSelected ? 'lobby__game-card--selected' : ''}"
             data-game-id="${gameId}"
             ${isHost ? `onclick="window.lobbyView.selectGame('${gameId}')"` : ''}>
          <div class="lobby__game-emoji">${game.emoji}</div>
          <div class="lobby__game-name">${game.name}</div>
          <div class="lobby__game-players">${game.minPlayers}+ players</div>
          ${isSelected ? '<div class="lobby__game-selected-badge">✓ Selected</div>' : ''}
        </div>
      `;
    }).join('');

    const playerCount = Object.values(players || {}).length;
    const minPlayers = selectedGame ? gameRegistry[selectedGame].minPlayers : 3;
    const canStart = isHost && selectedGame && playerCount >= minPlayers;
    const startButtonText = !selectedGame
      ? 'Select a game'
      : playerCount < minPlayers
        ? `Need ${minPlayers - playerCount} more player${minPlayers - playerCount > 1 ? 's' : ''}`
        : 'Start Game';

    const settingsPanel = selectedGame ? this.renderSettings(selectedGame, settings?.[selectedGame], isHost) : '';

    return `
      <div class="lobby">
        <div class="lobby__header">
          <h1 class="lobby__title">Game Lobby</h1>
          <div class="lobby__room-code">
            <span class="lobby__room-code-label">Room Code:</span>
            <button class="lobby__room-code-value" onclick="window.lobbyView.copyRoomCode()">
              ${roomCode}
              <span class="lobby__copy-icon">📋</span>
            </button>
          </div>
        </div>

        <div class="lobby__content">
          <div class="lobby__sidebar">
            <div class="lobby__section">
              <h2 class="lobby__section-title">Players (${playerCount})</h2>
              <div class="lobby__player-list">
                ${playerList}
              </div>
            </div>
            ${settingsPanel}
          </div>

          <div class="lobby__main">
            <div class="lobby__section">
              <h2 class="lobby__section-title">Select a Game</h2>
              <div class="lobby__game-grid">
                ${gameCards}
              </div>
            </div>

            ${isHost ? `
              <div class="lobby__actions">
                <button
                  class="btn btn--primary btn--lg lobby__start-btn"
                  onclick="window.lobbyView.startGame()"
                  ${!canStart ? 'disabled' : ''}>
                  ${startButtonText}
                </button>
              </div>
            ` : selectedGame ? `
              <div class="lobby__waiting">
                <div class="lobby__waiting-text">Waiting for host to start ${gameRegistry[selectedGame].name}...</div>
              </div>
            ` : `
              <div class="lobby__waiting">
                <div class="lobby__waiting-text">Waiting for host to select a game...</div>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  renderSettings(gameId, currentSettings, isHost) {
    if (gameId === 'herd-mentality') {
      const mins = Math.floor((currentSettings?.answerTimer || 60) / 60);
      return `
        <div class="lobby__section lobby__settings">
          <h2>Game Settings</h2>
          <div class="lobby__setting">
            <label>Answer Timer</label>
            <select onchange="window.lobbyView.updateAnswerTimer(this.value)" ${!isHost ? 'disabled' : ''}>
              ${[1,2,3,4,5].map(m => `<option value="${m}" ${m === mins ? 'selected' : ''}>${m} minute${m > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }

    if (gameId === 'fakin-it') {
      const aMins = Math.floor((currentSettings?.answerTimer || 300) / 60);
      const vMins = Math.floor((currentSettings?.voteTimer || 300) / 60);
      return `
        <div class="lobby__section lobby__settings">
          <h2>Game Settings</h2>
          <div class="lobby__setting">
            <label>Answer Timer</label>
            <select onchange="window.lobbyView.updateFakinItAnswerTimer(this.value)" ${!isHost ? 'disabled' : ''}>
              ${[3,4,5,6,7,8,9,10].map(m => `<option value="${m}" ${m === aMins ? 'selected' : ''}>${m} minutes</option>`).join('')}
            </select>
          </div>
          <div class="lobby__setting">
            <label>Vote Timer</label>
            <select onchange="window.lobbyView.updateFakinItVoteTimer(this.value)" ${!isHost ? 'disabled' : ''}>
              ${[3,4,5,6,7,8,9,10].map(m => `<option value="${m}" ${m === vMins ? 'selected' : ''}>${m} minutes</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }

    if (gameId === 'imposter') {
      const vMins = Math.floor((currentSettings?.voteTimer || 60) / 60);
      return `
        <div class="lobby__section lobby__settings">
          <h2>Game Settings</h2>
          <div class="lobby__setting">
            <label>Vote Timer</label>
            <select onchange="window.lobbyView.updateImposterVoteTimer(this.value)" ${!isHost ? 'disabled' : ''}>
              ${[1,2,3,4,5].map(m => `<option value="${m}" ${m === vMins ? 'selected' : ''}>${m} minute${m > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }

    if (gameId === 'spyfall') {
      const vMins = Math.floor((currentSettings?.voteTimer || 60) / 60);
      return `
        <div class="lobby__section lobby__settings">
          <h2>Game Settings</h2>
          <div class="lobby__setting">
            <label>Vote Timer</label>
            <select onchange="window.lobbyView.updateSpyfallVoteTimer(this.value)" ${!isHost ? 'disabled' : ''}>
              ${[1,2,3,4,5].map(m => `<option value="${m}" ${m === vMins ? 'selected' : ''}>${m} minute${m > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        </div>
      `;
    }

    return '';
  }

  attachEventListeners() {
    // Expose view to window for inline event handlers
    window.lobbyView = this;
  }

  async selectGame(gameId) {
    if (!this.stateManager.isHost()) return;
    await this.stateManager.updateState('selectedGame', gameId);

    const currentSettings = this.stateManager.state.settings?.[gameId];
    if (!currentSettings) {
      const defaults = {
        'fakin-it': { answerTimer: 300, voteTimer: 300 },
        'imposter': { voteTimer: 60 },
        'spyfall': { voteTimer: 60 },
        'herd-mentality': { answerTimer: 60 }
      };
      if (defaults[gameId]) {
        await this.stateManager.updateState(`settings/${gameId}`, defaults[gameId]);
      }
    }
  }

  async updateAnswerTimer(minutes) {
    await this.stateManager.updateState('settings/herd-mentality/answerTimer', parseInt(minutes) * 60);
  }

  async updateFakinItAnswerTimer(minutes) {
    await this.stateManager.updateState('settings/fakin-it/answerTimer', parseInt(minutes) * 60);
  }

  async updateFakinItVoteTimer(minutes) {
    await this.stateManager.updateState('settings/fakin-it/voteTimer', parseInt(minutes) * 60);
  }

  async updateImposterVoteTimer(minutes) {
    await this.stateManager.updateState('settings/imposter/voteTimer', parseInt(minutes) * 60);
  }

  async updateSpyfallVoteTimer(minutes) {
    await this.stateManager.updateState('settings/spyfall/voteTimer', parseInt(minutes) * 60);
  }

  async copyRoomCode() {
    const roomCode = this.stateManager.state.roomCode;
    try {
      await navigator.clipboard.writeText(roomCode);

      // Show feedback
      const codeButton = this.container.querySelector('.lobby__room-code-value');
      if (codeButton) {
        const originalText = codeButton.innerHTML;
        codeButton.innerHTML = `${roomCode} <span class="lobby__copy-icon">✓</span>`;
        codeButton.style.background = 'var(--color-success)';

        setTimeout(() => {
          codeButton.innerHTML = originalText;
          codeButton.style.background = '';
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy room code:', err);
    }
  }

  async startGame() {
    if (!this.stateManager.isHost()) return;

    const { selectedGame, players } = this.stateManager.state;
    if (!selectedGame) return;

    const playerCount = Object.values(players || {}).length;
    const minPlayers = gameRegistry[selectedGame].minPlayers;

    if (playerCount < minPlayers) return;

    // Show starting state
    const startBtn = this.container.querySelector('.lobby__start-btn');
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = 'Starting...';
    }

    try {
      // Import and initialize game
      const { getGameClass } = await import('../games/registry.js');
      const GameClass = await getGameClass(selectedGame);
      const game = new GameClass(this.stateManager.state.roomCode, this.stateManager);

      await game.initialize();
    } catch (error) {
      console.error('Failed to start game:', error);
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = 'Start Game';
      }
    }
  }

  onStateChange(state) {
    // Re-render when state changes
    if (this.container) {
      this.render(this.container);
    }
  }

  destroy() {
    // Clean up window reference
    if (window.lobbyView === this) {
      delete window.lobbyView;
    }
    super.destroy();
  }
}

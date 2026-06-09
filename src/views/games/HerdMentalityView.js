import { BaseView } from '../BaseView.js';
import { HerdMentalityGame } from '../../games/herd-mentality/HerdMentalityGame.js';
import { Timer } from '../../components/game/Timer.js';
import { QuestionDisplay } from '../../components/game/QuestionDisplay.js';
import { PlayerCard } from '../../components/game/PlayerCard.js';
import { Leaderboard } from '../../components/game/Leaderboard.js';
import { ForceNextButton } from '../../components/game/ForceNextButton.js';

/**
 * HerdMentalityView - View for all Herd Mentality phases
 */
export class HerdMentalityView extends BaseView {
  constructor(phase, stateManager) {
    super(stateManager);
    this.phase = phase;
    this.game = new HerdMentalityGame(stateManager.roomCode, stateManager);
    this.timer = null;
    this.draggedCard = null;
  }

  /**
   * Generate template based on current phase
   * @returns {string}
   */
  template() {
    switch(this.phase) {
      case 'question':
        return this.questionTemplate();
      case 'reveal':
        return this.revealTemplate();
      case 'results':
        return this.resultsTemplate();
      default:
        return '<div class="app-wrapper"><div class="container">Loading...</div></div>';
    }
  }

  /**
   * Question phase template
   * @returns {string}
   */
  questionTemplate() {
    const state = this.stateManager.state;
    const question = state.gameData?.herdMentality?.currentQuestion || 'Loading...';
    const player = this.stateManager.getCurrentPlayer();
    const isHost = this.stateManager.isHost();

    // Handle both old string format and new object format
    const answerData = player?.answer;
    const hasSubmitted = answerData ? this.game.repository.isAnswerSubmitted(player) : false;
    const answerValue = answerData ? this.game.repository.getAnswerValue(player) : '';

    return `
      <div class="app-wrapper">
        <div class="container">
          <div class="card">
            <div class="card__header">
              <h1 class="card__title">🐄 Herd Mentality</h1>
            </div>

            <div class="card__body">
              <div id="timer-container"></div>

              <div id="question-container"></div>

              <div class="input-group">
                <label for="answer-input">Your Answer</label>
                <textarea
                  id="answer-input"
                  class="input input--textarea"
                  placeholder="Type your answer here..."
                  ${hasSubmitted ? 'disabled' : ''}
                >${answerValue || ''}</textarea>
              </div>

              <div id="status-container" style="text-align: center; margin: var(--space-md) 0; color: var(--color-primary); font-weight: var(--font-weight-semibold);"></div>

              <div id="error-message" style="display: none; color: var(--color-danger); text-align: center; margin: var(--space-md) 0;"></div>
            </div>

            <div class="card__footer" style="flex-direction: column; gap: var(--space-md);">
              <div style="display: flex; gap: var(--space-md); width: 100%;">
                <button
                  id="submit-btn"
                  class="button button--primary"
                  style="flex: 1; display: ${hasSubmitted ? 'none' : 'block'};"
                >
                  Submit Answer
                </button>
                <button
                  id="change-btn"
                  class="button button--secondary"
                  style="flex: 1; display: ${hasSubmitted ? 'block' : 'none'};"
                >
                  Change Answer
                </button>
              </div>
              ${isHost ? '<div id="force-next-container"></div>' : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Reveal phase template
   * @returns {string}
   */
  revealTemplate() {
    const isHost = this.stateManager.isHost();

    return `
      <div class="app-wrapper">
        <div class="container">
          <div class="card">
            <div class="card__header">
              <h1 class="card__title">🐄 Answers Revealed</h1>
            </div>

            <div class="card__body">
              <div id="answer-groups-container"></div>

              <div id="new-group-zone" class="new-group-zone" style="display: none;">
                📋 Drop here to create a new group
              </div>
            </div>

            ${isHost ? `
              <div class="card__footer" style="flex-direction: column; align-items: stretch; gap: var(--space-md);">
                <p style="color: var(--color-gray-500); font-size: var(--font-size-sm); text-align: center;">
                  Drag cards to regroup answers or create new groups
                </p>
                <button id="show-results-btn" class="button button--success button--full">
                  Show Results
                </button>
                <div id="force-next-container"></div>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Results phase template
   * @returns {string}
   */
  resultsTemplate() {
    const isHost = this.stateManager.isHost();

    return `
      <div class="app-wrapper">
        <div class="container">
          <div class="card">
            <div class="card__header">
              <h1 class="card__title">🐄 Results</h1>
            </div>

            <div class="card__body">
              <div id="leaderboard-container"></div>
            </div>

            ${isHost ? `
              <div class="card__footer">
                <button id="lobby-btn" class="button button--secondary" style="flex: 1;">
                  Return to Lobby
                </button>
                <button id="new-round-btn" class="button button--primary" style="flex: 1;">
                  New Round
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners based on phase
   */
  attachEventListeners() {
    if (this.phase === 'question') {
      this.attachQuestionListeners();
    } else if (this.phase === 'reveal') {
      this.attachRevealListeners();
    } else if (this.phase === 'results') {
      this.attachResultsListeners();
    }
  }

  /**
   * Question phase listeners
   */
  attachQuestionListeners() {
    const state = this.stateManager.state;
    const timerDuration = state.settings?.herdMentality?.answerTimer || 60;
    const question = state.gameData?.herdMentality?.currentQuestion || 'Loading...';

    // Render timer
    const timerContainer = this.getElementById('timer-container');
    this.timer = new Timer(timerContainer, timerDuration, {
      warningThreshold: 10,
      onComplete: () => this.handleTimerExpired(),
      autoStart: true
    });
    this.addComponent(this.timer);

    // Start timer in database (for synchronization across clients)
    if (this.stateManager.isHost()) {
      this.game.repository.startAnswerTimer(timerDuration);
    }

    // Render question
    const questionContainer = this.getElementById('question-container');
    const questionDisplay = new QuestionDisplay(question);
    questionContainer.appendChild(questionDisplay.getElement());
    this.addComponent(questionDisplay);

    // Submit button
    const submitBtn = this.getElementById('submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => this.submitAnswer());
    }

    // Change answer button
    const changeBtn = this.getElementById('change-btn');
    if (changeBtn) {
      changeBtn.addEventListener('click', () => this.changeAnswer());
    }

    // Force-next button (host only)
    if (this.stateManager.isHost()) {
      const forceNextContainer = this.getElementById('force-next-container');
      if (forceNextContainer) {
        const forceNextBtn = new ForceNextButton({
          onForceNext: () => this.handleForceNext(),
          confirmMessage: 'Skip to answer reveal? Players who haven\'t submitted will have no answer.'
        });
        forceNextContainer.appendChild(forceNextBtn.getElement());
        this.addComponent(forceNextBtn);
      }
    }

    // Update submission status
    this.updateSubmissionStatus();
  }

  /**
   * Handle timer expiration
   */
  async handleTimerExpired() {
    const player = this.stateManager.getCurrentPlayer();
    const isSubmitted = player ? this.game.repository.isAnswerSubmitted(player) : false;

    if (player && !isSubmitted) {
      // Auto-submit current answer (even if empty)
      const answerInput = this.getElementById('answer-input');
      const answer = answerInput?.value.trim() || '[No Answer]';
      await this.game.repository.submitAnswer(this.stateManager.playerId, answer);
    }

    // Host auto-advances when timer expires
    if (this.stateManager.isHost()) {
      setTimeout(() => this.game.endRound(), 1000);
    }
  }

  /**
   * Submit answer
   */
  async submitAnswer() {
    const answerInput = this.getElementById('answer-input');
    const answer = answerInput.value.trim();

    if (!answer) {
      this.showError('Please enter an answer');
      return;
    }

    try {
      await this.game.repository.submitAnswer(this.stateManager.playerId, answer);

      // UI will update via state change
      this.getElementById('error-message').style.display = 'none';
    } catch (error) {
      console.error('Error submitting answer:', error);
      this.showError('Failed to submit answer');
    }
  }

  /**
   * Change answer (unsubmit)
   */
  async changeAnswer() {
    try {
      await this.game.repository.unsubmitAnswer(this.stateManager.playerId);

      // UI will update via state change
      const answerInput = this.getElementById('answer-input');
      if (answerInput) {
        answerInput.disabled = false;
        answerInput.focus();
      }
    } catch (error) {
      console.error('Error changing answer:', error);
      this.showError('Failed to change answer');
    }
  }

  /**
   * Handle force-next button click
   */
  async handleForceNext() {
    await this.game.forceNext(this.phase);
  }

  /**
   * Update submission status
   */
  updateSubmissionStatus() {
    const state = this.stateManager.state;
    const players = Object.values(state.players || {});
    const inGamePlayers = players.filter(p => p.inGame);
    const submittedPlayers = inGamePlayers.filter(p => this.game.repository.isAnswerSubmitted(p));

    const statusContainer = this.getElementById('status-container');
    if (statusContainer) {
      statusContainer.textContent = `${submittedPlayers.length}/${inGamePlayers.length} players submitted`;

      // All submitted - host moves to reveal
      if (submittedPlayers.length === inGamePlayers.length &&
          submittedPlayers.length > 0 &&
          this.stateManager.isHost()) {
        setTimeout(() => this.game.endRound(), 1000);
      }
    }

    // Update button visibility based on submission status
    const player = this.stateManager.getCurrentPlayer();
    const hasSubmitted = player ? this.game.repository.isAnswerSubmitted(player) : false;
    const answerValue = player ? this.game.repository.getAnswerValue(player) : '';

    const submitBtn = this.getElementById('submit-btn');
    const changeBtn = this.getElementById('change-btn');
    const answerInput = this.getElementById('answer-input');

    if (submitBtn && changeBtn && answerInput) {
      if (hasSubmitted) {
        submitBtn.style.display = 'none';
        changeBtn.style.display = 'block';
        answerInput.disabled = true;
        answerInput.value = answerValue || '';
      } else {
        submitBtn.style.display = 'block';
        changeBtn.style.display = 'none';
        answerInput.disabled = false;
      }
    }
  }

  /**
   * Reveal phase listeners
   */
  attachRevealListeners() {
    this.renderAnswerGroups();

    // Show results button (host only)
    const showResultsBtn = this.getElementById('show-results-btn');
    if (showResultsBtn) {
      showResultsBtn.addEventListener('click', () => this.game.processResults());
    }

    // Force-next button (host only)
    if (this.stateManager.isHost()) {
      const forceNextContainer = this.getElementById('force-next-container');
      if (forceNextContainer) {
        const forceNextBtn = new ForceNextButton({
          onForceNext: () => this.handleForceNext(),
          confirmMessage: 'Calculate results and show leaderboard?',
          buttonText: '⏭️ Force Results'
        });
        forceNextContainer.appendChild(forceNextBtn.getElement());
        this.addComponent(forceNextBtn);
      }
    }
  }

  /**
   * Render answer groups
   */
  async renderAnswerGroups() {
    const state = this.stateManager.state;
    let groupings = state.gameData?.herdMentality?.answerGroupings;

    // Auto-group if not done
    if (!groupings && this.stateManager.isHost()) {
      groupings = this.game.groupAnswers(state.players);
      await this.game.repository.setAnswerGroupings(groupings);
      return; // Will re-render on state change
    }

    if (!groupings) return;

    const container = this.getElementById('answer-groups-container');
    container.innerHTML = '';

    const pinkCowHolder = state.settings?.herdMentality?.pinkCowHolder;
    const isHost = this.stateManager.isHost();

    // Sort by size
    const sortedGroups = Object.entries(groupings).sort((a, b) => b[1].length - a[1].length);

    // Find majority and new pink cow
    const groupSizes = sortedGroups.map(([_, answers]) => answers.length);
    const maxSize = Math.max(...groupSizes);
    const majorityGroups = sortedGroups.filter(([_, answers]) => answers.length === maxSize);
    const majorityKey = majorityGroups.length === 1 ? sortedGroups[0][0] : null;

    const singleGroups = sortedGroups.filter(([_, answers]) => answers.length === 1);
    const newPinkCowKey = singleGroups.length === 1 ? singleGroups[0][0] : null;

    sortedGroups.forEach(([groupKey, answers], index) => {
      const isMajority = groupKey === majorityKey;
      const isNewPinkCow = groupKey === newPinkCowKey;

      const groupDiv = document.createElement('div');
      groupDiv.className = 'answer-group';
      groupDiv.dataset.groupKey = groupKey;
      groupDiv.style.marginBottom = 'var(--space-lg)';
      groupDiv.style.border = '2px solid var(--color-gray-300)';
      groupDiv.style.borderRadius = 'var(--radius-md)';
      groupDiv.style.padding = 'var(--space-lg)';

      if (isMajority) {
        groupDiv.style.borderColor = 'var(--color-success)';
        groupDiv.style.background = 'var(--color-success-light)';
      }
      if (isNewPinkCow) {
        groupDiv.style.borderColor = 'var(--color-pink)';
        groupDiv.style.background = 'var(--color-pink-light)';
      }

      // Header
      const header = document.createElement('div');
      header.style.fontWeight = 'var(--font-weight-semibold)';
      header.style.fontSize = 'var(--font-size-lg)';
      header.style.marginBottom = 'var(--space-md)';
      header.style.color = 'var(--color-primary)';

      let headerText = `Group ${index + 1} (${answers.length} ${answers.length === 1 ? 'player' : 'players'})`;
      if (isMajority) headerText += ' <span style="color: var(--color-success);">(Majority)</span>';
      if (isNewPinkCow) headerText += ' <span style="color: var(--color-pink);">(New Pink Cow)</span>';

      header.innerHTML = headerText;
      groupDiv.appendChild(header);

      // Cards container
      const cardsContainer = document.createElement('div');
      cardsContainer.style.display = 'flex';
      cardsContainer.style.flexWrap = 'wrap';
      cardsContainer.style.gap = 'var(--space-md)';

      answers.forEach(ans => {
        const hasPinkCow = ans.playerId === pinkCowHolder;
        const points = (isMajority && !hasPinkCow) ? 1 : 0;

        const badges = [];
        if (hasPinkCow) {
          badges.push({ text: '(Pink Cow)', color: 'var(--color-pink)' });
        }

        const card = new PlayerCard({
          id: ans.playerId,
          name: ans.playerName,
          answer: ans.answer,
          points
        }, {
          showAnswer: true,
          showPoints: true,
          badges,
          selectable: false
        });

        const cardElement = card.getElement();
        cardElement.draggable = isHost;
        cardElement.dataset.groupKey = groupKey;

        cardsContainer.appendChild(cardElement);
        this.addComponent(card);
      });

      groupDiv.appendChild(cardsContainer);

      // Drag-drop for host
      if (isHost) {
        groupDiv.addEventListener('dragover', (e) => e.preventDefault());
        groupDiv.addEventListener('drop', (e) => this.handleDrop(e, groupKey));
      }

      container.appendChild(groupDiv);
    });

    // New group zone for host
    if (isHost) {
      const newGroupZone = this.getElementById('new-group-zone');
      newGroupZone.style.display = 'flex';
      newGroupZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        newGroupZone.style.background = 'var(--color-primary-light)';
      });
      newGroupZone.addEventListener('dragleave', () => {
        newGroupZone.style.background = '';
      });
      newGroupZone.addEventListener('drop', (e) => this.handleNewGroupDrop(e));

      // Setup card drag handlers
      const cards = this.querySelectorAll('.player-card');
      cards.forEach(card => {
        card.addEventListener('dragstart', (e) => {
          this.draggedCard = e.target;
          newGroupZone.style.display = 'flex';
        });
        card.addEventListener('dragend', () => {
          this.draggedCard = null;
          newGroupZone.style.display = 'none';
        });
      });
    }
  }

  /**
   * Handle drop on group
   */
  async handleDrop(e, targetGroupKey) {
    e.preventDefault();
    if (!this.draggedCard) return;

    const sourceGroupKey = this.draggedCard.dataset.groupKey;
    if (sourceGroupKey === targetGroupKey) return;

    const playerId = this.draggedCard.dataset.playerId;
    await this.moveCardToGroup(playerId, sourceGroupKey, targetGroupKey);
  }

  /**
   * Handle drop on new group zone
   */
  async handleNewGroupDrop(e) {
    e.preventDefault();
    if (!this.draggedCard) return;

    const sourceGroupKey = this.draggedCard.dataset.groupKey;
    const playerId = this.draggedCard.dataset.playerId;

    await this.createNewGroup(playerId, sourceGroupKey);
  }

  /**
   * Move card to different group
   */
  async moveCardToGroup(playerId, sourceKey, targetKey) {
    const state = this.stateManager.state;
    const groupings = { ...state.gameData.herdMentality.answerGroupings };

    const player = groupings[sourceKey].find(p => p.playerId === playerId);
    groupings[sourceKey] = groupings[sourceKey].filter(p => p.playerId !== playerId);

    if (!groupings[targetKey]) groupings[targetKey] = [];
    groupings[targetKey].push(player);

    if (groupings[sourceKey].length === 0) delete groupings[sourceKey];

    await this.game.repository.setAnswerGroupings(groupings);
  }

  /**
   * Create new group with one player
   */
  async createNewGroup(playerId, sourceKey) {
    const state = this.stateManager.state;
    const groupings = { ...state.gameData.herdMentality.answerGroupings };

    const player = groupings[sourceKey].find(p => p.playerId === playerId);
    groupings[sourceKey] = groupings[sourceKey].filter(p => p.playerId !== playerId);

    if (groupings[sourceKey].length === 0) delete groupings[sourceKey];

    const newKey = `group_${playerId}_${Date.now()}`;
    groupings[newKey] = [player];

    await this.game.repository.setAnswerGroupings(groupings);
  }

  /**
   * Results phase listeners
   */
  attachResultsListeners() {
    this.renderLeaderboard();

    const lobbyBtn = this.getElementById('lobby-btn');
    if (lobbyBtn) {
      lobbyBtn.addEventListener('click', () => this.game.returnToLobby());
    }

    const newRoundBtn = this.getElementById('new-round-btn');
    if (newRoundBtn) {
      newRoundBtn.addEventListener('click', () => this.game.newRound());
    }
  }

  /**
   * Render leaderboard
   */
  renderLeaderboard() {
    const state = this.stateManager.state;
    const players = Object.entries(state.players || {})
      .filter(([_, p]) => p.inGame)
      .map(([id, p]) => ({ id, ...p }));

    const pinkCowHolder = state.settings?.herdMentality?.pinkCowHolder;
    const currentPlayerId = this.stateManager.playerId;

    const container = this.getElementById('leaderboard-container');
    const leaderboard = new Leaderboard(players, {
      pinkCowPlayerId: pinkCowHolder,
      highlightPlayerId: currentPlayerId,
      showRank: true,
      showCrown: true
    });

    container.appendChild(leaderboard.getElement());
    this.addComponent(leaderboard);
  }

  /**
   * Handle state changes
   */
  onStateChange(state) {
    if (this.phase === 'question') {
      this.updateSubmissionStatus();
    } else if (this.phase === 'reveal') {
      this.renderAnswerGroups();
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.timer) {
      this.timer.stop();
    }
    super.destroy();
  }
}

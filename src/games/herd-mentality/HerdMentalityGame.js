import { BaseGame } from '../BaseGame.js';
import { HerdMentalityRepository } from '../../repositories/games/HerdMentalityRepository.js';
import { db } from '../../../firebase-config.js';

/**
 * HerdMentalityGame - Game logic for Herd Mentality
 */
export class HerdMentalityGame extends BaseGame {
  constructor(roomCode, stateManager) {
    super(roomCode, stateManager);
    this.minPlayers = 3;
    this.repository = new HerdMentalityRepository(db, roomCode);
  }

  /**
   * Initialize game
   */
  async initialize() {
    const players = this.getAllPlayers().map(p => p.id);
    await this.repository.initializeGameData(players);
    await this.transitionToPhase('question');
  }

  /**
   * Start a new round
   */
  async startRound() {
    const question = await this.repository.getNextQuestion();
    await this.repository.setCurrentQuestion(question);
    await this.repository.clearAnswers();
    await this.transitionToPhase('question');
  }

  /**
   * Group answers using normalization algorithm
   * @param {Object} players - Players object
   * @returns {Object} Grouped answers
   */
  groupAnswers(players) {
    const groups = {};

    Object.entries(players).forEach(([pid, player]) => {
      if (!player.inGame) return;

      // Get answer value (handles both old string and new object format)
      const answerValue = this.repository.getAnswerValue(player);
      if (!answerValue) return;

      const normalized = this.normalizeAnswer(answerValue);

      if (!groups[normalized]) {
        groups[normalized] = [];
      }

      groups[normalized].push({
        playerId: pid,
        playerName: player.name,
        answer: answerValue
      });
    });

    return groups;
  }

  /**
   * Normalize answer for grouping
   * @param {string} answer - Raw answer
   * @returns {string} Normalized answer
   */
  normalizeAnswer(answer) {
    return answer
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/s\s*$/i, '')   // Remove trailing 's'
      .trim();
  }

  /**
   * Calculate scores based on groupings
   * @param {Object} gameData - Game data with answerGroupings
   * @param {Object} players - Players object
   * @returns {Object} Score updates {playerId: points}
   */
  calculateScores(gameData, players) {
    const groupings = gameData?.answerGroupings || {};
    const pinkCowHolder = this.stateManager.state.settings?.herdMentality?.pinkCowHolder;

    // Find majority group (largest unique size)
    const groupSizes = Object.values(groupings).map(g => g.length);
    if (groupSizes.length === 0) return {};

    const maxSize = Math.max(...groupSizes);
    const largestGroups = Object.values(groupings).filter(g => g.length === maxSize);
    const hasMajority = largestGroups.length === 1;

    const scores = {};

    // Award points to majority group
    if (hasMajority) {
      const majorityGroup = largestGroups[0];

      majorityGroup.forEach(player => {
        const pid = player.playerId;
        // Only exclude if there IS a pink cow AND this player has it
        // If pinkCowHolder is null/undefined, everyone in majority scores
        // This fixes the early-game scoring issue
        if (!pinkCowHolder || pid !== pinkCowHolder) {
          scores[pid] = 1;
        }
      });
    }

    return scores;
  }

  /**
   * Determine new pink cow holder
   * @param {Object} groupings - Answer groupings
   * @returns {string|null} New pink cow holder ID or null
   */
  determineNewPinkCow(groupings) {
    // Find groups with only 1 player (unique answers)
    const singlePlayerGroups = Object.values(groupings).filter(g => g.length === 1);

    // Only one unique answer = new pink cow
    if (singlePlayerGroups.length === 1) {
      return singlePlayerGroups[0][0].playerId;
    }

    // Multiple unique or none = keep current pink cow
    const currentPinkCow = this.stateManager.state.settings?.herdMentality?.pinkCowHolder;
    return currentPinkCow;
  }

  /**
   * End round and calculate results
   */
  async endRound() {
    const state = this.stateManager.state;
    const groupings = state.gameData?.herdMentality?.answerGroupings;

    if (!groupings) {
      // Auto-group if not done yet
      const autoGroupings = this.groupAnswers(state.players);
      await this.repository.setAnswerGroupings(autoGroupings);
    }

    await this.transitionToPhase('reveal');
  }

  /**
   * Process results and transition to results screen
   * IMPORTANT: Scores MUST be calculated and applied BEFORE pink cow transfer
   * This ensures the current pink cow holder doesn't get points if they're in the majority
   */
  async processResults() {
    const state = this.stateManager.state;
    const groupings = state.gameData?.herdMentality?.answerGroupings || {};

    // Guard: ensure groupings exist
    if (!groupings || Object.keys(groupings).length === 0) {
      console.error('No answer groupings found');
      return;
    }

    // Step 1: Calculate scores based on CURRENT pink cow holder
    const scores = this.calculateScores(state.gameData, state.players);

    // Step 2: Apply scores BEFORE pink cow transfer
    await this.repository.updateScores(scores);

    // Step 3: NOW determine new pink cow (after scores are applied)
    const newPinkCow = this.determineNewPinkCow(groupings);

    // Step 4: Transfer pink cow AFTER scores have been awarded
    const currentPinkCow = state.settings?.herdMentality?.pinkCowHolder;
    if (newPinkCow !== currentPinkCow) {
      await this.repository.setPinkCowHolder(newPinkCow);
    }

    // Mark scores as calculated
    await this.repository.markScoresCalculated();

    // Transition to results
    await this.transitionToPhase('results');
  }

  /**
   * Return to lobby
   */
  async returnToLobby() {
    const playerIds = this.getAllPlayers().map(p => p.id);

    const updates = {};
    updates[`phase`] = 'lobby';
    updates[`selectedGame`] = null;
    updates[`gameData/herdMentality`] = null;
    updates[`settings/herdMentality`] = null;

    playerIds.forEach(pid => {
      updates[`players/${pid}/inGame`] = false;
      updates[`players/${pid}/answer`] = null;
      updates[`players/${pid}/score`] = 0;
    });

    await this.stateManager.batchUpdate(updates);
  }

  /**
   * Start new round
   */
  async newRound() {
    await this.repository.resetForNewRound();
    await this.startRound();
  }

  /**
   * Force advance to next phase (host only)
   * @param {string} currentPhase - Current game phase
   */
  async forceNext(currentPhase) {
    switch(currentPhase) {
      case 'question':
        // Force end of question phase - move to reveal
        await this.endRound();
        break;

      case 'reveal':
        // Force show results - process with current groupings
        await this.processResults();
        break;

      case 'results':
        // No force-next needed - host has explicit buttons
        break;

      default:
        console.warn('Unknown phase for force-next:', currentPhase);
    }
  }
}

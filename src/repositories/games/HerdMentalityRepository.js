import { ref, update, get } from '../../../firebase-config.js';

/**
 * HerdMentalityRepository - Game-specific database operations
 */
export class HerdMentalityRepository {
  constructor(db, roomCode) {
    this.db = db;
    this.roomCode = roomCode;
  }

  /**
   * Initialize game data
   * @param {Array<string>} playerIds - Array of player IDs
   */
  async initializeGameData(playerIds) {
    const updates = {};

    // Initialize game data
    updates[`rooms/${this.roomCode}/gameData/herdMentality`] = {
      currentQuestion: null,
      usedQuestions: [],
      answerGroupings: null,
      scoresCalculated: false,
      answerTimerStarted: null,
      answerTimerDuration: null
    };

    // Initialize settings with explicit null for pinkCowHolder
    updates[`rooms/${this.roomCode}/settings/herdMentality`] = {
      answerTimer: 60, // 1 minute default (in seconds)
      currentRound: 1,
      pinkCowHolder: null // Explicitly set to null for first round
    };

    // Initialize player states
    playerIds.forEach(pid => {
      updates[`rooms/${this.roomCode}/players/${pid}/inGame`] = true;
      updates[`rooms/${this.roomCode}/players/${pid}/score`] = 0;
      updates[`rooms/${this.roomCode}/players/${pid}/answer`] = null;
    });

    await update(ref(this.db), updates);
  }

  /**
   * Get next random question
   * @returns {string} Question text
   */
  async getNextQuestion() {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    const usedQuestions = data?.gameData?.herdMentality?.usedQuestions || [];

    // Import questions dynamically
    const { getRandomQuestion } = await import('../../games/herd-mentality/questions.js');
    const question = getRandomQuestion(usedQuestions);

    // Update used questions
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/gameData/herdMentality/usedQuestions`]: [...usedQuestions, question]
    });

    return question;
  }

  /**
   * Set current question
   * @param {string} question - Question text
   */
  async setCurrentQuestion(question) {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/gameData/herdMentality/currentQuestion`]: question
    });
  }

  /**
   * Submit player answer (with resubmission support)
   * @param {string} playerId - Player ID
   * @param {string} answerValue - Answer text
   */
  async submitAnswer(playerId, answerValue) {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/players/${playerId}/answer`]: {
        value: answerValue,
        submitted: true,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Unsubmit player answer (allows changing answer)
   * @param {string} playerId - Player ID
   */
  async unsubmitAnswer(playerId) {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();
    const currentAnswer = data?.players?.[playerId]?.answer;

    if (currentAnswer) {
      // Preserve value but mark as not submitted
      const answerData = this.normalizeAnswer(currentAnswer);
      await update(ref(this.db), {
        [`rooms/${this.roomCode}/players/${playerId}/answer`]: {
          value: answerData.value,
          submitted: false,
          timestamp: Date.now()
        }
      });
    }
  }

  /**
   * Normalize answer data (handles old string format or new object format)
   * @param {string|Object} answer - Answer data
   * @returns {Object} Normalized answer object
   */
  normalizeAnswer(answer) {
    if (typeof answer === 'string') {
      // Old format - auto-upgrade
      return {
        value: answer,
        submitted: true,
        timestamp: Date.now()
      };
    }
    return answer; // Already new format
  }

  /**
   * Get player's answer value
   * @param {Object} playerData - Player data object
   * @returns {string|null} Answer value or null
   */
  getAnswerValue(playerData) {
    const answer = playerData?.answer;
    if (!answer) return null;

    const normalized = this.normalizeAnswer(answer);
    return normalized.value;
  }

  /**
   * Check if player has submitted their answer
   * @param {Object} playerData - Player data object
   * @returns {boolean} True if submitted
   */
  isAnswerSubmitted(playerData) {
    const answer = playerData?.answer;
    if (!answer) return false;

    const normalized = this.normalizeAnswer(answer);
    return normalized.submitted === true;
  }

  /**
   * Clear all player answers
   */
  async clearAnswers() {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    const updates = {};
    Object.keys(data.players || {}).forEach(pid => {
      if (data.players[pid].inGame) {
        updates[`rooms/${this.roomCode}/players/${pid}/answer`] = null;
      }
    });

    await update(ref(this.db), updates);
  }

  /**
   * Get answer groupings
   * @returns {Object} Grouped answers
   */
  async getAnswerGroupings() {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    return data?.gameData?.herdMentality?.answerGroupings || {};
  }

  /**
   * Set answer groupings
   * @param {Object} groupings - Grouped answers
   */
  async setAnswerGroupings(groupings) {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/gameData/herdMentality/answerGroupings`]: groupings
    });
  }

  /**
   * Update player scores
   * @param {Object} scoreUpdates - {playerId: pointsToAdd}
   */
  async updateScores(scoreUpdates) {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    const updates = {};
    Object.entries(scoreUpdates).forEach(([playerId, points]) => {
      const currentScore = data.players[playerId]?.score || 0;
      updates[`rooms/${this.roomCode}/players/${playerId}/score`] = currentScore + points;
    });

    await update(ref(this.db), updates);
  }

  /**
   * Set pink cow holder
   * @param {string|null} playerId - Player ID or null
   */
  async setPinkCowHolder(playerId) {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/settings/herdMentality/pinkCowHolder`]: playerId
    });
  }

  /**
   * Get pink cow holder
   * @returns {string|null} Player ID or null
   */
  async getPinkCowHolder() {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    return data?.settings?.herdMentality?.pinkCowHolder || null;
  }

  /**
   * Mark scores as calculated
   */
  async markScoresCalculated() {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/gameData/herdMentality/scoresCalculated`]: true
    });
  }

  /**
   * Increment round
   */
  async incrementRound() {
    const roomRef = ref(this.db, `rooms/${this.roomCode}`);
    const snapshot = await get(roomRef);
    const data = snapshot.val();

    const currentRound = data?.settings?.herdMentality?.currentRound || 1;

    await update(ref(this.db), {
      [`rooms/${this.roomCode}/settings/herdMentality/currentRound`]: currentRound + 1
    });
  }

  /**
   * Start answer timer
   * @param {number} duration - Timer duration in seconds
   */
  async startAnswerTimer(duration) {
    await update(ref(this.db), {
      [`rooms/${this.roomCode}/gameData/herdMentality/answerTimerStarted`]: Date.now(),
      [`rooms/${this.roomCode}/gameData/herdMentality/answerTimerDuration`]: duration
    });
  }

  /**
   * Check if answer timer has expired
   * @param {Object} gameData - Game data object
   * @returns {boolean} True if timer expired
   */
  isAnswerTimerExpired(gameData) {
    const started = gameData?.herdMentality?.answerTimerStarted;
    const duration = gameData?.herdMentality?.answerTimerDuration;

    if (!started || !duration) return false;

    return (Date.now() - started) >= (duration * 1000);
  }

  /**
   * Check if all in-game players have submitted answers
   * @param {Object} players - Players object
   * @returns {boolean} True if all submitted
   */
  checkAllAnswersSubmitted(players) {
    const inGamePlayers = Object.values(players || {}).filter(p => p.inGame);
    if (inGamePlayers.length === 0) return false;

    const submittedPlayers = inGamePlayers.filter(p => this.isAnswerSubmitted(p));
    return submittedPlayers.length === inGamePlayers.length;
  }

  /**
   * Reset for new round
   */
  async resetForNewRound() {
    const updates = {};
    updates[`rooms/${this.roomCode}/gameData/herdMentality/currentQuestion`] = null;
    updates[`rooms/${this.roomCode}/gameData/herdMentality/answerGroupings`] = null;
    updates[`rooms/${this.roomCode}/gameData/herdMentality/scoresCalculated`] = false;
    updates[`rooms/${this.roomCode}/gameData/herdMentality/answerTimerStarted`] = null;
    updates[`rooms/${this.roomCode}/gameData/herdMentality/answerTimerDuration`] = null;

    await update(ref(this.db), updates);
    await this.clearAnswers();
    await this.incrementRound();
  }
}

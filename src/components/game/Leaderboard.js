/**
 * Leaderboard - Displays sorted list of players with scores
 */
export class Leaderboard {
  constructor(players, options = {}) {
    this.players = players;
    this.options = {
      showRank: options.showRank !== false,
      showCrown: options.showCrown !== false,
      highlightPlayerId: options.highlightPlayerId || null,
      pinkCowPlayerId: options.pinkCowPlayerId || null,
      sortBy: options.sortBy || 'score', // 'score' or custom function
      ascending: options.ascending || false
    };

    this.element = this.create();
  }

  /**
   * Create leaderboard element
   * @returns {HTMLElement}
   */
  create() {
    const container = document.createElement('div');
    container.className = 'leaderboard';

    // Sort players
    const sortedPlayers = this.sortPlayers();

    // Find highest score (excluding pink cow if needed)
    const scores = sortedPlayers
      .filter(p => p.id !== this.options.pinkCowPlayerId)
      .map(p => p.score || 0);
    const highestScore = Math.max(...scores, 0);
    const topPlayers = sortedPlayers.filter(p =>
      p.id !== this.options.pinkCowPlayerId && (p.score || 0) === highestScore
    );
    const isTied = topPlayers.length > 1 && highestScore > 0;

    sortedPlayers.forEach((player, index) => {
      const row = document.createElement('div');
      row.className = 'leaderboard__row';
      row.dataset.playerId = player.id;

      // Highlight current player
      if (player.id === this.options.highlightPlayerId) {
        row.classList.add('leaderboard__row--highlight');
      }

      // Pink cow styling
      if (player.id === this.options.pinkCowPlayerId) {
        row.classList.add('leaderboard__row--pink-cow');
      }

      // Info section
      const info = document.createElement('div');
      info.className = 'leaderboard__info';

      // Rank
      if (this.options.showRank) {
        const rank = document.createElement('span');
        rank.className = 'leaderboard__rank';
        rank.textContent = `#${index + 1}`;
        info.appendChild(rank);
      }

      // Name
      const name = document.createElement('span');
      name.className = 'leaderboard__name';
      name.textContent = player.name;
      info.appendChild(name);

      // Crown for winner(s)
      if (this.options.showCrown && player.id !== this.options.pinkCowPlayerId && (player.score || 0) === highestScore && highestScore > 0) {
        if (isTied) {
          const tiedLabel = document.createElement('span');
          tiedLabel.className = 'leaderboard__label leaderboard__label--tied';
          tiedLabel.textContent = '(Tied)';
          info.appendChild(tiedLabel);
        } else {
          const crown = document.createElement('span');
          crown.className = 'leaderboard__crown';
          crown.textContent = '👑';
          info.appendChild(crown);
        }
      }

      // Pink cow label
      if (player.id === this.options.pinkCowPlayerId) {
        const pinkCowLabel = document.createElement('span');
        pinkCowLabel.className = 'leaderboard__label leaderboard__label--pink-cow';
        pinkCowLabel.textContent = '(Pink Cow)';
        info.appendChild(pinkCowLabel);
      }

      row.appendChild(info);

      // Score
      const score = document.createElement('div');
      score.className = 'leaderboard__score';
      score.textContent = `${player.score || 0} pts`;
      row.appendChild(score);

      container.appendChild(row);
    });

    return container;
  }

  /**
   * Sort players based on options
   * @returns {Array}
   */
  sortPlayers() {
    const playersCopy = [...this.players];

    if (typeof this.options.sortBy === 'function') {
      return playersCopy.sort(this.options.sortBy);
    }

    // Default: sort by score
    playersCopy.sort((a, b) => {
      const aScore = a[this.options.sortBy] || 0;
      const bScore = b[this.options.sortBy] || 0;

      if (this.options.ascending) {
        return aScore - bScore;
      } else {
        return bScore - aScore;
      }
    });

    return playersCopy;
  }

  /**
   * Get leaderboard element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Update leaderboard with new players
   * @param {Array} newPlayers
   */
  update(newPlayers) {
    this.players = newPlayers;
    const parent = this.element.parentNode;
    const newElement = this.create();

    if (parent) {
      parent.replaceChild(newElement, this.element);
    }

    this.element = newElement;
  }

  /**
   * Destroy leaderboard
   */
  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

/**
 * PlayerCard - Reusable player display card
 */
export class PlayerCard {
  constructor(playerData, options = {}) {
    this.playerData = playerData;
    this.options = {
      showScore: options.showScore !== false,
      showAnswer: options.showAnswer || false,
      showPoints: options.showPoints || false,
      selectable: options.selectable || false,
      selected: options.selected || false,
      onClick: options.onClick || null,
      variant: options.variant || null, // 'pink-cow', 'selected', etc.
      badges: options.badges || [] // Array of badge objects {text, color}
    };

    this.element = this.create();
  }

  /**
   * Create player card element
   * @returns {HTMLElement}
   */
  create() {
    const card = document.createElement('div');
    card.className = 'player-card';
    card.dataset.playerId = this.playerData.id;

    // Add variant class
    if (this.options.variant) {
      card.classList.add(`player-card--${this.options.variant}`);
    }

    // Add selected class
    if (this.options.selected) {
      card.classList.add('player-card--selected');
    }

    // Selectable
    if (this.options.selectable) {
      card.style.cursor = 'pointer';
    }

    // Build card content
    const nameContainer = document.createElement('div');
    nameContainer.className = 'player-card__name';

    // Player name
    const nameText = document.createElement('span');
    nameText.textContent = this.playerData.name;
    nameContainer.appendChild(nameText);

    // Badges (Pink Cow, etc.)
    this.options.badges.forEach(badge => {
      const badgeSpan = document.createElement('span');
      badgeSpan.className = 'player-card__badge';
      badgeSpan.style.color = badge.color || 'var(--color-primary)';
      badgeSpan.textContent = ` ${badge.text}`;
      nameContainer.appendChild(badgeSpan);
    });

    // Points indicator
    if (this.options.showPoints && this.playerData.points !== undefined) {
      const pointsSpan = document.createElement('span');
      pointsSpan.className = `player-card__points ${this.playerData.points > 0 ? 'player-card__points--positive' : 'player-card__points--zero'}`;
      pointsSpan.textContent = `+${this.playerData.points}`;
      nameContainer.appendChild(pointsSpan);
    }

    card.appendChild(nameContainer);

    // Answer
    if (this.options.showAnswer && this.playerData.answer) {
      const answerDiv = document.createElement('div');
      answerDiv.className = 'player-card__answer';
      answerDiv.textContent = this.playerData.answer;
      card.appendChild(answerDiv);
    }

    // Score
    if (this.options.showScore && this.playerData.score !== undefined) {
      const scoreDiv = document.createElement('div');
      scoreDiv.className = 'player-card__score';
      scoreDiv.textContent = `${this.playerData.score} pts`;
      card.appendChild(scoreDiv);
    }

    // Click handler
    if (this.options.onClick) {
      card.addEventListener('click', () => {
        this.options.onClick(this.playerData);
      });
    }

    return card;
  }

  /**
   * Get card element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Update player data
   * @param {Object} newData
   */
  update(newData) {
    this.playerData = { ...this.playerData, ...newData };
    const parent = this.element.parentNode;
    const newElement = this.create();

    if (parent) {
      parent.replaceChild(newElement, this.element);
    }

    this.element = newElement;
  }

  /**
   * Set selected state
   * @param {boolean} selected
   */
  setSelected(selected) {
    this.options.selected = selected;
    if (selected) {
      this.element.classList.add('player-card--selected');
    } else {
      this.element.classList.remove('player-card--selected');
    }
  }

  /**
   * Destroy card
   */
  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

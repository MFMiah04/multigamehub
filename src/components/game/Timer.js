/**
 * Timer - Reusable countdown timer component
 */
export class Timer {
  constructor(containerElement, duration, options = {}) {
    this.container = containerElement;
    this.duration = duration;
    this.timeLeft = duration;
    this.interval = null;

    this.options = {
      warningThreshold: options.warningThreshold || 5,
      onTick: options.onTick || null,
      onComplete: options.onComplete || null,
      autoStart: options.autoStart || false,
      showLabel: options.showLabel !== false
    };

    this.render();

    if (this.options.autoStart) {
      this.start();
    }
  }

  /**
   * Render the timer HTML
   */
  render() {
    const isWarning = this.timeLeft <= this.options.warningThreshold;
    const timerClass = `timer ${isWarning ? 'timer--warning' : ''}`;

    this.container.innerHTML = `
      <div class="${timerClass}">
        ${this.timeLeft}
      </div>
    `;
  }

  /**
   * Start the timer
   */
  start() {
    if (this.interval) {
      return; // Already running
    }

    this.interval = setInterval(() => {
      this.timeLeft--;
      this.render();

      if (this.options.onTick) {
        this.options.onTick(this.timeLeft);
      }

      if (this.timeLeft <= 0) {
        this.stop();
        if (this.options.onComplete) {
          this.options.onComplete();
        }
      }
    }, 1000);
  }

  /**
   * Stop the timer
   */
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * Reset the timer
   * @param {number} newDuration - Optional new duration
   */
  reset(newDuration) {
    this.stop();

    if (newDuration !== undefined) {
      this.duration = newDuration;
    }

    this.timeLeft = this.duration;
    this.render();
  }

  /**
   * Pause the timer
   */
  pause() {
    this.stop();
  }

  /**
   * Resume the timer
   */
  resume() {
    if (!this.interval && this.timeLeft > 0) {
      this.start();
    }
  }

  /**
   * Get remaining time
   * @returns {number}
   */
  getTimeLeft() {
    return this.timeLeft;
  }

  /**
   * Check if timer is running
   * @returns {boolean}
   */
  isRunning() {
    return this.interval !== null;
  }

  /**
   * Destroy the timer (cleanup)
   */
  destroy() {
    this.stop();
    this.container.innerHTML = '';
  }
}

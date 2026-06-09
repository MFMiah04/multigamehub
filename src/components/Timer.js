export class Timer {
  constructor(options) {
    this.element = options.element;
    this.duration = options.duration;
    this.warningAt = options.warningAt || 60;
    this.onTick = options.onTick || null;
    this.onComplete = options.onComplete || null;

    this.timeLeft = this.duration;
    this.interval = null;
  }

  start() {
    this.updateDisplay();
    this.interval = setInterval(() => {
      this.timeLeft--;
      this.updateDisplay();

      if (this.timeLeft === this.warningAt) {
        this.element.style.color = '#e74c3c';
      }

      if (this.onTick) this.onTick(this.timeLeft);

      if (this.timeLeft <= 0) {
        this.stop();
        if (this.onComplete) this.onComplete();
      }
    }, 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  reset(duration) {
    this.stop();
    this.duration = duration || this.duration;
    this.timeLeft = this.duration;
    this.element.style.color = '#667eea';
    this.updateDisplay();
  }

  updateDisplay() {
    const minutes = Math.floor(this.timeLeft / 60);
    const seconds = this.timeLeft % 60;
    this.element.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
}

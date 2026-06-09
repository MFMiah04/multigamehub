/**
 * QuestionDisplay - Displays question in a styled container
 */
export class QuestionDisplay {
  constructor(question, options = {}) {
    this.question = question;
    this.options = {
      label: options.label || 'Question:',
      className: options.className || ''
    };

    this.element = this.create();
  }

  /**
   * Create question display element
   * @returns {HTMLElement}
   */
  create() {
    const container = document.createElement('div');
    container.className = 'question-display';

    if (this.options.className) {
      this.options.className.split(' ').forEach(cls => {
        if (cls) container.classList.add(cls);
      });
    }

    // Label
    if (this.options.label) {
      const label = document.createElement('h3');
      label.className = 'question-display__label';
      label.textContent = this.options.label;
      container.appendChild(label);
    }

    // Question text
    const text = document.createElement('p');
    text.className = 'question-display__text';
    text.textContent = this.question;
    container.appendChild(text);

    return container;
  }

  /**
   * Get element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Update question text
   * @param {string} newQuestion
   */
  setQuestion(newQuestion) {
    this.question = newQuestion;
    const textElement = this.element.querySelector('.question-display__text');
    if (textElement) {
      textElement.textContent = newQuestion;
    }
  }

  /**
   * Destroy element
   */
  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

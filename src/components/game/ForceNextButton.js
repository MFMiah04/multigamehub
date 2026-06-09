/**
 * ForceNextButton - Reusable component for host to force advance to next phase
 *
 * Usage:
 *   const forceNextBtn = new ForceNextButton({
 *     onForceNext: () => this.handleForceNext(),
 *     confirmMessage: 'Skip to next screen?'
 *   });
 *   container.appendChild(forceNextBtn.getElement());
 */
export class ForceNextButton {
  constructor(options = {}) {
    this.options = {
      onForceNext: options.onForceNext || (() => {}),
      confirmMessage: options.confirmMessage || 'Skip to next screen? This will end the current phase.',
      buttonText: options.buttonText || 'Force Next',
      className: options.className || 'button button--secondary button--full'
    };

    this.element = null;
  }

  /**
   * Get the button DOM element
   * @returns {HTMLElement}
   */
  getElement() {
    if (this.element) {
      return this.element;
    }

    this.element = document.createElement('button');
    this.element.className = this.options.className;
    this.element.textContent = this.options.buttonText;
    this.element.style.marginTop = 'var(--space-lg)';

    this.element.addEventListener('click', () => this.handleClick());

    return this.element;
  }

  /**
   * Handle button click with confirmation
   */
  async handleClick() {
    if (confirm(this.options.confirmMessage)) {
      try {
        await this.options.onForceNext();
      } catch (error) {
        console.error('Error forcing next phase:', error);
        alert('Failed to advance to next phase. Please try again.');
      }
    }
  }

  /**
   * Update button text
   * @param {string} text - New button text
   */
  setText(text) {
    if (this.element) {
      this.element.textContent = text;
    }
    this.options.buttonText = text;
  }

  /**
   * Disable the button
   */
  disable() {
    if (this.element) {
      this.element.disabled = true;
    }
  }

  /**
   * Enable the button
   */
  enable() {
    if (this.element) {
      this.element.disabled = false;
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }
}

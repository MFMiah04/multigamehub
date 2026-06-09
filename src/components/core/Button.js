/**
 * Button - Reusable button component
 */
export class Button {
  constructor(options = {}) {
    this.options = {
      text: options.text || 'Button',
      variant: options.variant || 'primary', // primary, secondary, success, danger
      fullWidth: options.fullWidth || false,
      disabled: options.disabled || false,
      onClick: options.onClick || null,
      id: options.id || null,
      className: options.className || ''
    };

    this.element = this.create();
  }

  /**
   * Create button element
   * @returns {HTMLElement}
   */
  create() {
    const button = document.createElement('button');

    // Base class
    button.className = 'button';

    // Variant class
    button.classList.add(`button--${this.options.variant}`);

    // Full width
    if (this.options.fullWidth) {
      button.classList.add('button--full');
    }

    // Custom classes
    if (this.options.className) {
      this.options.className.split(' ').forEach(cls => {
        if (cls) button.classList.add(cls);
      });
    }

    // ID
    if (this.options.id) {
      button.id = this.options.id;
    }

    // Text
    button.textContent = this.options.text;

    // Disabled
    button.disabled = this.options.disabled;

    // Click handler
    if (this.options.onClick) {
      button.addEventListener('click', this.options.onClick);
    }

    return button;
  }

  /**
   * Get the button element
   * @returns {HTMLElement}
   */
  getElement() {
    return this.element;
  }

  /**
   * Set button text
   * @param {string} text
   */
  setText(text) {
    this.element.textContent = text;
  }

  /**
   * Enable/disable button
   * @param {boolean} disabled
   */
  setDisabled(disabled) {
    this.element.disabled = disabled;
  }

  /**
   * Show button
   */
  show() {
    this.element.style.display = '';
  }

  /**
   * Hide button
   */
  hide() {
    this.element.style.display = 'none';
  }

  /**
   * Add event listener
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    this.element.addEventListener(event, handler);
  }

  /**
   * Destroy button
   */
  destroy() {
    if (this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
  }
}

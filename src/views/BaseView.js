/**
 * BaseView - Abstract base class for all views
 */
export class BaseView {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.container = null;
    this.unsubscribe = null;
    this.components = [];
  }

  /**
   * Render the view into a container
   * @param {HTMLElement} container - Container element
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = this.template();
    this.attachEventListeners();

    // Subscribe to state changes
    this.unsubscribe = this.stateManager.subscribe((state) => {
      this.onStateChange(state);
    });
  }

  /**
   * Generate HTML template (must be implemented by subclasses)
   * @returns {string} HTML string
   */
  template() {
    throw new Error('template() must be implemented by subclass');
  }

  /**
   * Attach event listeners (override in subclasses)
   */
  attachEventListeners() {
    // Override in subclasses
  }

  /**
   * Handle state changes (override in subclasses)
   * @param {Object} state - New state
   */
  onStateChange(state) {
    // Override in subclasses
  }

  /**
   * Add a component to be managed by this view
   * @param {Object} component - Component instance
   */
  addComponent(component) {
    this.components.push(component);
  }

  /**
   * Get element by ID within this view
   * @param {string} id - Element ID
   * @returns {HTMLElement|null}
   */
  getElementById(id) {
    return this.container?.querySelector(`#${id}`) || null;
  }

  /**
   * Get element by selector within this view
   * @param {string} selector - CSS selector
   * @returns {HTMLElement|null}
   */
  querySelector(selector) {
    return this.container?.querySelector(selector) || null;
  }

  /**
   * Get all elements by selector within this view
   * @param {string} selector - CSS selector
   * @returns {NodeList}
   */
  querySelectorAll(selector) {
    return this.container?.querySelectorAll(selector) || [];
  }

  /**
   * Show error message
   * @param {string} message - Error message
   */
  showError(message) {
    const errorDiv = this.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.style.display = 'block';

      // Auto-hide after 5 seconds
      setTimeout(() => {
        errorDiv.style.display = 'none';
      }, 5000);
    }
  }

  /**
   * Show status message
   * @param {string} message - Status message
   */
  showStatus(message) {
    const statusDiv = this.getElementById('status-message');
    if (statusDiv) {
      statusDiv.textContent = message;
      statusDiv.style.display = 'block';
    }
  }

  /**
   * Hide status message
   */
  hideStatus() {
    const statusDiv = this.getElementById('status-message');
    if (statusDiv) {
      statusDiv.style.display = 'none';
    }
  }

  /**
   * Clean up and destroy view
   */
  destroy() {
    // Unsubscribe from state changes
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Destroy all managed components
    this.components.forEach(component => {
      if (component.destroy) {
        component.destroy();
      }
    });
    this.components = [];

    // Clear container
    if (this.container) {
      this.container.innerHTML = '';
    }
  }
}

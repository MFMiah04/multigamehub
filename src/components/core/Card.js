/**
 * Card - Reusable card container component
 */
export class Card {
  constructor(options = {}) {
    this.options = {
      title: options.title || null,
      content: options.content || '',
      footer: options.footer || null,
      className: options.className || ''
    };

    this.element = this.create();
  }

  /**
   * Create card element
   * @returns {HTMLElement}
   */
  create() {
    const card = document.createElement('div');
    card.className = 'card';

    if (this.options.className) {
      this.options.className.split(' ').forEach(cls => {
        if (cls) card.classList.add(cls);
      });
    }

    // Header
    if (this.options.title) {
      const header = document.createElement('div');
      header.className = 'card__header';

      const title = document.createElement('h1');
      title.className = 'card__title';
      title.textContent = this.options.title;

      header.appendChild(title);
      card.appendChild(header);
    }

    // Body
    const body = document.createElement('div');
    body.className = 'card__body';

    if (typeof this.options.content === 'string') {
      body.innerHTML = this.options.content;
    } else if (this.options.content instanceof HTMLElement) {
      body.appendChild(this.options.content);
    }

    card.appendChild(body);

    // Footer
    if (this.options.footer) {
      const footer = document.createElement('div');
      footer.className = 'card__footer';

      if (typeof this.options.footer === 'string') {
        footer.innerHTML = this.options.footer;
      } else if (this.options.footer instanceof HTMLElement) {
        footer.appendChild(this.options.footer);
      }

      card.appendChild(footer);
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
   * Set card title
   * @param {string} title
   */
  setTitle(title) {
    const titleElement = this.element.querySelector('.card__title');
    if (titleElement) {
      titleElement.textContent = title;
    }
  }

  /**
   * Set card content
   * @param {string|HTMLElement} content
   */
  setContent(content) {
    const body = this.element.querySelector('.card__body');
    if (body) {
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        body.innerHTML = '';
        body.appendChild(content);
      }
    }
  }

  /**
   * Get body element for appending content
   * @returns {HTMLElement}
   */
  getBody() {
    return this.element.querySelector('.card__body');
  }

  /**
   * Get footer element for appending content
   * @returns {HTMLElement|null}
   */
  getFooter() {
    return this.element.querySelector('.card__footer');
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

/**
 * Router - Simple client-side router
 */
export class Router {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.routes = new Map();
    this.currentRoute = null;
    this.params = {};
  }

  /**
   * Register a route
   * @param {string} path - Route path (supports :param syntax)
   * @param {Function} handler - Handler function
   */
  register(path, handler) {
    this.routes.set(path, {
      pattern: this.pathToRegex(path),
      handler,
      path
    });
  }

  /**
   * Convert path to regex pattern
   * @param {string} path - Path with optional :param
   * @returns {RegExp}
   */
  pathToRegex(path) {
    // Replace :param with named capture groups
    const pattern = path.replace(/:(\w+)/g, '(?<$1>[^/]+)');
    return new RegExp(`^${pattern}$`);
  }

  /**
   * Navigate to a path
   * @param {string} path - Path to navigate to
   * @returns {Promise<View>} The view instance
   */
  async navigate(path) {
    // Find matching route
    for (const [routePath, route] of this.routes) {
      const match = path.match(route.pattern);

      if (match) {
        this.currentRoute = routePath;
        this.params = match.groups || {};

        // Execute handler with params (may be async)
        const view = await route.handler(this.params);
        return view;
      }
    }

    // No route matched - 404
    console.warn(`No route matched for ${path}`);
    return null;
  }

  /**
   * Handle route matching and execution (legacy)
   * @param {string} path - Current path
   * @deprecated Use navigate() instead
   */
  async handleRoute(path) {
    return this.navigate(path);
  }

  /**
   * Get current route params
   * @returns {Object}
   */
  getParams() {
    return this.params;
  }

  /**
   * Initialize router (handle browser back/forward)
   */
  init() {
    // Handle popstate (back/forward buttons)
    window.addEventListener('popstate', () => {
      this.handleRoute(window.location.pathname);
    });

    // Handle initial route
    this.handleRoute(window.location.pathname);
  }
}

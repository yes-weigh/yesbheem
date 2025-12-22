/**
 * Configuration module for base path handling
 * Automatically detects whether the app is running locally or on a hosted site
 * and provides utilities for resolving paths correctly
 */
class Config {
    constructor() {
        this.basePath = this.detectBasePath();
        console.log('Config initialized with basePath:', this.basePath);
    }

    /**
     * Detects the base path from the current URL
     * Returns empty string for local development, '/yesbheem/' for hosted site
     */
    detectBasePath() {
        const pathname = window.location.pathname;

        // If we're at the root or in a local development environment
        if (pathname === '/' || pathname === '/index.html') {
            return '';
        }

        // List of Known App Routes that should NOT be treated as base path prefixes
        const appRoutes = ['/dashboard', '/dealer', '/discussions', '/instance', '/message', '/contact', '/product', '/pricelist', '/media', '/yesbheem', '/template', '/broadcast', '/welcome', '/chatbot', '/groupgrabber', '/report', '/integration', '/settings'];

        // internal helper to check if current path starts with an app route
        const isAppRoute = appRoutes.some(route => pathname.startsWith(route));
        if (isAppRoute) {
            return '';
        }

        // Check if we're in a subdirectory (e.g., /yesbheem/)
        const match = pathname.match(/^(\/[^\/]+)\//);
        if (match) {
            return match[1] + '/';
        }

        return '';
    }

    /**
     * Resolves a relative path to work correctly with the base tag
     * @param {string} path - Relative path (e.g., 'js/data_manager.js')
     * @returns {string} - Path relative to base (e.g., 'js/data_manager.js')
     */
    resolvePath(path) {
        // If path is already absolute (starts with /), return it as is
        if (path.startsWith('/')) {
            return path;
        }

        // Remove leading slash if present to make it relative
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        // Return the clean relative path - the base tag will handle the rest
        return cleanPath;
    }

    /**
     * Gets the base path
     * @returns {string} - Base path (e.g., '/yesbheem/' or '')
     */
    getBasePath() {
        return this.basePath;
    }

    /**
     * Checks if we're running in a hosted environment
     * @returns {boolean}
     */
    isHosted() {
        return this.basePath !== '';
    }
}

// Initialize and expose globally
window.appConfig = new Config();

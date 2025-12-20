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

        // Check if we're in a subdirectory (e.g., /yesbheem/)
        const match = pathname.match(/^(\/[^\/]+)\//);
        if (match) {
            return match[1] + '/';
        }

        return '';
    }

    /**
     * Resolves a relative path to an absolute path using the base path
     * @param {string} path - Relative path (e.g., 'js/data_manager.js')
     * @returns {string} - Absolute path (e.g., '/yesbheem/js/data_manager.js' or '/js/data_manager.js')
     */
    resolvePath(path) {
        // Remove leading slash if present
        const cleanPath = path.startsWith('/') ? path.substring(1) : path;

        // If no base path, just add leading slash
        if (!this.basePath) {
            return '/' + cleanPath;
        }

        // Combine base path with the clean path
        return '/' + this.basePath.replace(/^\//, '').replace(/\/$/, '') + '/' + cleanPath;
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

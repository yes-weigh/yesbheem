/**
 * ThemeManager - Handles light/dark theme switching with localStorage persistence
 */
class ThemeManager {
    constructor() {
        this.currentTheme = 'dark'; // default
        this.storageKey = 'yesbheem-theme';
        this.init();
    }

    init() {
        // Load saved theme or use default
        const savedTheme = localStorage.getItem(this.storageKey);
        this.currentTheme = savedTheme || 'dark';
        this.applyTheme(this.currentTheme);

        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        // User badge click to toggle dropdown
        const userBadge = document.getElementById('user-badge');
        const themeDropdown = document.getElementById('theme-dropdown');

        if (userBadge && themeDropdown) {
            userBadge.addEventListener('click', (e) => {
                e.stopPropagation();
                themeDropdown.classList.toggle('show');
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                themeDropdown.classList.remove('show');
            });
        }

        // Theme option clicks
        const themeOptions = document.querySelectorAll('[data-theme]');
        themeOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const theme = e.currentTarget.getAttribute('data-theme');
                this.setTheme(theme);
            });
        });
    }

    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.warn('Invalid theme:', theme);
            return;
        }

        this.currentTheme = theme;
        this.applyTheme(theme);
        localStorage.setItem(this.storageKey, theme);

        // Update active state in dropdown
        this.updateDropdownState(theme);
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }

    updateDropdownState(theme) {
        const themeOptions = document.querySelectorAll('[data-theme]');
        themeOptions.forEach(option => {
            if (option.getAttribute('data-theme') === theme) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.setTheme(newTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    window.themeManager = new ThemeManager();
});

// Expose to window for debugging
window.ThemeManager = ThemeManager;

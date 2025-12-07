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
        console.log('ThemeManager initialized in:', window.location.pathname);
        // Load saved theme or use default
        const savedTheme = localStorage.getItem(this.storageKey);
        this.currentTheme = savedTheme || 'dark';
        this.applyTheme(this.currentTheme);

        // Setup event listeners
        this.setupEventListeners();

        // Listen for theme changes from other tabs/frames
        window.addEventListener('storage', (e) => {
            if (e.key === this.storageKey) {
                console.log('ThemeManager: Storage event received', e.newValue);
                this.setTheme(e.newValue, false); // false = don't persist/broadcast again
            }
        });

        // Listen for theme changes via postMessage (from parent/iframe)
        window.addEventListener('message', (event) => {
            // console.log('ThemeManager: Message received', event.data);
            if (event.data && event.data.type === 'THEME_UPDATE') {
                console.log('ThemeManager: Theme update message received', event.data.theme);
                this.setTheme(event.data.theme, false);
            }
        });
    }

    setupEventListeners() {
        // User badge click to toggle dropdown (only if elements exist)
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
                this.setTheme(theme, true);
            });
        });
    }

    setTheme(theme, persist = true) {
        if (theme !== 'light' && theme !== 'dark') {
            console.warn('Invalid theme:', theme);
            return;
        }

        console.log('ThemeManager: Setting theme to', theme);
        this.currentTheme = theme;
        this.applyTheme(theme);

        if (persist) {
            localStorage.setItem(this.storageKey, theme);

            // Broadcast to iframes
            const iframes = document.querySelectorAll('iframe');
            if (iframes.length > 0) {
                console.log(`ThemeManager: Broadcasting to ${iframes.length} iframes`);
                iframes.forEach(iframe => {
                    iframe.contentWindow.postMessage({
                        type: 'THEME_UPDATE',
                        theme: theme
                    }, '*');
                });
            }
        }

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

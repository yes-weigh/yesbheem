// Navigation Controller - Manages page switching and sidebar state

// ---------------------------------------------------------------------------
// PAGE REGISTRY
// Maps page IDs to their SPA initialiser functions.
// To add a new page: add one entry here — nothing else needs to change.
// ---------------------------------------------------------------------------

/**
 * Safely resolve a global class/instance, log a friendly error if missing.
 * @param {string} name - window property name
 * @returns {*} the value or null
 */
function resolveGlobal(name) {
    const val = window[name];
    if (!val) console.error(`[SPA] '${name}' not found in global scope`);
    return val || null;
}

/**
 * Standard factory helper: instantiate a class and call .init() on it.
 * Stores the instance at `window[instanceKey]`.
 */
function initManager(classKey, instanceKey) {
    const Cls = resolveGlobal(classKey);
    if (!Cls) return;
    const mgr = new Cls();
    window[instanceKey] = mgr;
    if (typeof mgr.init === 'function') mgr.init();
}

const PAGE_REGISTRY = {
    // ── Data-heavy pages ────────────────────────────────────────────────────
    'dashboard': () => initManager('DashboardManager', 'dashboardManager'),
    'dealer': () => initManager('DealerManager', 'dealerManager'),
    'b2b-leads': () => initManager('B2BLeadsManager', 'b2bLeadsManager'),
    'campaign': () => initManager('CampaignManager', 'campaignManager'),
    'instance': () => initManager('InstanceManager', 'instanceManager'),
    'media': () => initManager('MediaManager', 'mediaMgr'),
    'template': () => initManager('TemplateManager', 'tmplMgr'),
    'discussions': () => initManager('BoardController', 'boardController'),

    // ── Settings (multi-controller) ─────────────────────────────────────────
    'settings': () => {
        // SettingsController auto-calls init() in its constructor
        const sc = resolveGlobal('SettingsController');
        if (sc) window.settingsController = new sc();

        // SettingsDataController needs explicit init() call
        const sdc = resolveGlobal('SettingsDataController');
        if (sdc) {
            window.settingsDataController = new sdc();
            window.settingsDataController.init();
        }

        const suc = resolveGlobal('SettingsUsersController');
        if (suc) window.settingsUsersController = new suc();

        const ssc = resolveGlobal('SettingsSecurityController');
        if (ssc) window.settingsSecurityController = new ssc();
    },

    // ── Map page (lazy-loads its own scripts) ───────────────────────────────
    'map': async () => {
        const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
        // Lazy-import map modules; they self-initialise on import
        await import(`${basePath}js/pan_zoom_controller.js`).catch(e => console.error('[SPA] pan_zoom_controller load failed', e));
        await import(`${basePath}js/map_interactions.js`).catch(e => console.error('[SPA] map_interactions load failed', e));
        await import(`${basePath}js/view_controller.js`).catch(e => console.error('[SPA] view_controller load failed', e));
    },

    // ── Stub pages — pure HTML, no JS init needed ───────────────────────────
    'login': null,
    'welcome': null,
    'chatbot': null,
    'broadcast': null,
    'contacts': null,
    'groupgrabber': null,
    'report': null,
    'integration': null,
    'pricelist': null,
    'product': null,
    'yesbheem': null,
};

// ---------------------------------------------------------------------------

class NavigationController {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarCollapsed = false;
        this._firstNavDone = false;
        this._showingLogin = false;
        this.pages = [
            { id: 'dashboard', name: 'Dashboard', icon: '📊' },
            { id: 'discussions', name: 'Tasks', icon: '📋' },
            { id: 'dealer', name: 'Dealer', icon: '🤝' },
            { id: 'b2b-leads', name: 'B2B Leads', icon: '👤' },
            { id: 'template', name: 'Template', icon: '📄' },
            { id: 'media', name: 'Media', icon: '🖼️' },
            { id: 'campaign', name: 'Campaign', icon: '📢' },
            { id: 'product', name: 'Product', icon: '📦' },
            { id: 'instance', name: 'Instance', icon: '🖥️' },
            { id: 'yesbheem', name: 'Yes Bheem', icon: '⚡' },
            { id: 'welcome', name: 'Welcome', icon: '👋' },
            { id: 'chatbot', name: 'Chatbot', icon: '🤖' },
            { id: 'integration', name: 'Integration', icon: '🔌' },
            { id: 'settings', name: 'Settings', icon: '⚙️' }
        ];
        this.init();
    }

    init() {
        this.setupEventListeners();

        // Handle initial URL
        const path = window.location.pathname;

        // [Public Route] Check for Certificate Preview
        // Bypass authentication for /cirtificates/*
        if (path.includes('/cirtificates/')) {
            // Extract ID (everything after the last slash or the cirtificates segment)
            // robust split to handle /cirtificates/sample123 or /cirtificates/sample123/
            const parts = path.split('/cirtificates/');
            if (parts.length > 1) {
                const certId = parts[1].replace(/\/$/, ''); // Remove trailing slash
                if (certId) {
                    this.renderPublicCertificate(certId);
                    return; // Stop further initialization (auth checks, etc.)
                }
            }
        }

        // [Public Route] Media Access
        if (path.startsWith('/public/media')) {
            import('./public_access_manager.js').then(({ PublicAccessManager }) => {
                PublicAccessManager.init();
            });
            return;
        }
        // Auth hasn't resolved yet — do NOT load any page content here.
        // handleNavigation('dashboard') will be called from checkAccess() once
        // Firebase confirms the user is authenticated.

        // Check Access Control
        this.checkAccess();
    }

    async checkAccess() {
        try {
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");

            // Resolve path dynamically to handle GitHub Pages subdirectories or root domains
            const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
            const configPath = `${basePath}js/services/firebase_config.js`.replace('//', '/'); // prevent double slash
            const { app } = await import(configPath);
            const auth = getAuth(app);

            onAuthStateChanged(auth, async (user) => {

                const settingsLink = document.querySelector('.nav-item[data-page="settings"]');
                const userNameEl = document.querySelector('.user-name-small');
                const userAvatarEl = document.querySelector('.user-avatar-small');

                if (user) {
                    // IMMEDIATELY show Sign Out button (don't wait for profile/claims)
                    // This fixes the missing button on Settings page refresh
                    const signOutBtn = document.getElementById('sign-out-button');
                    const divider = document.querySelector('.dropdown-divider');
                    if (signOutBtn) signOutBtn.style.display = 'flex';
                    if (divider) divider.style.display = 'block';

                    // Update Profile Display
                    try {
                        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const { db } = await import(configPath);

                        const userDoc = await getDoc(doc(db, "authorized_users", user.email));
                        const userData = userDoc.exists() ? userDoc.data() : {};

                        // Name
                        if (userNameEl) {
                            userNameEl.textContent = userData.displayName || user.email.split('@')[0];
                        }

                        // Avatar
                        if (userAvatarEl) {
                            if (userData.photoURL) {
                                userAvatarEl.style.backgroundImage = `url('${userData.photoURL}')`;
                                userAvatarEl.style.backgroundSize = 'cover';
                                userAvatarEl.innerText = '';
                            } else {
                                const name = userData.displayName || user.email;
                                userAvatarEl.innerText = name.charAt(0).toUpperCase();
                                userAvatarEl.style.backgroundImage = 'none';
                            }
                        }
                    } catch (err) {
                        console.error("Profile fetch error:", err);
                    }

                    const tokenResult = await user.getIdTokenResult();
                    const isAdmin = tokenResult.claims.role === 'admin';

                    if (settingsLink) {
                        settingsLink.style.display = isAdmin ? 'flex' : 'none';
                    }

                    // Security Redirect if on settings page
                    if (window.location.pathname.includes('settings') && !isAdmin) {
                        console.warn('Unauthorized access to settings. Redirecting...');
                        this.navigateTo('dashboard');
                    }

                    // Also check current "virtual" page if using our router
                    if (this.currentPage === 'settings' && !isAdmin) {
                        this.navigateTo('dashboard');
                    }

                    // Initialize DataManager once auth is confirmed
                    if (!window.dataManager && window.DataManager) {
                        console.log('[SPA] Initializing DataManager after authentication');
                        window.dataManager = new window.DataManager();
                    }

                    // Navigate to dashboard on first auth confirmation
                    if (!this._firstNavDone) {
                        this._firstNavDone = true;
                        this.handleNavigation('dashboard', false);
                    }

                } else {
                    // Not logged in — show login inside the SPA (no page navigation)
                    console.warn('User not authenticated. Showing login...');

                    // Remove the loader so the login card is visible
                    const authLoader = document.getElementById('initial-loader');
                    if (authLoader) authLoader.remove();

                    this.showLogin();
                    return;
                }
                // Hide initial loader ONLY if authenticated
                const loader = document.getElementById('initial-loader');
                if (loader) {
                    // Slight fade out effect
                    loader.style.transition = 'opacity 0.5s';
                    loader.style.opacity = '0';
                    setTimeout(() => loader.remove(), 500);
                }
            });
        } catch (e) {
            console.error('Error in checkAccess:', e);
            this.showLogin();
        }
    }

    setupEventListeners() {
        // Keep toggle button as fallback
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
        }

        // Mobile sidebar toggle button in title bar
        const mobileSidebarToggle = document.getElementById('mobile-sidebar-toggle');
        if (mobileSidebarToggle) {
            mobileSidebarToggle.addEventListener('click', () => this.toggleSidebar());
        }

        // Navigation items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const pageId = e.currentTarget.dataset.page;
                this.navigateTo(pageId);
            });
        });

        if (window.innerWidth <= 768) {
            this.sidebarCollapsed = true;
            this.updateSidebarState();
        }
        this.updateToggleIcon();

        // Sign Out Event Listener
        const signOutBtn = document.getElementById('sign-out-button');
        if (signOutBtn) {
            signOutBtn.addEventListener('click', async () => {
                try {
                    console.log('Signing out...');

                    // Dynamic import for LogoutHandler
                    const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
                    const logoutHandlerPath = `${basePath}js/logout_handler.js`.replace('//', '/');
                    const { LogoutHandler } = await import(logoutHandlerPath);

                    // Get fingerprint from security overlay or re-generate
                    let fingerprint = null;

                    // Try 1: Get from security overlay
                    if (window.securityOverlay && window.securityOverlay.fingerprint) {
                        fingerprint = window.securityOverlay.fingerprint;
                        console.log('[SignOut] Got fingerprint from securityOverlay:', fingerprint);
                    }
                    // Try 2: Get from localStorage
                    else if (localStorage.getItem('deviceFingerprint')) {
                        fingerprint = localStorage.getItem('deviceFingerprint');
                        console.log('[SignOut] Got fingerprint from localStorage:', fingerprint);
                    }
                    // Try 3: Re-generate fingerprint if not available
                    else {
                        console.warn('[SignOut] Fingerprint not found, attempting to re-generate...');
                        try {
                            const fpPromise = import('https://openfpcdn.io/fingerprintjs/v4')
                                .then(FingerprintJS => FingerprintJS.load());
                            const fp = await fpPromise;
                            const result = await fp.get();
                            fingerprint = result.visitorId;
                            console.log('[SignOut] Re-generated fingerprint:', fingerprint);
                        } catch (fpError) {
                            console.error('[SignOut] Could not generate fingerprint:', fpError);
                        }
                    }

                    console.log('[SignOut] Final fingerprint for logout:', fingerprint);
                    // Perform logout with proper cleanup
                    await LogoutHandler.performLogout(fingerprint, 'User clicked Sign Out');
                } catch (error) {
                    console.error('Sign out failed:', error);

                    // Fallback to basic sign out if LogoutHandler fails
                    try {
                        const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                        const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
                        const configPath = `${basePath}js/services/firebase_config.js`.replace('//', '/');
                        const { app } = await import(configPath);
                        const auth = getAuth(app);
                        await signOut(auth);
                        window.location.href = '/login.html';
                    } catch (fallbackError) {
                        console.error('Fallback sign out also failed:', fallbackError);
                        alert('Sign out failed: ' + error.message);
                    }
                }
            });
        }
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.updateSidebarState();
        this.updateToggleIcon();
    }

    updateToggleIcon() {
        // Branding is now the toggle, so we don't update the icon
        return;

        const toggleBtn = document.getElementById('mobile-sidebar-toggle');
        if (!toggleBtn) return;

        if (this.sidebarCollapsed) {
            // Closed - Show Hamburger
            toggleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="3" y1="12" x2="21" y2="12"></line>
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>`;
        } else {
            // Open - Show Close (X)
            toggleBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>`;
        }
    }

    updateSidebarState() {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');

        if (sidebar) {
            if (this.sidebarCollapsed) {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
            } else {
                sidebar.classList.remove('collapsed');
                mainContent.classList.remove('expanded');
            }
        }
    }

    /**
     * showLogin() — Load the login page INSIDE the SPA shell.
     * Keeps the URL as "/" and overlays the login card on top
     * of the existing app shell (sidebar etc. are hidden by the overlay).
     */
    async showLogin() {
        if (this._showingLogin) return;
        this._showingLogin = true;

        try {
            const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
            const response = await fetch(`${basePath}pages/login.html`);
            if (!response.ok) throw new Error(`Failed to fetch login page: ${response.status}`);
            const html = await response.text();

            const pageContent = document.getElementById('page-content');
            if (!pageContent) return;

            // Inject the HTML (overlay sits on top of everything)
            pageContent.innerHTML = html;

            // Wire up the login form via the globally-loaded login_controller.js
            if (typeof window.initLoginPage === 'function') {
                window.initLoginPage();
            } else {
                console.error('[NavController] window.initLoginPage not available');
            }
        } catch (err) {
            console.error('[NavController] showLogin failed:', err);
            // Hard fallback
            window.location.href = '/login.html';
        }
    }


    navigateTo(pageId) {
        if (pageId === this.currentPage) return;
        this.handleNavigation(pageId, true);
    }

    handleNavigation(pageId, autoCollapse) {
        this.currentPage = pageId;
        this._showingLogin = false; // Reset guard if we navigate (e.g. after login)
        this.updateActiveNavItem(pageId);
        this.loadPage(pageId);

        // Auto-collapse sidebar on mobile after navigation
        if (window.innerWidth <= 768) {
            this.sidebarCollapsed = true;
            this.updateSidebarState();
            this.updateToggleIcon();
        }
    }

    updateActiveNavItem(pageId) {
        document.querySelectorAll('.nav-item').forEach(item => {
            if (item.dataset.page === pageId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }

    async loadPage(pageId) {
        const contentArea = document.getElementById('page-content');
        if (!contentArea) return;

        try {
            // Show loading state
            contentArea.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';

            // Fetch page content
            const response = await fetch(`pages/${pageId}.html?t=${Date.now()}`);
            if (!response.ok) throw new Error(`Failed to load ${pageId}`);

            const html = await response.text();

            // Insert HTML
            contentArea.innerHTML = html;

            // Trigger animation
            contentArea.classList.remove('page-enter');
            void contentArea.offsetWidth; // Force reflow
            contentArea.classList.add('page-enter');

            // --- SPA INITIALIZATION ---
            // Call the globally loaded manager for this page

            // Dispatch page initialiser from the registry
            const init = PAGE_REGISTRY[pageId];
            if (init) {
                await init();
            }

        } catch (error) {
            console.error('Error loading page:', error);
            contentArea.innerHTML = `
                <div class="error-state">
                    <h2>Error Loading Page</h2>
                    <p>Could not load ${pageId}. Please try again.</p>
                </div>
            `;
        }
    }

    renderPublicCertificate(certId) {
        // Remove known potential overlays
        const loader = document.getElementById('initial-loader');
        if (loader) loader.remove();

        // Completely replace body content for the public view
        document.body.innerHTML = '';

        // Reset basic styles for the public page
        document.body.style.backgroundColor = '#f3f4f6';
        document.body.style.margin = '0';
        document.body.style.fontFamily = "'Outfit', sans-serif";
        document.body.style.display = 'flex';
        document.body.style.justifyContent = 'center';
        document.body.style.minHeight = '100vh';

        // Create main container
        const container = document.createElement('div');
        Object.assign(container.style, {
            width: '100%',
            maxWidth: '1000px',
            margin: '40px 20px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
        });

        // Header Section
        const header = document.createElement('div');
        Object.assign(header.style, {
            padding: '24px 32px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: '#ffffff'
        });

        header.innerHTML = `
            <div>
                <h1 style="margin: 0; font-size: 1.5rem; font-weight: 600; color: #111827;">Document Preview</h1>
                <p style="margin: 4px 0 0 0; color: #6b7280; font-size: 0.875rem;">Reference ID: <span style="font-family: monospace; background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${certId}</span></p>
            </div>
        `;

        // Download Button
        const pdfUrl = 'THIRD%20SCHEDULE.pdf'; // Static file at root
        const downloadBtn = document.createElement('a');
        downloadBtn.href = pdfUrl;
        downloadBtn.download = `Certificate_${certId}.pdf`;
        downloadBtn.textContent = 'Download PDF';
        Object.assign(downloadBtn.style, {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#2563EB', // Blue-600
            color: 'white',
            padding: '10px 20px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: '500',
            transition: 'background-color 0.2s',
            cursor: 'pointer'
        });

        // Add icon to button
        downloadBtn.innerHTML = `
            <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
            Download Copy
        `;

        downloadBtn.onmouseover = () => downloadBtn.style.backgroundColor = '#1d4ed8'; // Blue-700
        downloadBtn.onmouseout = () => downloadBtn.style.backgroundColor = '#2563EB';

        header.appendChild(downloadBtn);

        // Content Section (PDF Preview)
        const content = document.createElement('div');
        Object.assign(content.style, {
            flex: '1',
            padding: '0',
            backgroundColor: '#525659', // Neutral gray background for PDF viewer look
            minHeight: '80vh',
            position: 'relative'
        });

        content.innerHTML = `
            <iframe src="${pdfUrl}#toolbar=0" width="100%" height="100%" style="border: none; display: block; height: 80vh;">
                <div style="display: flex; flex-direction: column; alignItems: center; justify-content: center; height: 100%; color: white; text-align: center; padding: 20px;">
                    <p>This browser does not support inline PDF viewing.</p>
                    <a href="${pdfUrl}" download style="color: #60a5fa; margin-top: 10px;">Click here to download the PDF</a>
                </div>
            </iframe>
        `;

        // Append to container
        container.appendChild(header);
        container.appendChild(content);

        // Append container to body
        document.body.appendChild(container);

        // Add Fonts (ensure they are available if we wiped head)
        // Note: we wiped body, head is still there usually, but let's be safe.
        // Actually document.body.innerHTML = '' leaves head intact.
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navController = new NavigationController();
});

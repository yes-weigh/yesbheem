// Navigation Controller - Manages page switching and sidebar state
class NavigationController {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarCollapsed = false;
        this.pages = [
            { id: 'dashboard', name: 'Dashboard', icon: '📊' },
            { id: 'discussions', name: 'Tasks', icon: '📋' },
            { id: 'instance', name: 'Instance', icon: '🖥️' },
            { id: 'message', name: 'Message', icon: '💬' },
            { id: 'dealer', name: 'Dealer', icon: '🤝' },
            { id: 'contact', name: 'Contact', icon: '👤' },
            { id: 'product', name: 'Product', icon: '📦' },
            { id: 'pricelist', name: 'Pricelist', icon: '🏷️' },
            { id: 'media', name: 'Media', icon: '🖼️' },
            { id: 'yesbheem', name: 'Yes Bheem', icon: '⚡' },
            { id: 'template', name: 'Template', icon: '📄' },
            { id: 'broadcast', name: 'Broadcast', icon: '📡' },
            { id: 'welcome', name: 'Welcome', icon: '👋' },
            { id: 'chatbot', name: 'Chatbot', icon: '🤖' },
            { id: 'groupgrabber', name: 'Group Grabber', icon: '🔗' },
            { id: 'report', name: 'Report', icon: '📈' },
            { id: 'integration', name: 'Integration', icon: '🔌' },
            { id: 'settings', name: 'Settings', icon: '⚙️' }
        ];
        this.init();
    }

    init() {
        this.setupEventListeners();

        // Handle initial URL
        const path = window.location.pathname;
        let initialPage = 'dashboard';

        // Check if path corresponds to a valid page
        // We strip leading/trailing slashes and get the first segment
        const cleanPath = path.replace(/^\/+|\/+$/g, '');
        const segments = cleanPath.split('/');

        // If we are in a subdirectory like /dealer/index.html, we might need to be careful
        // But with our new setup, we expect /dealer or /dashboard
        // If empty, default to dashboard

        if (cleanPath) {
            // Check if the last segment matches a page ID
            const pageId = segments[segments.length - 1]; // e.g. "dealer" from "folder/dealer" or just "dealer"
            const foundPage = this.pages.find(p => p.id === pageId);
            if (foundPage) {
                initialPage = pageId;
            }
        }

        // Listen for browser back/forward buttons
        window.addEventListener('popstate', (event) => {
            if (event.state && event.state.pageId) {
                this.handleNavigation(event.state.pageId, false);
            } else {
                // Fallback or root
                this.handleNavigation('dashboard', false);
            }
        });

        // Replace current state for the initial load so back button works correctly
        history.replaceState({ pageId: initialPage }, '', window.location.pathname);
        this.handleNavigation(initialPage, false);

        // Check Access Control
        this.checkAccess();
    }

    async checkAccess() {
        try {
            const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            const { app } = await import('./services/firebase_config.js');
            const auth = getAuth(app);

            onAuthStateChanged(auth, async (user) => {
                const settingsLink = document.querySelector('.nav-item[data-page="settings"]');
                const userNameEl = document.querySelector('.user-name-small');
                const userAvatarEl = document.querySelector('.user-avatar-small');

                if (user) {
                    // Update Profile Display
                    try {
                        const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const { db } = await import('./services/firebase_config.js');

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

                    // Ensure Sign Out button is visible
                    const signOutBtn = document.getElementById('sign-out-button');
                    const divider = document.querySelector('.dropdown-divider');
                    if (signOutBtn) signOutBtn.style.display = 'flex';
                    if (divider) divider.style.display = 'block';

                    // Security Redirect if on settings page
                    if (window.location.pathname.includes('settings') && !isAdmin) {
                        console.warn('Unauthorized access to settings. Redirecting...');
                        this.navigateTo('dashboard');
                    }

                    // Also check current "virtual" page if using our router
                    if (this.currentPage === 'settings' && !isAdmin) {
                        this.navigateTo('dashboard');
                    }

                } else {
                    // Not logged in - hide settings by default
                    if (settingsLink) settingsLink.style.display = 'none';
                    if (userNameEl) userNameEl.textContent = 'Guest';
                    if (userAvatarEl) userAvatarEl.innerText = 'G';

                    // Hide Sign Out for Guest
                    const signOutBtn = document.getElementById('sign-out-button');
                    const divider = document.querySelector('.dropdown-divider');
                    if (signOutBtn) signOutBtn.style.display = 'none';
                    if (divider) divider.style.display = 'none';
                }
            });
        } catch (e) {
            console.error('Error in checkAccess:', e);
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
                    // Dynamic import for Firebase Auth since this is a non-module script
                    const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                    const { app } = await import('./services/firebase_config.js');
                    const auth = getAuth(app);

                    await signOut(auth);
                    console.log('Signed out successfully');
                    window.location.href = 'login.html';
                } catch (error) {
                    console.error('Sign out failed:', error);
                    alert('Sign out failed: ' + error.message);
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

    navigateTo(pageId) {
        if (pageId === this.currentPage) return;

        // Push state to history
        // Construct new URL: /pageId
        // We need to respect the base path if we are hosted? 
        // For now, assuming root.

        let newUrl = '/' + pageId;
        // Check if we are already at this URL to avoid duplicate states?
        // simple pushState is fine.

        history.pushState({ pageId: pageId }, '', newUrl);

        this.handleNavigation(pageId, true);
    }

    handleNavigation(pageId, autoCollapse) {
        this.currentPage = pageId;
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

            // Create a temporary container to parse the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Extract and remove script tags
            const scripts = tempDiv.querySelectorAll('script');
            const scriptContents = [];
            scripts.forEach(script => {
                let src = script.src;
                if (src) {
                    // Check if it already has params
                    src += (src.includes('?') ? '&' : '?') + 't=' + Date.now();
                }

                const scriptInfo = {
                    type: script.src ? 'src' : 'inline',
                    content: src || script.textContent,
                    isModule: script.type === 'module'
                };
                scriptContents.push(scriptInfo);
                script.remove();
            });

            // Insert the HTML without scripts
            contentArea.innerHTML = tempDiv.innerHTML;

            // Trigger animation
            contentArea.classList.remove('page-enter');
            void contentArea.offsetWidth; // Force reflow
            contentArea.classList.add('page-enter');

            // Now execute the scripts in order
            for (const script of scriptContents) {
                if (script.type === 'src') {
                    // Load external script
                    await this.loadExternalScript(script.content, script.isModule);
                } else {
                    // Execute inline script
                    if (script.isModule) {
                        // Append inline modules to body to execute them
                        await this.loadInlineModule(script.content);
                    } else {
                        try {
                            // Use Function constructor for better error handling
                            const scriptFunc = new Function(script.content);
                            scriptFunc();
                        } catch (err) {
                            console.error('Error executing inline script:', err);
                        }
                    }
                }
            }

            // If dashboard page, log success
            if (pageId === 'dashboard') {
                console.log('Dashboard loaded with map functionality');
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

    loadExternalScript(src, isModule = false) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');

            // Resolve the path using the base path configuration
            let resolvedSrc = src;
            if (window.appConfig && !src.startsWith('http') && !src.startsWith('//')) {
                // Only resolve relative paths, not absolute URLs
                resolvedSrc = window.appConfig.resolvePath(src);
            }

            script.src = resolvedSrc;
            if (isModule) script.type = 'module';
            script.onload = resolve;
            script.onerror = (error) => {
                console.error('Failed to load script:', resolvedSrc, error);
                reject(error);
            };
            document.body.appendChild(script);
        });
    }

    loadInlineModule(content) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.type = 'module';
            script.textContent = content;
            document.body.appendChild(script);
            // Inline modules execute immediately but asynchronously. 
            // We resolve immediately as we can't easily track completion without dispatching events.
            resolve();
        });
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navController = new NavigationController();
});

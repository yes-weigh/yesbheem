// Navigation Controller - Manages page switching and sidebar state
class NavigationController {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarCollapsed = false;
        this.pages = [
            { id: 'dashboard', name: 'Dashboard', icon: '📊' },
            { id: 'discussions', name: 'Tasks', icon: '📋' },
            { id: 'dealer', name: 'Dealer', icon: '🤝' },
            { id: 'instance', name: 'Instance', icon: '🖥️' },
            { id: 'b2b-leads', name: 'B2B Leads', icon: '👤' },
            { id: 'product', name: 'Product', icon: '📦' },
            { id: 'pricelist', name: 'Pricelist', icon: '🏷️' },
            { id: 'media', name: 'Media', icon: '🖼️' },
            { id: 'yesbheem', name: 'Yes Bheem', icon: '⚡' },
            { id: 'template', name: 'Template', icon: '📄' },
            { id: 'campaign', name: 'Campaign', icon: '📢' },
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

                } else {
                    // Not logged in - Strict Redirect
                    console.warn('User not authenticated. Redirecting to login...');

                    // Do NOT remove the loader. 
                    // Redirect immediately.
                    window.location.href = '/login.html';
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
            // In case of error (e.g. auth service down), we might want to redirect too
            // But for now, let's just log it. The loader might stay endlessly, which is better than leaking UI.
            window.location.href = '/login.html';
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
                // Do NOT append timestamp here. Let loadExternalScript handle versioning checks if needed.
                // Appending timestamp forces loadExternalScript to treat it as a new file (and re-execute),
                // which causes "Identifier already declared" errors for global classes.
                let src = script.src;

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
                            // Check if script content defines a class that already exists
                            // This is a basic check for common patterns like "class X" or "const X ="
                            const classMatch = script.content.match(/class\s+(\w+)/);
                            if (classMatch && window[classMatch[1]]) {
                                console.log(`Skipping inline script defining ${classMatch[1]} as it's already defined.`);
                                continue;
                            }

                            // Use Function constructor for better error handling
                            const scriptFunc = new Function(script.content);
                            scriptFunc();
                        } catch (err) {
                            // Ignore specific syntax errors related to redeclaration
                            if (err.name === 'SyntaxError' && err.message.includes('has already been declared')) {
                                console.log('Skipping script execution: Identifier already declared.');
                            } else {
                                console.error('Error executing inline script:', err);
                            }
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
            // Check if script is already loaded by src
            // Because we append timestamp, we perform a partial match or check global registry if we had one.
            // Simplified check: check if any script tag ends with the base filename

            // Resolve the path using the base path configuration
            let resolvedSrc = src;
            if (window.appConfig && !src.startsWith('http') && !src.startsWith('//')) {
                // Only resolve relative paths, not absolute URLs
                resolvedSrc = window.appConfig.resolvePath(src);
            }

            // Check if script is already loaded by filename
            const cleanSrc = src.split('?')[0];
            const fileName = cleanSrc.substring(cleanSrc.lastIndexOf('/') + 1);

            const existingScript = document.querySelector(`script[src*="${fileName}"]`);
            if (existingScript) {
                // Check if the source is exactly the same (including query params)
                // We compare against the resolved source
                if (existingScript.getAttribute('src') === resolvedSrc || existingScript.src === resolvedSrc || existingScript.src.endsWith(resolvedSrc)) {
                    console.log(`Script ${fileName} already loaded with same version. Skipping.`);
                    resolve();
                    return;
                }

                // If different, verify if we should reload (e.g. timestamp changed)
                console.log(`Script ${fileName} found but version changed. Reloading...`);
                existingScript.remove();
            }

            const script = document.createElement('script');
            script.src = resolvedSrc;
            if (isModule) script.type = 'module';
            script.onload = resolve;
            script.onerror = (error) => {
                console.error('Failed to load script:', resolvedSrc, error);

                // Allow proceeding even if script fails, to not block the page load completely
                // but log it clearly.
                resolve();
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

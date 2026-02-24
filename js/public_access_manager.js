/**
 * PublicAccessManager
 * Handles authentication and UI for the /public/media route
 */
export class PublicAccessManager {
    static async init() {
        console.log('[PublicAccessManager] Initializing...');

        // 1. Clear existing UI
        document.body.innerHTML = '';
        document.body.style.background = '#0f172a'; // Dark theme bg
        document.body.style.color = 'white';
        document.body.style.fontFamily = "'Outfit', sans-serif";

        // 2. Check Auth State
        const { getAuth, onAuthStateChanged } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const { app } = await import('./services/firebase_config.js');
        const auth = getAuth(app);

        // We use a promise wrapper to wait for auth check
        const user = await new Promise(resolve => {
            const unsubscribe = onAuthStateChanged(auth, (u) => {
                unsubscribe();
                resolve(u);
            });
        });

        if (user) {
            const token = await user.getIdTokenResult();
            if (token.claims.role === 'media_viewer') {
                const { getFirestore } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const db = getFirestore(app);
                window.firebaseContext = { app, auth, db };
                this.renderMediaView();
                return;
            } else {
                // If logged in as someone else (e.g. Admin), usually we might redirect to dashboard?
                // But the user strictly requested this URL for public access.
                // Let's assume if it's admin, they can see it too? 
                // Or force logout? For "passkey" mode, usually we force the specific experience.
                // Let's sign out if it's not the right role, or just show the prompt.
                // For simplicity: If role is NOT media_viewer, we sign them out to ensure isolation.
                await auth.signOut();
            }
        }

        // 3. Show Passkey Modal if not authenticated
        this.renderPasskeyModal();
    }

    static renderPasskeyModal() {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            height: 100vh; width: 100vw;
        `;

        container.innerHTML = `
            <div style="
                background: rgba(30, 41, 59, 0.8); 
                backdrop-filter: blur(12px); 
                padding: 40px; 
                border-radius: 24px; 
                border: 1px solid rgba(255,255,255,0.1);
                text-align: center;
                width: 320px;
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            ">
                <div style="font-size: 3rem; margin-bottom: 20px;">🔐</div>
                <h2 style="margin: 0 0 10px 0; font-weight: 600;">Media Access</h2>
                <p style="margin: 0 0 30px 0; color: #94a3b8; font-size: 0.9rem;">Enter the secure passkey to view the library.</p>
                
                <input type="password" id="public-passkey" placeholder="Enter Passkey" style="
                    width: 100%;
                    padding: 12px 16px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                    background: rgba(0,0,0,0.2);
                    color: white;
                    font-size: 1rem;
                    margin-bottom: 20px;
                    outline: none;
                    text-align: center;
                    transition: all 0.2s;
                    box-sizing: border-box;
                " onfocus="this.style.borderColor='#3b82f6'; this.style.background='rgba(0,0,0,0.4)'" 
                   onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.background='rgba(0,0,0,0.2)'">
                
                <button id="public-submit-btn" style="
                    width: 100%;
                    padding: 12px;
                    border-radius: 12px;
                    border: none;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    color: white;
                    font-weight: 600;
                    cursor: pointer;
                    transition: transform 0.1s;
                " onmousedown="this.style.transform='scale(0.98)'" onmouseup="this.style.transform='scale(1)'">
                    Verify Access
                </button>
                <div id="public-status" style="margin-top: 20px; font-size: 0.85rem; min-height: 20px; color: #ef4444;"></div>
            </div>
        `;

        document.body.appendChild(container);

        const btn = document.getElementById('public-submit-btn');
        const input = document.getElementById('public-passkey');

        const handleSubmit = async () => {
            const passkey = input.value.trim();
            if (!passkey) return;

            const status = document.getElementById('public-status');
            status.textContent = 'Verifying...';
            status.style.color = '#94a3b8';
            btn.disabled = true;
            btn.style.opacity = '0.7';

            try {
                const { getFunctions, httpsCallable } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js");
                const { app } = await import('./services/firebase_config.js');
                const functions = getFunctions(app); // Default region

                const verifyFunc = httpsCallable(functions, 'verifyMediaPasskey');
                const result = await verifyFunc({ passkey });

                const token = result.data.token;
                status.textContent = 'Authenticating...';

                const { getAuth, signInWithCustomToken } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
                const auth = getAuth(app);

                await signInWithCustomToken(auth, token);

                // Success! Re-init to load view
                this.init();

            } catch (error) {
                console.error(error);
                status.textContent = 'Access Denied. Invalid Passkey.';
                status.style.color = '#ef4444';
                btn.disabled = false;
                btn.style.opacity = '1';
                input.value = '';
                input.focus();
            }
        };

        btn.addEventListener('click', handleSubmit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSubmit();
        });
        input.focus();
    }

    static async renderMediaView() {
        // 1. Fetch the actual Media Page HTML (Single Source of Truth)
        try {
            const response = await fetch('/pages/media.html?t=' + Date.now());
            if (!response.ok) throw new Error("Failed to load media template");
            const html = await response.text();

            // 2. Wrap it and inject - Using exact CRM layout for consistency
            document.body.innerHTML = `
                <header class="title-bar">
                    <div class="title-bar-content">
                        <div class="title-bar-left">
                            <div class="title-bar-brand" id="mobile-sidebar-toggle" style="cursor: pointer;" title="Toggle Sidebar">
                                <h1>Yes Bheem</h1>
                            </div>
                        </div>
                        <div class="title-bar-right">
                            <div class="user-badge-container">
                                <div class="user-badge" id="user-badge">
                                    <div class="user-avatar-small">M</div>
                                    <span class="user-name-small">Media Viewer</span>
                                    <svg class="dropdown-icon" width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                                        <path d="M6 8L2 4h8z" />
                                    </svg>
                                </div>
                                <div class="theme-dropdown" id="theme-dropdown" style="display: none; position: absolute; right: 0; top: 100%; background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; padding: 5px; z-index: 1000; min-width: 150px;">
                                    <div class="dropdown-item" id="public-logout" style="color: #ff6b6b; padding: 10px; cursor: pointer; display: flex; align-items: center; gap: 10px;">
                                        <span class="theme-icon">🚪</span>
                                        <span>Sign Out</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div class="dashboard-container">
                    <aside class="sidebar" id="sidebar">
                        <nav class="nav-menu">
                            <div class="nav-item active" data-page="media">
                                <span class="nav-icon">🖼️</span>
                                <span class="nav-text">Media</span>
                            </div>
                        </nav>
                    </aside>

                    <main class="main-content" id="main-content">
                        <div id="page-content" class="page-enter">
                            ${html}
                        </div>
                    </main>
                </div>
            `;

            // UI Interactions for exact feel
            const badge = document.getElementById('user-badge');
            const dropdown = document.getElementById('theme-dropdown');
            if (badge && dropdown) {
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
                });
                document.addEventListener('click', () => dropdown.style.display = 'none');
            }

        } catch (e) {
            console.error("Error rendering media view:", e);
            document.body.innerHTML = `<div style="padding: 2rem; color: #ef4444;">Error loading media view. Please refresh.</div>`;
            return;
        }

        // Logout Logic
        document.getElementById('public-logout').addEventListener('click', async () => {
            const { getAuth, signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
            const { app } = await import('./services/firebase_config.js');
            const auth = getAuth(app);
            await signOut(auth);
            location.reload();
        });

        // Initialize Media Manager
        this.loadMediaDependencies();
    }

    static async loadMediaDependencies() {
        // Load scripts dynamically
        const scripts = [
            '/js/services/media_service.js',
            '/js/media_manager.js'
        ];

        for (const src of scripts) {
            if (!document.querySelector(`script[src="${src}"]`)) {
                await new Promise((resolve) => {
                    const s = document.createElement('script');
                    s.src = src;
                    s.type = 'module'; // Assuming they might use imports, or just standard script
                    // Actually existing files seem to be classes attached to window, but let's check.
                    // MediaManager is attached to window.
                    s.onload = resolve;
                    document.body.appendChild(s);
                });
            }
        }

        // Initialize Manager
        // We delay slightly to ensure DOM is ready and styles (although we have no styles loaded!)
        // WAIT: We need CSS! 
        this.loadStyles();

        setTimeout(() => {
            if (window.MediaManager) {
                window.mediaMgr = new window.MediaManager();
                // Override some styles/behavior for public view?
                // The existing manager renders into 'media-grid-container', which we created.
                // It also tries to update stats etc.
            } else {
                console.error("MediaManager class not found.");
            }
        }, 100);
    }

    static loadStyles() {
        const links = [
            '/css/variables.css',
            '/css/base.css',
            '/css/layout.css',
            '/css/header.css',
            '/css/sidebar.css',
            '/css/components.css',
            '/css/template.css'
        ];

        links.forEach(href => {
            const l = document.createElement('link');
            l.rel = 'stylesheet';
            l.href = href;
            document.head.appendChild(l);
        });

        // Inject Custom CSS to hide restricted actions (Delete Button) AND Upload controls and style cards
        const style = document.createElement('style');
        style.textContent = `
            button[title="Delete"] { display: none !important; }
            #btn-new-media { display: none !important; }
            .view-mode-toggle { display: none !important; } 
            .template-card { cursor: default !important; }
            /* Hide file input trigger if exposed */
            #drop-zone { pointer-events: none; opacity: 0.5; }
            /* Extra safety for modal */
            #upload-modal { display: none !important; }

            /* Card Styling & Interaction Overrides */
            .template-card {
                background: rgba(255,255,255,0.05);
                border: 1px solid rgba(255,255,255,0.1);
                border-radius: 12px;
                color: white;
                transition: transform 0.2s;
            }
            .template-card:hover {
                transform: translateY(-5px);
                background: rgba(255,255,255,0.1);
            }
            .badge {
                padding: 2px 8px; border-radius: 12px; background: rgba(255,255,255,0.1); font-size: 0.75rem;
            }
            
            /* Hide Delete/Edit buttons for public view? */
            /* If we want READ ONLY, we should hide actions. */
            .action-btn-icon { display: none !important; }
        `;
        document.head.appendChild(style);
    }
}

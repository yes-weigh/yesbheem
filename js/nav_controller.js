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
            { id: 'yesbheam', name: 'Yes bheam', icon: '⚡' },
            { id: 'template', name: 'Template', icon: '📄' },
            { id: 'broadcast', name: 'Broadcast', icon: '📡' },
            { id: 'welcome', name: 'Welcome', icon: '👋' },
            { id: 'chatbot', name: 'Chat bot', icon: '🤖' },
            { id: 'groupgrabber', name: 'Group grabber', icon: '🔗' },
            { id: 'report', name: 'Report', icon: '📈' },
            { id: 'integration', name: 'Integration', icon: '🔌' },
            { id: 'settings', name: 'Settings', icon: '⚙️' }
        ];
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPage(this.currentPage);
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

        // Mobile responsiveness
        if (window.innerWidth <= 768) {
            this.sidebarCollapsed = true;
            this.updateSidebarState();
        }
        this.updateToggleIcon();
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
                const scriptInfo = {
                    type: script.src ? 'src' : 'inline',
                    content: script.src || script.textContent,
                    isModule: script.type === 'module'
                };
                scriptContents.push(scriptInfo);
                script.remove();
            });

            // Insert the HTML without scripts
            contentArea.innerHTML = tempDiv.innerHTML;

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
            script.src = src;
            if (isModule) script.type = 'module';
            script.onload = resolve;
            script.onerror = reject;
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

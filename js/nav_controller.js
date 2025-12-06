// Navigation Controller - Manages page switching and sidebar state
class NavigationController {
    constructor() {
        this.currentPage = 'dashboard';
        this.sidebarCollapsed = false;
        this.pages = [
            { id: 'dashboard', name: 'Dashboard', icon: '📊' },
            { id: 'instance', name: 'Instance', icon: '🖥️' },
            { id: 'message', name: 'Message', icon: '💬' },
            { id: 'contacts', name: 'Contacts', icon: '👥' },
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
        // Sidebar toggle via logo
        const brandLogo = document.getElementById('brand-logo');
        if (brandLogo) {
            brandLogo.addEventListener('click', () => this.toggleSidebar());
        }

        // Keep toggle button as fallback
        const toggleBtn = document.getElementById('sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => this.toggleSidebar());
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
    }

    toggleSidebar() {
        this.sidebarCollapsed = !this.sidebarCollapsed;
        this.updateSidebarState();
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
            const response = await fetch(`pages/${pageId}.html`);
            if (!response.ok) throw new Error(`Failed to load ${pageId}`);

            const html = await response.text();

            // Create a temporary container to parse the HTML
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;

            // Extract and remove script tags
            const scripts = tempDiv.querySelectorAll('script');
            const scriptContents = [];
            scripts.forEach(script => {
                if (script.src) {
                    // External script
                    scriptContents.push({ type: 'src', content: script.src });
                } else {
                    // Inline script
                    scriptContents.push({ type: 'inline', content: script.textContent });
                }
                script.remove();
            });

            // Insert the HTML without scripts
            contentArea.innerHTML = tempDiv.innerHTML;

            // Now execute the scripts in order
            for (const script of scriptContents) {
                if (script.type === 'src') {
                    // Load external script
                    await this.loadExternalScript(script.content);
                } else {
                    // Execute inline script
                    try {
                        // Use Function constructor for better error handling
                        const scriptFunc = new Function(script.content);
                        scriptFunc();
                    } catch (err) {
                        console.error('Error executing inline script:', err);
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

    loadExternalScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.body.appendChild(script);
        });
    }
}

// Initialize navigation when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.navController = new NavigationController();
});

class ViewController {
    constructor(dataManager) {
        this.dataManager = dataManager;
        this.currentView = 'india';
        this.stateMapCache = new Map();

        // DOM Elements
        this.containers = {
            india: document.getElementById('india-view'),
            state: document.getElementById('state-view'),
            indiaMap: document.getElementById('india-map-container'),
            stateMap: document.getElementById('state-map-container')
        };

        this.breadcrumbs = {
            india: document.getElementById('crumb-india'),
            sep: document.getElementById('crumb-sep'),
            state: document.getElementById('crumb-state')
        };

        // Loading overlay removed
        this.mapInteractions = null;
        this.panZoom = null;

        this.init();
    }

    async init() {
        this.setupNavigation();
        await this.loadIndiaMap();
    }

    setupNavigation() {
        if (this.breadcrumbs.india) {
            this.breadcrumbs.india.addEventListener('click', () => {
                if (this.currentView !== 'india') this.showIndiaView();
            });
        }

        const zoomIn = document.getElementById('zoom-in');
        const zoomOut = document.getElementById('zoom-out');
        const zoomReset = document.getElementById('zoom-reset');

        if (zoomIn) zoomIn.addEventListener('click', () => this.panZoom?.zoomIn());
        if (zoomOut) zoomOut.addEventListener('click', () => this.panZoom?.zoomOut());
        if (zoomReset) zoomReset.addEventListener('click', () => this.panZoom?.reset());
    }

    async loadIndiaMap() {
        this.showLoading(true);
        try {
            // Updated path
            const response = await fetch('../assets/maps/india_map_high_res.svg');
            if (!response.ok) throw new Error('Failed to load India Map SVG');
            const svgText = await response.text();

            if (this.containers.indiaMap) {
                this.containers.indiaMap.innerHTML = svgText;

                const svgFn = this.containers.indiaMap.querySelector('svg');
                if (svgFn) {
                    svgFn.style.width = '100%';
                    svgFn.style.height = '100%';
                    this.panZoom = new PanZoomController('#map-viewport', '#india-map-container');
                }

                this.initializeIndiaInteractions();
            }

            this.showIndiaView();
            // Load initial overview data
            await this.loadIndiaOverview();
        } catch (error) {
            console.error('Failed to load India map:', error);
        } finally {
            this.showLoading(false);
        }
    }

    async loadIndiaOverview() {
        if (this.dataManager && this.dataManager.getCountryData) {
            const data = await this.dataManager.getCountryData();
            this.updateSidebarWithData(data);
        }
    }

    updateSidebarWithData(data) {
        const title = document.getElementById('district-name');
        const desc = document.getElementById('district-description');
        const statsContainer = document.getElementById('stats-container');
        const dealerSection = document.getElementById('dealer-section');
        const statsFloater = document.getElementById('stats-floater');

        if (title) title.textContent = data.name;
        if (desc) desc.textContent = `Overview of ${data.name}`;

        // Update Floating Stats
        if (statsContainer) {
            statsContainer.innerHTML = UIRenderer.renderStats(data);
        }

        // Show Floater
        if (statsFloater) statsFloater.classList.remove('hidden');

        // Update Dealer List (remains in sidebar)
        if (dealerSection) dealerSection.innerHTML = UIRenderer.renderDealerList(data.dealers);
    }

    initializeIndiaInteractions() {
        if (!this.containers.indiaMap) return;

        const states = this.containers.indiaMap.querySelectorAll('path');
        states.forEach(state => {
            state.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent background click interference
                let stateId = state.id.trim(); // Trim whitespace
                if (stateId.startsWith('IN-')) stateId = stateId.replace('IN-', '');
                const stateName = state.getAttribute('title') || stateId;
                this.showStateView(stateId, stateName);
            });

            state.addEventListener('mouseenter', async () => {
                // Show State Preview on Hover
                const lookupId = state.id.trim(); // e.g. "IN-KL"
                const data = await this.dataManager.getStateData(lookupId);
                // We reuse the sidebar update to show stats
                this.updateSidebarWithData(data);
            });

            state.addEventListener('mouseleave', () => {
                // Revert to Pan India Overview
                this.loadIndiaOverview();
            });
        });

        // Background Click Listener for India Map
        this.containers.indiaMap.addEventListener('click', (e) => {
            // Check if clicked element is actually background
            if (e.target.tagName === 'svg' || e.target.id === 'india-map-container') {
                this.loadIndiaOverview();
            }
        });
    }

    updateSidebarPlaceholder(titleText, context = 'State') {
        const title = document.getElementById('district-name');
        const desc = document.getElementById('district-description');
        const statsContainer = document.getElementById('stats-container');
        const dealerSection = document.getElementById('dealer-section');

        if (statsContainer) statsContainer.innerHTML = '';
        if (dealerSection) dealerSection.innerHTML = '';

        if (title) title.textContent = titleText || `${context} Overview`;

        if (desc) {
            if (titleText) {
                desc.textContent = `Click to explore detailed analytics for ${titleText}.`;
            } else {
                desc.textContent = 'Select a region to explore detailed analytics.';
            }
        }
    }

    async showStateView(stateId, stateName) {
        console.log(`Navigating to state: ${stateName} (${stateId})`);

        this.updateBreadcrumbs(stateName);
        this.currentView = 'state';

        this.containers.india.classList.remove('active');
        this.containers.state.classList.add('active');

        // Normalize ID for check
        const isKerala = stateId === 'KL' || stateId === 'IN-KL';

        const toggle = document.getElementById('color-grade-wrapper');
        if (isKerala && toggle) {
            toggle.classList.remove('start-hidden');
            toggle.classList.add('visible');
        } else if (toggle) {
            toggle.classList.remove('visible');
            toggle.classList.add('start-hidden');
        }

        if (isKerala) {
            await this.loadStateContent(stateId);
        } else {
            // Show placeholder map but load data
            if (this.containers.stateMap) {
                this.containers.stateMap.innerHTML = `
                    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted);text-align:center;">
                        <h2 style="font-size:2rem;margin-bottom:1rem;color:var(--text-main);">${stateName}</h2>
                        <p>Interactive map coming soon.</p>
                        <p style="font-size:0.9rem;opacity:0.7;">Sales data is available in the sidebar.</p>
                    </div>`;
            }
            this.loadStateAggregateData(stateId, stateName);
        }
    }

    updateBreadcrumbs(stateName) {
        if (this.breadcrumbs.india) this.breadcrumbs.india.classList.remove('active');
        if (this.breadcrumbs.sep) this.breadcrumbs.sep.style.display = 'inline';
        if (this.breadcrumbs.state) {
            this.breadcrumbs.state.textContent = stateName;
            this.breadcrumbs.state.style.display = 'inline';
            this.breadcrumbs.state.classList.add('active');
        }
    }

    async loadStateAggregateData(stateId, stateName) {
        this.showLoading(true);
        try {
            const lookupId = stateId.length === 2 ? `IN-${stateId}` : stateId;
            const data = await this.dataManager.getStateData(lookupId);

            this.updateSidebarWithData(data);

        } catch (e) {
            console.error("Failed to load state data:", e);
        } finally {
            this.showLoading(false);
        }
    }

    async showIndiaView() {
        this.currentView = 'india';

        this.containers.state.classList.remove('active');
        this.containers.india.classList.add('active');

        if (this.breadcrumbs.sep) this.breadcrumbs.sep.style.display = 'none';
        if (this.breadcrumbs.state) this.breadcrumbs.state.style.display = 'none';
        if (this.breadcrumbs.india) this.breadcrumbs.india.classList.add('active');

        if (this.containers.indiaMap.querySelector('svg')) {
            this.panZoom = new PanZoomController('#map-viewport', '#india-map-container');
            this.panZoom.reset();
        }

        this.updateSidebarPlaceholder('India Overview', 'India'); // Temporary placholder

        // Load Real Data
        this.loadIndiaOverview();

        const toggle = document.getElementById('color-grade-wrapper');
        if (toggle) { toggle.classList.remove('visible'); toggle.classList.add('start-hidden'); }
    }

    async loadStateContent(stateId) {
        this.showLoading(true);
        try {
            let svgText;
            let mapFilename = 'Kerala-map-en.svg';
            if (stateId === 'TN') {
                mapFilename = 'Tamil_Nadu-map-en.svg';
            }

            if (this.stateMapCache.has(stateId)) {
                console.log('Using cached map for', stateId);
                svgText = this.stateMapCache.get(stateId);
            } else {
                // Updated path with dynamic filename
                const url = `../assets/maps/${mapFilename}?t=${Date.now()}`;
                console.log('Fetching map from:', url);
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Map not found: ${mapFilename} (Status: ${response.status})`);
                svgText = await response.text();
                console.log('Map fetch successful, length:', svgText.length);
                this.stateMapCache.set(stateId, svgText);
            }

            console.log('Injecting SVG into state-map-container');
            this.containers.stateMap.innerHTML = svgText;

            const svg = this.containers.stateMap.querySelector('svg');
            if (svg) {
                console.log('SVG element found, applying full width/height');
                // Remove fixed dimensions to allow CSS scaling
                svg.removeAttribute('width');
                svg.removeAttribute('height');

                svg.style.width = '100%';
                svg.style.height = '100%';
            } else {
                console.warn('No SVG element found in injected content!');
            }

            if (!this.mapInteractions && typeof MapInteractions !== 'undefined') {
                this.mapInteractions = new MapInteractions(this.dataManager, this);
            }

            if (this.mapInteractions) {
                // PASS stateId to initializeDistricts
                this.mapInteractions.initializeDistricts(stateId);

                // Initialize with State Overview
                const stateNames = {
                    'KL': 'Kerala',
                    'IN-KL': 'Kerala'
                };
                const stateName = stateNames[stateId] || stateId;

                // Show overview initially
                // We use aggregated data for initial view (matches "State Overview")
                await this.loadStateAggregateData(stateId, stateName);

                // Also load detailed district data in background for interactions
                await this.mapInteractions.loadDistrictData(stateName);
            }

            this.panZoom = new PanZoomController('#map-viewport', '#state-map-container');

        } catch (error) {
            console.error('Error loading state map:', error);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        // Loading overlay removed - no-op
        // The loading overlay was causing display issues with the large logo
        return;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    window.viewController = new ViewController(dataManager);
});

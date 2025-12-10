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
        const backBtn = document.getElementById('back-to-india-btn');

        if (zoomIn) zoomIn.addEventListener('click', () => this.panZoom?.zoomIn());
        if (zoomOut) zoomOut.addEventListener('click', () => this.panZoom?.zoomOut());
        if (zoomReset) zoomReset.addEventListener('click', () => this.panZoom?.reset());
        if (backBtn) backBtn.addEventListener('click', () => this.showIndiaView());

        // View toggle dropdown
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector) {
            viewSelector.addEventListener('change', (e) => {
                e.preventDefault();
                const view = e.target.value;
                this.handleViewChange(view);
            });
        }

        const viewToggleContainer = document.querySelector('.view-toggle-container');
        if (viewToggleContainer) {
            ['mousedown', 'click', 'dblclick', 'wheel', 'touchstart', 'touchend'].forEach(evt => {
                viewToggleContainer.addEventListener(evt, (e) => e.stopPropagation());
            });
        }
    }

    handleViewChange(view) {
        // Update active state in dropdown if triggered programmatically
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector && viewSelector.value !== view) {
            viewSelector.value = view;
        }

        if (this.currentView === 'india') {
            const dealerSection = document.getElementById('dealer-section');
            if (!dealerSection || !this.indiaData) return;

            if (view === 'states') {
                const statesData = this.dataManager.aggregateByState(this.indiaData.dealers);
                dealerSection.innerHTML = UIRenderer.renderDistrictSalesList(statesData);
            } else {
                dealerSection.innerHTML = UIRenderer.renderDealerList(this.indiaData.dealers);
            }
        } else if (this.mapInteractions) {
            this.mapInteractions.handleViewChange(view);
        }
    }

    async loadIndiaMap() {
        this.showLoading(true);
        try {
            // Updated path
            const response = await fetch(`../assets/maps/india_map_high_res.svg?t=${Date.now()}`);
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
            this.indiaData = data; // Cache data
            this.updateSidebarWithData(data);
        }
    }

    updateSidebarWithData(data) {
        const title = document.getElementById('district-name');
        const desc = document.getElementById('district-description');
        const dealerSection = document.getElementById('dealer-section');

        let displayName = data.name;
        if (displayName === 'Pan India' || displayName === 'India') {
            displayName = 'INDIA';
        }

        if (title) title.textContent = displayName;

        if (desc) {
            desc.style.display = 'none';
        }

        // Update Floating Stats -> Post Message to Parent Dashboard
        window.parent.postMessage({
            type: 'STATS_UPDATE',
            data: {
                name: data.name,
                achievement: data.achievement,
                currentSales: data.currentSales,
                dealerCount: data.dealerCount ? data.dealerCount : (data.dealers ? data.dealers.length : 0),
                monthlyTarget: data.monthlyTarget
            }
        }, '*');

        // Update Dealer List (remains in sidebar)
        const viewSelector = document.getElementById('view-selector');
        const activeView = viewSelector ? viewSelector.value : 'states';

        if (dealerSection) {
            if (activeView === 'states' && this.currentView === 'india' && data.dealers) {
                const statesData = this.dataManager.aggregateByState(data.dealers);
                dealerSection.innerHTML = UIRenderer.renderDistrictSalesList(statesData);
            } else {
                dealerSection.innerHTML = UIRenderer.renderDealerList(data.dealers);
            }
        }
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

                // SPECIAL HANDLING FOR KERALA: Single click just shows details
                if (stateId === 'KL' || stateId === 'IN-KL') {
                    this.showStateDetails(stateId);
                } else {
                    // Other states: Single click shows details (same as existing behavior)
                    this.showStateView(stateId, stateName);
                }
            });

            state.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                let stateId = state.id.trim();
                // Normalize ID
                if (stateId.startsWith('IN-')) stateId = stateId.replace('IN-', '');
                const stateName = state.getAttribute('title') || stateId;

                // SPECIAL HANDLING FOR KERALA: Double click drills down
                if (stateId === 'KL' || stateId === 'IN-KL') {
                    this.showStateView(stateId, stateName);
                }
            });
        });

        // Background Click Listener for India Map
        this.containers.indiaMap.addEventListener('click', (e) => {
            // Only reset to India overview if clicking directly on SVG background (not a path element)
            if (e.target.tagName === 'svg' || e.target === this.containers.indiaMap) {
                // Clear any selected state
                this.highlightState(null);

                // Reset view dropdown: Allow and Select 'States' view again
                const viewSelector = document.getElementById('view-selector');
                if (viewSelector) {
                    const statesOption = viewSelector.querySelector('option[value="states"]');
                    const districtsOption = viewSelector.querySelector('option[value="districts"]');

                    if (statesOption) {
                        statesOption.hidden = false;
                        statesOption.disabled = false;
                    }
                    if (districtsOption) {
                        districtsOption.hidden = true;
                        districtsOption.disabled = true;
                    }
                    viewSelector.value = 'states'; // Auto-select States
                }

                this.loadIndiaOverview();
            }
        });
    }

    updateSidebarPlaceholder(titleText, context = 'State') {
        const title = document.getElementById('district-name');
        const desc = document.getElementById('district-description');
        const dealerSection = document.getElementById('dealer-section');
        if (dealerSection) dealerSection.innerHTML = '';

        if (title) title.textContent = titleText || `${context} Overview`;

        if (desc) {
            desc.style.display = 'none';
        }
    }

    async showStateDetails(stateId) {
        // Reset view dropdown to 'dealers' automatically when a state is selected
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector) {
            viewSelector.value = 'dealers';

            // Disable and hide 'States' option when looking at a specific state
            // Manage Options: Hide States, Show Districts
            const statesOption = viewSelector.querySelector('option[value="states"]');
            const districtsOption = viewSelector.querySelector('option[value="districts"]');

            if (statesOption) {
                statesOption.hidden = true;
                statesOption.disabled = true;
            }
            if (districtsOption) {
                districtsOption.hidden = true;
                districtsOption.disabled = true;
            }
        }

        // Highlight Only - stay on India Map
        this.highlightState(stateId);

        // Fetch and display state data
        try {
            const lookupId = stateId.length === 2 ? `IN-${stateId}` : stateId;
            const data = await this.dataManager.getStateData(lookupId);
            this.updateSidebarWithData(data);
        } catch (e) {
            console.error("Failed to load state data:", e);
        }
    }

    async showStateView(stateId, stateName) {
        console.log(`State interaction: ${stateName} (${stateId})`);

        // Normalize ID for check
        const isKerala = stateId === 'KL' || stateId === 'IN-KL';
        const backBtn = document.getElementById('back-to-india-btn');

        if (isKerala) {
            // Full Navigation for Kerala (Drill Down)
            this.currentView = 'state';

            this.containers.india.classList.remove('active');
            this.containers.state.classList.add('active');

            if (backBtn) backBtn.style.display = 'block'; // Show Back Button

            // Also hide states option for full state view
            // Also hide states option for full state view
            const viewSelector = document.getElementById('view-selector');
            if (viewSelector) {
                // Set default to districts for full view
                viewSelector.value = 'districts';

                const statesOption = viewSelector.querySelector('option[value="states"]');
                const districtsOption = viewSelector.querySelector('option[value="districts"]');

                if (statesOption) {
                    statesOption.hidden = true;
                    statesOption.disabled = true;
                }
                if (districtsOption) {
                    districtsOption.hidden = false;
                    districtsOption.disabled = false;
                }
            }

            await this.loadStateContent(stateId);

        } else {
            // For other states (or if logic changes), just show details
            this.showStateDetails(stateId);
        }
    }

    highlightState(stateId) {
        if (!this.containers.indiaMap) return;

        // Remove existing highlights
        const allPaths = this.containers.indiaMap.querySelectorAll('path');
        allPaths.forEach(p => p.classList.remove('highlighted'));

        // Add highlight to clicked state
        // Try exact match or IN- prefix
        if (stateId) {
            let target = document.getElementById(stateId) || document.getElementById(`IN-${stateId}`);
            if (target) {
                target.classList.add('highlighted');
            }
        }
    }

    async showIndiaView() {
        this.currentView = 'india';

        this.containers.state.classList.remove('active');
        this.containers.india.classList.add('active');

        // Reset sidebar
        this.highlightState(null); // Clear highlights
        const backBtn = document.getElementById('back-to-india-btn');
        if (backBtn) backBtn.style.display = 'none';

        if (this.breadcrumbs.sep) this.breadcrumbs.sep.style.display = 'none';
        if (this.breadcrumbs.state) this.breadcrumbs.state.style.display = 'none';
        if (this.breadcrumbs.india) this.breadcrumbs.india.classList.add('active');

        if (this.containers.indiaMap.querySelector('svg')) {
            this.panZoom = new PanZoomController('#map-viewport', '#india-map-container');
            this.panZoom.reset();
        }

        // Reset view dropdown: Allow and Select 'States' view again
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector) {
            const statesOption = viewSelector.querySelector('option[value="states"]');
            const districtsOption = viewSelector.querySelector('option[value="districts"]');

            if (statesOption) {
                statesOption.hidden = false;
                statesOption.disabled = false;
            }
            if (districtsOption) {
                districtsOption.hidden = true;
                districtsOption.disabled = true;
            }
            viewSelector.value = 'states'; // Auto-select States
        }

        this.updateSidebarPlaceholder('INDIA', 'INDIA');

        // Load Real Data
        this.loadIndiaOverview();
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

                // Show overview initially - Load Kerala state data
                try {
                    const lookupId = stateId.length === 2 ? `IN-${stateId}` : stateId;
                    const data = await this.dataManager.getStateData(lookupId);
                    this.updateSidebarWithData(data);

                    // Ensure MapInteractions has the data
                    if (this.mapInteractions) {
                        this.mapInteractions.currentData = data;
                        this.mapInteractions.stateOverviewData = data;
                    }
                } catch (e) {
                    console.error("Failed to load state overview data:", e);
                }

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
        return;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    window.viewController = new ViewController(dataManager);
});

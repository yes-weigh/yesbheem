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

        this.loadingOverlay = document.getElementById('loading-overlay');
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
            const response = await fetch('india_map_high_res.svg');
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
        } catch (error) {
            console.error('Failed to load India map:', error);
        } finally {
            this.showLoading(false);
        }
    }

    initializeIndiaInteractions() {
        if (!this.containers.indiaMap) return;

        const states = this.containers.indiaMap.querySelectorAll('path');
        states.forEach(state => {
            state.addEventListener('click', (e) => {
                let stateId = state.id;
                if (stateId.startsWith('IN-')) stateId = stateId.replace('IN-', '');
                const stateName = state.getAttribute('title') || stateId;
                this.showStateView(stateId, stateName);
            });

            state.addEventListener('mouseenter', () => {
                this.updateSidebarPlaceholder(state.getAttribute('title'), 'India');
            });
        });
    }

    updateSidebarPlaceholder(titleText, context = 'State') {
        const title = document.getElementById('district-name');
        const desc = document.getElementById('district-description');
        const statsContainer = document.getElementById('stats-container');
        const dealerSection = document.getElementById('dealer-section');

        // Only clear stats if we are resetting to a generic state (not updating with valid data)
        // actually, we clear on hover for now or keep previous? user asked for data.
        // Let's clear to avoid confusion.
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

        const toggle = document.getElementById('color-grade-wrapper');
        if (stateId === 'KL' && toggle) {
            toggle.classList.remove('start-hidden');
            toggle.classList.add('visible');
        } else if (toggle) {
            toggle.classList.remove('visible');
            toggle.classList.add('start-hidden');
        }

        if (stateId === 'KL') {
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
        this.breadcrumbs.india.classList.remove('active');
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
            // Re-prefix for DataManager if needed (it expects IN-TL format usually?? 
            // Checking DataManager.js: it maps stateId 'IN-AP' etc. 
            // My click handler strips 'IN-'. So I should re-add it or DataManager should handle it.
            // DataManager has a map with 'IN-xx' keys. 
            // Let's pass 'IN-' + stateId if length is 2.

            const lookupId = stateId.length === 2 ? `IN-${stateId}` : stateId;

            const data = await this.dataManager.getStateData(lookupId);

            const title = document.getElementById('district-name');
            const desc = document.getElementById('district-description');

            if (title) title.textContent = data.name;
            if (desc) desc.textContent = "State Performance Overview";

            const statsContainer = document.getElementById('stats-container');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="stat-card">
                        <span class="stat-label">Achievement</span>
                        <div class="stat-value" style="color:${this.getColor(data.achievement)}">${data.achievement}</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Current Sales</span>
                        <div class="stat-value">₹${this.formatNumber(data.currentSales)}</div>
                    </div>
                    <div class="stat-card">
                        <span class="stat-label">Dealer Count</span>
                        <div class="stat-value">${data.dealerCount}</div>
                    </div>
                     <div class="stat-card">
                        <span class="stat-label">Monthly Target</span>
                        <div class="stat-value">₹${this.formatNumber(data.monthlyTarget)}</div>
                    </div>
                `;
            }

            const dealerSection = document.getElementById('dealer-section');
            if (dealerSection && data.dealers.length > 0) {
                const maxSales = data.dealers[0].sales;
                let dealerHtml = '<h3 style="margin-bottom:1rem;color:var(--text-muted);font-size:0.9rem;text-transform:uppercase;letter-spacing:0.05em;">Dealer Performance</h3>';
                
                data.dealers.forEach((d, i) => {
                    const percent = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
                    dealerHtml += `
                        <div class="dealer-item" style="position:relative; overflow:hidden;">
                            <div style="position:absolute; bottom:0; left:0; height:3px; background:var(--primary); width:${percent}%; opacity:0.7; transition:width 0.5s;"></div>
                            <div class="dealer-rank">${i + 1}</div>
                            <div style="flex:1; position:relative; z-index:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <div class="dealer-name" style="font-weight:500;color:white;">${d.name}</div>
                                    <div class="dealer-sales" style="font-size:0.85rem;color:var(--text-muted)">₹${this.formatNumber(d.sales)}</div>
                                </div>
                                <div style="font-size:0.7rem; color:rgba(255,255,255,0.3); margin-top:2px;">Contribution: ${percent.toFixed(1)}% of Top</div>
                            </div>
                        </div>
                     `;
                });
                dealerSection.innerHTML = dealerHtml;
            }

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
        this.breadcrumbs.india.classList.add('active');

        if (this.containers.indiaMap.querySelector('svg')) {
            this.panZoom = new PanZoomController('#map-viewport', '#india-map-container');
            this.panZoom.reset();
        }

        this.updateSidebarPlaceholder('India Overview', 'India');
        const toggle = document.getElementById('color-grade-wrapper');
        if (toggle) { toggle.classList.remove('visible'); toggle.classList.add('start-hidden'); }
    }

    async loadStateContent(stateId) {
        this.showLoading(true);
        try {
            let svgText;
            if (this.stateMapCache.has(stateId)) {
                svgText = this.stateMapCache.get(stateId);
            } else {
                const response = await fetch(`Kerala-map-en.svg?t=${Date.now()}`);
                if (!response.ok) throw new Error('Map not found');
                svgText = await response.text();
                this.stateMapCache.set(stateId, svgText);
            }

            this.containers.stateMap.innerHTML = svgText;

            const svg = this.containers.stateMap.querySelector('svg');
            if (svg) {
                svg.style.width = '100%';
                svg.style.height = '100%';
            }

            if (!this.mapInteractions && typeof MapInteractions !== 'undefined') {
                this.mapInteractions = new MapInteractions(this.dataManager, this);
            }

            if (this.mapInteractions) {
                this.mapInteractions.initializeKeralaDistricts();
                await this.mapInteractions.loadDistrictData(); // LOAD DATA CALL ADDED
            }

            this.panZoom = new PanZoomController('#map-viewport', '#state-map-container');

        } catch (error) {
            console.error('Error loading state map:', error);
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        if (!this.loadingOverlay) return;
        if (show) this.loadingOverlay.classList.remove('hidden');
        else this.loadingOverlay.classList.add('hidden');
    }

    // Utilities for rendering
    formatNumber(num) {
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
        if (num >= 1000) return (num / 1000).toFixed(2) + ' K';
        return num.toFixed(2);
    }

    getColor(achievement) {
        const p = parseFloat(achievement);
        if (p >= 100) return '#10b981';
        if (p >= 70) return '#f59e0b';
        return '#ef4444';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    window.viewController = new ViewController(dataManager);
});

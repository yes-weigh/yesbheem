/**
 * MapInteractions - Handles district/region click events and interactions
 */
import { getColorShade } from './utils/color-shade-generator.js';
import { DistrictColorizer } from './components/district-colorizer.js';
import { DistrictLabels } from './components/district-labels.js';
import { DistrictHover } from './components/district-hover.js';

class MapInteractions {
    constructor(dataManager, viewController) {
        this.dataManager = dataManager;
        this.viewController = viewController;
        this.districtInsights = {};
        this.currentStateId = null;
        this.stateOverviewData = null; // Cache for state overview
        this.selectedDistrictId = null; // Track selected district

        // Initialize component instances
        this.colorizer = new DistrictColorizer();
        this.labels = new DistrictLabels();
        this.hover = new DistrictHover();
    }

    /**
     * Initialize Kerala district interactions
     * @param {string} stateId - Current state ID (e.g., 'KL')
     */
    handleViewChange(viewType) {
        // console.log('handleViewChange called with:', viewType);
        const dealerSection = document.getElementById('dealer-section');
        if (!dealerSection) return;

        // Show loading immediately to provide visual feedback
        dealerSection.innerHTML = UIRenderer.renderLoading('Loading view...');

        // Wrapped in setTimeout to allow the browser to render the loader
        setTimeout(() => {
            let html = '';
            let metric = 'sales'; // Default to sales (districts view)

            if (viewType === 'dealers') {
                // Show dealers list
                if (this.currentData && this.currentData.dealers) {
                    html = UIRenderer.renderDealerList(this.currentData.dealers);
                }
                // User requested coloring for Dealers view (same as dealer_count)
                metric = 'dealer_count';
                // Coloring applied at end of function or explicitly here? 
                // The coloring logic is inside the `else` block (Line 84).
                // So for this block, I must call it explicitly or refactor.
                // I'll call it explicitly.
                if (this.districtInsights) {
                    this.colorizeDistricts(metric);

                    // Update hover component with new metric
                    if (this.hover) {
                        this.hover.updateMetric(metric);
                    }
                }

            } else if (viewType === 'states') {
                // Fallback if somehow triggered
                if (this.currentData && this.currentData.dealers) {
                    const statesData = this.dataManager.aggregateByState(this.currentData.dealers);
                    html = UIRenderer.renderDistrictSalesList(statesData);
                }
                metric = null;

            } else {
                // District Views: districts (sales), gdp, population, dealer_count
                if (this.districtInsights && Object.keys(this.districtInsights).length > 0) {
                    // Determine Metric
                    if (viewType === 'gdp') metric = 'gdp';
                    else if (viewType === 'population') metric = 'population';
                    else if (viewType === 'dealer_count') metric = 'dealer_count';
                    else metric = 'sales';

                    // Sort for Sidebar
                    const districtsArray = Object.values(this.districtInsights).filter(d => d.name);

                    // Helper to parse if needed (reusing logic)
                    const parseVal = (v) => {
                        if (typeof v === 'number') return v;
                        if (!v) return 0;
                        return parseFloat(v.toString().replace(/,/g, '').replace(/[^0-9.]/g, '')) || 0;
                    };

                    let sortFn;
                    if (metric === 'sales') sortFn = (a, b) => (b.currentSales || 0) - (a.currentSales || 0);
                    else if (metric === 'dealer_count') sortFn = (a, b) => (b.dealerCount || 0) - (a.dealerCount || 0);
                    else if (metric === 'gdp') sortFn = (a, b) => parseVal(b.gdp) - parseVal(a.gdp);
                    else if (metric === 'population') sortFn = (a, b) => parseVal(b.population) - parseVal(a.population);

                    districtsArray.sort(sortFn);

                    // Render List
                    if (metric === 'sales' || metric === 'districts') {
                        html = UIRenderer.renderDistrictSalesList(districtsArray);
                    } else if (metric === 'dealer_count') {
                        // Map to expected format for renderDealerCountList if needed or reuse same
                        html = UIRenderer.renderDealerCountList(districtsArray, 'Districts by Dealer Count');
                    } else {
                        // GDP / Pop
                        const title = metric === 'gdp' ? 'Districts by GDP' : 'Districts by Population';
                        html = UIRenderer.renderStateMetricList(districtsArray, metric, title);
                    }

                    // Apply Coloring
                    this.colorizeDistricts(metric);

                    // Update hover component with new metric
                    if (this.hover) {
                        this.hover.updateMetric(metric);
                    }
                }
            }

            console.log(`[handleViewChange] Setting currentViewMetric to: ${metric}`);
            if (html) dealerSection.innerHTML = html;
            this.currentViewMetric = metric; // Cache for hover

            // Debug
            // const testEl = document.getElementById('IN-KL-14'); // Kasaragod
            // if(testEl) console.log('Test Element listeners active?');
        }, 50);
    }


    // getColorShade() moved to utils/color-shade-generator.js

    /**
     * Colorize districts based on metric
     * Delegates to DistrictColorizer component
     */
    colorizeDistricts(metric) {
        this.colorizer.colorizeDistricts(metric, this.districtInsights);
    }

    // Update initializeDistricts to add Hover and Labels
    initializeDistricts(stateId) {
        this.currentStateId = stateId;
        const districts = document.querySelectorAll('.district');
        const mapContainer = document.getElementById('state-map-container');
        const stateView = document.getElementById('state-view');

        // Create dedicated label for State View since India view label gets hidden
        let hoverLabel = document.getElementById('state-hover-label');
        if (!hoverLabel && stateView) {
            hoverLabel = document.createElement('div');
            hoverLabel.id = 'state-hover-label';
            hoverLabel.style.position = 'absolute';
            hoverLabel.style.top = '20px';
            hoverLabel.style.left = '20px';
            hoverLabel.style.background = 'rgba(15, 23, 42, 0.9)';
            hoverLabel.style.color = '#e2e8f0';
            hoverLabel.style.padding = '8px 12px';
            hoverLabel.style.borderRadius = '6px';
            hoverLabel.style.fontSize = '1rem';
            hoverLabel.style.fontWeight = '500';
            hoverLabel.style.pointerEvents = 'none';
            hoverLabel.style.zIndex = '1000';
            hoverLabel.style.display = 'none';
            hoverLabel.style.border = '1px solid rgba(255,255,255,0.1)';
            hoverLabel.style.backdropFilter = 'blur(4px)';

            // Ensure state-view is relative
            if (getComputedStyle(stateView).position === 'static') {
                stateView.style.position = 'relative';
            }
            stateView.appendChild(hoverLabel);
        }

        this.cacheStateData();

        // Use DistrictLabels component to create labels
        this.labels.createLabels(districts, mapContainer);

        // Set default metric if missing
        if (!this.currentViewMetric) {
            console.log('[initializeDistricts] Defaulting metric to sales');
            this.currentViewMetric = 'sales';
        } else {
            console.log(`[initializeDistricts] Metric already set to: ${this.currentViewMetric}`);
        }

        // Use DistrictHover component to initialize hover interactions
        this.hover.initialize(districts, hoverLabel, this.districtInsights, this.currentViewMetric);

        districts.forEach(district => {
            // Click event
            district.addEventListener('click', (e) => {
                e.stopPropagation();
                districts.forEach(d => d.classList.remove('highlighted'));
                district.classList.add('highlighted');
                district.style.opacity = '1';

                this.selectedDistrictId = district.id;
                this.handleDistrictClick(district.id);
            });
        });

        // Background Click
        if (mapContainer) {
            mapContainer.addEventListener('click', async (e) => {
                if (e.target.tagName === 'svg' || e.target === mapContainer) {
                    districts.forEach(d => d.classList.remove('highlighted'));
                    this.selectedDistrictId = null;

                    if (this.stateOverviewData) {
                        this.updateSidebar(this.stateOverviewData);
                    }

                    // Reset View to Districts (default for map view)
                    const viewSelector = document.getElementById('view-selector');
                    if (viewSelector) {
                        // Unhide options
                        const districtsOption = viewSelector.querySelector('option[value="districts"]');
                        if (districtsOption) {
                            districtsOption.hidden = false;
                            districtsOption.disabled = false;
                        }
                        const choices = ['gdp', 'population', 'dealer_count'];
                        choices.forEach(v => {
                            const opt = viewSelector.querySelector(`option[value="${v}"]`);
                            if (opt) { opt.hidden = false; opt.disabled = false; }
                        });

                        // Always reset to 'districts' view on background click in State View
                        viewSelector.value = 'districts';
                        this.currentView = 'districts'; // Reset internal view state

                        this.handleViewChange(viewSelector.value);
                    }
                }
            });
        }
    }

    async cacheStateData() {
        if (this.currentStateId && this.dataManager) {
            const lookupId = this.currentStateId.length === 2 ? `IN-${this.currentStateId}` : this.currentStateId;
            try {
                this.stateOverviewData = await this.dataManager.getStateData(lookupId);
            } catch (err) {
                console.error("Error caching state overview:", err);
            }
        }
    }

    /**
     * Handle district click event
     */
    handleDistrictClick(districtId) {
        const infoPanel = document.getElementById('info-panel');
        const insights = this.districtInsights[districtId];

        if (insights) {
            this.updateSidebar(insights);
        }

        if (infoPanel) infoPanel.classList.add('active');

        // FORCE Dealers View and Hide Districts Option
        this.currentView = 'dealers';
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector) {
            viewSelector.value = 'dealers';
            const districtsOption = viewSelector.querySelector('option[value="districts"]');
            if (districtsOption) {
                districtsOption.hidden = true;
                districtsOption.disabled = true;
            }

            // Also hide GDP, Population and Dealer Count when viewing a specific district
            const gdpOption = viewSelector.querySelector('option[value="gdp"]');
            const popOption = viewSelector.querySelector('option[value="population"]');
            const dealerCountOption = viewSelector.querySelector('option[value="dealer_count"]');

            if (gdpOption) {
                gdpOption.hidden = true;
                gdpOption.disabled = true;
            }
            if (popOption) {
                popOption.hidden = true;
                popOption.disabled = true;
            }
            if (dealerCountOption) {
                dealerCountOption.hidden = true;
                dealerCountOption.disabled = true;
            }
        }
        // Re-render sidebar to match new view
        this.renderSidebarContent();
    }

    /**
     * Helper to update the sidebar DOM
     */
    updateSidebar(data) {
        const districtNameEl = document.getElementById('district-name');
        const districtDescriptionEl = document.getElementById('district-description');
        const dealerSection = document.getElementById('dealer-section');

        if (!districtNameEl) return;

        districtNameEl.textContent = data.name;

        // Determine description based on context (District vs State)
        if (districtDescriptionEl) {
            // Hide description for cleaner UI
            districtDescriptionEl.style.display = 'none';
        }

        // Send stats to dashboard header via postMessage (instead of floating tile)
        window.parent.postMessage({
            type: 'STATS_UPDATE',
            data: {
                name: data.name,
                gdp: data.gdp,
                population: data.population,
                achievement: data.achievement,
                currentSales: data.currentSales,
                dealerCount: data.dealerCount ? data.dealerCount : (data.dealers ? data.dealers.length : 0),
                monthlyTarget: data.monthlyTarget
            }
        }, '*');

        // Store data for view switching
        this.currentData = data;

        // Initialize view state if not set
        if (!this.currentView) {
            this.currentView = 'districts'; // Default to districts for Kerala
        }

        // Render toggle + content
        this.renderSidebarContent();
    }

    /**
     * Render sidebar content with toggle
     */
    renderSidebarContent() {
        const dealerSection = document.getElementById('dealer-section');
        if (!dealerSection || !this.currentData) return;

        // Render toggle and appropriate list
        // Create HTML content directly (No toggle buttons)
        let html = '';

        if (this.currentView === 'dealers') {
            html += UIRenderer.renderDealerList(this.currentData.dealers);
        } else {
            // For districts view (default or selected via dropdown)
            if (this.districtInsights && Object.keys(this.districtInsights).length > 0) {
                const sortedDistricts = this.dataManager.getDistrictsSortedBySales(this.districtInsights);
                html += UIRenderer.renderDistrictSalesList(sortedDistricts);
            }
        }

        dealerSection.innerHTML = html;
        // Toggle listeners removed
    }

    /**
     * Apply color grading based on achievement
     */
    applyColorGrading() {
        const districts = document.querySelectorAll('.district');
        districts.forEach(district => {
            const districtId = district.id;
            const insights = this.districtInsights[districtId];
            if (insights) {
                const color = UIRenderer.getColor(insights.achievement);
                district.style.fill = color;
            }
        });
    }

    /**
     * Remove color grading
     */
    removeColorGrading() {
        const districts = document.querySelectorAll('.district');
        districts.forEach(district => {
            district.style.fill = '';
        });
    }

    /**
     * Load district data
     */
    async loadDistrictData(stateName = 'Kerala') {
        const districts = document.querySelectorAll('.district');
        const districtIds = Array.from(districts).map(d => d.id).filter(id => id);

        if (this.dataManager && this.dataManager.loadData) {
            try {
                const data = await this.dataManager.loadData(stateName, districtIds);
                if (data && Object.keys(data).length > 0) {
                    this.districtInsights = data;
                    console.log('District insights loaded:', Object.keys(data).length, 'districts');

                    // Update hover component with new data
                    if (this.hover) {
                        this.hover.updateData(data);
                        console.log('[loadDistrictData] Updated hover component with district data');
                    }

                    // Show sorted district list in state overview
                    // This displays when user is looking at Kerala state (not a specific district)
                    if (!this.selectedDistrictId) {
                        const sortedDistricts = this.dataManager.getDistrictsSortedBySales(data);
                        const dealerSection = document.getElementById('dealer-section');
                        if (dealerSection && sortedDistricts) {
                            dealerSection.innerHTML = UIRenderer.renderDistrictSalesList(sortedDistricts);
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load district data:', error);
            }
        }
    }

    /**
     * Show state-level information (Legacy wrapper if needed, but now internalized)
     */
    showStateInfo(stateData) {
        this.updateSidebar(stateData);
        const infoPanel = document.getElementById('info-panel');
        if (infoPanel) infoPanel.classList.add('active');
    }


}

// Expose to window
window.MapInteractions = MapInteractions;

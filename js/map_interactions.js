/**
 * MapInteractions - Handles district/region click events and interactions
 */
class MapInteractions {
    constructor(dataManager, viewController) {
        this.dataManager = dataManager;
        this.viewController = viewController;
        this.districtInsights = {};
        this.currentStateId = null;
        this.stateOverviewData = null; // Cache for state overview
        this.selectedDistrictId = null; // Track selected district
    }

    /**
     * Initialize Kerala district interactions
     * @param {string} stateId - Current state ID (e.g., 'KL')
     */
    initializeDistricts(stateId) {
        this.currentStateId = stateId;
        const districts = document.querySelectorAll('.district');
        const mapContainer = document.getElementById('state-map-container');

        // Cache initial state data for quick revert
        this.cacheStateData();

        // Add click event listeners to each district
        districts.forEach(district => {
            district.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling to background
                // Remove highlighted class from all
                districts.forEach(d => d.classList.remove('highlighted'));
                district.classList.add('highlighted');

                this.selectedDistrictId = district.id;
                this.handleDistrictClick(district.id);
            });

            // Hover effects removed for strict click-only interaction
        });

        // Background Click Listener for State Map
        if (mapContainer) {
            mapContainer.addEventListener('click', async (e) => {
                // Only reset to state overview if clicking directly on SVG background (not a district path)
                if (e.target.tagName === 'svg' || e.target === mapContainer) {
                    // Deselect all districts
                    districts.forEach(d => d.classList.remove('highlighted'));
                    this.selectedDistrictId = null;

                    // Show State Overview
                    if (this.stateOverviewData) {
                        this.updateSidebar(this.stateOverviewData);
                    }

                    // Restore Districts View
                    this.currentView = 'districts';
                    const viewSelector = document.getElementById('view-selector');
                    if (viewSelector) {
                        const districtsOption = viewSelector.querySelector('option[value="districts"]');
                        if (districtsOption) {
                            districtsOption.hidden = false;
                            districtsOption.disabled = false;
                        }

                        // Show GDP and Population again
                        const gdpOption = viewSelector.querySelector('option[value="gdp"]');
                        const popOption = viewSelector.querySelector('option[value="population"]');
                        if (gdpOption) {
                            gdpOption.hidden = false;
                            gdpOption.disabled = false;
                        }
                        if (popOption) {
                            popOption.hidden = false;
                            popOption.disabled = false;
                        }

                        viewSelector.value = 'districts';
                    }
                    // Re-render sidebar
                    this.renderSidebarContent();
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

            // Also hide GDP and Population when viewing a specific district
            const gdpOption = viewSelector.querySelector('option[value="gdp"]');
            const popOption = viewSelector.querySelector('option[value="population"]');
            if (gdpOption) {
                gdpOption.hidden = true;
                gdpOption.disabled = true;
            }
            if (popOption) {
                popOption.hidden = true;
                popOption.disabled = true;
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

    /**
     * Handle view change from floating buttons
     */
    handleViewChange(viewType) {
        console.log('handleViewChange called with:', viewType);
        const dealerSection = document.getElementById('dealer-section');
        if (!dealerSection) {
            console.log('dealer-section not found');
            return;
        }

        console.log('currentData:', this.currentData);

        let html = '';

        if (viewType === 'dealers') {
            // Show dealers list
            if (this.currentData && this.currentData.dealers) {
                console.log('Rendering dealers list, count:', this.currentData.dealers.length);
                html = UIRenderer.renderDealerList(this.currentData.dealers);
            }
        } else if (viewType === 'states') {
            if (this.currentData && this.currentData.dealers) {
                console.log('Aggregating states from dealers...');
                const statesData = this.dataManager.aggregateByState(this.currentData.dealers);
                console.log('States data:', statesData);
                html = UIRenderer.renderDistrictSalesList(statesData);
            }
        } else if (viewType === 'districts') {
            // Show districts list (Kerala view)
            if (this.districtInsights && Object.keys(this.districtInsights).length > 0) {
                const sortedDistricts = this.dataManager.getDistrictsSortedBySales(this.districtInsights);
                html = UIRenderer.renderDistrictSalesList(sortedDistricts);
            }
        }

        console.log('Updating dealerSection with html length:', html.length);
        dealerSection.innerHTML = html;
    }
}

// Expose to window
window.MapInteractions = MapInteractions;

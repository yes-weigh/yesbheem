/**
 * MapInteractions - Handles district/region click events and interactions
 */
class MapInteractions {
    constructor(dataManager, viewController) {
        this.dataManager = dataManager;
        this.viewController = viewController;
        this.districtInsights = {};
        this.colorGradeEnabled = false;
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
        const colorGradeToggle = document.getElementById('color-grade-toggle');
        const mapContainer = document.getElementById('state-map-container');

        // Cache initial state data for quick revert
        this.cacheStateData();

        // Add click event listeners to each district
        districts.forEach(district => {
            district.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent bubbling to background
                // Remove selected class from all
                districts.forEach(d => d.classList.remove('selected'));
                district.classList.add('selected');

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
                    districts.forEach(d => d.classList.remove('selected'));
                    this.selectedDistrictId = null;

                    // Show State Overview
                    if (this.stateOverviewData) {
                        this.updateSidebar(this.stateOverviewData);
                    }
                }
            });
        }

        // Handle color grade toggle
        if (colorGradeToggle) {
            colorGradeToggle.addEventListener('change', (e) => {
                this.colorGradeEnabled = e.target.checked;
                if (this.colorGradeEnabled) {
                    this.applyColorGrading();
                } else {
                    this.removeColorGrading();
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
    }

    /**
     * Helper to update the sidebar DOM
     */
    updateSidebar(data) {
        const districtNameEl = document.getElementById('district-name');
        const districtDescriptionEl = document.getElementById('district-description');
        const statsContainer = document.getElementById('stats-container');
        const dealerSection = document.getElementById('dealer-section');
        const statsFloater = document.getElementById('stats-floater');

        if (!districtNameEl) return;

        districtNameEl.textContent = data.name;

        // Determine description based on context (District vs State)
        if (districtDescriptionEl) {
            // Simple check: if it has 'dealers' array and monthlyTarget > 500000 (likely state), OR check name
            if (data.name === this.stateOverviewData?.name) {
                districtDescriptionEl.textContent = "State Performance Overview";
            } else {
                districtDescriptionEl.textContent = `Detailed performance for ${data.name}`;
            }
        }

        // Update Floating Stats
        if (statsContainer) {
            statsContainer.innerHTML = UIRenderer.renderStats(data);
        }

        // Show Floater
        if (statsFloater) statsFloater.classList.remove('hidden');

        // Update Dealer list in sidebar
        if (dealerSection) dealerSection.innerHTML = UIRenderer.renderDealerList(data.dealers);
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

                    // Apply color grading if toggle is on
                    const colorGradeToggle = document.getElementById('color-grade-toggle');
                    if (colorGradeToggle && colorGradeToggle.checked) {
                        this.applyColorGrading();
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

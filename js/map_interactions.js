/**
 * MapInteractions - Handles district/region click events and interactions
 */
class MapInteractions {
    constructor(dataManager, viewController) {
        this.dataManager = dataManager;
        this.viewController = viewController;
        this.districtInsights = {};
        this.colorGradeEnabled = false;
    }

    /**
     * Initialize Kerala district interactions
     */
    initializeKeralaDistricts() {
        const districts = document.querySelectorAll('.district');
        const colorGradeToggle = document.getElementById('color-grade-toggle');

        // Add click event listeners to each district
        districts.forEach(district => {
            district.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleDistrictClick(district.id);
            });

            district.addEventListener('mouseenter', () => {
                district.style.opacity = '0.8';
            });

            district.addEventListener('mouseleave', () => {
                district.style.opacity = '1';
            });
        });

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

    /**
     * Handle district click event
     */
    handleDistrictClick(districtId) {
        const infoPanel = document.getElementById('info-panel');
        const districtNameEl = document.getElementById('district-name');
        const districtDescriptionEl = document.getElementById('district-description');

        if (!infoPanel || !districtNameEl || !districtDescriptionEl) return;

        const insights = this.districtInsights[districtId];

        if (insights) {
            // Update info panel with district data
            districtNameEl.textContent = insights.name;

            // Build the description with insights
            let description = `
                <div class="info-stats">
                    <div class="stat-item">
                        <span class="stat-label">Dealer Count</span>
                        <span class="stat-value">${insights.dealerCount || 0}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Current Sales</span>
                        <span class="stat-value">₹${this.formatNumber(insights.currentSales || 0)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Monthly Target</span>
                        <span class="stat-value">₹${this.formatNumber(insights.monthlyTarget || 500000)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Achievement</span>
                        <span class="stat-value achievement">${insights.achievement || '0%'}</span>
                    </div>
                </div>
            `;

            // Add all dealers if available
            if (insights.dealers && insights.dealers.length > 0) {
                const maxSales = insights.dealers[0].sales;

                description += '<div class="dealer-list"><h3 style="margin:1.5rem 0 1rem 0; color:var(--text-muted); font-size:0.9rem; text-transform:uppercase; letter-spacing:0.05em;">Dealer Performance</h3>';

                insights.dealers.forEach((dealer, index) => {
                    const percent = maxSales > 0 ? (dealer.sales / maxSales) * 100 : 0;

                    description += `
                        <div class="dealer-item" style="position:relative; overflow:hidden; margin-bottom:0.75rem; padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; display:flex; gap:1rem; align-items:center;">
                            <div style="position:absolute; bottom:0; left:0; height:3px; background:#4f46e5; width:${percent}%; opacity:0.7;"></div>
                            
                            <div class="dealer-rank" style="background:#4f46e5; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">${index + 1}</div>
                            <div style="flex:1;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span class="dealer-name" style="font-weight:500; color:white;">${dealer.name}</span>
                                    <span class="dealer-sales" style="font-size:0.85rem; color:#94a3b8;">₹${this.formatNumber(dealer.sales)}</span>
                                </div>
                            </div>
                        </div>
                    `;
                });
                description += '</div>';
            }

            districtDescriptionEl.innerHTML = description;
        }

        infoPanel.classList.add('active');
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
                const color = this.getColorByAchievement(insights.achievement);
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
     * Get color based on achievement percentage
     */
    getColorByAchievement(achievement) {
        const percent = parseFloat(achievement);
        if (percent >= 100) return '#10b981'; // Green
        else if (percent >= 70) return '#f59e0b'; // Orange
        else if (percent >= 40) return '#fbbf24'; // Yellow
        else return '#ef4444'; // Red
    }

    /**
     * Format number with Indian number system
     */
    formatNumber(num) {
        if (num >= 10000000) {
            return (num / 10000000).toFixed(2) + ' Cr';
        } else if (num >= 100000) {
            return (num / 100000).toFixed(2) + ' L';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + ' K';
        }
        return num.toFixed(2);
    }

    /**
     * Load district data
     */
    async loadDistrictData() {
        if (this.dataManager && this.dataManager.loadData) {
            try {
                const data = await this.dataManager.loadData();
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
     * Show state-level information
     */
    showStateInfo(stateData) {
        const infoPanel = document.getElementById('info-panel');
        const districtNameEl = document.getElementById('district-name');
        const districtDescriptionEl = document.getElementById('district-description');

        if (!infoPanel || !districtNameEl || !districtDescriptionEl) return;

        districtNameEl.textContent = stateData.name;

        // Build state info display
        let description = `
            <div class="info-stats">
                <div class="stat-item">
                    <span class="stat-label">Dealer Count</span>
                    <span class="stat-value">${stateData.dealerCount || 0}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Current Sales</span>
                    <span class="stat-value">₹${this.formatNumber(stateData.currentSales || 0)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Monthly Target</span>
                    <span class="stat-value">₹${this.formatNumber(stateData.monthlyTarget || 500000)}</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Achievement</span>
                    <span class="stat-value achievement">${stateData.achievement || '0%'}</span>
                </div>
            </div>
        `;

        // Add all dealers if available
        if (stateData.dealers && stateData.dealers.length > 0) {
            const maxSales = stateData.dealers[0].sales;

            description += '<div class="dealer-list"><h3 style="margin:1.5rem 0 1rem 0; color:var(--text-muted); font-size:0.9rem; text-transform:uppercase; letter-spacing:0.05em;">Dealer Performance</h3>';

            stateData.dealers.forEach((dealer, index) => {
                const percent = maxSales > 0 ? (dealer.sales / maxSales) * 100 : 0;

                description += `
                     <div class="dealer-item" style="position:relative; overflow:hidden; margin-bottom:0.75rem; padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; display:flex; gap:1rem; align-items:center;">
                        <div style="position:absolute; bottom:0; left:0; height:3px; background:#4f46e5; width:${percent}%; opacity:0.7;"></div>
                        
                        <div class="dealer-rank" style="background:#4f46e5; width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">${index + 1}</div>
                        <div style="flex:1;">
                            <div style="display:flex; justify-content:space-between; align-items:center;">
                                <span class="dealer-name" style="font-weight:500; color:white;">${dealer.name}</span>
                                <span class="dealer-sales" style="font-size:0.85rem; color:#94a3b8;">₹${this.formatNumber(dealer.sales)}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            description += '</div>';
        }

        districtDescriptionEl.innerHTML = description;
        infoPanel.classList.add('active');
    }
}

// Expose to window
window.MapInteractions = MapInteractions;

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

    /**
     * Helper function to create color shades without transparency
     * Converts hex to RGB, adjusts lightness, returns opaque hex color
     * High intensity = full saturated color, Low intensity = darker (blended with black)
     */
    getColorShade(hexColor, intensity) {
        // intensity is 0-1, where 0 is darkest (low sales), 1 is full color (high sales)
        // Convert hex to RGB
        const r = parseInt(hexColor.slice(1, 3), 16);
        const g = parseInt(hexColor.slice(3, 5), 16);
        const b = parseInt(hexColor.slice(5, 7), 16);

        // Create shade by blending with black for low values
        // Use a range from 30% to 100% of base color intensity
        const minIntensity = 0.3;
        const actualIntensity = minIntensity + (intensity * (1 - minIntensity));

        // Blend with black (0, 0, 0) - darker for low values, full color for high values
        const newR = Math.round(r * actualIntensity);
        const newG = Math.round(g * actualIntensity);
        const newB = Math.round(b * actualIntensity);

        return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
    }

    /**
     * Colorize districts based on metric
     */
    colorizeDistricts(metric) {
        console.log(`[Colorize] Metric: ${metric}, Data Available:`, !!this.districtInsights);
        if (!metric || !this.districtInsights) return;

        const districts = document.querySelectorAll('.district');
        const dataArr = Object.values(this.districtInsights);

        // Base colors for each metric
        const colors = {
            'sales': '#3b82f6',       // Blue
            'dealer_count': '#f97316', // Orange
            'gdp': '#10b981',          // Green
            'population': '#8b5cf6'    // Purple
        };
        const baseColor = colors[metric] || '#3b82f6';

        // Get Max for normalization
        const parseVal = (d) => {
            let val = 0;
            if (metric === 'sales') val = d.currentSales || d.totalSales || 0;
            else if (metric === 'dealer_count') val = d.dealerCount || 0;
            else if (metric === 'gdp') {
                let s = d.gdp;
                val = s ? parseFloat(s.toString().replace(/,/g, '').replace(/[^0-9.]/g, '')) : 0;
            }
            else if (metric === 'population') {
                let s = d.population;
                val = s ? parseFloat(s.toString().replace(/,/g, '').replace(/[^0-9.]/g, '')) : 0;
            }
            return val || 0;
        };

        let maxVal = 0;
        dataArr.forEach(d => {
            const v = parseVal(d);
            if (v > maxVal) maxVal = v;
        });
        console.log(`[Colorize] Max Value for ${metric}: ${maxVal}`);

        // Apply colors to districts
        districts.forEach(d => {
            const districtName = d.getAttribute('title') || d.id;
            const item = dataArr.find(x => x.name.trim().toLowerCase() === districtName.trim().toLowerCase().replace(/-/g, ' '));

            d.classList.remove('highlighted'); // Reset selection style

            const paths = d.querySelectorAll('path');

            if (item) {
                const val = parseVal(item);
                if (val <= 0) {
                    // No data - use light gray, fully opaque
                    paths.forEach(p => {
                        p.style.transition = 'fill 0.3s ease, stroke 0.3s ease';
                        p.style.fill = '#e2e8f0';
                        p.style.stroke = '#ffffff'; // White border
                        p.style.opacity = '1'; // Fully opaque
                    });
                } else {
                    // Calculate intensity (0-1) based on value
                    const intensity = val / maxVal;

                    // Get fully opaque color shade
                    const shadedColor = this.getColorShade(baseColor, intensity);

                    paths.forEach(p => {
                        p.style.transition = 'fill 0.3s ease, stroke 0.3s ease';
                        p.style.fill = shadedColor;
                        p.style.stroke = '#ffffff'; // White border
                        p.style.opacity = '1'; // Fully opaque - no transparency!
                    });
                }
            } else {
                // No matching data - light gray, fully opaque
                paths.forEach(p => {
                    p.style.transition = 'fill 0.3s ease, stroke 0.3s ease';
                    p.style.fill = '#e2e8f0';
                    p.style.stroke = '#ffffff'; // White border
                    p.style.opacity = '1'; // Fully opaque
                });
            }
        });
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
            // ... existing hover label creation logic can remain or be shortened if not changing ...
            // (Re-declaring it here to keep context, assuming previous block was good)
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

        // 1. Clean up existing labels (if re-initializing)
        const existingLabels = mapContainer ? mapContainer.querySelectorAll('.district-label') : [];
        existingLabels.forEach(l => l.remove());

        districts.forEach(district => {
            const districtName = district.getAttribute('title') || district.id;

            // 2. ADD TEXT LABEL
            // Use getBBox to find center
            try {
                // Ensure the district is visible/rendered to get BBox
                const bbox = district.getBBox();
                if (bbox && bbox.width > 0) {
                    let cx = bbox.x + bbox.width / 2;
                    let cy = bbox.y + bbox.height / 2;

                    // Create Text Element
                    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

                    // Format Name (Shorten heavy names if needed, or split lines)
                    // e.g. Thiruvananthapuram -> TVM? Or keep full? 
                    // Let's keep formatted name but handle length via font size if needed.
                    // Simple logic: Capitalize words
                    let labelText = districtName.replace(/-/g, ' ');

                    // Special shortening for better map fit? 
                    // "Thiruvananthapuram" is very long. Let's use "Trivandrum" or wrapping?
                    // User asked for "District Name", implying full name usually.
                    // We'll trust the space provided but maybe scale font.

                    // Capitalize First Letter of Each Word
                    labelText = labelText.split(' ').map(word => {
                        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                    }).join(' ');





                    if (labelText.toLowerCase().trim() === 'alappuzha') {
                        cy += 30; // Shift Down to wider area
                    }

                    text.textContent = labelText;
                    text.setAttribute('x', cx);
                    text.setAttribute('y', cy);
                    text.setAttribute('class', 'district-label'); // Mark for cleanup
                    text.setAttribute('text-anchor', 'middle'); // Center horizontally
                    text.setAttribute('dominant-baseline', 'middle'); // Center vertically
                    text.style.pointerEvents = 'none'; // Click-through to path
                    text.style.fill = 'rgba(255, 255, 255, 0.95)'; // White text, high contrast
                    text.style.fontSize = '40px'; // User requested 40px
                    text.style.fontWeight = '400'; // Not bold (Requested)
                    text.style.fontFamily = 'Inter, sans-serif';
                    text.style.textShadow = '0px 1px 3px rgba(0,0,0,0.9)'; // Stronger shadow

                    // Adaptive Rotation: If district is tall, rotate text vertical (-90 deg)
                    const lowerName = labelText.toLowerCase().trim();
                    if (lowerName === 'malappuram') {
                        text.setAttribute('transform', `rotate(-45, ${cx}, ${cy})`);
                    } else if (lowerName === 'thiruvananthapuram') {
                        text.setAttribute('transform', `rotate(45, ${cx}, ${cy})`);
                    } else if (lowerName === 'alappuzha') {
                        text.setAttribute('transform', `rotate(70, ${cx}, ${cy})`); // Vertical
                    } else if (bbox.height > bbox.width * 1.2) {
                        text.setAttribute('transform', `rotate(-90, ${cx}, ${cy})`);
                    }

                    // Append to the SVG (Parent of district path)
                    if (district.parentNode) {
                        district.parentNode.appendChild(text);
                    }
                }
            } catch (e) {
                console.warn('Could not add label for district:', districtName, e);
            }

            // Click
            district.addEventListener('click', (e) => {
                e.stopPropagation();
                districts.forEach(d => d.classList.remove('highlighted'));
                district.classList.add('highlighted');
                // Ensure opacity is full on selection for visibility?
                district.style.opacity = '1';

                this.selectedDistrictId = district.id;
                this.handleDistrictClick(district.id);
            });

            // Hover
            // Set default metric if missing
            if (!this.currentViewMetric) {
                console.log('[initializeDistricts] Defaulting metric to sales');
                this.currentViewMetric = 'sales';
            } else {
                console.log(`[initializeDistricts] Metric already set to: ${this.currentViewMetric}`);
            }

            district.addEventListener('mouseenter', () => {
                const districtName = district.getAttribute('title') || district.id;
                let text = `<strong>${districtName}</strong>`;

                // Add Data logic
                if (this.currentViewMetric && this.districtInsights) {
                    const dataArr = Object.values(this.districtInsights);
                    const item = dataArr.find(x => x.name.trim().toLowerCase() === districtName.trim().toLowerCase().replace(/-/g, ' '));

                    console.log(`[Hover] ${districtName}:`, item);

                    if (item) {
                        let valLabel = '';
                        let val = '';
                        let m = this.currentViewMetric;

                        if (m === 'sales') {
                            valLabel = 'Sales';
                            // Format
                            const s = item.currentSales || 0;
                            if (s >= 10000000) val = `₹${(s / 10000000).toFixed(2)} Cr`;
                            else val = `₹${(s / 100000).toFixed(2)} L`;
                        } else if (m === 'dealer_count') {
                            valLabel = 'Dealers';
                            val = item.dealerCount || 0;
                        } else if (m === 'gdp') {
                            valLabel = 'GDP';
                            val = item.gdp || 'N/A';
                        } else if (m === 'population') {
                            valLabel = 'Population';
                            val = item.population || 'N/A';
                        }

                        if (valLabel) {
                            text += `<div style="font-size:0.85rem; opacity:0.8; margin-top:2px;">${valLabel}: ${val}</div>`;
                        }
                    }
                }

                // For State View (Kerala), use the dedicated label
                let label = document.getElementById('state-hover-label');
                if (!label) label = document.getElementById('map-hover-label'); // Fallback

                if (label) {
                    label.innerHTML = text;
                    label.style.display = 'block';
                    // Positioning handled by CSS/Mouse move? No, usually fixed or follows mouse.
                    // If fixed top-left, we are good.
                }
            });

            district.addEventListener('mouseleave', () => {
                if (hoverLabel) hoverLabel.style.display = 'none';
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
                    // If we want to KEEP the current view (e.g. GDP) but just deselect district, 
                    // we should re-trigger handleViewChange with current dropdown value.
                    const viewSelector = document.getElementById('view-selector');
                    if (viewSelector) {
                        // Unhide options (copy logic from fix)
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
                    // this.renderSidebarContent(); // Redundant and causes overwrite issues
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


}

// Expose to window
window.MapInteractions = MapInteractions;

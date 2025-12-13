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

    async handleViewChange(view) {
        // Update active state in dropdown if triggered programmatically
        const viewSelector = document.getElementById('view-selector');
        if (viewSelector && viewSelector.value !== view) {
            viewSelector.value = view;
        }

        if (this.currentView === 'india') {
            const dealerSection = document.getElementById('dealer-section');
            if (!dealerSection) return;

            if (view === 'states') {
                if (this.indiaData && this.indiaData.dealers) {
                    const statesData = this.dataManager.aggregateByState(this.indiaData.dealers);
                    dealerSection.innerHTML = UIRenderer.renderDistrictSalesList(statesData);
                    this.colorizeMapStates(statesData, 'states');
                }
            } else if (view === 'dealer_count') {
                if (this.indiaData && this.indiaData.dealers) {
                    const statesData = this.dataManager.aggregateByState(this.indiaData.dealers);
                    // Sort by Dealer Count
                    statesData.sort((a, b) => b.dealerCount - a.dealerCount);
                    dealerSection.innerHTML = UIRenderer.renderDealerCountList(statesData);
                    this.colorizeMapStates(statesData, 'dealer_count');
                }
            } else if (view === 'dealers') {
                if (this.indiaData && this.indiaData.dealers) {
                    dealerSection.innerHTML = UIRenderer.renderDealerList(this.indiaData.dealers);
                    this.resetMapColors();
                }
            } else if (view === 'gdp' || view === 'population') {
                // Loading state
                dealerSection.innerHTML = '<div style="padding:1rem; text-align:center; color: var(--text-muted);">Loading Data...</div>';

                try {
                    const data = await this.dataManager.getStatesWithKPIs();

                    // Sort Data
                    const parseVal = (v) => {
                        if (!v) return -1;
                        let str = v.toString().replace(/,/g, '');
                        return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
                    };

                    data.sort((a, b) => parseVal(b[view]) - parseVal(a[view]));

                    const title = view === 'gdp' ? 'States by GDP' : 'States by Population';
                    dealerSection.innerHTML = UIRenderer.renderStateMetricList(data, view, title);
                    this.colorizeMapStates(data, view);

                } catch (e) {
                    console.error('Error rendering KPI view:', e);
                    dealerSection.innerHTML = '<div style="padding:1rem; text-align:center; color: var(--text-error);">Failed to load data</div>';
                }
            }
        } else if (this.currentView === 'state') {
            // Updated handling: Delegate to MapInteractions
            if (this.mapInteractions) {
                this.mapInteractions.handleViewChange(view);
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

        // Create or get the valid label element
        let hoverLabel = document.getElementById('map-hover-label');
        if (!hoverLabel && this.containers.indiaMap) {
            hoverLabel = document.createElement('div');
            hoverLabel.id = 'map-hover-label';
            hoverLabel.style.position = 'absolute';
            hoverLabel.style.top = '20px';
            hoverLabel.style.left = '20px';
            hoverLabel.style.background = 'rgba(15, 23, 42, 0.9)'; // Dark background
            hoverLabel.style.color = '#e2e8f0';
            hoverLabel.style.padding = '8px 12px';
            hoverLabel.style.borderRadius = '6px';
            hoverLabel.style.fontSize = '1rem';
            hoverLabel.style.fontWeight = '500';
            hoverLabel.style.pointerEvents = 'none'; // Click-through
            hoverLabel.style.zIndex = '1000';
            hoverLabel.style.display = 'none'; // Hidden by default
            hoverLabel.style.border = '1px solid rgba(255,255,255,0.1)';
            hoverLabel.style.backdropFilter = 'blur(4px)';

            // Append to the VIEW container, NOT the map container
            // This prevents it from moving when the map is panned/zoomed
            if (this.containers.india) {
                this.containers.india.style.position = 'relative';
                this.containers.india.appendChild(hoverLabel);
            }
        }

        const states = this.containers.indiaMap.querySelectorAll('path');
        states.forEach(state => {
            // Hover Listeners
            state.addEventListener('mouseenter', () => {
                const stateName = state.getAttribute('title') || state.id.replace('IN-', '');
                if (stateName && hoverLabel) {
                    let text = `<strong>${stateName}</strong>`;

                    // Add Data Detail if available
                    if (this.currentMapData && this.currentMetric) {
                        const key = stateName.toLowerCase().trim();
                        const item = this.currentMapData.find(d => d.name.toLowerCase().trim() === key);

                        if (item) {
                            let valLabel = '';
                            let val = '';

                            if (this.currentMetric === 'states') { // Sales
                                valLabel = 'Sales';
                                // Format Sales: Cr or L
                                const s = item.currentSales || item.sales || item.totalSales || 0;
                                if (s >= 10000000) val = `₹${(s / 10000000).toFixed(2)} Cr`;
                                else val = `₹${(s / 100000).toFixed(2)} L`;
                            } else if (this.currentMetric === 'dealer_count') {
                                valLabel = 'Dealers';
                                val = item.dealerCount || 0;
                            } else if (this.currentMetric === 'gdp') {
                                valLabel = 'GDP';
                                val = item.gdp || 'N/A';
                            } else if (this.currentMetric === 'population') {
                                valLabel = 'Population';
                                val = item.population || 'N/A';
                            }

                            if (valLabel) {
                                text += `<div style="font-size:0.85rem; opacity:0.8; margin-top:2px;">${valLabel}: ${val}</div>`;
                            }
                        }
                    }

                    hoverLabel.innerHTML = text;
                    hoverLabel.style.display = 'block';
                }
            });

            state.addEventListener('mouseleave', () => {
                if (hoverLabel) {
                    hoverLabel.style.display = 'none';
                }
            });

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

                    // Restore Dealer Count option
                    const dealerCountOption = viewSelector.querySelector('option[value="dealer_count"]');
                    if (dealerCountOption) {
                        dealerCountOption.hidden = false;
                        dealerCountOption.disabled = false;
                    }

                    viewSelector.value = 'states'; // Auto-select States
                }

                this.loadIndiaOverview().then(() => {
                    // Force update coloring for 'states' view
                    this.handleViewChange('states');
                    // Ensure active state cleared
                    this.currentView = 'india';
                });
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

            // Also hide GDP and Population when viewing a specific state
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

            // Also hide Dealer Count when viewing a specific state
            const dealerCountOption = viewSelector.querySelector('option[value="dealer_count"]');
            if (dealerCountOption) {
                dealerCountOption.hidden = true;
                dealerCountOption.disabled = true;
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

    async showStateView(stateId, stateName, renderSidebar = true) {
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

                // Hide GDP/Pop for drill down too - REVERTED for Kerala
                // Now we want them visible for Kerala
                const gdpOption = viewSelector.querySelector('option[value="gdp"]');
                const popOption = viewSelector.querySelector('option[value="population"]');

                // Only show if it IS Kerala, otherwise hide (default behavior for other states drilled down?)
                // Actually the current drill down logic is primarily for Kerala.
                // If we expand later, we might want to check data availability.
                if (gdpOption) {
                    gdpOption.hidden = false;
                    gdpOption.disabled = false;
                }
                if (popOption) {
                    popOption.hidden = false;
                    popOption.disabled = false;
                }

                // Unhide Dealer Count for state view as well
                const dealerCountOption = viewSelector.querySelector('option[value="dealer_count"]');
                if (dealerCountOption) {
                    dealerCountOption.hidden = false;
                    dealerCountOption.disabled = false;
                }
            }

            await this.loadStateContent(stateId, renderSidebar);

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

            // Show ALL top level options again: GDP, Population, Dealer Count
            const gdpOption = viewSelector.querySelector('option[value="gdp"]');
            const popOption = viewSelector.querySelector('option[value="population"]');
            const dealerCountOption = viewSelector.querySelector('option[value="dealer_count"]');

            if (gdpOption) {
                gdpOption.hidden = false;
                gdpOption.disabled = false;
            }
            if (popOption) {
                popOption.hidden = false;
                popOption.disabled = false;
            }
            if (dealerCountOption) {
                dealerCountOption.hidden = false;
                dealerCountOption.disabled = false;
            }

            viewSelector.value = 'states'; // Auto-select States
        }

        this.updateSidebarPlaceholder('INDIA', 'INDIA');

        // Load Real Data
        this.loadIndiaOverview();
    }

    async loadStateContent(stateId, renderSidebar = true) {
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

                    if (this.mapInteractions) {
                        this.mapInteractions.stateOverviewData = data;
                        this.mapInteractions.currentData = data; // Initialize currentData for view handlers

                        // Only update sidebar if requested (avoids flicker when restoring district view)
                        if (renderSidebar) {
                            this.updateSidebarWithData(data);
                        }
                    }
                } catch (e) {
                    console.error("Failed to load state overview data:", e);
                }

                // Also load detailed district data in background for interactions
                await this.mapInteractions.loadDistrictData(stateName);

                // Force View Refresh to match dropdown (ensure Districts list overrides default)
                const viewSelector = document.getElementById('view-selector');
                if (viewSelector) {
                    this.handleViewChange(viewSelector.value);
                }
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

    colorizeMapStates(sortedData, metric) {
        if (!this.containers.indiaMap) return;

        // Cache for hover lookup
        this.currentMapData = sortedData;
        this.currentMetric = metric;

        // 1. Create Data Map (Name -> Data Item & Rank)
        const dataMap = new Map();
        sortedData.forEach((item, index) => {
            if (item.name) {
                dataMap.set(item.name.toLowerCase().trim(), { ...item, rank: index });
            }
        });

        const total = sortedData.length;
        const paths = this.containers.indiaMap.querySelectorAll('path');

        // 2. Define Base Colors
        const colors = {
            'states': '#3b82f6',       // Blue (Sales)
            'dealer_count': '#f97316', // Orange
            'gdp': '#10b981',          // Green
            'population': '#8b5cf6'    // Purple
        };
        const baseColor = colors[metric] || '#3b82f6';

        // Helper to check for "Zero" value
        const isZero = (item, m) => {
            if (!item) return true;
            let val = 0;
            if (m === 'states') val = item.sales || item.totalSales || item.currentSales || 0;
            else if (m === 'dealer_count') val = item.dealerCount || 0;
            else if (m === 'gdp') val = this.parseMetricVal(item.gdp);
            else if (m === 'population') val = this.parseMetricVal(item.population);
            return val <= 0;
        };

        // 3. Apply Colors
        paths.forEach(path => {
            let name = path.getAttribute('title');
            if (!name) {
                // Try ID fallback
                let id = path.id;
                if (id && id.startsWith('IN-')) id = id.replace('IN-', '');
                name = id;
            }

            if (name) {
                const key = name.toLowerCase().trim();
                const item = dataMap.get(key);

                if (item) {
                    // Check if value is effectively zero
                    if (isZero(item, metric)) {
                        // VERY DARK for zero values - blend with dark background
                        path.style.fill = '#0f172a'; // Deep slate (almost black)
                        path.style.fillOpacity = '0.3';
                        path.style.stroke = 'rgba(255,255,255,0.2)'; // More visible
                    } else {
                        const rank = item.rank;
                        // Higher Contrast Curve
                        // Normalized Rank (0 to 1, where 1 is top)
                        const norm = 1 - (rank / total);

                        // Power curve for better contrast separation (Values drop off faster)
                        const intensity = Math.pow(norm, 1.5);

                        // Opacity Range: 0.2 to 1.0 (Previously 0.2 to 0.9)
                        const opacity = 0.2 + (0.8 * intensity);

                        path.style.fill = baseColor;
                        path.style.fillOpacity = opacity;
                        path.style.stroke = 'rgba(255,255,255,0.6)'; // Much more visible
                    }
                } else {
                    // No data found in list -> Very Dark
                    path.style.fill = '#0f172a';
                    path.style.fillOpacity = '0.3';
                    path.style.stroke = '';
                }
            }
        });
    }

    // Helper for parsing string values
    parseMetricVal(v) {
        if (!v) return 0;
        if (typeof v === 'number') return v;
        let str = v.toString().replace(/,/g, '');
        return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    }

    resetMapColors() {
        this.currentMetric = null;
        if (!this.containers.indiaMap) return;
        const paths = this.containers.indiaMap.querySelectorAll('path');
        paths.forEach(path => {
            path.style.fill = '';
            path.style.fillOpacity = '';
            path.style.stroke = '';
        });
    }

    handleListClick(stateName) {
        if (!stateName) return;
        console.log('List clicked for:', stateName);

        // Map State Name to ID
        // Simplified lookup (could be robustified)
        const nameToId = {
            'Kerala': 'KL',
            'Tamil Nadu': 'TN',
            'Karnataka': 'KA',
            'Maharashtra': 'MH',
            'Andhra Pradesh': 'AP',
            'Telangana': 'TG',
            'Goa': 'GA',
            'Gujarat': 'GJ',
            'Rajasthan': 'RJ',
            'Punjab': 'PB',
            'Haryana': 'HR',
            'Himachal Pradesh': 'HP',
            'Jammu and Kashmir': 'JK',
            'Uttar Pradesh': 'UP',
            'Uttarakhand': 'UT',
            'Madhya Pradesh': 'MP',
            'Chhattisgarh': 'CT',
            'Odisha': 'OR',
            'West Bengal': 'WB',
            'Bihar': 'BR',
            'Jharkhand': 'JH',
            'Assam': 'AS',
            'Sikkim': 'SK',
            'Arunachal Pradesh': 'AR',
            'Nagaland': 'NL',
            'Manipur': 'MN',
            'Mizoram': 'MZ',
            'Tripura': 'TR',
            'Meghalaya': 'ML',
            'Delhi': 'DL',
            'Puducherry': 'PY',
            'Chandigarh': 'CH',
            'Ladakh': 'LA',
            'Dadra and Nagar Haveli': 'DN',
            'Daman and Diu': 'DD',
            'Andaman and Nicobar Islands': 'AN',
            'Lakshadweep': 'LD'
        };

        let id = nameToId[stateName];

        // Extended fuzzy match if direct lookup fails
        if (!id) {
            const key = stateName.toLowerCase();
            for (const [n, i] of Object.entries(nameToId)) {
                if (n.toLowerCase() === key) {
                    id = i;
                    break;
                }
            }
        }

        if (id) {
            // SPECIAL HANDLING FOR KERALA
            if (id === 'KL') {
                this.showStateDetails(id);
            } else {
                this.showStateView(id, stateName);
            }
        } else {
            console.warn('Could not map View list click to State ID for:', stateName);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const dataManager = new DataManager();
    window.viewController = new ViewController(dataManager);
});

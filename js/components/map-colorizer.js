/**
 * @fileoverview Map colorization logic for states and districts
 * @module components/map-colorizer
 */

/**
 * Handles map colorization based on various metrics (sales, GDP, population, dealer count)
 * @class MapColorizer
 * @example
 * const colorizer = new MapColorizer();
 * colorizer.colorizeMapStates(container, statesData, 'sales');
 */
export class MapColorizer {
    constructor() {
        /**
         * Color scheme for different metrics
         * @type {Object<string, string>}
         */
        this.colors = {
            'states': '#3b82f6',       // Blue (Sales)
            'dealer_count': '#f97316', // Orange
            'gdp': '#10b981',          // Green
            'population': '#8b5cf6'    // Purple
        };

        /**
         * Cached map data for current view
         * @type {Array|null}
         */
        this.currentMapData = null;

        /**
         * Current metric being displayed
         * @type {string|null}
         */
        this.currentMetric = null;
    }

    /**
     * Colorizes map states based on sorted data and metric
     * @param {HTMLElement} container - Map container element
     * @param {Array<Object>} sortedData - Sorted array of state/district data
     * @param {string} metric - Metric to colorize by ('states', 'dealer_count', 'gdp', 'population')
     * @returns {Object} Object containing currentMapData and currentMetric for external use
     * @example
     * const result = colorizer.colorizeMapStates(mapContainer, statesData, 'gdp');
     * // Returns: { currentMapData: [...], currentMetric: 'gdp' }
     */
    colorizeMapStates(container, sortedData, metric) {
        if (!container) return { currentMapData: null, currentMetric: null };

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
        const paths = container.querySelectorAll('path');

        // 2. Get Base Color
        const baseColor = this.colors[metric] || '#3b82f6';

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
                    if (this.isZero(item, metric)) {
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

        return { currentMapData: this.currentMapData, currentMetric: this.currentMetric };
    }

    /**
     * Checks if an item has a zero or invalid value for the given metric
     * @param {Object} item - Data item to check
     * @param {string} metric - Metric to check
     * @returns {boolean} True if value is zero or invalid
     * @private
     */
    isZero(item, metric) {
        if (!item) return true;
        let val = 0;
        if (metric === 'states') val = item.sales || item.totalSales || item.currentSales || 0;
        else if (metric === 'dealer_count') val = item.dealerCount || 0;
        else if (metric === 'gdp') val = this.parseMetricVal(item.gdp);
        else if (metric === 'population') val = this.parseMetricVal(item.population);
        return val <= 0;
    }

    /**
     * Parses metric values from strings (e.g., "3.5 Cr", "1000")
     * @param {string|number} value - Value to parse
     * @returns {number} Parsed numeric value
     * @example
     * parseMetricVal("3.5 Cr") // Returns: 3.5
     * parseMetricVal(1000) // Returns: 1000
     */
    parseMetricVal(value) {
        if (!value) return 0;
        if (typeof value === 'number') return value;
        let str = value.toString().replace(/,/g, '');
        return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
    }

    /**
     * Resets all map colors to default
     * @param {HTMLElement} container - Map container element
     * @example
     * colorizer.resetMapColors(mapContainer);
     */
    resetMapColors(container) {
        this.currentMetric = null;
        this.currentMapData = null;
        if (!container) return;
        const paths = container.querySelectorAll('path');
        paths.forEach(path => {
            path.style.fill = '';
            path.style.fillOpacity = '';
            path.style.stroke = '';
        });
    }
}

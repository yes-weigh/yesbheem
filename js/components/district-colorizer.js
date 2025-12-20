/**
 * @fileoverview District colorization logic for map visualization
 * @module components/district-colorizer
 */

import { getColorShade } from '../utils/color-shade-generator.js';

/**
 * Handles district colorization based on various metrics
 * @class DistrictColorizer
 * @example
 * const colorizer = new DistrictColorizer();
 * colorizer.colorizeDistricts('sales', districtData);
 */
export class DistrictColorizer {
    constructor() {
        /**
         * Color scheme for different metrics
         * @type {Object<string, string>}
         */
        this.colors = {
            'sales': '#3b82f6',       // Blue
            'dealer_count': '#f97316', // Orange
            'gdp': '#10b981',          // Green
            'population': '#8b5cf6'    // Purple
        };
    }

    /**
     * Colorizes districts based on metric and data
     * @param {string} metric - Metric to colorize by ('sales', 'dealer_count', 'gdp', 'population')
     * @param {Object} districtInsights - Object containing district data
     * @returns {void}
     * @example
     * colorizer.colorizeDistricts('sales', { 'Thiruvananthapuram': { currentSales: 5000000 } });
     */
    colorizeDistricts(metric, districtInsights) {
        console.log(`[Colorize] Metric: ${metric}, Data Available:`, !!districtInsights);
        if (!metric || !districtInsights) return;

        const districts = document.querySelectorAll('.district');
        const dataArr = Object.values(districtInsights);

        // Get base color for metric
        const baseColor = this.colors[metric] || '#3b82f6';

        // Get max value for normalization
        let maxVal = 0;
        dataArr.forEach(d => {
            const v = this.parseMetricValue(d, metric);
            if (v > maxVal) maxVal = v;
        });
        console.log(`[Colorize] Max Value for ${metric}: ${maxVal}`);

        // Apply colors to districts
        districts.forEach(d => {
            const districtName = d.getAttribute('title') || d.id;
            const item = dataArr.find(x =>
                x.name.trim().toLowerCase() === districtName.trim().toLowerCase().replace(/-/g, ' ')
            );

            d.classList.remove('highlighted'); // Reset selection style

            const paths = d.querySelectorAll('path');

            if (item) {
                const val = this.parseMetricValue(item, metric);
                if (val <= 0) {
                    // No data - use light gray, fully opaque
                    this.applyNoDataStyle(paths);
                } else {
                    // Calculate intensity (0-1) based on value
                    const intensity = val / maxVal;

                    // Get fully opaque color shade
                    const shadedColor = getColorShade(baseColor, intensity);

                    this.applyColorStyle(paths, shadedColor);
                }
            } else {
                // No matching data - light gray, fully opaque
                this.applyNoDataStyle(paths);
            }
        });
    }

    /**
     * Parses metric value from district data
     * @param {Object} district - District data object
     * @param {string} metric - Metric to parse
     * @returns {number} Parsed numeric value
     * @private
     */
    parseMetricValue(district, metric) {
        let val = 0;

        if (metric === 'sales') {
            val = district.currentSales || district.totalSales || 0;
        } else if (metric === 'dealer_count') {
            val = district.dealerCount || 0;
        } else if (metric === 'gdp') {
            let s = district.gdp;
            val = s ? parseFloat(s.toString().replace(/,/g, '').replace(/[^0-9.]/g, '')) : 0;
        } else if (metric === 'population') {
            let s = district.population;
            val = s ? parseFloat(s.toString().replace(/,/g, '').replace(/[^0-9.]/g, '')) : 0;
        }

        return val || 0;
    }

    /**
     * Applies color style to paths
     * @param {NodeList} paths - Path elements to style
     * @param {string} color - Color to apply
     * @private
     */
    applyColorStyle(paths, color) {
        paths.forEach(p => {
            p.style.transition = 'fill 0.3s ease, stroke 0.3s ease';
            p.style.fill = color;
            p.style.stroke = '#ffffff'; // White border
            p.style.opacity = '1'; // Fully opaque - no transparency!
        });
    }

    /**
     * Applies no-data style to paths
     * @param {NodeList} paths - Path elements to style
     * @private
     */
    applyNoDataStyle(paths) {
        paths.forEach(p => {
            p.style.transition = 'fill 0.3s ease, stroke 0.3s ease';
            p.style.fill = '#e2e8f0';
            p.style.stroke = '#ffffff'; // White border
            p.style.opacity = '1'; // Fully opaque
        });
    }

    /**
     * Resets all district colors
     * @returns {void}
     * @example
     * colorizer.resetColors();
     */
    resetColors() {
        const districts = document.querySelectorAll('.district');
        districts.forEach(d => {
            const paths = d.querySelectorAll('path');
            paths.forEach(p => {
                p.style.fill = '';
                p.style.stroke = '';
                p.style.opacity = '';
                p.style.transition = '';
            });
        });
    }
}

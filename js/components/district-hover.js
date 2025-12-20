/**
 * @fileoverview District hover interaction management
 * @module components/district-hover
 */

/**
 * Handles hover interactions and tooltips for districts
 * @class DistrictHover
 * @example
 * const hover = new DistrictHover();
 * hover.initialize(districts, hoverLabel, districtData, 'sales');
 */
export class DistrictHover {
    constructor() {
        /**
         * Reference to the hover label element
         * @type {HTMLElement|null}
         */
        this.hoverLabel = null;

        /**
         * Current district insights data
         * @type {Object|null}
         */
        this.districtInsights = null;

        /**
         * Current metric being displayed
         * @type {string|null}
         */
        this.currentMetric = null;
    }

    /**
     * Initializes hover interactions for all districts
     * @param {NodeList} districts - District elements
     * @param {HTMLElement} hoverLabel - Hover label element
     * @param {Object} districtInsights - District data object
     * @param {string} currentMetric - Current metric ('sales', 'dealer_count', 'gdp', 'population')
     * @returns {void}
     * @example
     * hover.initialize(districts, labelElement, districtData, 'sales');
     */
    initialize(districts, hoverLabel, districtInsights, currentMetric) {
        this.hoverLabel = hoverLabel;
        this.districtInsights = districtInsights;
        this.currentMetric = currentMetric || 'sales';

        console.log(`[DistrictHover] Initializing with metric: ${this.currentMetric}`);

        districts.forEach(district => {
            // Mouse enter event
            district.addEventListener('mouseenter', () => {
                this.handleMouseEnter(district);
            });

            // Mouse leave event
            district.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    /**
     * Handles mouse enter event for a district
     * @param {SVGElement} district - District element
     * @private
     */
    handleMouseEnter(district) {
        const districtName = district.getAttribute('title') || district.id;
        let text = `<strong>${districtName}</strong>`;

        // Add data if available
        if (this.currentMetric && this.districtInsights) {
            const dataArr = Object.values(this.districtInsights);
            const item = dataArr.find(x =>
                x.name.trim().toLowerCase() === districtName.trim().toLowerCase().replace(/-/g, ' ')
            );

            console.log(`[Hover] ${districtName}:`, item);

            if (item) {
                const { label, value } = this.formatValue(item, this.currentMetric);

                if (label && value) {
                    text += `<div style="font-size:0.85rem; opacity:0.8; margin-top:2px;">${label}: ${value}</div>`;
                }
            }
        }

        this.showTooltip(text);
    }

    /**
     * Shows the tooltip with formatted text
     * @param {string} htmlText - HTML text to display
     * @returns {void}
     * @private
     */
    showTooltip(htmlText) {
        // Try state-hover-label first, then fallback to map-hover-label
        let label = this.hoverLabel ||
            document.getElementById('state-hover-label') ||
            document.getElementById('map-hover-label');

        if (label) {
            label.innerHTML = htmlText;
            label.style.display = 'block';
        }
    }

    /**
     * Hides the tooltip
     * @returns {void}
     * @example
     * hover.hideTooltip();
     */
    hideTooltip() {
        if (this.hoverLabel) {
            this.hoverLabel.style.display = 'none';
        }
    }

    /**
     * Formats the value for display based on the metric
     * @param {Object} item - District data item
     * @param {string} metric - Metric type
     * @returns {Object} Object with label and formatted value
     * @private
     */
    formatValue(item, metric) {
        let label = '';
        let value = '';

        if (metric === 'sales') {
            label = 'Sales';
            const s = item.currentSales || 0;
            if (s >= 10000000) {
                value = `₹${(s / 10000000).toFixed(2)} Cr`;
            } else {
                value = `₹${(s / 100000).toFixed(2)} L`;
            }
        } else if (metric === 'dealer_count') {
            label = 'Dealers';
            value = item.dealerCount || 0;
        } else if (metric === 'gdp') {
            label = 'GDP';
            value = item.gdp || 'N/A';
        } else if (metric === 'population') {
            label = 'Population';
            value = item.population || 'N/A';
        }

        return { label, value };
    }

    /**
     * Updates the current metric
     * @param {string} metric - New metric to use
     * @returns {void}
     * @example
     * hover.updateMetric('gdp');
     */
    updateMetric(metric) {
        this.currentMetric = metric;
        console.log(`[DistrictHover] Metric updated to: ${metric}`);
    }

    /**
     * Updates the district insights data
     * @param {Object} districtInsights - New district data
     * @returns {void}
     * @example
     * hover.updateData(newDistrictData);
     */
    updateData(districtInsights) {
        this.districtInsights = districtInsights;
    }
}

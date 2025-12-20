/**
 * @fileoverview Hover tooltip management for map interactions
 * @module components/hover-tooltip
 */

/**
 * Manages hover tooltips for map states and districts
 * @class HoverTooltip
 * @example
 * const tooltip = new HoverTooltip();
 * tooltip.create(parentContainer);
 * tooltip.show('Kerala', stateData, 'sales');
 */
export class HoverTooltip {
    constructor() {
        /**
         * The tooltip DOM element
         * @type {HTMLElement|null}
         */
        this.element = null;
    }

    /**
     * Creates and appends the hover label element to the parent container
     * @param {HTMLElement} parentContainer - Container to append tooltip to
     * @returns {HTMLElement} The created tooltip element
     * @example
     * const tooltip = new HoverTooltip();
     * tooltip.create(document.getElementById('india-view'));
     */
    create(parentContainer) {
        // Check if already exists
        let hoverLabel = document.getElementById('map-hover-label');

        if (!hoverLabel && parentContainer) {
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

            // Ensure parent has relative positioning
            if (parentContainer) {
                parentContainer.style.position = 'relative';
                parentContainer.appendChild(hoverLabel);
            }
        }

        this.element = hoverLabel;
        return hoverLabel;
    }

    /**
     * Shows the tooltip with state/district information
     * @param {string} name - Name of the state/district
     * @param {Array<Object>} mapData - Current map data array
     * @param {string} metric - Current metric being displayed
     * @returns {void}
     * @example
     * tooltip.show('Kerala', statesData, 'sales');
     */
    show(name, mapData, metric) {
        if (!this.element || !name) return;

        let text = `<strong>${name}</strong>`;

        // Add Data Detail if available
        if (mapData && metric) {
            const key = name.toLowerCase().trim();
            const item = mapData.find(d => d.name.toLowerCase().trim() === key);

            if (item) {
                const { label, value } = this.formatValue(item, metric);

                if (label && value) {
                    text += `<div style="font-size:0.85rem; opacity:0.8; margin-top:2px;">${label}: ${value}</div>`;
                }
            }
        }

        this.element.innerHTML = text;
        this.element.style.display = 'block';
    }

    /**
     * Hides the tooltip
     * @returns {void}
     * @example
     * tooltip.hide();
     */
    hide() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    }

    /**
     * Formats the value for display based on the metric
     * @param {Object} item - Data item containing the metric value
     * @param {string} metric - Metric type ('states', 'dealer_count', 'gdp', 'population')
     * @returns {Object} Object with label and formatted value
     * @private
     * @example
     * const { label, value } = formatValue(stateData, 'sales');
     * // Returns: { label: 'Sales', value: '₹3.50 Cr' }
     */
    formatValue(item, metric) {
        let label = '';
        let value = '';

        if (metric === 'states') { // Sales
            label = 'Sales';
            // Format Sales: Cr or L
            const s = item.currentSales || item.sales || item.totalSales || 0;
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
     * Destroys the tooltip element
     * @returns {void}
     * @example
     * tooltip.destroy();
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

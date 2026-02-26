/**
 * UIRenderer
 * Centralizes the HTML generation for UI components like Stats Cards and Dealer Lists.
 * Ensures usage of standard CSS classes and consistent formatting.
 */

// Import component renderers
import { renderDealerList as _renderDealerList } from './components/dealer-list-renderer.js';
import { renderDistrictSalesList as _renderDistrictSalesList } from './components/district-list-renderer.js';
import { renderStateMetricList as _renderStateMetricList } from './components/state-metric-renderer.js';
import { renderDealerCountList as _renderDealerCountList } from './components/dealer-count-renderer.js';
import { renderLoading as _renderLoading } from './components/loading-spinner.js';
import { renderDealerEditForm as _renderDealerEditForm } from './components/dealer-edit-form.js';
import { renderDealerDetailsModal as _renderDealerDetailsModal } from './components/dealer-details-modal.js';
import { renderB2BLeadModal as _renderB2BLeadModal } from './components/b2b-lead-modal.js';
class UIRenderer {

    /**
     * Render the Stats Grid HTML
     * @param {Object} data - Aggregated data object containing achievement, currentSales, dealerCount, monthlyTarget
     * @returns {string} HTML string
     */
    static renderStats(data) {
        return `
            <div class="stat-card">
                <span class="stat-label">Achievement</span>
                <div class="stat-value" style="color:${this.getColor(data.achievement)}">${data.achievement || '0%'}</div>
            </div>
            <div class="stat-card">
                <span class="stat-label">GDP</span>
                <div class="stat-value">${data.gdp && data.gdp !== 'N/A' && data.gdp !== 0 ? (typeof data.gdp === 'number' ? ('₹' + this.formatNumber(data.gdp)) : data.gdp) : 'N/A'}</div>
            </div>
             <div class="stat-card">
                <span class="stat-label">Monthly Target</span>
                <div class="stat-value">₹${this.formatNumber(data.monthlyTarget || 0)}</div>
            </div>
        `;
    }

    /**
     * Render the Dealer List HTML
     * @param {Array} dealers - Array of dealer objects {name, sales}
     * @returns {string} HTML string
     */
    static renderDealerList(dealers) {
        return _renderDealerList(dealers, this.formatNumber);
    }

    /**
     * Render the District Sales List HTML (sorted by total sales)
     * @param {Array} districts - Array of district objects {name, totalSales}
     * @returns {string} HTML string
     */
    static renderDistrictSalesList(districts) {
        return _renderDistrictSalesList(districts, this.formatNumber);
    }

    /**
     * Render a generic list of states sorted by a metric (GDP/Population)
     * @param {Array} states - Array of objects {name, gdp, population}
     * @param {string} metricKey - Key to display ('gdp' or 'population')
     * @param {string} title - Header title
     */
    static renderStateMetricList(states, metricKey, title) {
        return _renderStateMetricList(states, metricKey, title);
    }

    /**
     * Render the Dealer Count List HTML (sorted by count)
     * @param {Array} states - Array of state/district objects {name, dealerCount}
     * @param {string} title - Optional title override
     * @returns {string} HTML string
     */
    static renderDealerCountList(states, title = 'States by Dealer Count') {
        return _renderDealerCountList(states, title);
    }

    /**
     * Render view toggle for switching between Dealers and Districts
     * @param {string} activeView - 'dealers' or 'districts'
     * @returns {string} HTML string
     */
    static renderViewToggle(activeView = 'dealers') {
        return `
            <div class="view-toggle">
                <button class="toggle-btn ${activeView === 'dealers' ? 'active' : ''}" data-view="dealers">
                    Dealers
                </button>
                <button class="toggle-btn ${activeView === 'districts' ? 'active' : ''}" data-view="districts">
                    Districts
                </button>
            </div>
        `;
    }

    // Utilities
    static formatNumber(num) {
        if (num === undefined || num === null || isNaN(num)) return '0.00';

        // Trillion
        if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + ' T';
        // Billion
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' B';
        // Crore
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        // Lakh
        if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
        // Thousand
        if (num >= 1000) return (num / 1000).toFixed(2) + ' K';

        return num.toFixed(2);
    }

    static getColor(achievement) {
        const p = parseFloat(achievement);
        if (p >= 100) return '#10b981';
        if (p >= 70) return '#f59e0b';
        return '#ef4444';
    }

    /**
     * Render a loading spinner with optional message
     * @param {string} message - Text to display below spinner
     * @returns {string} HTML string
     */
    static renderLoading(message = 'Loading...') {
        return _renderLoading(message);
    }

    /**
     * Render the Dealer Edit Form HTML
     * @param {string} dealerName 
     * @param {string} billingZip 
     * @param {string} shippingZip 
     * @param {Object} rawData - Full CSV row data
     * @returns {string} HTML string
     */
        static renderDealerEditForm(dealerName, billingZip = '', shippingZip = '', rawData = {}, generalSettings = {}) {
        return _renderDealerEditForm(dealerName, billingZip, shippingZip, rawData, generalSettings);
    }

    static renderDealerDetailsModal(data, settings) {
        return _renderDealerDetailsModal(data, settings);
    }

    static renderB2BLeadModal(lead, settings) {
        return _renderB2BLeadModal(lead, settings);
    }
}
window.UIRenderer = UIRenderer;



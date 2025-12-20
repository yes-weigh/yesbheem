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
        let fieldsHtml = '';

        // Fields to exclude from generic loop
        const excludeKeys = [
            'customer_name',
            'customer_id',
            'count',
            'sales',
            'sales_with_tax',
            'custom_fields_list',
            'currency_code',
            'branch_name',
            'shipping_state',
            'shipping_zipcode',
            'billing_zipcode',
            'district',
            'billing_state',
            'key_account_manager',
            'dealer_stage'
        ];

        // 1. Top Fields
        const topFieldMap = [
            { label: 'First Name', keys: ['first_name', 'first name', 'First Name'] },
            { label: 'Mobile Phone', keys: ['mobile_phone', 'mobile phone', 'phone', 'Mobile Phone'] },
            { label: 'Zip Code', keys: ['billing_zipcode'] }
        ];

        // 2. Bottom Fields
        const bottomFieldMap = [
            { label: 'District', keys: ['district'] },
            { label: 'State', keys: ['billing_state'] }
        ];

        const priorityFields = [];

        const renderFieldBlock = (map) => {
            let html = '';
            map.forEach(f => {
                let pKey = f.keys.find(k => rawData.hasOwnProperty(k));
                // District always shown if requested
                if (!pKey && f.keys.includes('district')) pKey = 'district';
                // State always shown if requested
                if (!pKey && f.keys.includes('billing_state')) pKey = 'billing_state';


                if (pKey) {
                    priorityFields.push(pKey);
                    const val = rawData[pKey] || '';
                    const label = f.label;

                    let inputHtml = `
                            <input type="text" 
                                   class="edit-field-input" 
                                   data-field="${pKey}" 
                                   value="${val}" 
                                   disabled
                                   style="flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default;">
                        `;

                    const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;
                    const loadingIcon = `<svg class="zip-loading-spinner" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none; animation: spin 1s linear infinite;"><circle cx="12" cy="12" r="10" opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path></svg>`;

                    const isEditable = label !== 'State' && label !== 'District';
                    const isZipCode = label === 'Zip Code';

                    const editButton = isEditable ? `
                             <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit" data-field-type="${isZipCode ? 'zipcode' : 'text'}">
                                ${pencilIcon}
                             </button>
                             ${isZipCode ? loadingIcon : ''}` : '';

                    html += `
                            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                                 <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                                 ${inputHtml}
                                 ${editButton}
                            </div>
                        `;
                }
            });
            return html;
        };

        // Render Top Fields
        fieldsHtml += renderFieldBlock(topFieldMap);

        // 3. Dropdown Fields (Key Account Manager, Dealer Stage)
        const dropdowns = [
            { label: 'KAM', key: 'key_account_manager', options: generalSettings.key_accounts || [] },
            { label: 'Stage', key: 'dealer_stage', options: generalSettings.dealer_stages || [] }
        ];

        dropdowns.forEach(dd => {
            priorityFields.push(dd.key); // Add dropdown keys to priorityFields
            const val = rawData[dd.key] || '';
            const label = dd.label;

            let optionsHtml = `<option value="" ${val === '' ? 'selected' : ''}>Select...</option>`;
            dd.options.forEach(opt => {
                const isSel = opt === val ? 'selected' : '';
                optionsHtml += `<option value="${opt}" ${isSel}>${opt}</option>`;
            });

            let inputHtml = `
                    <select class="edit-field-input" 
                            data-field="${dd.key}" 
                            disabled
                            style="flex: 1; min-width: 0; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default; appearance: none; -webkit-appearance: none;">
                        ${optionsHtml}
                    </select>
                `;

            const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

            const editButton = `
                     <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit" data-field-type="select">
                        ${pencilIcon}
                     </button>`;

            fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                         <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                         ${inputHtml}
                         ${editButton}
                    </div>
                `;
        });

        // 4. Generic Fields
        for (const [key, val] of Object.entries(rawData)) {
            if (excludeKeys.includes(key) || priorityFields.includes(key)) continue;

            let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            let value = val || '';
            value = value.replace(/"/g, '&quot;');

            let inputHtml = `
                <input type="text" 
                       class="edit-field-input" 
                       data-field="${key}" 
                       value="${value}" 
                       disabled
                       style="flex: 1; min-width: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; padding: 4px 0; border-radius: 4px; border: 1px solid transparent; background: transparent; color: white; font-size: 0.8rem; height: 26px; cursor: default;">
            `;

            const pencilIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>`;

            const editButton = `
                         <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit">
                            ${pencilIcon}
                         </button>`;

            fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                         <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                         ${inputHtml}
                         ${editButton}
                    </div>
                `;
        }

        // 5. Render Bottom Fields
        fieldsHtml += renderFieldBlock(bottomFieldMap);

        return `
            <div class="dealer-edit-form" onclick="event.stopPropagation()" style="background: rgba(15, 23, 42, 0.98); padding: 8px; margin: 4px 0 8px 0; border-radius: 6px; border: 1px solid var(--accent-color); box-shadow: 0 4px 12px rgba(0,0,0,0.4); width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">
                <div style="font-size: 0.8rem; color: var(--text-main); font-weight: 600; margin-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; display:flex; justify-content:space-between; align-items:center;">
                    <span>${dealerName}</span>
                    <button onclick="window.viewController.cancelEdit(this)" style="background: none; border: none; padding: 2px; cursor: pointer; color: var(--text-muted); opacity: 0.7; transition: opacity 0.2s;" title="Close">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                
                <div style="max-height: 250px; overflow-y: auto; padding-right: 2px; margin-bottom: 8px;">
                    ${fieldsHtml}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.1);">
                    <button onclick="window.viewController.cancelEdit(this)" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.2); background: transparent; color: var(--text-muted); cursor: pointer; transition: all 0.2s;">Cancel</button>
                    <button onclick="window.viewController.saveDealerInfo('${dealerName}')" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: none; background: var(--accent-color); color: white; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;">Save</button>
                </div>
            </div>
            `;
    }
}

window.UIRenderer = UIRenderer;

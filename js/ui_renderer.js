/**
 * UIRenderer
 * Centralizes the HTML generation for UI components like Stats Cards and Dealer Lists.
 * Ensures usage of standard CSS classes and consistent formatting.
 */
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
                <span class="stat-label">Current Sales</span>
                <div class="stat-value">₹${this.formatNumber(data.currentSales || 0)}</div>
            </div>
            <div class="stat-card">
                <span class="stat-label">Dealer Count</span>
                <div class="stat-value">${data.dealerCount || 0}</div>
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
        if (!dealers || dealers.length === 0) return '';

        const maxSales = dealers[0].sales;
        let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Top Dealers</h3>';
        html += '<div class="dealer-list">';

        dealers.forEach((d, i) => {
            // Filter out yescloud dealers
            if (d.isYesCloud) return;

            const percent = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
            html += `
                <div class="dealer-item-compact" onclick="window.viewController && window.viewController.handleListClick('${d.name}')" style="cursor: pointer;">
                    <div class="dealer-rank">${i + 1}</div>
                    <div class="dealer-info">
                        <div class="dealer-row">
                            <span class="dealer-name" title="${d.name}">${d.name}</span>
                            <span class="dealer-sales">₹${this.formatNumber(d.sales)}</span>
                        </div>
                        <div class="contribution-bar-bg">
                            <div class="contribution-bar-fill" style="width:${percent}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    /**
     * Render the District Sales List HTML (sorted by total sales)
     * @param {Array} districts - Array of district objects {name, totalSales}
     * @returns {string} HTML string
     */
    static renderDistrictSalesList(districts) {
        if (!districts || districts.length === 0) return '';

        // Helper to get sales value
        const getSales = (d) => d.currentSales || d.totalSales || 0;

        // Calculate total sales and max for percentage bars (like dealer list)
        const totalSales = districts.reduce((sum, d) => sum + getSales(d), 0);
        // Assuming sorted desc, but safer to calc max
        let maxSales = 0;
        districts.forEach(d => {
            const s = getSales(d);
            if (s > maxSales) maxSales = s;
        });

        let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Sales</h3>';
        html += '<div class="district-sales-list">';

        districts.forEach((district, i) => {
            const val = getSales(district);
            const percentage = totalSales > 0 ? ((val / totalSales) * 100) : 0;
            const percentageText = percentage.toFixed(1);
            // Bar width based on max sales (same as dealer list)
            const barWidth = maxSales > 0 ? (val / maxSales) * 100 : 0;

            html += `
                <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${district.name}')" style="cursor: pointer;">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-info">
                        <div class="district-row" style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap;">
                            <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                <span class="district-name" style="overflow: hidden; text-overflow: ellipsis;" title="${district.name}">${district.name}</span>
                                <span class="district-count" style="font-size: 0.75em; color: var(--text-muted); margin-left: 5px; flex-shrink: 0;" title="Dealer Count">(${district.dealerCount || 0})</span>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 10px;">
                                <span class="district-percentage" style="min-width: 45px; text-align: right;">${percentageText}%</span>
                                <span class="district-sales" style="min-width: 70px; text-align: right;">₹${this.formatNumber(val)}</span>
                            </div>
                        </div>
                        <div class="contribution-bar-bg">
                            <div class="contribution-bar-fill" style="width:${barWidth}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    /**
     * Render a generic list of states sorted by a metric (GDP/Population)
     * @param {Array} states - Array of objects {name, gdp, population}
     * @param {string} metricKey - Key to display ('gdp' or 'population')
     * @param {string} title - Header title
     */
    static renderStateMetricList(states, metricKey, title) {
        if (!states || states.length === 0) return '';

        // Helper to parse value (handles "3.5 Cr", "1000", etc)
        const parseVal = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            let str = val.replace(/,/g, '');
            // Simple Parsing assuming value is the main number content
            let num = parseFloat(str.replace(/[^0-9.]/g, ''));
            return isNaN(num) ? 0 : num;
        };

        // Calculate Totals and Max
        let totalVal = 0;
        let maxVal = 0;

        states.forEach(s => {
            const v = parseVal(s[metricKey]);
            totalVal += v;
            if (v > maxVal) maxVal = v;
        });

        let html = `<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${title}</h3>`;
        html += '<div class="district-sales-list">';

        states.forEach((state, i) => {
            const val = state[metricKey] || 'N/A';
            const numVal = parseVal(val);

            // Percentage of Total
            const percentTotal = totalVal > 0 ? (numVal / totalVal) * 100 : 0;
            const percentText = percentTotal.toFixed(1) + '%';

            // Bar relative to Max
            const barWidth = maxVal > 0 ? (numVal / maxVal) * 100 : 0;

            html += `
                <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${state.name}')" style="cursor: pointer;">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-info">
                        <div class="district-row">
                            <span class="district-name" title="${state.name}">${state.name}</span>
                            <span class="district-percentage" style="color: #3b82f6;">${percentText}</span>
                            <span class="district-sales" style="color: var(--text-main);">${val}</span>
                        </div>
                        <div class="contribution-bar-bg">
                            <div class="contribution-bar-fill" style="width:${barWidth}%"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    /**
     * Render the Dealer Count List HTML (sorted by count)
     * @param {Array} states - Array of state/district objects {name, dealerCount}
     * @param {string} title - Optional title override
     * @returns {string} HTML string
     */
    static renderDealerCountList(states, title = 'States by Dealer Count') {
        if (!states || states.length === 0) return '';

        // Calculate max for percentage bars
        const maxCount = states[0]?.dealerCount || 0;
        const totalDealers = states.reduce((sum, s) => sum + (s.dealerCount || 0), 0);

        let html = `<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${title}</h3>`;
        html += '<div class="district-sales-list">';

        states.forEach((state, i) => {
            const count = state.dealerCount || 0;
            // Bar width based on max count
            const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
            const percentTotal = totalDealers > 0 ? (count / totalDealers) * 100 : 0;

            html += `
                <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${state.name}')" style="cursor: pointer;">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-info">
                        <div class="district-row" style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap;">
                             <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                                <span class="district-name" style="overflow: hidden; text-overflow: ellipsis;" title="${state.name}">${state.name}</span>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 10px;">
                                <span class="district-percentage" style="min-width: 45px; text-align: right; color: var(--text-muted);">${percentTotal.toFixed(1)}%</span>
                                <span class="district-sales" style="min-width: 40px; text-align: right; color: var(--text-main); font-weight: 600;">${count}</span>
                            </div>
                        </div>
                        <div class="contribution-bar-bg">
                            <div class="contribution-bar-fill" style="width:${barWidth}%; background-color: #ed8936;"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
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
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
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
        return `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: var(--text-muted);">
                <div class="spinner" style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
                <div style="font-size: 0.9rem;">${message}</div>
            </div>
            <style>
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
    }

    /**
     * Render the Dealer Edit Form HTML
     * @param {string} dealerName 
     * @param {string} billingZip 
     * @param {string} shippingZip 
     * @param {Object} rawData - Full CSV row data
     * @returns {string} HTML string
     */
    static renderDealerEditForm(dealerName, billingZip = '', shippingZip = '', rawData = {}) {
        let fieldsHtml = '';
        // Fields to exclude from being editable or shown in valid inputs list (if any)
        // We definitely exclude customer_name as it is the key
        // Fields to exclude from being editable or shown in valid inputs list (if any)
        // We definitely exclude customer_name as it is the key
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
            'billing_zipcode', // Exclude from generic loop, handled manually
            'district' // Exclude from generic loop, handled manually
        ];

        // Sort keys? or Keep original order? Original order is better for context usually.
        // rawData should have keys in order of CSV


        // Define logical order and potential key variations
        const fieldMap = [
            { label: 'First Name', keys: ['first_name', 'first name', 'First Name'] },
            { label: 'Mobile Phone', keys: ['mobile_phone', 'mobile phone', 'phone', 'Mobile Phone'] },
            { label: 'Zip Code', keys: ['billing_zipcode'] },
            { label: 'District', keys: ['district'] },
            { label: 'State', keys: ['billing_state'] }
        ];

        const priorityFields = []; // Will be populated with actual keys found

        fieldMap.forEach(f => {
            // Find first key that exists in data
            let pKey = f.keys.find(k => rawData.hasOwnProperty(k));

            // Special handling: District is always shown (injected), ensure we catch it
            if (!pKey && f.keys.includes('district')) pKey = 'district';

            if (pKey) {
                priorityFields.push(pKey); // Mark as processed for generic loop exclusion

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

                // Edit Logic: State and District are Read-Only per request
                const isEditable = label !== 'State' && label !== 'District';
                const isZipCode = label === 'Zip Code';

                const editButton = isEditable ? `
                         <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit" data-field-type="${isZipCode ? 'zipcode' : 'text'}">
                            ${pencilIcon}
                         </button>
                         ${isZipCode ? loadingIcon : ''}` : '';

                fieldsHtml += `
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                             <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                             ${inputHtml}
                             ${editButton}
                        </div>
                    `;
            }
        });

        for (const [key, val] of Object.entries(rawData)) {
            if (excludeKeys.includes(key) || priorityFields.includes(key)) continue;

            // Format Label: "billing_zipcode" -> "Billing Zipcode"
            let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

            // Custom simplified labels
            if (key === 'billing_state') label = 'State';

            // Value safety
            let value = val || '';
            // Escape quotes for HTML attribute
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

            const editButton = key !== 'billing_state' ? `
                         <button onclick="window.viewController.toggleEditField(this)" style="background: none; border: none; padding: 4px; cursor: pointer; opacity: 0.5; color: var(--text-muted); display: flex; align-items: center; margin-left: 4px; transition: all 0.2s;" title="Edit">
                            ${pencilIcon}
                         </button>` : '';

            fieldsHtml += `
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                         <label style="flex: 0 0 85px; font-size: 0.7rem; color: var(--text-muted); text-align: right; margin-right: 8px;">${label}</label>
                         ${inputHtml}
                         ${editButton}
                    </div>
                `;
        }

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

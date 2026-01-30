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
                // Handle both object {name, phone} and string formats
                const optValue = typeof opt === 'object' ? opt.name : opt;
                const isSel = optValue === val ? 'selected' : '';
                optionsHtml += `<option value="${optValue}" ${isSel}>${optValue}</option>`;
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

            let value = (val !== null && val !== undefined) ? String(val) : '';
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
            <div class="dealer-edit-form" data-dealer-name="${dealerName.replace(/"/g, '&quot;')}" onclick="event.stopPropagation()" style="background: rgba(15, 23, 42, 0.98); padding: 8px; margin: 4px 0 8px 0; border-radius: 6px; border: 1px solid var(--accent-color); box-shadow: 0 4px 12px rgba(0,0,0,0.4); width: 100%; max-width: 100%; box-sizing: border-box; overflow: hidden;">
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
                    <button onclick="window.viewController.saveDealerInfo('${dealerName.replace(/'/g, "\\'")}')" style="padding: 4px 10px; font-size: 0.75rem; border-radius: 4px; border: none; background: var(--accent-color); color: white; cursor: pointer; font-weight: 600; box-shadow: 0 2px 4px rgba(0,0,0,0.2); transition: all 0.2s;">Save</button>
                </div>
            </div>
            </div>
            `;
    }
    /**
     * Render the Full Dealer Details Modal (Center Screen)
     * @param {Object} data - { aggregated, overrides, history }
     * @param {Object} settings - { key_accounts, dealer_stages, dealer_categories }
     */
    static renderDealerDetailsModal(data, settings) {
        const { aggregated, history } = data;
        const dealerName = aggregated.customer_name || 'Unknown Dealer';

        // Calculate Total Sales from History
        const totalSalesVal = history.reduce((sum, item) => sum + parseFloat(item.data.sales || 0), 0);
        const totalSales = totalSalesVal.toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

        // Helper: Safe Value
        const v = (key) => {
            let val = aggregated[key];
            if (val === undefined || val === null) return '';
            return val.toString().replace(/"/g, '&quot;');
        };

        // --- OVERVIEW: 3-Column Grid Layout ---

        // Helper: Render Floating Label Input
        const renderFloatingInput = (label, field, type = 'text', readonly = false, extraAttrs = '') => `
            <div class="floating-group">
                <input type="${type}" 
                       class="floating-input" 
                       id="inp_${field}" 
                       data-field="${field}" 
                       value="${v(field)}" 
                       placeholder=" "
                       ${readonly ? 'readonly tabindex="-1"' : ''}
                       ${extraAttrs}>
                <label class="floating-label" for="inp_${field}">${label}</label>
                ${field === 'billing_zipcode' ? `
                    <svg class="zip-loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none; position: absolute; right: 10px; top: 12px; animation: spin 1s linear infinite; color: var(--color-info);">
                        <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                        <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                    </svg>
                ` : ''}
            </div>
        `;

        // Helper: Render Floating Select
        const renderFloatingSelect = (label, field, options) => {
            const current = v(field);
            // Handle both object {name, phone} and string formats
            const opts = options.map(o => {
                const optValue = typeof o === 'object' ? o.name : o;
                return `<option value="${optValue}" ${optValue === current ? 'selected' : ''}>${optValue}</option>`;
            }).join('');
            return `
                <div class="floating-group">
                    <select class="floating-input" id="inp_${field}" data-field="${field}">
                        <option value=""></option>
                        ${opts}
                    </select>
                    <label class="floating-label" for="inp_${field}">${label}</label>
                </div>
            `;
        };

        // Categories Widget (Scrollable Chips)
        const cats = aggregated.categories || [];
        let categoriesHtml = '';

        if (Array.isArray(cats) && cats.length > 0) {
            categoriesHtml = cats.map(c => `<span class="category-chip">${c}</span>`).join('');
        } else {
            categoriesHtml = '<span style="opacity:0.3; font-size: 0.8rem; padding: 4px;">No categories...</span>';
        }

        const categoriesWidget = `
            <div class="floating-group" style="cursor: pointer;" onclick="window.dealerManager.editDealerCategories('${aggregated._internalId || aggregated.id || aggregated.cust_id}', '${dealerName.replace(/'/g, "\\'")}', this)">
                <div class="floating-input categories-container">
                    ${categoriesHtml}
                </div>
                <label class="floating-label" style="top: -8px; font-size: 0.65rem; color: var(--color-info); background: var(--modal-bg-gradient); padding: 0 4px;">Categories</label>
                <div style="position:absolute; right:10px; top:12px; opacity:0.5; pointer-events:none;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>
                </div>
            </div>
        `;

        const overviewHtml = `
            <div class="compact-grid">
                <!-- Col 1: Identity -->
                <div class="grid-col">
                    <h5 class="col-title">Identity</h5>
                    ${renderFloatingSelect('Key Account Manager', 'key_account_manager', settings.key_accounts || [])}
                    ${renderFloatingSelect('Dealer Stage', 'dealer_stage', settings.dealer_stages || [])}
                    ${categoriesWidget}
                </div>

                <!-- Col 2: Contact -->
                <div class="grid-col">
                    <h5 class="col-title">Contact</h5>
                    ${renderFloatingInput('Contact Name', 'first_name')}
                    ${renderFloatingInput('Mobile Phone', 'mobile_phone')}
                </div>

                <!-- Col 3: Location -->
                <div class="grid-col">
                    <h5 class="col-title">Location</h5>
                    ${renderFloatingInput('Zip Code', 'billing_zipcode', 'text', false, 'onchange="window.dealerManager.handlePopupZipChange(this)"')}
                    ${renderFloatingInput('District', 'district', 'text', true)}
                    ${renderFloatingInput('State', 'billing_state', 'text', true)}
                    <input type="hidden" data-field="shipping_zipcode" value="${v('shipping_zipcode') || v('billing_zipcode')}">
                </div>
            </div>
        `;

        // --- HISTORY TAB CONTENT ---
        const historyRows = history.map(h => {
            const sales = parseFloat(h.data.sales || 0).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
            const date = new Date(h.date).toLocaleDateString();
            return `
                <tr>
                    <td>${h.reportName}</td>
                    <td>${date}</td>
                    <td class="text-right">${sales}</td>
                </tr>
             `;
        }).join('');

        const historyHtml = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>Report Name</th>
                        <th>Upload Date</th>
                        <th class="text-right">Sales Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${historyRows.length > 0 ? historyRows : '<tr><td colspan="3" class="text-center">No history found</td></tr>'}
                </tbody>
                <tfoot>
                    <tr style="background: var(--modal-footer-bg); font-weight: 700;">
                        <td colspan="2" style="text-align: right; color: var(--modal-input-text); border-top: 1px solid var(--modal-table-border);">Total Sales</td>
                        <td class="text-right" style="color: var(--color-success); border-top: 1px solid var(--modal-table-border);">${totalSales}</td>
                    </tr>
                </tfoot>
            </table>
        `;

        // --- MODAL SHELL ---
        return `
            <div class="dealer-modal-overlay" onclick="window.dealerManager.closeDealerDetails()">
                <div class="dealer-modal" onclick="event.stopPropagation()">
                    <!-- Header -->
                    <div class="dealer-modal-header">
                        <div class="header-left">
                            <h2>${dealerName}</h2>
                        </div>
                        <div class="header-actions">
                             <div class="total-sales-display" style="margin-right: 20px; text-align: right;">
                                <div style="font-size: 0.65rem; color: var(--modal-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; font-weight:600;">Total Sales</div>
                                <div style="font-size: 1.1rem; font-weight: 700; color: var(--color-success); line-height: 1.2;">${totalSales}</div>
                             </div>
                             ${(() => {
                const stageName = aggregated.dealer_stage;
                if (!stageName) return '';
                const image = (settings.stage_images || {})[stageName];
                if (image) {
                    return `<img src="${image}" alt="${stageName}" title="${stageName}" style="height: 32px; width: 32px; object-fit: cover; border-radius: 50%;">`;
                }
                return `<span class="badge stage-badge stage-${(stageName || '').toLowerCase()}">${stageName}</span>`;
            })()}
                            <button class="close-btn" onclick="window.dealerManager.closeDealerDetails()">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="dealer-modal-tabs">
                        <button class="tab-btn active" onclick="window.dealerManager.switchModalTab('overview')">Overview</button>
                        <button class="tab-btn" onclick="window.dealerManager.switchModalTab('sales')">Sales (${history.length})</button>
                    </div>

                    <!-- Body -->
                    <div class="dealer-modal-content" id="modal-tab-overview">
                        ${overviewHtml}
                    </div>
                    
                    <div class="dealer-modal-content" id="modal-tab-sales" style="display: none;">
                        ${historyHtml}
                    </div>

                    <!-- Footer -->
                    <div class="dealer-modal-footer">
                        <div class="footer-note">
                            <span style="color:var(--color-info);">*</span> Changes saved as overrides
                        </div>
                        <div class="footer-actions">
                            <button class="btn-cancel" onclick="window.dealerManager.closeDealerDetails()">Cancel</button>
                            <button class="btn-save" onclick="window.dealerManager.saveDealerDetails('${dealerName.replace(/'/g, "\\'")}')">Save Changes</button>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .dealer-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--modal-overlay-bg);
                    backdrop-filter: blur(8px);
                    z-index: 10000;
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.1s ease-out;
                }
                .dealer-modal {
                    background: var(--modal-bg-gradient);
                    width: 750px;
                    max-width: 95%;
                    border-radius: 16px;
                    border: var(--modal-border);
                    box-shadow: var(--modal-shadow);
                    color: var(--modal-input-text);
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                
                @keyframes scaleUp {
                    from { transform: scale(0.95) translateY(10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                /* Header */
                .dealer-modal-header {
                    padding: 16px 24px;
                    border-bottom: var(--modal-tabs-border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--modal-header-bg);
                }
                .dealer-modal-header h2 { 
                    margin: 0; font-size: 1.25rem; font-weight: 700; 
                    color: var(--modal-h2-color);
                    text-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header-actions { display: flex; gap: 12px; align-items: center; }
                .stage-badge { 
                    padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; 
                    text-transform: uppercase; background: rgba(16, 185, 129, 0.2); color: #34d399; 
                    border: 1px solid rgba(16, 185, 129, 0.3);
                }
                .stage-badge.stage-churned { background: rgba(239, 68, 68, 0.2); color: #f87171; border-color: rgba(239, 68, 68, 0.3); }
                .stage-badge.stage-prospect { background: rgba(245, 158, 11, 0.2); color: #fbbf24; border-color: rgba(245, 158, 11, 0.3); }

                .close-btn { 
                    background: rgba(255,255,255,0.05); border: none; color: var(--modal-text-secondary); 
                    border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s; 
                }
                .close-btn:hover { background: rgba(100,100,255,0.1); color: var(--modal-h2-color); transform: rotate(90deg); }

                /* Tabs */
                .dealer-modal-tabs {
                    display: flex; padding: 0 24px;
                    background: var(--modal-tabs-bg);
                    border-bottom: var(--modal-tabs-border);
                }
                .tab-btn {
                    padding: 14px 4px; margin-right: 24px;
                    background: none; border: none; 
                    color: var(--modal-label-color);
                    font-size: 0.85rem; font-weight: 600; cursor: pointer;
                    position: relative; transition: color 0.2s;
                }
                .tab-btn.active { color: var(--modal-h2-color); }
                .tab-btn.active::after {
                    content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
                    height: 2px; background: var(--color-info); box-shadow: 0 -1px 8px var(--color-info);
                }

                /* Content Body */
                .dealer-modal-content { padding: 24px; flex: 1; }
                
                /* Compact Grid Layout */
                .compact-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                .col-title {
                    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
                    color: var(--modal-label-color); margin: 0 0 16px 0; font-weight: 700;
                    border-bottom: 1px dashed var(--modal-table-border); padding-bottom: 4px;
                }

                /* Categories Chips */
                .categories-container {
                    display: flex; flex-wrap: wrap; gap: 6px; 
                    padding: 12px 10px;
                    overflow-y: auto; align-content: flex-start;
                    height: auto !important; min-height: 48px; max-height: 120px;
                }
                .categories-container::-webkit-scrollbar { width: 4px; }
                .categories-container::-webkit-scrollbar-track { background: transparent; }
                .categories-container::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 2px; }

                .category-chip {
                    display: inline-flex; align-items: center;
                    padding: 2px 8px; border-radius: 12px;
                    background: rgba(59, 130, 246, 0.15); 
                    color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.2);
                    font-size: 0.75rem; white-space: nowrap;
                    font-weight: 500;
                }

                /* Floating Labels */
                .floating-group { position: relative; margin-bottom: 16px; }
                .floating-input {
                    width: 100%;
                    padding: 16px 12px 6px;
                    height: 48px;
                    background: var(--modal-input-bg);
                    border: var(--modal-input-border);
                    border-radius: 8px;
                    color: var(--modal-input-text);
                    font-size: 0.9rem;
                    font-family: inherit;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .floating-input:focus {
                    outline: none;
                    border-color: var(--color-info);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    background: var(--modal-input-focus-bg);
                }
                .floating-label {
                    position: absolute;
                    top: 14px; left: 12px;
                    font-size: 0.85rem;
                    color: var(--modal-label-color);
                    pointer-events: none;
                    transition: all 0.2s ease-out;
                }
                /* Active State for Float */
                .floating-input:focus ~ .floating-label,
                .floating-input:not(:placeholder-shown) ~ .floating-label {
                    top: 4px;
                    font-size: 0.65rem;
                    color: var(--color-info);
                    font-weight: 600;
                }
                /* Select handling */
                select.floating-input { padding-top: 16px; cursor: pointer; }
                select.floating-input option { background: var(--modal-input-bg); color: var(--modal-input-text); }

                /* Readonly */
                .floating-input[readonly] {
                    background: var(--modal-readonly-bg);
                    border-color: transparent;
                    cursor: default;
                    color: var(--modal-text-secondary);
                }

                /* Footer */
                .dealer-modal-footer {
                    padding: 16px 24px;
                    border-top: var(--modal-footer-border);
                    background: var(--modal-footer-bg);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .footer-note { font-size: 0.75rem; color: var(--modal-text-secondary); font-style: italic; }
                
                .btn-cancel {
                    padding: 8px 16px; margin-right: 8px;
                    background: transparent; border: 1px solid var(--modal-table-border);
                    color: var(--modal-text-secondary); border-radius: 6px; cursor: pointer; transition: 0.2s;
                }
                .btn-cancel:hover { background: rgba(255,255,255,0.05); color: var(--modal-h2-color); }
                
                .btn-save {
                    padding: 8px 24px;
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    border: none; color: white; border-radius: 6px;
                    font-weight: 600; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
                    transition: transform 0.1s, box-shadow 0.2s;
                }
                .btn-save:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.4); }
                .btn-save:active { transform: translateY(0); }

                .history-table { width: 100%; border-collapse: separate; border-spacing: 0; }
                .history-table th { 
                    text-align: left; padding: 12px; font-size: 0.75rem; 
                    color: var(--modal-table-header); 
                    text-transform: uppercase; border-bottom: 1px solid var(--modal-table-border); 
                }
                .history-table td { 
                    padding: 12px; font-size: 0.85rem; 
                    color: var(--modal-table-row); 
                    border-bottom: 1px solid rgba(255,255,255,0.03); 
                }
                .history-table tr:hover td { background: rgba(255,255,255,0.02); }
                .text-right { text-align: right; }
            </style>
        `;
    }
}

window.UIRenderer = UIRenderer;

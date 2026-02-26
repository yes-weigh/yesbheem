export function renderDealerDetailsModal(data, settings) {
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

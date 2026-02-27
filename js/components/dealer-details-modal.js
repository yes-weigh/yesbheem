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

    // --- ENGAGEMENT TAB CONTENT ---
    const activityChips = (settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => `
        <button type="button" class="activity-chip" onclick="
            this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        " data-value="${a}" style="
            padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);
            background: transparent; color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; height: 28px; display: flex; align-items: center; white-space: nowrap;
        " onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.05)';" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent';">
            ${a}
        </button>
    `).join('');

    const statusOptions = settings.dealer_stages || ['New', 'Contacted', 'Converted', 'Lost'];
    const currentStatus = aggregated.dealer_stage || '';

    const engagementHtml = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; overflow: hidden; height: 100%;">
            
            <!-- Column 1: CRM HUB -->
            <div class="modal-column column-crm" style="display: flex; flex-direction: column; height: 100%; border-right: var(--modal-tabs-border); overflow: hidden; background: transparent;">
                
                <!-- Header -->
                <div style="padding: 16px 24px 14px; border-bottom: var(--modal-tabs-border); flex-shrink: 0; background: transparent; display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Z"></path><path d="M12 6V12L16 14"></path></svg>
                        <span style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Activity Timeline</span>
                    </div>
                </div>

                <!-- History Feed -->
                <div id="crm-tab-history" class="crm-history-container" style="display: flex; flex-direction: column-reverse; flex: 1; overflow-y: auto; padding: 20px 24px; position: relative; gap: 12px;">
                    <div style="position: absolute; left: 24px; top: 0; bottom: 20px; width: 1px; background: linear-gradient(to bottom, rgba(59, 130, 246, 0.3), rgba(255, 255, 255, 0.05)); z-index: 0;"></div>
                    
                    <div id="dealer-logs-list" style="display: flex; flex-direction: column; gap: 16px; padding-left: 32px; z-index: 1;">
                        <div style="text-align: center; color: var(--text-muted); padding: 40px; font-style: italic; opacity: 0.5;">Loading history...</div>
                    </div>
                </div>

                <!-- Quick Add Log -->
                <div style="flex-shrink: 0; border-top: var(--modal-footer-border); background: var(--modal-footer-bg); padding: 16px 20px; display: flex; flex-direction: column; z-index: 2;">
                    <div style="display: flex; gap: 10px; align-items: flex-end;">
                        <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 14px; position: relative;" onfocusin="this.style.borderColor='rgba(59, 130, 246, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">
                            
                            <div style="display: flex; flex-direction: column; gap: 14px;">
                                <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 14px;">
                                    <div style="width: 140px;">
                                        <select id="inp_status_log" data-field="dealer_stage" onchange="window.dealerManager.saveDealerDetails('${dealerName.replace(/'/g, "\\'")}')"
                                            style="width: 100%; background: transparent url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmOGZhZmMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=') no-repeat right 8px center; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px 28px 6px 10px; color: var(--modal-input-text); font-size: 0.75rem; font-weight: 600; outline: none; appearance: none; cursor: pointer; height: 32px;">
                                            <option value="" style="background: var(--modal-input-bg); color: var(--modal-input-text);">Stage...</option>
                                            ${statusOptions.map(opt => {
        const val = typeof opt === 'object' ? opt.name : opt;
        return `<option value="${val}" style="background: var(--modal-input-bg); color: var(--modal-input-text);" ${currentStatus === val ? 'selected' : ''}>${val}</option>`;
    }).join('')}
                                        </select>
                                    </div>

                                    <div style="display: flex; align-items: center; padding-right: 4px;">
                                        <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                                            <input type="checkbox" id="toggle-due-date" onchange="
                                                document.getElementById('due-date-container').style.display = this.checked ? 'flex' : 'none';
                                            " style="
                                                width: 14px; height: 14px; cursor: pointer; accent-color: var(--color-info);
                                                border-radius: 2px; background: rgba(255,255,255,1); border: 1px solid transparent; margin: 0;
                                            ">
                                            <span style="font-size: 0.8rem; font-weight: 500; color: #94a3b8;">Due Date</span>
                                        </label>
                                    </div>
                                </div>

                                <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
                                    <div class="activity-chips-container" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; flex: 1; align-items: center;">
                                        ${activityChips}
                                    </div>
                                </div>
                            </div>

                            <div id="due-date-container" style="display: none; gap: 8px;">
                                <input type="date" id="new-log-date" class="floating-input" style="flex: 1; border-radius: 8px; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                                <input type="time" id="new-log-time" class="floating-input" style="flex: 1; border-radius: 8px; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                            </div>

                            <div style="height: 1px; background: rgba(255,255,255,0.05); width: 100%;"></div>

                            <div style="display: flex; gap: 10px; align-items: flex-end;">
                                <textarea id="new-log-content" placeholder="Log details..." style="
                                    flex: 1; min-height: 48px; max-height: 120px;
                                    background: transparent; border: none; outline: none;
                                    color: var(--modal-input-text); padding: 0; margin: 0;
                                    font-size: 0.9rem; resize: none; line-height: 1.5;
                                    font-family: inherit;
                                " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                                
                                <button class="wa-send-btn" onclick="window.dealerManager.addLog('${dealerName.replace(/'/g, "\\'")}')" style="
                                    width: 44px; height: 44px; border-radius: 50%; padding: 0;
                                    display: flex; align-items: center; justify-content: center;
                                    flex-shrink: 0; min-width: unset; position: relative;
                                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                                    color: white; border: none; cursor: pointer;
                                    box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                                    transition: all 0.2s;
                                " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(59, 130, 246, 0.3)';">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Column 2: WHATSAPP CHAT -->
            <div class="modal-column column-engagement" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: transparent;">

                <!-- Header -->
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: var(--modal-tabs-border); flex-shrink: 0; background: transparent;">
                    <div style="display: flex; align-items: center; gap: 10px; color: #10b981;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .004 5.41.001 12.045a11.811 11.811 0 001.592 5.967L0 24l6.135-1.609a11.808 11.808 0 005.91 1.579h.005c6.637 0 12.05-5.411 12.053-12.047a11.801 11.801 0 00-3.536-8.509z"/></svg>
                        <span style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">WhatsApp</span>
                        <span style="font-size: 0.65rem; color: #64748b; font-weight: 500; margin-left: 2px;">• Live</span>
                    </div>
                    <div id="wa-instance-status" class="wa-status-pill">
                        <span class="wa-status-dot"></span>
                        Initializing...
                    </div>
                    <input type="hidden" id="inp_phone" value="${v('mobile_phone')}">
                    <input type="hidden" id="inp_kam_hidden" value="${v('key_account_manager')}">
                </div>

                <!-- Chat History -->
                <div id="wa-chat-history" style="
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px 16px 8px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    scroll-behavior: smooth;
                ">
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center; color: #334155; font-size: 0.8rem; font-style: italic;">
                            <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.4;">💬</div>
                            Loading messages...
                        </div>
                    </div>
                </div>

                <!-- Composer -->
                <div style="flex-shrink: 0; background: var(--modal-footer-bg); border-top: var(--modal-footer-border); padding: 12px 14px; display: flex; flex-direction: column;">
                    
                    <!-- Unified WA Composer Box -->
                    <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 12px 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 12px; position: relative;" onfocusin="this.style.borderColor='rgba(16, 185, 129, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">

                        <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                            <!-- Template selector -->
                            <div class="wa-modern-select-wrapper" style="margin-bottom: 0; flex: 2; min-width: 0;">
                                <select id="wa-template-select" class="wa-modern-select" onchange="window.dealerManager.handleWATemplateChange(this.value)" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 8px; width: 100%; outline: none; appearance: none; -webkit-appearance: none;">
                                    <option value="">Select Template...</option>
                                </select>
                            </div>

                            <!-- Media actions -->
                            <div style="display: flex; gap: 8px; flex: 1.5; min-width: 0;">
                                <button class="wa-action-btn" onclick="window.dealerManager.openMediaGallery()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                    Gallery
                                </button>
                                <button class="wa-action-btn" onclick="document.getElementById('wa-file-upload').click()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                    Upload
                                </button>
                                <input type="file" id="wa-file-upload" style="display: none;" onchange="window.dealerManager.handleWAMediaUpload(this.files[0])">
                            </div>
                        </div>

                        <!-- Media preview (shown when selected) -->
                        <div id="wa-media-preview" class="wa-preview-container" style="display: none; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(16,185,129,0.2);"></div>

                        <div style="height: 1px; background: rgba(255,255,255,0.05); width: 100%;"></div>

                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                            <textarea id="wa-message-body" placeholder="Message..." style="
                                flex: 1; min-height: 48px; max-height: 120px;
                                background: transparent; border: none; outline: none;
                                color: var(--modal-input-text); padding: 0; margin: 0;
                                font-size: 0.88rem; resize: none; line-height: 1.4;
                                font-family: inherit;
                            " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                            
                            <button class="wa-send-btn" onclick="window.dealerManager.sendWhatsAppMessage('${dealerName.replace(/'/g, "\\'")}')" style="
                                width: 44px; height: 44px; border-radius: 50%; padding: 0;
                                display: flex; align-items: center; justify-content: center;
                                flex-shrink: 0; min-width: unset;
                                background: linear-gradient(135deg, #10b981, #059669);
                                color: white; border: none; cursor: pointer;
                                box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                                transition: all 0.2s;
                            " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(16, 185, 129, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(16, 185, 129, 0.3)';">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            </button>
                        </div>

                    </div>
                </div>
            </div>

        </div>
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
                        <button class="tab-btn" onclick="window.dealerManager.switchModalTab('engagement')">Engagement</button>
                        <button class="tab-btn" onclick="window.dealerManager.switchModalTab('sales')">Sales (${history.length})</button>
                    </div>

                    <!-- Body -->
                    <div class="dealer-modal-content" id="modal-tab-overview">
                        ${overviewHtml}
                    </div>

                    <div class="dealer-modal-content" id="modal-tab-engagement" style="display: none; padding: 0; min-height: 50vh;">
                        ${engagementHtml}
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

                /* WhatsApp Status Dot & Utilities */
                .wa-status-dot {
                    width: 8px; height: 8px; border-radius: 50%;
                    background: #94a3b8; position: relative;
                }
                #wa-instance-status.connected .wa-status-dot {
                    background: #10b981;
                    box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
                }
                #wa-instance-status.connected .wa-status-dot::after {
                    content: ''; position: absolute; inset: -4px;
                    border-radius: 50%; border: 2px solid rgba(16, 185, 129, 0.2);
                    animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
                }
                @keyframes ping {
                    75%, 100% { transform: scale(2); opacity: 0; }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            </style>
        `;
}

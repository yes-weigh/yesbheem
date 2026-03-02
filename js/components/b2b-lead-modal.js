export function renderB2BLeadModal(lead, settings) {
    const leadName = lead.name || 'New Lead';

    // Helper: Safe Value
    const v = (val) => {
        if (val === undefined || val === null) return '';
        return val.toString().replace(/"/g, '&quot;');
    };

    // Helper: Render Floating Label Input
    const renderFloatingInput = (label, field, type = 'text', readonly = false, extraAttrs = '', style = '') => {
        return `
                <div class="floating-group" style="${style}">
                    <input type="${type}" class="floating-input" placeholder=" " 
                        id="inp_${field}" data-field="${field}" value="${v(lead[field])}" 
                        ${readonly ? 'readonly' : ''} ${extraAttrs}
                        onchange="window.b2bLeadsManager.saveLeadDetails('${lead.id}', true)">
                    <label class="floating-label" for="inp_${field}">${label}</label>
                    ${field === 'pincode' ? `
                        <svg class="zip-loading-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display: none; position: absolute; right: 10px; top: 12px; animation: spin 1s linear infinite; color: var(--color-info);">
                            <circle cx="12" cy="12" r="10" opacity="0.25"></circle>
                            <path d="M12 2a10 10 0 0 1 10 10" opacity="0.75"></path>
                        </svg>
                    ` : ''}
                </div>
            `;
    };

    // Helper: Render Floating Select
    const renderFloatingSelect = (label, field, options, readonly = false, extraAttrs = '', style = '') => {
        const current = lead[field];
        // Default onchange for autosave; if extraAttrs contains its own onchange it will override this one
        // because extraAttrs is placed AFTER the default, making it take precedence (HTML uses last duplicate attr)
        return `
                <div class="floating-group" style="${style}">
                    <select class="floating-input" id="inp_${field}" data-field="${field}" 
                        ${readonly ? 'disabled' : ''}
                        onchange="window.b2bLeadsManager.saveLeadDetails('${lead.id}', true)"
                        ${extraAttrs}>
                        <option value="">Select ${label}...</option>
                        ${(options || []).map(opt => {
            const val = typeof opt === 'object' ? opt.name : opt;
            const labelText = typeof opt === 'object' ? opt.name : opt;
            return `<option value="${val}" ${current === val ? 'selected' : ''}>${labelText}</option>`;
        }).join('')}
                    </select>
                    <label class="floating-label" for="inp_${field}">${label}</label>
                </div>
            `;
    };

    const statusOptions = settings.lead_stages || ['New', 'Contacted', 'Converted', 'Lost'];

    const overviewHtml = `
            <div class="compact-grid">
                <!-- Col 1: Identity -->
                <!-- Col 1: Identity -->
                <div class="grid-col">
                    <h5 class="col-title">Identity</h5>
                    ${renderFloatingSelect('KAM', 'kam', settings.key_accounts || [])}
                    ${renderFloatingInput('Business Name', 'business_name')}
                </div>
            </div>
        `;

    // --- MODAL SHELL ---
    return `
            <div class="dealer-modal-overlay" onclick="window.b2bLeadsManager.closeEditModal()">
                <div class="dealer-modal" onclick="event.stopPropagation()">
                    <!-- Header: Title + Controls + Profile -->
                    <div class="dealer-modal-header" style="padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; height: auto;">
                        <!-- Absolute Close Button Relocated -->
                        <button class="close-btn" onclick="window.b2bLeadsManager.closeEditModal()" style="
                            position: absolute; top: 12px; right: 12px; border-radius: 50%; width: 36px; height: 36px; 
                            display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); 
                            border: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); cursor: pointer; transition: all 0.2s; z-index: 100;
                        " onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='white';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='var(--text-muted)';">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <!-- Top Bar: Title, Status -->
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 24px;">
                            <div style="display: flex; align-items: center; gap: 16px;">
                                <!-- Header title removed as requested -->
                            </div>
                            
                            <!-- Stage Chips (Prominent & Centered) -->
                            <div style="flex: 1; display: flex; justify-content: center; align-items: center; gap: 10px; padding-right: 40px;">
                                <!-- Stage chips removed as requested -->
                            </div>
                        </div>

                        <!-- Bottom Bar: Profile Fields Strip (Iconic Style) -->
                        <div style="background: var(--modal-tabs-bg); border: var(--modal-tabs-border); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);">
                            <div style="display: flex; flex: 1; align-items: center; gap: 16px; overflow-x: auto; padding: 2px;">
                                ${renderFloatingInput('Name', 'name', 'text', false, '', 'width: 160px;')}
                                ${renderFloatingInput('Business', 'business_name', 'text', false, '', 'width: 200px;')}
                                ${renderFloatingInput('Phone', 'phone', 'text', false, '', 'width: 140px;')}
                                <div style="display: flex; align-items: center; gap: 8px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 16px;">
                                    ${renderFloatingInput('Code', 'pincode', 'text', true, 'onchange="window.b2bLeadsManager.handlePopupZipChange(this)"', 'width: 80px;')}
                                    ${renderFloatingInput('State', 'state', 'text', true, '', 'width: 100px;')}
                                    ${renderFloatingInput('District', 'district', 'text', true, '', 'width: 110px;')}
                                    ${renderFloatingInput('City', 'city', 'text', true, '', 'width: 110px;')}
                                </div>
                                <div style="display: flex; align-items: center; gap: 8px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 16px;">
                                    ${renderFloatingSelect('KAM', 'kam', settings.key_accounts || [], false, `onchange="window.b2bLeadsManager.saveLeadDetails('${lead.id}', true); window.b2bLeadsManager.updateWhatsAppInterface(this.value);"`, 'width: 180px;')}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="dealer-modal-content" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0; overflow: hidden; height: 100%;">
                        
                        <!-- Column 1: CRM HUB (History & Add Log Chat-Style) -->
                        <div class="modal-column column-crm" style="display: flex; flex-direction: column; height: 100%; border-right: var(--modal-tabs-border); overflow: hidden; background: transparent;">
                            
                            <!-- Header: CRM Timeline -->
                            <div style="padding: 16px 24px 14px; border-bottom: var(--modal-tabs-border); flex-shrink: 0; background: transparent; display: flex; align-items: center; justify-content: space-between;">
                                <div style="display: flex; align-items: center; gap: 10px; color: #3b82f6;">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 2A10 10 0 1 0 22 12A10 10 0 0 0 12 2Z"></path><path d="M12 6V12L16 14"></path></svg>
                                    <span style="font-size: 0.85rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;">Activity Timeline</span>
                                </div>
                            </div>

                            <!-- History Feed (Scrollable) - reversed for bottom-up flow -->
                            <div id="crm-tab-history" class="crm-history-container" style="display: flex; flex-direction: column-reverse; flex: 1; overflow-y: auto; padding: 20px 24px; position: relative; gap: 12px;">
                                <!-- Thread Line -->
                                <div style="position: absolute; left: 24px; top: 0; bottom: 20px; width: 1px; background: linear-gradient(to bottom, rgba(59, 130, 246, 0.3), rgba(255, 255, 255, 0.05)); z-index: 0;"></div>
                                
                                <div id="b2b-logs-list" style="display: flex; flex-direction: column; gap: 16px; padding-left: 32px; z-index: 1;">
                                    <!-- Populated by JS -->
                                    <div style="text-align: center; color: var(--text-muted); padding: 40px; font-style: italic; opacity: 0.5;">No history recorded.</div>
                                </div>
                            </div>

                            <!-- Quick Add Log (Pinned Bottom) -->
                            <div style="flex-shrink: 0; border-top: var(--modal-footer-border); background: var(--modal-footer-bg); padding: 16px 20px; display: flex; flex-direction: column; z-index: 2;">
                                
                                <div style="display: flex; gap: 10px; align-items: flex-end;">
                                    <!-- Unified Composer Box -->
                                    <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 14px; position: relative;" onfocusin="this.style.borderColor='rgba(59, 130, 246, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">
                                        
                                        <!-- Top Controls Row -->
                                        <div style="display: flex; flex-direction: column; gap: 14px;">
                                            
                                            <!-- Row 1: Stage Dropdown & Due Date -->
                                            <div style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; gap: 14px;">
                                                <div style="width: 140px;">
                                                    <select id="inp_status" data-field="status" onchange="window.b2bLeadsManager.saveLeadDetails('${lead.id}', true)"
                                                        style="width: 100%; background: transparent url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmOGZhZmMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=') no-repeat right 8px center; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px 28px 6px 10px; color: var(--modal-input-text); font-size: 0.75rem; font-weight: 600; outline: none; appearance: none; cursor: pointer; height: 32px;">
                                                        <option value="" style="background: var(--modal-input-bg); color: var(--modal-input-text);">Stage...</option>
                                                        ${(statusOptions || []).map(opt => {
        const val = typeof opt === 'object' ? opt.name : opt;
        const labelText = typeof opt === 'object' ? opt.name : opt;
        return `<option value="${val}" style="background: var(--modal-input-bg); color: var(--modal-input-text);" ${lead.status === val ? 'selected' : ''}>${labelText}</option>`;
    }).join('')}
                                                    </select>
                                                </div>

                                                <!-- Due Date Toggle -->
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

                                            <!-- Row 2: Chips -->
                                            <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: center; justify-content: space-between;">
                                                
                                                <div class="activity-chips-container" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; flex: 1; align-items: center;">
                                                    ${(settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => `
                                                        <button type="button" class="activity-chip" onclick="
                                                            this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
                                                            this.classList.add('active');
                                                        " data-value="${a}" style="
                                                            padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);
                                                            background: transparent; color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; height: 28px; display: flex; align-items: center; white-space: nowrap;
                                                        " onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.05)';" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent';">
                                                            ${a}
                                                        </button>
                                                    `).join('')}
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
                                            
                                            <button class="wa-send-btn" onclick="window.b2bLeadsManager.addLog('${lead.id}')" style="
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

                            <!-- ① Fixed Header: title + connection status -->
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
                            </div>

                            <!-- ② Scrollable Chat History (fills remaining space) -->
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

                            <!-- ③ Composer — pinned at bottom -->
                            <div style="flex-shrink: 0; background: var(--modal-footer-bg); border-top: var(--modal-footer-border); padding: 12px 14px; display: flex; flex-direction: column;">
                                
                                <!-- Unified WA Composer Box -->
                                <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 12px 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 12px; position: relative;" onfocusin="this.style.borderColor='rgba(16, 185, 129, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">

                                    <!-- Top Row: Template & Media actions -->
                                    <div style="display: flex; gap: 8px; align-items: center; width: 100%;">
                                        <!-- Template selector -->
                                        <div class="wa-modern-select-wrapper" style="margin-bottom: 0; flex: 2; min-width: 0;">
                                            <select id="wa-template-select" class="wa-modern-select" onchange="window.b2bLeadsManager.handleWATemplateChange(this.value)" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 8px; width: 100%; outline: none; appearance: none; -webkit-appearance: none;">
                                                <option value="">Select Template...</option>
                                            </select>
                                        </div>

                                        <!-- Media actions -->
                                        <div style="display: flex; gap: 8px; flex: 1.5; min-width: 0;">
                                            <button class="wa-action-btn" onclick="window.b2bLeadsManager.openMediaGallery()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                Gallery
                                            </button>
                                            <button class="wa-action-btn" onclick="document.getElementById('wa-file-upload').click()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s; white-space: nowrap;">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                                Upload
                                            </button>
                                            <input type="file" id="wa-file-upload" style="display: none;" onchange="window.b2bLeadsManager.handleWAMediaUpload(this.files[0])">
                                        </div>
                                    </div>

                                    <!-- Media preview (shown when selected) -->
                                    <div id="wa-media-preview" class="wa-preview-container" style="display: none; position: relative; border-radius: 8px; overflow: hidden; border: 1px solid rgba(16,185,129,0.2);"></div>

                                    <!-- Separator Line -->
                                    <div style="height: 1px; background: rgba(255,255,255,0.05); width: 100%;"></div>

                                    <!-- Bottom Row: Textarea + Send button -->
                                    <div style="display: flex; gap: 10px; align-items: flex-end;">
                                        <textarea id="wa-message-body" placeholder="Message..." style="
                                            flex: 1; min-height: 48px; max-height: 120px;
                                            background: transparent; border: none; outline: none;
                                            color: var(--modal-input-text); padding: 0; margin: 0;
                                            font-size: 0.88rem; resize: none; line-height: 1.4;
                                            font-family: inherit;
                                        " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"
                                          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();window.b2bLeadsManager.sendWhatsAppMessage('${lead.id}');}"></textarea>
                                        
                                        <button id="wa-whatsapp-send-btn" class="wa-send-btn" onclick="window.b2bLeadsManager.sendWhatsAppMessage('${lead.id}')" style="
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
                </div>
            </div>
            
            <style>
                .dealer-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--modal-overlay-bg);
                    backdrop-filter: blur(8px);
                    -webkit-backdrop-filter: blur(8px);
                    z-index: 10000;
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                .dealer-modal {
                    position: relative;
                    background: var(--modal-bg-gradient);
                    backdrop-filter: blur(24px);
                    -webkit-backdrop-filter: blur(24px);
                    width: 95vw;
                    height: 90vh;
                    max-width: 1600px; /* Max constraint for ultra wide */
                    border-radius: 24px;
                    border: var(--modal-border);
                    box-shadow: var(--modal-shadow);
                    color: var(--modal-input-text);
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    animation: scaleUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                }
                
                /* Override overview styles for stacked column */
                .edit-stack {
                    display: flex;
                    flex-direction: column;
                    gap: 8px; /* Reduced from 16px */
                }
                /* Remove double spacing (margin + gap) in stack */
                .edit-stack .floating-group {
                    margin-bottom: 0;
                }
                
                /* Elegant Scrollbars */
                .modal-column::-webkit-scrollbar,
                #b2b-logs-list::-webkit-scrollbar,
                .wa-chat-history-container::-webkit-scrollbar,
                #wa-chat-history::-webkit-scrollbar,
                .crm-history-container::-webkit-scrollbar {
                    width: 5px;
                    height: 5px;
                }
                .modal-column::-webkit-scrollbar-track,
                #b2b-logs-list::-webkit-scrollbar-track,
                .wa-chat-history-container::-webkit-scrollbar-track,
                #wa-chat-history::-webkit-scrollbar-track,
                .crm-history-container::-webkit-scrollbar-track {
                    background: transparent;
                }
                .modal-column::-webkit-scrollbar-thumb,
                #b2b-logs-list::-webkit-scrollbar-thumb,
                .wa-chat-history-container::-webkit-scrollbar-thumb,
                #wa-chat-history::-webkit-scrollbar-thumb,
                .crm-history-container::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.15);
                    border-radius: 10px;
                    transition: background 0.3s ease;
                }
                .modal-column::-webkit-scrollbar-thumb:hover,
                #b2b-logs-list::-webkit-scrollbar-thumb:hover,
                .wa-chat-history-container::-webkit-scrollbar-thumb:hover,
                #wa-chat-history::-webkit-scrollbar-thumb:hover,
                .crm-history-container::-webkit-scrollbar-thumb:hover {
                    background: rgba(255, 255, 255, 0.25);
                }

                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
                @keyframes scaleUp {
                    from { transform: scale(0.96) translateY(20px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                /* Header */
                .dealer-modal-header {
                    padding: 20px 28px;
                    border-bottom: var(--modal-tabs-border);
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--modal-header-bg);
                }
                .dealer-modal-header h2 { 
                    margin: 0; font-size: 1.35rem; font-weight: 800; 
                    color: var(--modal-h2-color); text-shadow: 0 2px 10px rgba(0,0,0,0.1);
                    letter-spacing: -0.01em;
                }
                .header-actions { display: flex; gap: 14px; align-items: center; }
                
                .close-btn { 
                    background: rgba(255, 255, 255, 0.04); border: none; color: var(--modal-text-secondary); 
                    border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1); 
                }
                .close-btn:hover { background: rgba(100,100,255,0.1); color: var(--modal-h2-color); transform: rotate(90deg) scale(1.05); }

                /* Modernized WhatsApp Section */
                .wa-status-pill {
                    padding: 6px 14px;
                    border-radius: 24px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.06);
                    box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
                }
                .wa-status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    position: relative;
                    background: #64748b;
                }
                .wa-status-pill.connected {
                    background: rgba(16, 185, 129, 0.12);
                    border-color: rgba(16, 185, 129, 0.25);
                    color: #f8fafc;
                }
                .wa-status-pill.connected .wa-status-dot {
                    background: #10b981;
                    box-shadow: 0 0 10px #10b981;
                }
                .wa-status-pill.connected .wa-status-dot::after {
                    content: '';
                    position: absolute;
                    inset: -3px;
                    border: 1px solid #10b981;
                    border-radius: 50%;
                    animation: ripple 2s infinite cubic-bezier(0.16, 1, 0.3, 1);
                }
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .wa-action-btn {
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 8px 12px;
                    color: #cbd5e1;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
                }
                .wa-action-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.15);
                    color: #fff;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .wa-action-btn svg { width: 16px; height: 16px; }
                .wa-modern-select-wrapper {
                    position: relative;
                }
                .wa-modern-select {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 10px 16px;
                    color: #f1f5f9;
                    font-size: 0.85rem;
                    outline: none;
                    appearance: none;
                    cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .wa-modern-select:focus {
                    border-color: rgba(16, 185, 129, 0.5);
                    box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.15), inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .wa-modern-select option { background: #0f172a; color: #f8fafc; }
                .wa-modern-select-wrapper::after {
                    content: '▾';
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #94a3b8;
                    pointer-events: none;
                    font-size: 0.8rem;
                }
                
                .wa-send-btn {
                    padding: 12px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 6px 15px -3px rgba(16, 185, 129, 0.4), inset 0 1px 0 rgba(255,255,255,0.2);
                }
                .wa-send-btn:hover:not(:disabled) {
                    transform: translateY(-2px) scale(1.02);
                    box-shadow: 0 10px 25px -5px rgba(16, 185, 129, 0.5), inset 0 1px 0 rgba(255,255,255,0.2);
                }
                .wa-send-btn:active:not(:disabled) {
                    transform: translateY(0) scale(0.98);
                }
                .wa-send-btn:disabled {
                    background: rgba(255, 255, 255, 0.05);
                    color: #475569;
                    box-shadow: none;
                    cursor: not-allowed;
                    opacity: 0.6;
                }
                .wa-preview-container {
                    margin-bottom: 12px; border-radius: 14px; overflow: hidden;
                    background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(16, 185, 129, 0.2);
                }

                /* Compact Grid Layout */
                .compact-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 20px;
                }
                @media (max-width: 768px) {
                    .compact-grid { grid-template-columns: 1fr; }
                    .dealer-modal { width: 100%; height: 100%; border-radius: 0; }
                }

                /* Floating Labels */
                .floating-group { position: relative; margin-bottom: 0; }
                .floating-input {
                    width: 100%;
                    padding: 20px 14px 6px;
                    height: 52px;
                    background: var(--modal-input-bg);
                    border: var(--modal-input-border);
                    border-radius: 12px;
                    color: var(--modal-input-text);
                    font-size: 0.95rem;
                    font-family: 'Inter', sans-serif;
                    font-weight: 500;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    box-sizing: border-box;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.1);
                }
                .floating-input:hover {
                    box-shadow: 0 0 0 1px var(--color-info) inset;
                }
                .floating-input:focus {
                    outline: none;
                    border-color: var(--color-info); /* Focus glow */
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1), inset 0 2px 4px rgba(0,0,0,0.1);
                    background: var(--modal-input-focus-bg);
                }
                .floating-label {
                    position: absolute;
                    top: 16px; left: 14px;
                    font-size: 0.9rem;
                    color: var(--modal-label-color);
                    pointer-events: none;
                    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    font-weight: 500;
                }
                /* Active State for Float */
                .floating-input:focus ~ .floating-label,
                .floating-input:not(:placeholder-shown) ~ .floating-label {
                    top: 6px;
                    font-size: 0.68rem;
                    color: var(--color-info);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                /* Select handling */
                select.floating-input { padding-top: 18px; cursor: pointer; }
                select.floating-input option { background: var(--modal-input-bg); color: var(--modal-input-text); }

                /* Readonly */
                .floating-input[readonly], .floating-input[disabled] {
                    background: var(--modal-readonly-bg);
                    border-color: transparent;
                    cursor: default;
                    color: var(--modal-text-secondary);
                    box-shadow: none;
                }

                /* Chip Active States */
                .activity-chip {
                    position: relative;
                    overflow: hidden;
                    z-index: 1;
                }
                .activity-chip::before {
                    content: '';
                    position: absolute;
                    top: 0; left: 0; right: 0; bottom: 0;
                    background: linear-gradient(135deg, rgba(255,255,255,0.1), transparent);
                    opacity: 0; transition: opacity 0.3s;
                    z-index: -1;
                }
                .activity-chip:hover::before { opacity: 1; }
                
                .activity-chip.active, .status-chip.active {
                    background: linear-gradient(135deg, #3b82f6, #2563eb) !important;
                    border-color: transparent !important;
                    color: white !important;
                    box-shadow: 0 6px 15px -3px rgba(59, 130, 246, 0.5), inset 0 1px 0 rgba(255,255,255,0.2) !important;
                    font-weight: 600;
                    transform: translateY(-1px);
                }

                /* Improved bubble */
                .wa-msg {
                    max-width: 82%;
                    padding: 10px 14px;
                    border-radius: 14px;
                    font-size: 0.9rem;
                    line-height: 1.45;
                    position: relative;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                }
            </style>
        `;
}

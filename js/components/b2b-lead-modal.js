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
                    <div class="dealer-modal-header" style="padding: 16px 24px; display: flex; flex-direction: column; gap: 16px; height: auto; border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(0,0,0,0.1);">
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
                        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; box-shadow: inset 0 1px 1px rgba(255,255,255,0.05);">
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

                    <div class="dealer-modal-content" style="display: grid; grid-template-columns: 420px 1fr; gap: 0; overflow: hidden; height: 100%;">
                        
                        <!-- Column 1: CRM HUB (History & Add Log Chat-Style) -->
                        <div class="modal-column column-crm" style="display: flex; flex-direction: column; height: 100%; border-right: 1px solid rgba(255,255,255,0.06); overflow: hidden; background: rgba(0,0,0,0.15);">
                            
                            <!-- Header: CRM Timeline -->
                            <div style="padding: 16px 24px 14px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; background: rgba(59, 130, 246, 0.04); display: flex; align-items: center; justify-content: space-between;">
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
                            <div style="flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.3); padding: 18px 24px; display: flex; flex-direction: column; gap: 12px; z-index: 2;">
                                
                                <!-- Compact Stage & Activity Selection Row -->
                                <div style="display: flex; gap: 12px; align-items: center;">
                                    <div style="flex: 1; max-width: 150px;">
                                        <!-- Inline select instead of heavy floating group -->
                                        <select id="inp_status" data-field="status" onchange="window.b2bLeadsManager.saveLeadDetails('${lead.id}', true)"
                                            style="width: 100%; background: rgba(0, 0, 0, 0.3) url('data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23f8fafc\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'><polyline points=\'6 9 12 15 18 9\'></polyline></svg>') no-repeat right 8px center; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px; padding: 6px 28px 6px 10px; color: #f8fafc; font-size: 0.8rem; outline: none; appearance: none; cursor: pointer; height: 34px;">
                                            <option value="" style="background: #1e293b; color: #f8fafc;">Stage...</option>
                                            ${(statusOptions || []).map(opt => {
        const val = typeof opt === 'object' ? opt.name : opt;
        const labelText = typeof opt === 'object' ? opt.name : opt;
        return `<option value="${val}" style="background: #1e293b; color: #f8fafc;" ${lead.status === val ? 'selected' : ''}>${labelText}</option>`;
    }).join('')}
                                        </select>
                                    </div>
                                    <div class="activity-chips-container" style="display: flex; flex-wrap: wrap; gap: 8px; flex: 1;">
                                        ${(settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => `
                                            <button type="button" class="activity-chip" onclick="
                                                this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
                                                this.classList.add('active');
                                            " data-value="${a}" style="
                                                padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1);
                                                background: rgba(255, 255, 255, 0.05); color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; transition: all 0.2s; height: 30px; display: flex; align-items: center; font-weight: 500;
                                            ">
                                                ${a}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>

                                <!-- Due Date Toggle -->
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
                                    <label style="display: inline-flex; align-items: center; gap: 8px; cursor: pointer; user-select: none;">
                                        <input type="checkbox" id="toggle-due-date" onchange="
                                            document.getElementById('due-date-container').style.display = this.checked ? 'flex' : 'none';
                                        " style="
                                            width: 15px; height: 15px; cursor: pointer; accent-color: var(--color-info);
                                            border-radius: 4px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2);
                                        ">
                                        <span style="font-size: 0.75rem; font-weight: 600; color: var(--modal-text-secondary); opacity: 0.9;">Set Due Date</span>
                                    </label>
                                </div>

                                <div id="due-date-container" style="display: none; gap: 10px; margin-top: 2px;">
                                    <input type="date" id="new-log-date" class="floating-input" style="flex: 1.2; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; padding: 6px 10px; height: 36px; font-size: 0.85rem;">
                                    <input type="time" id="new-log-time" class="floating-input" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; color: white; padding: 6px 10px; height: 36px; font-size: 0.85rem;">
                                </div>

                                <!-- Input & Send -->
                                <div style="display: flex; gap: 10px; align-items: flex-end; margin-top: 4px;">
                                    <div style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 4px; transition: border-color 0.2s;" onfocusin="this.style.borderColor='rgba(59, 130, 246, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.1)'">
                                        <textarea id="new-log-content" placeholder="Log details..." style="
                                            width: 100%; min-height: 48px; max-height: 120px;
                                            background: transparent; border: none; outline: none;
                                            color: #f8fafc; padding: 8px 10px;
                                            font-size: 0.9rem; resize: none; line-height: 1.5;
                                            font-family: inherit;
                                        " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                                    </div>
                                    <button class="wa-send-btn" onclick="window.b2bLeadsManager.addLog('${lead.id}')" style="
                                        width: 48px; height: 48px; border-radius: 50%; padding: 0;
                                        display: flex; align-items: center; justify-content: center;
                                        flex-shrink: 0; min-width: unset;
                                        background: linear-gradient(135deg, #3b82f6, #2563eb);
                                        color: white; border: none; cursor: pointer;
                                        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                                        transition: all 0.2s;
                                    " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(59, 130, 246, 0.3)';">
                                        <!-- Send Icon (Check/Pen or Send arrow) -->
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Column 2: WHATSAPP CHAT -->
                        <div class="modal-column column-engagement" style="display: flex; flex-direction: column; height: 100%; overflow: hidden; background: rgba(255,255,255,0.015);">

                            <!-- ① Fixed Header: title + connection status -->
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; background: rgba(16,185,129,0.04);">
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
                            <div style="flex-shrink: 0; border-top: 1px solid rgba(255,255,255,0.06); background: rgba(0,0,0,0.25); padding: 12px 14px; display: flex; flex-direction: column; gap: 8px;">

                                <!-- Template selector -->
                                <div class="wa-modern-select-wrapper" style="margin-bottom: 0;">
                                    <select id="wa-template-select" class="wa-modern-select" onchange="window.b2bLeadsManager.handleWATemplateChange(this.value)" style="padding: 9px 14px; font-size: 0.8rem; border-radius: 10px;">
                                        <option value="">Select Template...</option>
                                    </select>
                                </div>

                                <!-- Media actions row -->
                                <div style="display: flex; gap: 8px;">
                                    <button class="wa-action-btn" onclick="window.b2bLeadsManager.openMediaGallery()" style="flex: 1; padding: 7px; font-size: 0.72rem; border-radius: 10px;">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                        Gallery
                                    </button>
                                    <button class="wa-action-btn" onclick="document.getElementById('wa-file-upload').click()" style="flex: 1; padding: 7px; font-size: 0.72rem; border-radius: 10px;">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:15px;height:15px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                        Upload
                                    </button>
                                    <input type="file" id="wa-file-upload" style="display: none;" onchange="window.b2bLeadsManager.handleWAMediaUpload(this.files[0])">
                                </div>

                                <!-- Media preview (shown when selected) -->
                                <div id="wa-media-preview" class="wa-preview-container" style="display: none; position: relative; border-radius: 10px; overflow: hidden; border: 1px solid rgba(16,185,129,0.2);"></div>

                                <!-- Message input + send -->
                                <div style="display: flex; gap: 8px; align-items: flex-end;">
                                    <div style="flex: 1; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 2px 4px; transition: border-color 0.2s;" onfocusin="this.style.borderColor='rgba(16,185,129,0.4)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.08)'">
                                        <textarea id="wa-message-body" placeholder="Message..." style="
                                            width: 100%; min-height: 36px; max-height: 100px;
                                            background: transparent; border: none; outline: none;
                                            color: #f1f5f9; padding: 8px 12px;
                                            font-size: 0.88rem; resize: none; line-height: 1.4;
                                            font-family: inherit;
                                        " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,100)+'px'"></textarea>
                                    </div>
                                    <button class="wa-send-btn" onclick="window.b2bLeadsManager.sendWhatsAppMessage('${lead.id}')" style="
                                        width: 44px; height: 44px; border-radius: 50%; padding: 0;
                                        display: flex; align-items: center; justify-content: center;
                                        flex-shrink: 0; font-size: 0; min-width: unset;
                                    ">
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
            
            <style>
                .dealer-modal-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: var(--modal-overlay-bg, rgba(0, 0, 0, 0.85)); /* Darker overlay */
                    backdrop-filter: blur(12px);
                    z-index: 10000;
                    display: flex; align-items: center; justify-content: center;
                    animation: fadeIn 0.1s ease-out;
                }
                .dealer-modal {
                    position: relative;
                    background: var(--modal-bg-gradient, #0f172a);
                    width: 95vw;
                    height: 90vh;
                    max-width: 1600px; /* Max constraint for ultra wide */
                    border-radius: 20px;
                    border: var(--modal-border, 1px solid rgba(255,255,255,0.08));
                    box-shadow: var(--modal-shadow, 0 50px 100px -20px rgba(0, 0, 0, 0.7));
                    color: var(--modal-input-text, #e2e8f0);
                    display: flex; flex-direction: column;
                    overflow: hidden;
                    animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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
                .edit-group {
                    /* No specific styles needed, just container */
                }
                
                /* Scrollbar for internally scrolling columns */
                .modal-column::-webkit-scrollbar,
                #b2b-logs-list::-webkit-scrollbar {
                    width: 6px;
                }
                .modal-column::-webkit-scrollbar-track,
                #b2b-logs-list::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                }
                .modal-column::-webkit-scrollbar-thumb,
                #b2b-logs-list::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }

                
                @keyframes scaleUp {
                    from { transform: scale(0.95) translateY(10px); opacity: 0; }
                    to { transform: scale(1) translateY(0); opacity: 1; }
                }

                /* Header */
                .dealer-modal-header {
                    padding: 16px 24px;
                    border-bottom: var(--modal-tabs-border, 1px solid rgba(255,255,255,0.05));
                    display: flex; justify-content: space-between; align-items: center;
                    background: var(--modal-header-bg, rgba(255,255,255,0.02));
                }
                .dealer-modal-header h2 { 
                    margin: 0; font-size: 1.25rem; font-weight: 700; 
                    color: var(--modal-h2-color, #f8fafc);
                    text-shadow: 0 2px 10px rgba(0,0,0,0.1);
                }
                .header-actions { display: flex; gap: 12px; align-items: center; }
                .stage-badge { 
                    padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; 
                    text-transform: uppercase; background: rgba(16, 185, 129, 0.2); color: #34d399; 
                    border: 1px solid rgba(16, 185, 129, 0.3);
                }
                
                .close-btn { 
                    background: rgba(255,255,255,0.05); border: none; color: var(--modal-text-secondary, #94a3b8); 
                    border-radius: 50%; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;
                    cursor: pointer; transition: all 0.2s; 
                }
                .close-btn:hover { background: rgba(100,100,255,0.1); color: var(--modal-h2-color); transform: rotate(90deg); }

                /* Modernized WhatsApp Section */
                .whatsapp-modern-card {
                    background: rgba(16, 185, 129, 0.03);
                    border: 1px solid rgba(16, 185, 129, 0.1);
                    border-radius: 20px;
                    padding: 20px;
                    position: relative;
                    overflow: hidden;
                    backdrop-filter: blur(5px);
                }
                .whatsapp-header-group {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .whatsapp-title-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #10b981;
                }
                .whatsapp-title-wrapper h4 {
                    margin: 0;
                    font-size: 0.9rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .wa-status-pill {
                    padding: 6px 12px;
                    border-radius: 20px;
                    font-size: 0.7rem;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.05);
                }
                .wa-status-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                    position: relative;
                    background: #475569;
                }
                .wa-status-pill.connected {
                    background: rgba(16, 185, 129, 0.1);
                    border-color: rgba(16, 185, 129, 0.2);
                    color: #f8fafc;
                }
                .wa-status-pill.connected .wa-status-dot {
                    background: #10b981;
                    box-shadow: 0 0 8px #10b981;
                }
                .wa-status-pill.connected .wa-status-dot::after {
                    content: '';
                    position: absolute;
                    inset: -2px;
                    border: 1px solid #10b981;
                    border-radius: 50%;
                    animation: ripple 2s infinite;
                }
                @keyframes ripple {
                    0% { transform: scale(1); opacity: 0.8; }
                    100% { transform: scale(2.5); opacity: 0; }
                }
                .wa-action-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                    margin-bottom: 15px;
                }
                .wa-action-btn {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 12px;
                    padding: 10px;
                    color: #94a3b8;
                    font-size: 0.75rem;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    transition: all 0.2s;
                }
                .wa-action-btn:hover {
                    background: rgba(255, 255, 255, 0.08);
                    border-color: rgba(255, 255, 255, 0.15);
                    color: #f8fafc;
                    transform: translateY(-1px);
                }
                .wa-action-btn svg { width: 18px; height: 18px; }
                .wa-modern-select-wrapper {
                    position: relative;
                    margin-bottom: 15px;
                }
                .wa-modern-select {
                    width: 100%;
                    background: rgba(0, 0, 0, 0.25);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 12px;
                    padding: 12px 16px;
                    color: #f8fafc;
                    font-size: 0.85rem;
                    outline: none;
                    appearance: none;
                    cursor: pointer;
                    transition: all 0.2s;
                }
                .wa-modern-select:focus {
                    border-color: rgba(16, 185, 129, 0.4);
                    box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.1);
                }
                .wa-modern-select option { background: #0f172a; color: #f8fafc; }
                .wa-modern-select-wrapper::after {
                    content: '▾';
                    position: absolute;
                    right: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #64748b;
                    pointer-events: none;
                    font-size: 0.7rem;
                }
                .wa-message-composer {
                    background: rgba(0, 0, 0, 0.2);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    border-radius: 16px;
                    padding: 4px;
                    margin-bottom: 20px;
                    transition: border-color 0.2s;
                }
                .wa-message-composer:focus-within { border-color: rgba(16, 185, 129, 0.3); }
                .wa-message-composer textarea {
                    width: 100%;
                    min-height: 80px;
                    background: transparent;
                    border: none;
                    color: #f1f5f9;
                    padding: 12px;
                    font-size: 0.9rem;
                    resize: none;
                    outline: none;
                    line-height: 1.5;
                }
                .wa-send-btn {
                    width: 100%;
                    padding: 14px;
                    border-radius: 14px;
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: white;
                    font-weight: 700;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border: none;
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                }
                .wa-send-btn:hover:not(:disabled) {
                    transform: translateY(-2px) scale(1.01);
                    box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4);
                }
                .wa-send-btn:disabled {
                    background: rgba(255, 255, 255, 0.05);
                    color: #475569;
                    box-shadow: none;
                    cursor: not-allowed;
                    opacity: 0.5;
                }
                .wa-preview-container {
                    margin-bottom: 15px; border-radius: 16px; overflow: hidden;
                    background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(16, 185, 129, 0.1);
                }

                /* Tabs */
                .dealer-modal-tabs {
                    display: flex; padding: 0 24px;
                    background: var(--modal-tabs-bg, rgba(0,0,0,0.1));
                    border-bottom: var(--modal-tabs-border, 1px solid rgba(255,255,255,0.05));
                }
                .tab-btn {
                    padding: 14px 4px; margin-right: 24px;
                    background: none; border: none; 
                    color: var(--modal-label-color, #64748b);
                    font-size: 0.85rem; font-weight: 600; cursor: pointer;
                    position: relative; transition: color 0.2s;
                }
                .tab-btn.active { color: var(--modal-h2-color, #f8fafc); }
                .tab-btn.active::after {
                    content: ''; position: absolute; bottom: -1px; left: 0; right: 0;
                    height: 2px; background: var(--color-info, #3b82f6); box-shadow: 0 -1px 8px var(--color-info);
                }

                /* Content Body */
                .dealer-modal-content { padding: 24px; flex: 1; }
                
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

                .col-title {
                    font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.08em;
                    color: var(--modal-label-color, #64748b); margin: 0 0 16px 0; font-weight: 700;
                    border-bottom: 1px dashed var(--modal-table-border, rgba(255,255,255,0.1)); padding-bottom: 4px;
                }

                /* Floating Labels */
                .floating-group { position: relative; margin-bottom: 16px; }
                .floating-input {
                    width: 100%;
                    padding: 16px 12px 6px;
                    height: 48px;
                    background: var(--modal-input-bg, rgba(30, 41, 59, 0.5));
                    border: var(--modal-input-border, 1px solid rgba(255, 255, 255, 0.1));
                    border-radius: 8px;
                    color: var(--modal-input-text, #f1f5f9);
                    font-size: 0.9rem;
                    font-family: inherit;
                    transition: all 0.2s;
                    box-sizing: border-box;
                }
                .floating-input:focus {
                    outline: none;
                    border-color: var(--color-info, #3b82f6);
                    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
                    background: var(--modal-input-focus-bg, rgba(30, 41, 59, 0.8));
                }
                .floating-label {
                    position: absolute;
                    top: 14px; left: 12px;
                    font-size: 0.85rem;
                    color: var(--modal-label-color, #94a3b8);
                    pointer-events: none;
                    transition: all 0.2s ease-out;
                }
                /* Active State for Float */
                .floating-input:focus ~ .floating-label,
                .floating-input:not(:placeholder-shown) ~ .floating-label {
                    top: 4px;
                    font-size: 0.65rem;
                    color: var(--color-info, #3b82f6);
                    font-weight: 600;
                }
                /* Select handling */
                select.floating-input { padding-top: 16px; cursor: pointer; }
                select.floating-input option { background: var(--modal-input-bg, #1e293b); color: var(--modal-input-text); }

                /* Readonly */
                .floating-input[readonly], .floating-input[disabled] {
                    background: var(--modal-readonly-bg, rgba(0, 0, 0, 0.2));
                    border-color: transparent;
                    cursor: default;
                    color: var(--modal-text-secondary, #94a3b8);
                }

                /* Edit Toggle Button */
                .edit-toggle-btn {
                    position: absolute; right: 10px; top: 12px;
                    background: none; border: none;
                    color: var(--text-muted); opacity: 0.5;
                    cursor: pointer; transition: all 0.2s;
                }
                .edit-toggle-btn:hover { opacity: 1; color: var(--accent-color); }

                /* Footer */
                .dealer-modal-footer {
                    padding: 16px 24px;
                    border-top: var(--modal-footer-border, 1px solid rgba(255,255,255,0.05));
                    background: var(--modal-footer-bg, rgba(15, 23, 42, 0.5));
                    display: flex; justify-content: space-between; align-items: center;
                }
                .footer-note { font-size: 0.75rem; color: var(--modal-text-secondary, #94a3b8); font-style: italic; }
                
                .btn-cancel {
                    padding: 8px 16px; margin-right: 8px;
                    background: transparent; border: 1px solid var(--modal-table-border, rgba(255,255,255,0.1));
                    color: var(--modal-text-secondary, #94a3b8); border-radius: 6px; cursor: pointer; transition: 0.2s;
                }
                .btn-cancel:hover { background: rgba(255,255,255,0.05); color: var(--modal-h2-color, #f8fafc); }
                
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

                /* Chip Active States */
                .activity-chip.active, .status-chip.active {
                    background: var(--color-info, #3b82f6) !important;
                    border-color: var(--color-info, #3b82f6) !important;
                    color: white !important;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
                    font-weight: 700;
                }

                /* CRM Scrollbar Styles (matched to WhatsApp chat scrollbar) */
                .crm-history-container::-webkit-scrollbar {
                    width: 6px;
                }
                .crm-history-container::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                }
                .crm-history-container::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }

                /* Chat History Styles */
                .wa-chat-history-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    max-height: 400px;
                    overflow-y: auto;
                    padding: 4px;
                }
                .wa-chat-history-container::-webkit-scrollbar,
                #wa-chat-history::-webkit-scrollbar {
                    width: 6px;
                }
                .wa-chat-history-container::-webkit-scrollbar-track,
                #wa-chat-history::-webkit-scrollbar-track {
                    background: rgba(0,0,0,0.1);
                }
                .wa-chat-history-container::-webkit-scrollbar-thumb,
                #wa-chat-history::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 3px;
                }
                .wa-msg {
                    max-width: 85%;
                    padding: 8px 12px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    line-height: 1.4;
                    position: relative;
                }
                .wa-msg.inbound {
                    align-self: flex-start;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.08);
                    color: #e2e8f0;
                    border-bottom-left-radius: 2px;
                }
                .wa-msg.outbound {
                    align-self: flex-end;
                    background: rgba(16, 185, 129, 0.1);
                    border: 1px solid rgba(16, 185, 129, 0.2);
                    color: #f8fafc;
                    border-bottom-right-radius: 2px;
                }
                .wa-msg-content { white-space: pre-wrap; word-break: break-word; }
                .wa-msg-time {
                    display: block;
                    font-size: 0.65rem;
                    opacity: 0.5;
                    margin-top: 4px;
                    text-align: right;
                }
            </style>
        `;
}

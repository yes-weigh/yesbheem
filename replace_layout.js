const fs = require('fs');
let content = fs.readFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', 'utf8');

const startMarker = '<!-- Unified Composer Box -->';
const endMarker = '<!-- Column 2: WHATSAPP CHAT -->';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newBlock = `<!-- Unified Composer Box -->
                                    <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 14px; position: relative;" onfocusin="this.style.borderColor='rgba(59, 130, 246, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">
                                        
                                        <!-- Top Controls Row -->
                                        <div style="display: flex; flex-wrap: wrap; gap: 14px; align-items: flex-start;">
                                            
                                            <div style="flex-shrink: 0; width: 140px;">
                                                <select id="inp_status" data-field="status" onchange="window.b2bLeadsManager.saveLeadDetails('\${lead.id}', true)"
                                                    style="width: 100%; background: transparent url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNiIgaGVpZ2h0PSIxNiIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmOGZhZmMiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj48cG9seWxpbmUgcG9pbnRzPSI2IDkgMTIgMTUgMTggOSI+PC9wb2x5bGluZT48L3N2Zz4=') no-repeat right 8px center; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 6px 28px 6px 10px; color: #f8fafc; font-size: 0.75rem; font-weight: 600; outline: none; appearance: none; cursor: pointer; height: 32px;">
                                                    <option value="" style="background: #1e293b; color: #f8fafc;">Stage...</option>
                                                    \${(statusOptions || []).map(opt => {
                                                        const val = typeof opt === 'object' ? opt.name : opt;
                                                        const labelText = typeof opt === 'object' ? opt.name : opt;
                                                        return \`<option value="\${val}" style="background: #1e293b; color: #f8fafc;" \${lead.status === val ? 'selected' : ''}>\${labelText}</option>\`;
                                                    }).join('')}
                                                </select>
                                            </div>

                                            <div class="activity-chips-container" style="display: flex; flex-wrap: wrap; gap: 6px; flex: 1; align-items: flex-start; align-content: flex-start;">
                                                \${(settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => \`
                                                    <button type="button" class="activity-chip" onclick="
                                                        this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
                                                        this.classList.add('active');
                                                    " data-value="\${a}" style="
                                                        padding: 2px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.1);
                                                        background: transparent; color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; height: 28px; display: flex; align-items: center; justify-content: center;
                                                    " onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.05)';" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent';">
                                                        \${a}
                                                    </button>
                                                \`).join('')}
                                            </div>
                                            
                                            <div style="display: flex; align-items: center; padding-top: 4px;">
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

                                        <div id="due-date-container" style="display: none; gap: 8px;">
                                            <input type="date" id="new-log-date" class="floating-input" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                                            <input type="time" id="new-log-time" class="floating-input" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                                        </div>

                                        <div style="height: 1px; background: rgba(255,255,255,0.05); width: 100%;"></div>

                                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                                            <textarea id="new-log-content" placeholder="Log details..." style="
                                                flex: 1; min-height: 48px; max-height: 120px;
                                                background: transparent; border: none; outline: none;
                                                color: #f8fafc; padding: 0; margin: 0;
                                                font-size: 0.9rem; resize: none; line-height: 1.5;
                                                font-family: inherit;
                                            " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                                            
                                            <button class="wa-send-btn" onclick="window.b2bLeadsManager.addLog('\${lead.id}')" style="
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

                        `;

fs.writeFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', before + newBlock + after);
console.log("Successfully replaced layout");

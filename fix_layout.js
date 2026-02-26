const fs = require('fs');
let content = fs.readFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', 'utf8');

const oldChipsStart = '<div class="activity-chips-container"';
const oldChipsContent = `                                            <div class="activity-chips-container" style="display: flex; flex-wrap: wrap; gap: 6px; flex: 1; align-items: flex-start; align-content: flex-start;">
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
                                            </div>`;

const newChipsContent = `                                            <div class="activity-chips-container" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; flex: 1; min-width: 250px; align-items: center;">
                                                \${(settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => \`
                                                    <button type="button" class="activity-chip" onclick="
                                                        this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
                                                        this.classList.add('active');
                                                    " data-value="\${a}" style="
                                                        padding: 4px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);
                                                        background: transparent; color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; height: 28px; display: flex; align-items: center;
                                                    " onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.1)';" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent';">
                                                        \${a}
                                                    </button>
                                                \`).join('')}
                                            </div>`;

if(content.includes(oldChipsContent)) {
    content = content.replace(oldChipsContent, newChipsContent);
    fs.writeFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', content);
    console.log("Chips layout substituted via exact match.");
} else {
    console.log("Could not find exact match. Doing regex replacement...");
    
    // Instead of exact string matching, we can replace the layout block. 
    // We will just rewrite the `Unified Composer Box` to fix any flex issues.
    const startMarker = '<!-- Unified Composer Box (matches user image exactly) -->';
    const endMarker = '<!-- Column 2: WHATSAPP CHAT -->';
    const sIdx = content.indexOf(startMarker);
    const eIdx = content.indexOf(endMarker);
    
    if (sIdx > -1 && eIdx > -1) {
        const before = content.substring(0, sIdx);
        const after = content.substring(eIdx);
        
        const newBlock = \`<!-- Unified Composer Box (matches user image exactly) -->
                                    <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 12px 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 12px; position: relative;" onfocusin="this.style.borderColor='rgba(59, 130, 246, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">
                                        
                                        <!-- Top Controls Row (Dropdown, Chips, Due Date) -->
                                        <div style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 12px; align-items: center;">
                                            
                                            <!-- Stage Dropdown -->
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

                                            <!-- Horizontal Chips Area -->
                                            <div class="activity-chips-container" style="display: flex; flex-direction: row; flex-wrap: wrap; gap: 8px; flex: 1; min-width: 200px; align-items: center;">
                                                \${(settings.log_activities || ['Call', 'Visit', 'Message', 'Followup']).map(a => \`
                                                    <button type="button" class="activity-chip" onclick="
                                                        this.parentElement.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));
                                                        this.classList.add('active');
                                                    " data-value="\${a}" style="
                                                        padding: 0px 14px; border-radius: 20px; border: 1px solid rgba(255, 255, 255, 0.2);
                                                        background: transparent; color: var(--modal-text-secondary); cursor: pointer; font-size: 0.75rem; font-weight: 500; transition: all 0.2s; height: 28px; display: flex; align-items: center; justify-content: center; white-space: nowrap;
                                                    " onmouseover="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.05)';" onmouseout="if(!this.classList.contains('active')) this.style.background='transparent';">
                                                        \${a}
                                                    </button>
                                                \`).join('')}
                                            </div>
                                            
                                            <!-- Due Date Toggle -->
                                            <div style="display: flex; align-items: center; justify-content: flex-end;">
                                                <label style="display: inline-flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;">
                                                    <input type="checkbox" id="toggle-due-date" onchange="
                                                        document.getElementById('due-date-container').style.display = this.checked ? 'flex' : 'none';
                                                    " style="
                                                        width: 14px; height: 14px; cursor: pointer; accent-color: var(--color-info);
                                                        border-radius: 2px; background: rgba(255,255,255,1); border: none; margin: 0; appearance: none;
                                                    ">
                                                    <!-- custom checkbox dot -->
                                                    <style>
                                                        #toggle-due-date:checked {
                                                            background: #fff;
                                                            position: relative;
                                                        }
                                                        #toggle-due-date:checked::after {
                                                            content: ''; position: absolute; left: 4px; top: 1px; width: 4px; height: 8px; border: solid #0f172a; border-width: 0 2px 2px 0; transform: rotate(45deg);
                                                        }
                                                    </style>
                                                    <span style="font-size: 0.75rem; font-weight: 500; color: var(--modal-text-secondary); opacity: 0.9;">Due Date</span>
                                                </label>
                                            </div>
                                        </div>

                                        <!-- Due Date Inputs -->
                                        <div id="due-date-container" style="display: none; gap: 8px;">
                                            <input type="date" id="new-log-date" class="floating-input" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                                            <input type="time" id="new-log-time" class="floating-input" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: white; padding: 6px 10px; height: 32px; font-size: 0.8rem;">
                                        </div>

                                        <!-- Separator Line -->
                                        <div style="height: 1px; background: rgba(255,255,255,0.05); width: 100%;"></div>

                                        <!-- Textarea section with inline send button -->
                                        <div style="display: flex; gap: 10px; align-items: flex-end;">
                                            <textarea id="new-log-content" placeholder="Log details..." style="
                                                flex: 1; min-height: 48px; max-height: 120px;
                                                background: transparent; border: none; outline: none;
                                                color: #f8fafc; padding: 0; margin: 0;
                                                font-size: 0.9rem; resize: none; line-height: 1.5;
                                                font-family: inherit;
                                            " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                                            
                                            <!-- Send Button (Inside Box, Aligned Bottom-Right) -->
                                            <button class="wa-send-btn" onclick="window.b2bLeadsManager.addLog('\${lead.id}')" style="
                                                width: 44px; height: 44px; border-radius: 50%; padding: 0;
                                                display: flex; align-items: center; justify-content: center;
                                                flex-shrink: 0; min-width: unset;
                                                background: linear-gradient(135deg, #3b82f6, #3b82f6);
                                                color: white; border: none; cursor: pointer;
                                                box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
                                                transition: all 0.2s;
                                            " onmouseover="this.style.transform='translateY(-2px) scale(1.05)'; this.style.boxShadow='0 6px 20px rgba(59, 130, 246, 0.4)';" onmouseout="this.style.transform='none'; this.style.boxShadow='0 4px 15px rgba(59, 130, 246, 0.3)';">
                                                <!-- Tick icon -->
                                                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        \`;
        
        fs.writeFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', before + newBlock + after);
        console.log("Chips layout substituted via block replacement.");
    } else {
        console.error("Markers not found");
        process.exit(1);
    }
}

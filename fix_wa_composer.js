const fs = require('fs');
let content = fs.readFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', 'utf8');

const startMarker = '<!-- ③ Composer — pinned at bottom -->';
const endMarker = '                            </div>\n                        </div>\n\n                    </div>\n                </div>\n            </div>';

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker, startIndex);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const before = content.substring(0, startIndex);
const after = content.substring(endIndex);

const newBlock = `<!-- ③ Composer — pinned at bottom -->
                            <div style="flex-shrink: 0; background: rgba(0,0,0,0.25); padding: 12px 14px; display: flex; flex-direction: column;">
                                
                                <!-- Unified WA Composer Box -->
                                <div style="flex: 1; background: transparent; border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 12px 16px; transition: border-color 0.2s; display: flex; flex-direction: column; gap: 12px; position: relative;" onfocusin="this.style.borderColor='rgba(16, 185, 129, 0.5)'" onfocusout="this.style.borderColor='rgba(255,255,255,0.15)'">

                                    <!-- Top Row: Template selector -->
                                    <div class="wa-modern-select-wrapper" style="margin-bottom: 0;">
                                        <select id="wa-template-select" class="wa-modern-select" onchange="window.b2bLeadsManager.handleWATemplateChange(this.value)" style="padding: 6px 14px; font-size: 0.8rem; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.1); background: transparent; color: #f8fafc; width: 100%; outline: none;">
                                            <option value="" style="background: #1e293b; color: #f8fafc;">Select Template...</option>
                                        </select>
                                    </div>

                                    <!-- Middle Row: Media actions -->
                                    <div style="display: flex; gap: 8px;">
                                        <button class="wa-action-btn" onclick="window.b2bLeadsManager.openMediaGallery()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--modal-text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                            Gallery
                                        </button>
                                        <button class="wa-action-btn" onclick="document.getElementById('wa-file-upload').click()" style="flex: 1; padding: 6px; font-size: 0.72rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: transparent; color: var(--modal-text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                            Upload
                                        </button>
                                        <input type="file" id="wa-file-upload" style="display: none;" onchange="window.b2bLeadsManager.handleWAMediaUpload(this.files[0])">
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
                                            color: #f1f5f9; padding: 0; margin: 0;
                                            font-size: 0.88rem; resize: none; line-height: 1.4;
                                            font-family: inherit;
                                        " oninput="this.style.height='auto'; this.style.height=Math.min(this.scrollHeight,120)+'px'"></textarea>
                                        
                                        <button class="wa-send-btn" onclick="window.b2bLeadsManager.sendWhatsAppMessage('\${lead.id}')" style="
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
`;

fs.writeFileSync('d:\\kerala\\js\\components\\b2b-lead-modal.js', before + newBlock + after);
console.log("Replaced WA composer successfully.");

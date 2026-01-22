class TemplateRenderer {
    constructor(callbacks) {
        this.callbacks = callbacks || {}; // { onLoadTemplate, onRemoveButton, onUpdateUI }
    }

    /* --- HELPERS --- */
    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* --- TEMPLATE LIST --- */
    renderTemplateList(templates, activeId) {
        const list = document.getElementById('template-list');
        if (!list) return;

        if (!templates || templates.length === 0) {
            list.innerHTML = '<div class="text-xs text-muted text-center py-4">No templates found</div>';
            return;
        }

        list.innerHTML = templates.map(t => {
            const isActive = activeId === t.id;
            return `
            <div class="template-item ${isActive ? 'active' : ''}" style="position: relative; display: flex; align-items: center; gap: 0.5rem;">
                <div style="flex: 1; cursor: pointer;" onclick="window.tmplMgr.loadTemplate('${t.id}')">
                    <div class="font-bold text-sm text-white truncate">${this.escapeHtml(t.name)}</div>
                    <div class="text-xs text-muted mt-1 flex justify-between" style="opacity:0.7">
                        <span class="uppercase">${t.type}</span>
                        <span>${t.id.substring(0, 4)}</span>
                    </div>
                </div>
                <button 
                    onclick="event.stopPropagation(); window.tmplMgr.deleteTemplate('${t.id}')" 
                    class="template-delete-btn"
                    title="Delete template"
                    style="opacity: 0; transition: all 0.2s; background: rgba(239, 68, 68, 0.1); border: none; border-radius: 8px; padding: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                    <svg width="14" height="14" fill="none" stroke="#ef4444" stroke-width="2" viewBox="0 0 24 24">
                        <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                    </svg>
                </button>
            </div>`;
        }).join('');
    }

    /* --- BUTTONS --- */
    renderButtons(buttons) {
        const list = document.getElementById('buttons-list');
        if (!list) return;
        list.innerHTML = '';

        this.updateButtonBadge(buttons.length);

        buttons.forEach((btn, index) => {
            const div = document.createElement('div');
            div.className = 'button-card';

            // Header
            const header = document.createElement('div');
            header.className = 'btn-card-header';
            header.innerHTML = `
                <span class="btn-card-label">BUTTON ${index + 1}</span>
                <button class="btn-remove-icon" title="Remove">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            `;
            // Bind remove
            header.querySelector('button').onclick = () => this.callbacks.onRemoveButton(index);
            div.appendChild(header);

            // Grid
            const grid = document.createElement('div');
            grid.className = 'modern-grid-inputs';
            grid.style.gridTemplateColumns = '1fr 2fr';

            // Type Select
            const typeWrapper = document.createElement('div');
            typeWrapper.className = 'input-group-fancy';
            const typeSelect = document.createElement('select');
            typeSelect.className = 'input-fancy select-fancy';
            [
                { val: 'reply', label: 'Quick Reply' },
                { val: 'url', label: 'URL Action' },
                { val: 'call', label: 'Phone Number' },
                { val: 'copy', label: 'Copy Code' }
            ].forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.val;
                opt.textContent = t.label;
                opt.selected = btn.type === t.val;
                typeSelect.appendChild(opt);
            });
            typeSelect.onchange = (e) => this.callbacks.onUpdateButton(index, 'type', e.target.value);
            typeWrapper.appendChild(typeSelect);

            // Label Input
            const labelInput = document.createElement('input');
            labelInput.type = 'text';
            labelInput.className = 'input-fancy';
            labelInput.placeholder = 'Button Label';
            labelInput.value = btn.text;
            labelInput.oninput = (e) => this.callbacks.onUpdateButton(index, 'text', e.target.value);

            grid.appendChild(typeWrapper);
            grid.appendChild(labelInput);
            div.appendChild(grid);

            // Conditional Value Input
            if (btn.type !== 'reply') {
                const valWrapper = document.createElement('div');
                valWrapper.className = 'input-group-fancy';
                valWrapper.style.marginTop = '1rem';

                const valInput = document.createElement('input');
                valInput.type = 'text';
                valInput.className = 'input-fancy';

                if (btn.type === 'url') valInput.placeholder = 'https://example.com';
                else if (btn.type === 'call') valInput.placeholder = '+919876543210';
                else if (btn.type === 'copy') valInput.placeholder = 'Promo Code';

                valInput.value = btn.value || '';
                valInput.oninput = (e) => this.callbacks.onUpdateButton(index, 'value', e.target.value);

                valWrapper.appendChild(valInput);
                div.appendChild(valWrapper);
            }

            list.appendChild(div);
        });
    }

    updateButtonBadge(count) {
        const badge = document.getElementById('btn-count-badge');
        if (badge) badge.textContent = count;
        const btnTab = document.getElementById('btn-trigger-buttons');
        // Visual hint for populated tab
        if (btnTab) {
            if (count > 0) btnTab.style.borderColor = 'var(--primary)';
            else btnTab.style.borderColor = ''; // reset
        }
    }

    /* --- LIVE PREVIEW --- */
    renderLivePreview(data) {
        const { text, footer, mediaUrl, mediaType, buttons } = data;

        // 1. Media
        const mediaView = document.getElementById('wa-media-preview');
        const mediaPlaceholder = document.getElementById('wa-media-placeholder');
        if (mediaView && mediaPlaceholder) {
            if (mediaUrl) {
                mediaView.innerHTML = '';
                mediaView.classList.remove('hidden');
                mediaPlaceholder.classList.add('hidden');

                if (mediaType === 'video') {
                    const vid = document.createElement('video');
                    vid.src = mediaUrl;
                    vid.className = 'wa-media-img';
                    vid.controls = true;
                    mediaView.appendChild(vid);
                } else {
                    const img = document.createElement('img');
                    img.src = mediaUrl;
                    img.className = 'wa-media-img';
                    mediaView.appendChild(img);
                }
            } else {
                mediaView.classList.add('hidden');
                mediaPlaceholder.classList.add('hidden');
            }
        }

        // 2. Text
        const textView = document.getElementById('wa-text-preview');
        // Only render text if explicitly provided (avoids overwriting inline edits)
        if (textView && typeof text !== 'undefined') {
            let formatted = (text || '')
                .replace(/\*(.*?)\*/g, '<span class="wa-bold">$1</span>')
                .replace(/_(.*?)_/g, '<span class="wa-italic">$1</span>')
                .replace(/~(.*?)~/g, '<span class="wa-strike">$1</span>')
                .replace(/\n/g, '<br>');
            textView.innerHTML = formatted;
        }

        // 3. Footer
        const footerView = document.getElementById('wa-footer-preview');
        if (footerView) {
            // Only render footer if explicitly provided
            if (typeof footer !== 'undefined') {
                if (footer) {
                    footerView.textContent = footer;
                    footerView.classList.remove('hidden');
                } else {
                    footerView.classList.add('hidden');
                }
            }
        }

        // 4. Buttons - HANDLED BY TemplateManager.renderButtonsInline() NOW
        // The preview container is now the editing list.
        /*
        const btnsView = document.getElementById('wa-buttons-preview');
        const btnsPlaceholder = document.getElementById('wa-buttons-placeholder');
        if (btnsView && btnsPlaceholder) {
            // ... (Removed to prevent overwriting the edit list)
        }
        */
    }
}

window.TemplateRenderer = TemplateRenderer;

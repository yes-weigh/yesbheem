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
            <div class="template-item ${isActive ? 'active' : ''}"
                 onclick="window.tmplMgr.loadTemplate('${t.id}')">
                <div class="font-bold text-sm text-white truncate">${this.escapeHtml(t.name)}</div>
                <div class="text-xs text-muted mt-1 flex justify-between" style="opacity:0.7">
                    <span class="uppercase">${t.type}</span>
                    <span>${t.id.substring(0, 4)}</span>
                </div>
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
        if (textView) {
            let formatted = (text || 'Type a message...')
                .replace(/\*(.*?)\*/g, '<span class="wa-bold">$1</span>')
                .replace(/_(.*?)_/g, '<span class="wa-italic">$1</span>')
                .replace(/~(.*?)~/g, '<span class="wa-strike">$1</span>')
                .replace(/\n/g, '<br>');
            textView.innerHTML = formatted;
        }

        // 3. Footer
        const footerView = document.getElementById('wa-footer-preview');
        if (footerView) {
            if (footer) {
                footerView.textContent = footer;
                footerView.classList.remove('hidden');
            } else {
                footerView.classList.add('hidden');
            }
        }

        // 4. Buttons
        const btnsView = document.getElementById('wa-buttons-preview');
        const btnsPlaceholder = document.getElementById('wa-buttons-placeholder');
        if (btnsView && btnsPlaceholder) {
            btnsView.innerHTML = '';
            if (buttons && buttons.length > 0) {
                btnsPlaceholder.classList.add('hidden');
                buttons.forEach(btn => {
                    const btnEl = document.createElement('div');
                    btnEl.className = 'wa-button';
                    let icon = '';
                    if (btn.type === 'url') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>';
                    if (btn.type === 'call') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>';
                    if (btn.type === 'reply') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>';
                    if (btn.type === 'copy') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';

                    btnEl.innerHTML = `<span>${icon}</span> <span>${this.escapeHtml(btn.text) || 'Button'}</span>`;
                    btnsView.appendChild(btnEl);
                });
            } else {
                btnsPlaceholder.classList.add('hidden');
            }
        }
    }
}

window.TemplateRenderer = TemplateRenderer;

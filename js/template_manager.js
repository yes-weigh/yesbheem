/**
 * TemplateManager (Controller)
 * Coordinates TemplateService (Data) and TemplateRenderer (UI)
 */
class TemplateManager {
    constructor() {
        this.service = new window.TemplateService();
        this.renderer = new window.TemplateRenderer({
            onRemoveButton: (index) => this.removeButton(index),
            onUpdateButton: (index, key, value) => this.updateButton(index, key, value)
        });

        // State
        this.templates = [];
        this.activeTemplateId = null;
        this.buttons = [];
        this.currentSection = 'text'; // Track active section

        // UI Refs
        this.sessionSelect = document.getElementById('session-select');

        this.init();
    }

    async init() {
        this.setupEventListeners();
        try {
            const [sessions, templates, settings] = await Promise.all([
                this.service.getSessions(),
                this.service.getTemplates(),
                this.loadSettings()
            ]);

            this.renderSessions(sessions);
            this.templates = templates;
            this.renderer.renderTemplateList(this.templates, this.activeTemplateId);

            // Populate language and category dropdowns
            if (settings) {
                this.settings = settings; // Store settings
                this.populateLanguages(settings.template_languages || []);
                this.populateCategories(settings.template_categories || []);
            }

        } catch (e) {
            console.error('Init failed', e);
        }
    }

    async loadSettings() {
        try {
            const { db } = await import('./services/firebase_config.js');
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(db, 'settings', 'general');
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? docSnap.data() : null;
        } catch (e) {
            console.error('Failed to load settings:', e);
            return null;
        }
    }

    populateLanguages(languages) {
        const select = document.getElementById('template-language-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select Language</option>' +
            languages.map(lang => `<option value="${this.escapeHtml(lang)}">${this.escapeHtml(lang)}</option>`).join('');
    }

    populateCategories(categories) {
        const select = document.getElementById('template-category-select');
        if (!select) return;

        select.innerHTML = '<option value="">Select Category</option>' +
            categories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('');
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /* --- DATA & STATE --- */

    renderSessions(sessions) {
        if (sessions.length === 0) {
            this.sessionSelect.innerHTML = '<option value="">No connected devices</option>';
        } else {
            this.sessionSelect.innerHTML = sessions.map(s =>
                `<option value="${s.id}">${s.name || 'Unnamed'} (${s.phoneNumber || 'Unknown'})</option>`
            ).join('');
        }
    }

    async loadTemplate(id) {
        const template = this.templates.find(t => t.id === id);
        if (!template) return;

        this.activeTemplateId = id;

        // Update UI Inputs
        document.getElementById('template-name-input').value = template.name;

        const languageSelect = document.getElementById('template-language-select');
        const categorySelect = document.getElementById('template-category-select');
        if (languageSelect) languageSelect.value = template.language || '';
        if (categorySelect) categorySelect.value = template.category || '';

        // Delete Button Logic
        const delBtn = document.getElementById('btn-delete-template');
        if (delBtn) {
            delBtn.style.opacity = 1;
            delBtn.style.pointerEvents = 'auto';
            delBtn.onclick = () => this.deleteTemplate(id);
        }

        // Parse Content
        const content = template.content || {};

        // Populate Preview Directly (Inline Editing)
        const textPreview = document.getElementById('wa-text-preview');
        const footerPreview = document.getElementById('wa-footer-preview');

        if (textPreview) textPreview.innerText = content.text || content.caption || '';
        if (footerPreview) {
            footerPreview.innerText = content.footer || '';
            footerPreview.classList.toggle('hidden', !content.footer && this.activeTemplateId !== 'NEW'); // Show if new or has content
            if (!content.footer) footerPreview.classList.remove('hidden'); // Always show for editing if desired, or handle via focus
        }

        // document.getElementById('footer-input-container').classList.toggle('hidden', !content.footer); // Removed container

        // Media
        let mediaUrl = '';
        let mediaType = 'image';
        if (content.image) { mediaUrl = content.image.url; mediaType = 'image'; }
        if (content.video) { mediaUrl = content.video.url; mediaType = 'video'; }

        document.getElementById('media-url-input').value = mediaUrl;
        document.getElementById('media-type-select').value = mediaType;
        // Show inline media controls if media exists
        const mediaControls = document.getElementById('wa-media-controls');
        if (mediaControls && mediaUrl) {
            mediaControls.classList.remove('hidden');
        }

        // Buttons
        this.buttons = [];
        if (content.interactiveButtons) {
            this.buttons = content.interactiveButtons.map(b => {
                const params = JSON.parse(b.buttonParamsJson);
                let type = 'reply';
                let val = '';
                if (b.name === 'cta_url') { type = 'url'; val = params.url; }
                if (b.name === 'cta_call') { type = 'call'; val = params.phone_number; }
                if (b.name === 'cta_copy') { type = 'copy'; val = params.copy_code; }
                return { type, text: params.display_text, value: val };
            });
        }

        this.renderButtonsInline();
        this.updateUI();
        this.renderer.renderTemplateList(this.templates, this.activeTemplateId); // Update active state
        this.focusSection('text');
    }

    async deleteTemplate(id) {
        if (!confirm('Delete this template?')) return;
        try {
            await this.service.deleteTemplate(id);
            await this.refreshTemplates();
            this.resetForm();
        } catch (e) { alert('Failed to delete'); }
    }

    async refreshTemplates() {
        this.templates = await this.service.getTemplates();
        this.renderer.renderTemplateList(this.templates, this.activeTemplateId);
    }

    /* --- UI UPDATES --- */

    updateUI() {
        this.renderer.renderButtons(this.buttons);

        // Only render Media in Live Preview (Text/Footer are inline managed)
        this.renderer.renderLivePreview({
            // text: ..., // Managed inline
            // footer: ..., // Managed inline
            mediaUrl: document.getElementById('media-url-input').value,
            mediaType: document.getElementById('media-type-select').value,
            buttons: this.buttons
        });

        // After render, check if we need to show placeholders based on FOCUS
        this.updatePreviewPlaceholders();
    }

    focusSection(section) {
        this.currentSection = section; // Track state

        const els = {
            // text: document.getElementById('text-input-section'), // Removed
            // media: document.getElementById('media-input-section'), // Removed - now inline
            buttons: document.getElementById('buttons-input-section'),
            // footer: document.getElementById('footer-input-container') // Removed
        };
        const tabs = {
            buttons: document.getElementById('btn-trigger-buttons')
        };

        // Hide all inputs
        Object.values(els).forEach(el => el && el.classList.add('hidden'));
        document.querySelectorAll('.action-pill').forEach(b => b.classList.remove('active'));

        // Show active input
        if (els[section]) els[section].classList.remove('hidden');
        if (tabs[section]) tabs[section].classList.add('active');

        // Focus Inline Elements if applicable
        if (section === 'text') {
            document.getElementById('wa-text-preview').focus();
        } else if (section === 'footer') {
            const footerEl = document.getElementById('wa-footer-preview');
            footerEl.classList.remove('hidden');
            footerEl.focus();
        }

        // Update preview placeholders
        this.updatePreviewPlaceholders();
    }

    updatePreviewPlaceholders() {
        const section = this.currentSection;
        const mediaUrl = document.getElementById('media-url-input').value;
        const mediaPH = document.getElementById('wa-media-placeholder');
        const mediaPreview = document.getElementById('wa-media-preview');

        // Show Media Placeholder ONLY if: Focus is Media AND No Media Content
        if (section === 'media' && !mediaUrl) {
            if (mediaPH) mediaPH.classList.remove('hidden');
        } else {
            // Else keep it hidden (renderer also hides it by default now)
            if (mediaPH && !mediaUrl) mediaPH.classList.add('hidden');
        }

        const buttonsPH = document.getElementById('wa-buttons-placeholder');
        // Show Buttons Placeholder ONLY if: Focus is Buttons AND No Buttons
        if (section === 'buttons' && this.buttons.length === 0) {
            if (buttonsPH) buttonsPH.classList.remove('hidden');
        } else {
            if (buttonsPH && this.buttons.length === 0) buttonsPH.classList.add('hidden');
        }
    }

    /* --- BUTTON MANAGEMENT (INLINE) --- */

    addButtonInline() {
        if (this.buttons.length >= 3) {
            alert('Maximum 3 buttons allowed');
            return;
        }

        // Show edit form
        this.editingButtonIndex = this.buttons.length; // New button
        this.showButtonEditForm();
    }

    showButtonEditForm(button = null) {
        const form = document.getElementById('wa-button-edit-form');
        const addBtn = document.getElementById('wa-button-add');

        // Populate form
        document.getElementById('btn-type-input').value = button ? button.type : 'reply';
        document.getElementById('btn-text-input').value = button ? button.text : '';
        document.getElementById('btn-value-input').value = button ? button.value || '' : '';

        // Show/hide value input based on type
        this.updateButtonValueInput(button ? button.type : 'reply');

        // Show form, hide add button
        form.classList.remove('hidden');
        if (addBtn) addBtn.classList.add('hidden');
    }

    hideButtonEditForm() {
        const form = document.getElementById('wa-button-edit-form');
        const addBtn = document.getElementById('wa-button-add');

        form.classList.add('hidden');
        if (addBtn && this.buttons.length < 3) addBtn.classList.remove('hidden');

        this.editingButtonIndex = null;
    }

    updateButtonValueInput(type) {
        const valueInput = document.getElementById('btn-value-input');
        if (type === 'reply') {
            valueInput.classList.add('hidden');
        } else {
            valueInput.classList.remove('hidden');
            if (type === 'url') valueInput.placeholder = 'https://example.com';
            else if (type === 'call') valueInput.placeholder = '+919876543210';
            else if (type === 'copy') valueInput.placeholder = 'Promo Code';
        }
    }

    confirmButton() {
        const type = document.getElementById('btn-type-input').value;
        const text = document.getElementById('btn-text-input').value;
        const value = document.getElementById('btn-value-input').value;

        if (!text) {
            alert('Button label is required');
            return;
        }

        if (type !== 'reply' && !value) {
            alert('Value is required for this button type');
            return;
        }

        const buttonData = { type, text, value: type === 'reply' ? '' : value };

        if (this.editingButtonIndex !== null && this.editingButtonIndex < this.buttons.length) {
            // Edit existing
            this.buttons[this.editingButtonIndex] = buttonData;
        } else {
            // Add new
            this.buttons.push(buttonData);
        }

        this.hideButtonEditForm();
        this.renderButtonsInline();
    }

    editButtonInline(index) {
        this.editingButtonIndex = index;
        this.showButtonEditForm(this.buttons[index]);
    }

    removeButton(index) {
        this.buttons.splice(index, 1);
        this.renderButtonsInline();
    }

    renderButtonsInline() {
        const container = document.getElementById('wa-buttons-preview');
        const addBtn = document.getElementById('wa-button-add');

        container.innerHTML = '';

        this.buttons.forEach((btn, index) => {
            const btnEl = document.createElement('div');
            btnEl.className = 'wa-button-rendered';

            let icon = '';
            if (btn.type === 'url') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>';
            if (btn.type === 'call') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"></path></svg>';
            if (btn.type === 'reply') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>';
            if (btn.type === 'copy') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';

            btnEl.innerHTML = `
                <div class="wa-button-content">
                    <span>${icon}</span>
                    <span>${this.escapeHtml(btn.text) || 'Button'}</span>
                </div>
                <div class="wa-button-icons">
                    <div class="wa-button-icon edit" data-index="${index}">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                        </svg>
                    </div>
                    <div class="wa-button-icon delete" data-index="${index}">
                        <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                        </svg>
                    </div>
                </div>
            `;

            container.appendChild(btnEl);
        });

        // Add event listeners to edit/delete icons
        container.querySelectorAll('.wa-button-icon.edit').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                this.editButtonInline(parseInt(el.dataset.index));
            });
        });

        container.querySelectorAll('.wa-button-icon.delete').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this button?')) {
                    this.removeButton(parseInt(el.dataset.index));
                }
            });
        });

        // Show/hide add button
        if (addBtn) {
            if (this.buttons.length >= 3) {
                addBtn.classList.add('hidden');
            } else {
                addBtn.classList.remove('hidden');
            }
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }



    updateButton(index, key, value) {
        this.buttons[index][key] = value;
        // Only re-render INPUTS if the TYPE changes (structure change)
        if (key === 'type') {
            this.updateUI();
        } else {
            // For text/value updates, only update the PREVIEW
            // For text/value updates, only update the PREVIEW (Media/Buttons part)
            this.renderer.renderLivePreview({
                // text: document.getElementById('message-body').value,
                // footer: document.getElementById('footer-input').value,
                mediaUrl: document.getElementById('media-url-input').value,
                mediaType: document.getElementById('media-type-select').value,
                buttons: this.buttons
            });
            // Ensure placeholders state is consistent without re-rendering inputs
            this.updatePreviewPlaceholders();
        }
    }

    /* --- EVENTS --- */

    setupEventListeners() {
        // Inputs -> Live Preview (Media/Buttons only now)
        ['media-url-input', 'media-type-select'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateUI());
        });

        // Media Placeholder Click - Toggle Inline Controls
        const mediaPlaceholder = document.getElementById('wa-media-placeholder');
        const mediaControls = document.getElementById('wa-media-controls');
        if (mediaPlaceholder && mediaControls) {
            mediaPlaceholder.addEventListener('click', () => {
                mediaControls.classList.toggle('hidden');
                if (!mediaControls.classList.contains('hidden')) {
                    // Focus the URL input when opening
                    document.getElementById('media-url-input').focus();
                }
            });
        }

        // Inline Text Listeners (Optional: logic if distinct actions needed on input)
        // document.getElementById('wa-text-preview').addEventListener('input', () => { ... });

        // Auto-resize Textarea (Removed)

        // Media File -> Upload -> URL
        const fileInput = document.getElementById('media-file-input');
        fileInput.addEventListener('change', async (e) => {
            if (e.target.files[0]) {
                try {
                    const url = await this.service.uploadFile(e.target.files[0]);
                    document.getElementById('media-url-input').value = url;
                    this.updateUI();
                } catch (err) { alert(err.message); }
            }
        });

        // Inline Button Controls
        const addButtonBtn = document.getElementById('wa-button-add');
        if (addButtonBtn) {
            addButtonBtn.querySelector('button').addEventListener('click', () => this.addButtonInline());
        }

        const confirmBtn = document.getElementById('btn-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmButton());
        }

        const btnTypeInput = document.getElementById('btn-type-input');
        if (btnTypeInput) {
            btnTypeInput.addEventListener('change', (e) => this.updateButtonValueInput(e.target.value));
        }

        // Actions
        document.getElementById('btn-new-template').addEventListener('click', () => this.resetForm());
        document.getElementById('btn-save-template').addEventListener('click', () => this.handleSave());
        document.getElementById('btn-send-message').addEventListener('click', () => this.handleSend());

        window.tmplMgr = this;
    }

    async handleSave() {
        const name = document.getElementById('template-name-input').value;
        if (!name) return alert('Enter name');

        try {
            const payload = this.preparePayload();
            const language = document.getElementById('template-language-select').value;
            const category = document.getElementById('template-category-select').value;

            const res = await this.service.saveTemplate({
                id: this.activeTemplateId,
                name: name,
                language: language || null,
                category: category || null,
                type: payload.type,
                content: (payload.type === 'text' ? { text: payload.text } : payload.content)
            }, !!(this.activeTemplateId && this.activeTemplateId !== 'NEW'));

            if (res.success) {
                alert('Saved');
                this.refreshTemplates();
            } else alert('Failed');
        } catch (e) { alert(e.message); }
    }

    async handleSend() {
        const btn = document.getElementById('btn-send-message');
        const sessionId = this.sessionSelect.value;
        const to = document.getElementById('phone-number').value;

        if (!sessionId || !to) return alert('Check details');

        btn.textContent = 'Sending...';
        btn.disabled = true;

        try {
            const payload = this.preparePayload();
            const res = await this.service.sendMessage({
                sessionId,
                to,
                type: payload.type,
                content: payload.content || { text: payload.text }
            });

            if (res.success) {
                const status = document.getElementById('status-message');
                status.classList.remove('hidden');
                setTimeout(() => status.classList.add('hidden'), 3000);
            } else alert(res.message);

        } catch (e) { console.error(e); alert('Failed to send'); }
        finally {
            btn.textContent = 'Send Message';
            btn.disabled = false;
        }
    }

    preparePayload() {
        const bodyText = document.getElementById('wa-text-preview').innerText;
        const footerText = document.getElementById('wa-footer-preview').innerText;
        const mediaUrl = document.getElementById('media-url-input').value;
        const mediaType = document.getElementById('media-type-select').value;

        const hasMedia = !!mediaUrl;
        const hasButtons = this.buttons.length > 0;

        let type = 'text';
        if (hasMedia && hasButtons) type = 'buttons_media';
        else if (hasMedia) type = 'text_media';
        else if (hasButtons) type = 'buttons';

        if (type === 'text') return { text: bodyText, type: 'text' };

        const content = {};
        if (bodyText) {
            if (type.includes('media')) content.caption = bodyText;
            else content.text = bodyText;
        }
        if (hasMedia) content[mediaType] = { url: mediaUrl };
        if (hasButtons) {
            if (footerText) content.footer = footerText;
            content.interactiveButtons = this.buttons.map(b => {
                let params = { display_text: b.text };
                let name = 'quick_reply';
                if (b.type === 'url') { name = 'cta_url'; params.url = params.merchant_url = b.value; }
                if (b.type === 'copy') { name = 'cta_copy'; params.copy_code = b.value; }
                if (b.type === 'call') { name = 'cta_call'; params.phone_number = b.value; }
                if (b.type === 'reply') { params.id = 'btn_' + Math.random().toString(36).substr(2, 9); }
                return { name, buttonParamsJson: JSON.stringify(params) };
            });
        }

        return { content, type };
    }

    resetForm() {
        this.activeTemplateId = null;
        document.getElementById('template-name-input').value = '';

        const textPreview = document.getElementById('wa-text-preview');
        if (textPreview) textPreview.innerText = '';

        const footerPreview = document.getElementById('wa-footer-preview');
        if (footerPreview) {
            footerPreview.innerText = '';
            footerPreview.classList.add('hidden');
        }

        document.getElementById('media-url-input').value = '';
        this.buttons = [];
        this.renderButtonsInline();
        this.updateUI(); // Resets view
        this.focusSection('text'); // Resets focus to text (hides other placeholders)
    }
}

// Start
new TemplateManager();

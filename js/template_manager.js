
// d:\kerala\js\template_manager.js

class TemplateManager {
    constructor() {
        this.apiBase = window.appConfig.apiUrl + '/api';
        this.templates = [];
        this.sessions = [];
        this.activeTemplateId = null;

        // UI Refs
        this.container = document.getElementById('template-page');
        this.sessionSelect = document.getElementById('session-select');
        this.templateList = document.getElementById('template-list');
        this.typeButtons = document.querySelectorAll('.type-btn');
        this.mediaToggle = document.querySelectorAll('.toggle-btn');
        this.form = document.getElementById('message-form');
        this.buttonsList = document.getElementById('buttons-list');

        // State
        this.messageType = 'text';
        this.mediaSource = 'url';
        this.buttons = [];

        this.init();
    }

    async init() {
        this.setupEventListeners();
        await Promise.all([this.loadSessions(), this.loadTemplates()]);
    }

    /* --- DATA LOADING --- */

    async loadSessions() {
        try {
            const res = await fetch(`${this.apiBase}/auth/sessions`);
            const data = await res.json();

            this.sessions = (data.sessions || []).filter(s => s.connected);

            if (this.sessions.length === 0) {
                this.sessionSelect.innerHTML = '<option value="">No connected devices</option>';
            } else {
                this.sessionSelect.innerHTML = this.sessions.map(s =>
                    `<option value="${s.id}">${s.name || 'Unnamed'} (${s.phoneNumber || 'Unknown'})</option>`
                ).join('');
            }
        } catch (e) {
            console.error('Failed to load sessions', e);
            this.sessionSelect.innerHTML = '<option value="">Error loading devices</option>';
        }
    }

    async loadTemplates() {
        this.templateList.innerHTML = '<div class="loading-spinner"></div>';
        try {
            const res = await fetch(`${this.apiBase}/templates`);
            const data = await res.json();
            this.templates = data.data || [];
            this.renderTemplateList();
        } catch (e) {
            console.error('Failed to load templates', e);
            this.templateList.innerHTML = '<p class="text-muted p-2">Error loading templates</p>';
        }
    }

    /* --- RENDERING --- */

    renderTemplateList() {
        if (this.templates.length === 0) {
            this.templateList.innerHTML = '<p class="text-muted p-2 text-center text-sm">No templates saved yet.</p>';
            return;
        }

        this.templateList.innerHTML = this.templates.map(t => `
        <div class="template-item ${this.activeTemplateId === t.id ? 'active' : ''}"
            data-id="${t.id}"
            style="padding: 1rem; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.5rem; transition: all 0.2s;">

            <div class="flex justify-between items-start mb-2">
                <h4 class="font-bold text-white text-base">${t.name}</h4>
                <span style="font-size:0.7rem; background:rgba(99,102,241,0.2); color:#a5b4fc; padding: 2px 8px; border-radius: 4px; font-weight: 600;">
                    ${t.type.replace('_', ' ').toUpperCase()}
                </span>
            </div>

            <p class="text-sm text-gray-400 truncate mb-3">
                ${(t.content.text || t.content.caption || 'Media/Interactive content').substring(0, 50)}...
            </p>

            <div class="flex justify-end">
                <button class="template-delete text-red-400 hover:text-red-300 p-2 rounded hover:bg-red-500/10 transition-colors" data-id="${t.id}" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            </div>
        </div>
        `).join('');

        // Re-attach listeners
        this.templateList.querySelectorAll('.template-item').forEach(el => {
            el.addEventListener('click', (e) => {
                if (!e.target.classList.contains('template-delete')) {
                    this.loadTemplate(el.dataset.id);
                }
            });
        });

        this.templateList.querySelectorAll('.template-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteTemplate(e.currentTarget.dataset.id, e));
        });
    }

    renderButtonInputs() {
        if (this.buttons.length === 0) {
            this.buttonsList.innerHTML = `
            <div class="text-center p-8 border border-dashed border-gray-700 rounded-lg bg-gray-900/30">
                    <p class="text-sm text-gray-400 mb-2">No interactive buttons added yet.</p>
                    <button type="button" class="secondary-btn small mx-auto" onclick="document.getElementById('btn-add-button').click()">+ Add First Button</button>
                </div>`;
            return;
        }

        this.buttonsList.innerHTML = this.buttons.map((btn, index) => {
            const isReply = btn.type === 'reply';
            let valuePlaceholder = 'Value';
            if (btn.type === 'url') valuePlaceholder = 'https://example.com';
            if (btn.type === 'call') valuePlaceholder = '+919876543210';
            if (btn.type === 'copy') valuePlaceholder = 'Promo Code / Text';

            return `
            <div class="button-item type-${btn.type}" style="background: rgba(255, 255, 255, 0.03); padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); margin-bottom: 1rem;">
                <div class="flex justify-between items-center mb-3" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h5 style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em;">Button ${index + 1}</h5>
                    <button type="button" style="color: #ef4444; background: rgba(239, 68, 68, 0.1); padding: 0.4rem 0.8rem; border-radius: 6px; border: none; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" 
                            onmouseover="this.style.background='rgba(239, 68, 68, 0.2)'"
                            onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'"
                            onclick="window.tmplMgr.removeButton(${index})">
                        REMOVE
                    </button>
                </div>

                <div style="display: grid; grid-template-columns: 1fr; gap: 1rem;">
                    <div class="form-group">
                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Action Type</label>
                        <select class="modern-input" style="width: 100%; background: #0f172a; border: 1px solid var(--border); padding: 0.75rem; border-radius: 8px; color: white;"
                                onchange="window.tmplMgr.updateButton(${index}, 'type', this.value)">
                            <option value="reply" ${btn.type === 'reply' ? 'selected' : ''}>Quick Reply (Text Only)</option>
                            <option value="url" ${btn.type === 'url' ? 'selected' : ''}>Open Website (Link)</option>
                            <option value="copy" ${btn.type === 'copy' ? 'selected' : ''}>Copy Offer/Code</option>
                            <option value="call" ${btn.type === 'call' ? 'selected' : ''}>Phone Call</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Button Label (on WhatsApp)</label>
                        <input type="text" class="modern-input" style="width: 100%; background: #0f172a; border: 1px solid var(--border); padding: 0.75rem; border-radius: 8px; color: white;"
                               placeholder="e.g. Visit Website" value="${btn.text}" 
                               oninput="window.tmplMgr.updateButton(${index}, 'text', this.value)">
                    </div>

                    ${!isReply ? `
                    <div class="form-group">
                        <label class="form-label" style="display: block; margin-bottom: 0.5rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Action Value</label>
                        <input type="text" class="modern-input" style="width: 100%; background: #0f172a; border: 1px solid var(--border); padding: 0.75rem; border-radius: 8px; color: white;"
                               placeholder="${valuePlaceholder}" value="${btn.value || ''}" 
                               oninput="window.tmplMgr.updateButton(${index}, 'value', this.value)">
                    </div>
                    ` : ''}
                </div>
            </div>`;
        }).join('');
    }

    /* --- INTERACTIONS --- */

    setupEventListeners() {
        // Message Type Switching
        this.typeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMessageType(btn.dataset.type);
            });
        });

        // Media Source Toggle
        this.mediaToggle.forEach(btn => {
            btn.addEventListener('click', () => {
                this.setMediaSource(btn.dataset.source);
            });
        });

        // Add Button
        document.getElementById('btn-add-button').addEventListener('click', () => {
            if (this.buttons.length >= 3) return;
            this.buttons.push({ type: 'reply', text: 'Quick Reply' });
            this.renderButtonInputs();
        });

        // New Template (Reset)
        document.getElementById('btn-new-template').addEventListener('click', () => this.resetForm());

        // Save Action (Direct)
        document.getElementById('btn-save-template').addEventListener('click', () => this.handleSave());

        // Delete Action
        const deleteBtn = document.getElementById('btn-delete-template');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this.handleDelete());

        // Form Submit Listener removed as we use direct button actions
        if (this.form) {
            this.form.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleSend(e);
            });
        }

        // Send Button
        const sendBtn = document.getElementById('btn-send-message');
        if (sendBtn) sendBtn.addEventListener('click', (e) => this.handleSend(e));

        // Expose helper to window for dynamic HTML calls
        window.tmplMgr = this;

        // Media Preview Listeners
        const fileInput = document.getElementById('media-file-input');
        const urlInput = document.getElementById('media-url-input');

        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        urlInput.addEventListener('input', (e) => this.handleUrlInput(e));
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        // Immediate Local Preview
        const objectUrl = URL.createObjectURL(file);
        this.renderPreview(objectUrl, file.type.startsWith('video') ? 'video' : 'image');
    }

    handleUrlInput(e) {
        const url = e.target.value;
        const type = document.getElementById('media-type-select').value;
        if (url.length > 10) {
            this.renderPreview(url, type);
        }
    }

    renderPreview(url, type) {
        const container = document.getElementById('media-preview-container');
        const img = document.getElementById('media-preview-image');
        const vid = document.getElementById('media-preview-video');

        container.classList.remove('hidden');

        if (type === 'video') {
            img.classList.add('hidden');
            vid.src = url;
            vid.classList.remove('hidden');
        } else {
            vid.classList.add('hidden');
            img.src = url;
            img.classList.remove('hidden');
        }
    }

    setTemplateType(type) {
        this.messageType = type;

        // UI Updates
        this.typeButtons.forEach(b => b.classList.toggle('active', b.id === `type-${type}`));

        const showMedia = type.includes('media');
        const showButtons = type.includes('button');

        const mediaSection = document.getElementById('media-section');
        const buttonsSection = document.getElementById('buttons-section');
        const footerSection = document.getElementById('footer-section');

        if (mediaSection) mediaSection.classList.toggle('hidden', !showMedia);
        if (buttonsSection) buttonsSection.classList.toggle('hidden', !showButtons);
        if (footerSection) footerSection.classList.toggle('hidden', !showButtons);

        // Update Label
        /* const bodyLabel = document.getElementById('body-label');
           if(bodyLabel) bodyLabel.textContent = showMedia ? 'Caption' : 'Message Body'; */
    }

    clearPreview() {
        document.getElementById('media-preview-container').classList.add('hidden');
        document.getElementById('media-preview-image').src = '';
        document.getElementById('media-preview-video').src = '';
    }

    setMediaSource(source) {
        this.mediaSource = source;
        this.mediaToggle.forEach(b => b.classList.toggle('active', b.dataset.source === source));

        const isFile = source === 'file';
        document.getElementById('media-url-input').classList.toggle('hidden', isFile);
        document.getElementById('media-file-input').classList.toggle('hidden', !isFile);
    }

    /* --- LOGIC --- */

    updateButton(index, key, value) {
        this.buttons[index][key] = value;
        if (key === 'type') this.renderButtonInputs(); // Re-render for inputs
    }

    removeButton(index) {
        this.buttons.splice(index, 1);
        this.renderButtonInputs();
    }

    resetForm() {
        this.currentTemplateId = null;

        // Reset New UI Elements
        const nameInput = document.getElementById('template-name-input');
        if (nameInput) nameInput.value = '';

        const idInput = document.getElementById('template-id-hidden');
        if (idInput) idInput.value = '';

        const saveBtnText = document.getElementById('save-btn-text');
        if (saveBtnText) saveBtnText.textContent = 'Save Template';

        const deleteBtn = document.getElementById('btn-delete-template');
        if (deleteBtn) deleteBtn.classList.add('hidden');

        this.setMessageType('text');
        this.setMediaSource('url');
        this.buttons = [];
        this.renderButtonInputs();

        // Clear inputs
        this.form.reset();
        document.getElementById('media-type-select').value = 'image';

        // Use default session if available
        if (this.sessions.length > 0) {
            this.sessionSelect.value = this.sessions[0].id;
        }

        this.clearPreview();
    }

    loadTemplate(id) {
        const t = this.templates.find(tmpl => tmpl.id === id);
        if (!t) return;

        this.currentTemplateId = id;

        // Update New UI Elements
        const nameInput = document.getElementById('template-name-input');
        if (nameInput) nameInput.value = t.name;

        const idInput = document.getElementById('template-id-hidden');
        if (idInput) idInput.value = t.id;

        const saveBtnText = document.getElementById('save-btn-text');
        if (saveBtnText) saveBtnText.textContent = 'Update Template';

        const deleteBtn = document.getElementById('btn-delete-template');
        if (deleteBtn) deleteBtn.classList.remove('hidden');

        // Apply content
        this.setTemplateType(t.type);
        const content = t.content;

        document.getElementById('message-body').value = content.text || content.caption || '';
        document.getElementById('footer-input').value = content.footer || '';

        // Media
        if (content.image || content.video) {
            const type = content.image ? 'image' : 'video';
            document.getElementById('media-type-select').value = type;
            const url = (content.image || content.video).url;
            document.getElementById('media-url-input').value = url;
            this.setMediaSource('url');
            this.renderPreview(url, type);
        } else {
            this.clearPreview();
        }

        // Buttons
        if (content.interactiveButtons) {
            this.buttons = content.interactiveButtons.map(b => {
                try {
                    const p = JSON.parse(b.buttonParamsJson);
                    const typeMap = { 'cta_url': 'url', 'cta_copy': 'copy', 'cta_call': 'call', 'quick_reply': 'reply' };
                    let type = Object.keys(typeMap).find(k => b.name === k) || 'reply';
                    type = typeMap[type] || 'reply';

                    return {
                        type: type,
                        text: p.display_text,
                        value: p.url || p.copy_code || p.phone_number || ''
                    };
                } catch (e) { return { type: 'reply', text: 'Error' }; }
            });
        } else {
            this.buttons = [];
        }
        this.renderButtonInputs();
        this.renderTemplateList(); // Update active state
    }

    async deleteTemplate(id, e) {
        e.stopPropagation();
        if (!confirm('Delete this template?')) return;

        try {
            await fetch(`${this.apiBase} /templates/${id} `, { method: 'DELETE' });
            this.templates = this.templates.filter(t => t.id !== id);
            if (this.activeTemplateId === id) this.resetForm();
            this.renderTemplateList();
        } catch (e) {
            alert('Failed to delete template');
        }
    }

    resetForm() {
        this.currentTemplateId = null;
        this.activeTemplateId = null;
        this.renderTemplateList();

        const nameInput = document.getElementById('template-name-input');
        if (nameInput) nameInput.value = '';

        document.getElementById('template-id-display').textContent = 'NEW';

        // Reset Logic
        this.setTemplateType('text');

        document.getElementById('message-body').value = '';
        document.getElementById('footer-input').value = '';

        // Media Reset
        this.setMediaSource('url');
        document.getElementById('media-url-input').value = '';
        const fileInput = document.getElementById('media-file-input');
        if (fileInput) fileInput.value = '';
        this.clearPreview();

        // Buttons Reset
        this.buttons = [];
        this.renderButtonInputs();

        const deleteBtn = document.getElementById('btn-delete-template');
        if (deleteBtn) {
            deleteBtn.style.opacity = '0';
            deleteBtn.style.pointerEvents = 'none';
        }
    }

    /* --- SUBMISSION --- */

    async preparePayload() {
        const bodyText = document.getElementById('message-body').value;
        const footerText = document.getElementById('footer-input').value;
        let mediaUrl = document.getElementById('media-url-input').value;
        const mediaTypeVal = document.getElementById('media-type-select').value;

        // Handle File Upload
        if (this.mediaSource === 'file') {
            const fileInput = document.getElementById('media-file-input');
            if (fileInput.files.length > 0) {
                const formData = new FormData();
                formData.append('file', fileInput.files[0]);
                const res = await fetch(`${this.apiBase} /messages/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    mediaUrl = data.url; // Use 'url' as returned by standard firebaseService (was 'path' in some versions, check backend!)
                    // UPDATE DOM to prevent re-upload and show specific URL
                    document.getElementById('media-url-input').value = mediaUrl;

                    // Switch mode so "Save" uses this URL naturally
                    this.setMediaSource('url');
                } else {
                    throw new Error('File upload failed');
                }
            }
        }

        const content = {};

        // Construct Content Object based on Type
        if (this.messageType === 'text') {
            return { text: bodyText }; // Backend expects 'text', not 'message'
        }

        // Interactive/Media Structure
        if (bodyText) {
            if (this.messageType.includes('media')) content.caption = bodyText;
            else content.text = bodyText;
        }

        if (this.messageType.includes('media') && mediaUrl) {
            content[mediaTypeVal] = { url: mediaUrl };
        }

        if (this.messageType.includes('button')) {
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

        return { content };
    }

    async handleSend(e) {
        if (e) e.preventDefault();
        const statusBox = document.getElementById('status-message');
        const btn = document.getElementById('btn-send-message');
        const sessionId = this.sessionSelect.value;
        let to = document.getElementById('phone-input').value;

        // 1. Validate Session & Phone
        if (!sessionId) { alert('Please select a device.'); return; }
        if (!to) { alert('Please enter a phone number.'); return; }

        // Sanitize Check
        to = to.replace(/[^0-9]/g, ''); // Remove spaces, dashes, plus
        if (to.length < 10) { alert('Invalid Phone Number. Please check.'); return; }

        statusBox.classList.add('hidden');
        btn.disabled = true;
        btn.textContent = 'Sending...';

        try {
            const payload = await this.preparePayload();
            let endpoint = '/messages/text'; // Corrected endpoint
            let body = { sessionId, to, ...payload };

            if (this.messageType !== 'text') {
                endpoint = '/messages/interactive'; // Corrected endpoint
                // preparePayload returns { content: ... } for interactive
                // body should be { sessionId, to, content: ... }
            }

            const res = await fetch(`${this.apiBase}${endpoint} `, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();

            if (data.success) {
                statusBox.textContent = '✅ Message Sent Successfully!';
                statusBox.className = 'status-box success';
            } else {
                throw new Error(data.message || 'Send failed');
            }
        } catch (err) {
            console.error(err);
            statusBox.textContent = '❌ Error: ' + err.message;
            statusBox.className = 'status-box error';
        } finally {
            statusBox.classList.remove('hidden');
            btn.disabled = false;
            btn.textContent = '🚀 Send Message';
        }
    }

    async handleSave() {
        // Get Name from Inline Input
        const nameInput = document.getElementById('template-name-input');
        const name = nameInput.value.trim();

        if (!name) {
            alert('Please enter a Template Name at the top of the editor.');
            nameInput.focus();
            nameInput.classList.add('ring-2', 'ring-red-500');
            setTimeout(() => nameInput.classList.remove('ring-2', 'ring-red-500'), 2000);
            return;
        }

        try {
            const payload = await this.preparePayload();
            // Payload structure from preparePayload: { content: { ... } } or { text: ... } 

            // Normalize content for backend
            let contentObj;
            if (this.messageType === 'text') {
                contentObj = { text: payload.text };
            } else {
                contentObj = payload.content;
            }

            const templateData = {
                name: name,
                type: this.messageType,
                content: contentObj
            };

            let method, url;
            if (this.currentTemplateId) {
                // UPDATE
                method = 'PUT';
                url = `${this.apiBase} /templates/${this.currentTemplateId} `;
            } else {
                // CREATE
                method = 'POST';
                url = `${this.apiBase}/templates`;
            }

            const res = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(templateData)
            });

            const data = await res.json();
            if (data.success) {
                alert(this.currentTemplateId ? 'Template updated successfully!' : 'Template saved successfully!');

                // Refresh list
                await this.loadTemplates();

                // If created new, select it. If updated, keep current.
                const newId = data.data.id || this.currentTemplateId;
                if (newId) {
                    // Update internal ID if it was a create
                    if (!this.currentTemplateId) this.loadTemplate(newId);
                } else {
                    this.resetForm();
                }
            } else {
                throw new Error(data.message || 'Failed to save template');
            }
        } catch (error) {
            console.error('Save Error:', error);
            alert('Error saving template: ' + error.message);
        }
    }

    async handleDelete() {
        if (!this.currentTemplateId) return;

        if (!confirm('Are you sure you want to delete this template? This cannot be undone.')) {
            return;
        }

        try {
            const res = await fetch(`${this.apiBase}/templates/${this.currentTemplateId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                await this.loadTemplates();
                this.resetForm();
            } else {
                throw new Error(data.message || 'Failed to delete');
            }
        } catch (error) {
            console.error('Delete Error:', error);
            alert('Error deleting template: ' + error.message);
        }
    }
}

new TemplateManager();

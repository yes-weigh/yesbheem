
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
            <div class="template-item ${this.activeTemplateId === t.id ? 'active' : ''}" data-id="${t.id}">
                <div class="flex justify-between items-start">
                    <h4 class="font-medium text-sm text-main">${t.name}</h4>
                    <span class="badge" style="font-size:0.65rem; background:#f1f5f9; color:#64748b;">
                        ${t.type.replace('_', ' ').toUpperCase()}
                    </span>
                </div>
                <p class="text-xs text-muted mt-1 truncate">
                    ${(t.content.text || t.content.caption || 'Media/Interactive content').substring(0, 50)}...
                </p>
                <button class="btn-icon template-delete" data-id="${t.id}">&times;</button>
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
            <div class="button-item type-${btn.type}">
                <div class="form-group mb-0">
                    <label class="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Action Type</label>
                    <select class="form-select w-full text-xs py-2" onchange="window.tmplMgr.updateButton(${index}, 'type', this.value)">
                        <option value="reply" ${btn.type === 'reply' ? 'selected' : ''}>Quick Reply</option>
                        <option value="url" ${btn.type === 'url' ? 'selected' : ''}>Open Website</option>
                        <option value="copy" ${btn.type === 'copy' ? 'selected' : ''}>Copy Text</option>
                        <option value="call" ${btn.type === 'call' ? 'selected' : ''}>Phone Call</option>
                    </select>
                </div>
                
                <div class="form-group mb-0">
                    <label class="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Button Label</label>
                    <input type="text" class="form-input text-xs py-2 w-full" placeholder="e.g. Visit Website" value="${btn.text}" oninput="window.tmplMgr.updateButton(${index}, 'text', this.value)">
                </div>

                ${!isReply ? `
                <div class="form-group mb-0">
                    <label class="text-[10px] uppercase text-gray-500 font-bold mb-1 block">Action Value</label>
                    <input type="text" class="form-input text-xs py-2 w-full" placeholder="${valuePlaceholder}" value="${btn.value || ''}" oninput="window.tmplMgr.updateButton(${index}, 'value', this.value)">
                </div>
                ` : ''}

                <div class="flex items-end h-full pb-1">
                    <button type="button" class="text-gray-400 hover:text-red-500 transition-colors p-2" onclick="window.tmplMgr.removeButton(${index})" title="Remove Button">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                    </button>
                </div>
            </div>
            `;
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

        // Save Modal
        document.getElementById('btn-save-template').addEventListener('click', () => {
            document.getElementById('save-modal').classList.remove('hidden');
        });
        document.getElementById('close-save-modal').addEventListener('click', () => {
            document.getElementById('save-modal').classList.add('hidden');
        });
        document.getElementById('btn-confirm-save').addEventListener('click', () => this.handleSave());

        // Form Submit
        this.form.addEventListener('submit', (e) => this.handleSend(e));

        // Expose helper to window for dynamic HTML calls
        window.tmplMgr = this;
    }

    setMessageType(type) {
        this.messageType = type;

        // UI Updates
        this.typeButtons.forEach(b => b.classList.toggle('active', b.dataset.type === type));

        const showMedia = type.includes('media');
        const showButtons = type.includes('button');

        document.getElementById('media-section').classList.toggle('hidden', !showMedia);
        document.getElementById('buttons-section').classList.toggle('hidden', !showButtons);
        document.getElementById('footer-section').classList.toggle('hidden', !showButtons);

        document.getElementById('body-label').textContent = showMedia ? 'Caption' : 'Message Body';
    }

    setMediaSource(source) {
        this.mediaSource = source;
        this.mediaToggle.forEach(b => b.classList.toggle('active', b.dataset.source === source));

        const isFile = source === 'file';
        document.getElementById('media-url-input').classList.toggle('hidden', isFile);
        document.getElementById('media-file-label').classList.toggle('hidden', !isFile);
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
        this.activeTemplateId = null;
        document.getElementById('editor-title').textContent = 'Compose Message';
        document.getElementById('active-template-badge').classList.add('hidden');

        this.setMessageType('text');
        this.setMediaSource('url');
        this.buttons = [];
        this.renderButtonInputs();

        // Clear inputs
        this.form.reset();
        // Reset specific hidden inputs that form.reset() might miss if not carefully managed
        document.getElementById('media-type-select').value = 'image';

        // Use default session if available
        if (this.sessions.length > 0) {
            this.sessionSelect.value = this.sessions[0].id;
        }
    }

    loadTemplate(id) {
        const t = this.templates.find(tmpl => tmpl.id === id);
        if (!t) return;

        this.activeTemplateId = id;
        document.getElementById('editor-title').textContent = 'Edit Template';
        const badge = document.getElementById('active-template-badge');
        badge.textContent = t.name;
        badge.classList.remove('hidden');

        // Apply content
        this.setMessageType(t.type);
        const content = t.content;

        document.getElementById('message-body').value = content.text || content.caption || '';
        document.getElementById('footer-input').value = content.footer || '';

        // Media
        if (content.image || content.video) {
            document.getElementById('media-type-select').value = content.image ? 'image' : 'video';
            const url = (content.image || content.video).url;
            document.getElementById('media-url-input').value = url;
            this.setMediaSource('url'); // Always valid for loaded templates
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
            await fetch(`${this.apiBase}/templates/${id}`, { method: 'DELETE' });
            this.templates = this.templates.filter(t => t.id !== id);
            if (this.activeTemplateId === id) this.resetForm();
            this.renderTemplateList();
        } catch (e) {
            alert('Failed to delete template');
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
                const res = await fetch(`${this.apiBase}/messages/upload`, { method: 'POST', body: formData });
                const data = await res.json();
                if (data.success) {
                    mediaUrl = data.path; // Or data.url depending on backend
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
        e.preventDefault();
        const statusBox = document.getElementById('status-message');
        const btn = document.getElementById('btn-send');
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

            const res = await fetch(`${this.apiBase}${endpoint}`, {
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
        const name = document.getElementById('save-template-name').value;
        if (!name) return;

        try {
            const payload = await this.preparePayload(); // Get content
            const body = {
                name,
                type: this.messageType,
                content: payload.content || (payload.message ? { text: payload.message } : {}) // Normalize text type
            };

            const res = await fetch(`${this.apiBase}/templates`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            if (res.ok) {
                document.getElementById('save-modal').classList.add('hidden');
                document.getElementById('save-template-name').value = '';
                this.loadTemplates();
                alert('Template Saved!');
            } else {
                throw new Error('Save failed');
            }
        } catch (e) {
            alert('Error saving template: ' + e.message);
        }
    }
}

new TemplateManager();

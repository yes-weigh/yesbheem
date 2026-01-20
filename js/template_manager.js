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
            const [sessions, templates] = await Promise.all([
                this.service.getSessions(),
                this.service.getTemplates()
            ]);

            this.renderSessions(sessions);
            this.templates = templates;
            this.renderer.renderTemplateList(this.templates, this.activeTemplateId);

        } catch (e) {
            console.error('Init failed', e);
        }
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
        document.getElementById('template-id-display').textContent = id;
        document.getElementById('template-name-input').value = template.name;

        // Delete Button Logic
        const delBtn = document.getElementById('btn-delete-template');
        if (delBtn) {
            delBtn.style.opacity = 1;
            delBtn.style.pointerEvents = 'auto';
            delBtn.onclick = () => this.deleteTemplate(id);
        }

        // Parse Content
        const content = template.content || {};
        document.getElementById('message-body').value = content.text || content.caption || '';
        document.getElementById('footer-input').value = content.footer || '';
        document.getElementById('footer-input-container').classList.toggle('hidden', !content.footer);

        // Media
        let mediaUrl = '';
        let mediaType = 'image';
        if (content.image) { mediaUrl = content.image.url; mediaType = 'image'; }
        if (content.video) { mediaUrl = content.video.url; mediaType = 'video'; }

        document.getElementById('media-url-input').value = mediaUrl;
        document.getElementById('media-type-select').value = mediaType;
        document.getElementById('media-input-section').classList.toggle('hidden', !!mediaUrl === false);

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
            document.getElementById('buttons-input-section').classList.remove('hidden');
        }

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
        this.renderer.renderLivePreview({
            text: document.getElementById('message-body').value,
            footer: document.getElementById('footer-input').value,
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
            text: document.getElementById('text-input-section'),
            media: document.getElementById('media-input-section'),
            buttons: document.getElementById('buttons-input-section'),
            footer: document.getElementById('footer-input-container')
        };
        const tabs = {
            text: document.getElementById('btn-trigger-text'),
            media: document.getElementById('btn-trigger-media'),
            buttons: document.getElementById('btn-trigger-buttons'),
            footer: document.getElementById('btn-trigger-footer')
        };

        // Hide all inputs
        Object.values(els).forEach(el => el && el.classList.add('hidden'));
        document.querySelectorAll('.action-pill').forEach(b => b.classList.remove('active'));

        // Show active input
        if (els[section]) els[section].classList.remove('hidden');
        if (tabs[section]) tabs[section].classList.add('active');

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

    /* --- BUTTON MANAGEMENT --- */

    addButton() {
        if (this.buttons.length < 3) {
            this.buttons.push({ type: 'reply', text: 'Reply' });
            this.updateUI();
        }
    }

    removeButton(index) {
        this.buttons.splice(index, 1);
        this.updateUI();
    }

    updateButton(index, key, value) {
        this.buttons[index][key] = value;
        // Only re-render INPUTS if the TYPE changes (structure change)
        if (key === 'type') {
            this.updateUI();
        } else {
            // For text/value updates, only update the PREVIEW
            this.renderer.renderLivePreview({
                text: document.getElementById('message-body').value,
                footer: document.getElementById('footer-input').value,
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
        // Inputs -> Live Preview
        ['message-body', 'footer-input', 'media-url-input', 'media-type-select'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateUI());
        });

        // Auto-resize Textarea
        const ta = document.getElementById('message-body');
        const resizeTa = () => {
            ta.style.height = 'auto';
            ta.style.height = (ta.scrollHeight) + 'px';
        };
        ta.addEventListener('input', resizeTa);
        // Initial resize/resize on load
        new ResizeObserver(resizeTa).observe(ta);

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

        // Media Toggle Source
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                const src = e.target.dataset.source;
                document.getElementById('media-url-input').classList.toggle('hidden', src === 'file');
                document.getElementById('media-file-input').classList.toggle('hidden', src !== 'file');
            });
        });

        // Buttons
        document.getElementById('btn-add-button').addEventListener('click', () => this.addButton());

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
            const res = await this.service.saveTemplate({
                id: this.activeTemplateId,
                name: name,
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
        const bodyText = document.getElementById('message-body').value;
        const footerText = document.getElementById('footer-input').value;
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
        document.getElementById('template-id-display').textContent = 'NEW';
        document.getElementById('template-name-input').value = '';
        document.getElementById('message-body').value = '';
        document.getElementById('footer-input').value = '';
        document.getElementById('media-url-input').value = '';
        this.buttons = [];
        this.updateUI(); // Resets view
        this.focusSection('text'); // Resets focus to text (hides other placeholders)
    }
}

// Start
new TemplateManager();

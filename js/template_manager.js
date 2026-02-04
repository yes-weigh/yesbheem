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

        // Components
        this.mediaSelector = new window.MediaSelector();

        // State
        this.templates = [];
        this.activeTemplateId = null;
        this.buttons = [];
        this.currentSection = 'text'; // Track active section
        this.viewMode = localStorage.getItem('templateViewMode') || 'list'; // Default to list

        // UI Refs
        this.sessionSelect = document.getElementById('session-select');
        this.listContainer = document.getElementById('template-list-container');
        this.editorContainer = document.getElementById('template-editor-container');
        this.controlsBar = document.getElementById('template-controls');

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.setupViewToggle();

        try {
            const [sessions, templates, settings] = await Promise.all([
                this.service.getSessions(),
                this.service.getTemplates(),
                this.loadSettings()
            ]);

            this.renderSessions(sessions);
            this.templates = templates;
            // Initial Render: List View
            this.renderList();

            // Update dashboard stats
            this.updateDashboardStats();

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

    /* --- DASHBOARD STATS --- */

    updateDashboardStats() {
        // Delegate to main render function
        this.renderLanguageStats();
    }

    renderLanguageStats() {
        const container = document.getElementById('language-stats-container');
        if (!container) return;

        const templates = this.templates || [];

        // 1. Build Total Card (First Position)
        const totalCount = templates.length;
        const totalCardHtml = `
            <div class="stat-card stat-total">
                <div class="stat-number">${totalCount}</div>
                <div class="stat-label">TOTAL</div>
            </div>
        `;

        // 2. Build Language Cards
        let langCardsHtml = '';
        if (this.languages && this.languages.length > 0) {
            langCardsHtml = this.languages.map(lang => {
                const count = templates.filter(t =>
                    t.language?.toLowerCase() === lang.toLowerCase()
                ).length;

                return `
            <div class="stat-card stat-language">
                <div class="stat-number">${count}</div>
                <div class="stat-label">${this.escapeHtml(lang).toUpperCase()}</div>
            </div>`;
            }).join('');
        }

        // Render all
        container.innerHTML = totalCardHtml + langCardsHtml;
    }

    /* --- VIEW & NAVIGATION --- */

    setupViewToggle() {
        const toggles = document.querySelectorAll('.view-btn');
        toggles.forEach(btn => {
            if (btn.dataset.view === this.viewMode) btn.classList.add('active');
            else btn.classList.remove('active');

            btn.addEventListener('click', () => {
                this.viewMode = btn.dataset.view;
                localStorage.setItem('templateViewMode', this.viewMode);

                // Update buttons
                toggles.forEach(b => b.classList.toggle('active', b.dataset.view === this.viewMode));

                this.renderList();
            });
        });
    }

    showDashboard() {
        this.activeTemplateId = null;
        this.editorContainer.classList.add('hidden');
        this.listContainer.classList.remove('hidden');
        this.controlsBar.classList.remove('hidden'); // Show controls
        this.renderList();
    }

    openEditor(id) {
        this.activeTemplateId = id;
        this.controlsBar.classList.add('hidden'); // Hide controls
        this.listContainer.classList.add('hidden');
        this.editorContainer.classList.remove('hidden');

        if (id === 'NEW') {
            this.resetForm();
        } else {
            this.loadTemplate(id);
        }
    }

    /* --- RENDERING --- */

    renderList() {
        if (!this.listContainer) return;

        const templates = this.filterTemplates(); // Implement filtering if needed, currently just returns all
        // Create base classes if missing (safely)
        this.listContainer.classList.add('template-list-container');
        // Remove old view classes
        this.listContainer.classList.remove('list-view', 'card-view', 'detailed-view');
        // Add current view class
        this.listContainer.classList.add(`${this.viewMode}-view`);

        if (templates.length === 0) {
            this.listContainer.innerHTML = '<div class="empty-state"><p class="text-muted">No templates found. Create a new one!</p></div>';
            return;
        }

        if (this.viewMode === 'list') {
            this.renderListView(templates);
        } else if (this.viewMode === 'detailed') {
            this.renderDetailedView(templates);
        } else {
            this.renderCardView(templates);
        }
    }



    renderCardView(templates) {
        this.listContainer.innerHTML = templates.map(t => {
            const media = this.getMediaUrl(t);
            return `
            <div class="template-card" onclick="window.tmplMgr.openEditor('${t.id}')">
                <div style="display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 0.75rem;">
                    ${media ? `
                        <div style="width: 60px; height: 60px; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.3); flex-shrink: 0; border: 1px solid rgba(255,255,255,0.05);">
                            ${media.type === 'image' ?
                        `<img src="${media.url}" alt="Media" style="width: 100%; height: 100%; object-fit: cover;" />` :
                        `<video src="${media.url}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>`
                    }
                        </div>
                    ` : ''}
                    
                    <div style="flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 0.5rem;">
                        <div class="template-card-title" style="word-break: break-word; line-height: 1.3;">${this.escapeHtml(t.name)}</div>
                        <div class="template-card-badges" style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            ${t.language ? `<span class="badge badge-lang">${t.language}</span>` : ''}
                            ${t.category ? `<span class="badge badge-cat">${t.category}</span>` : ''}
                        </div>
                    </div>
                </div>
                
                <div class="template-card-preview" style="display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 1rem;">
                    ${this.getPreviewText(t)}
                </div>

                <div style="display: flex; justify-content: flex-end; gap: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem; margin-top: auto;">
                     <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.handleClone('${t.id}')" title="Clone">
                        📄
                    </button>
                     <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.deleteTemplate('${t.id}')" title="Delete">
                        🗑️
                    </button>
                </div>
            </div>
            `;
        }).join('');
    }


    renderListView(templates) {
        const renderHeader = (field, label) => {
            const isActiv = this.sortField === field;
            const icon = isActiv ? (this.sortDirection === 'asc' ? '▲' : '▼') : '';
            return `<th class="sortable-header" onclick="window.tmplMgr.handleSort('${field}')" style="cursor:pointer; user-select:none;">
                ${label} <span style="font-size:0.8em; margin-left:4px;">${icon}</span>
            </th>`;
        };

        this.listContainer.innerHTML = `
            <table class="template-table">
                <thead>
                    <tr>
                        <th style="width: 50px;"></th>
                        ${renderHeader('name', 'Name')}
                        ${renderHeader('category', 'Category')}
                        ${renderHeader('language', 'Language')}
                        <th>Preview</th>
                        <th style="width: 50px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${templates.map(t => {
            const media = this.getMediaUrl(t);
            return `
                         <tr onclick="window.tmplMgr.openEditor('${t.id}')">
                            <td style="padding: 0.5rem;">
                                ${media ? `
                                    <div style="width: 40px; height: 40px; border-radius: 6px; overflow: hidden; background: rgba(0,0,0,0.3);">
                                        ${media.type === 'image' ?
                        `<img src="${media.url}" alt="Media" style="width: 100%; height: 100%; object-fit: cover;" />` :
                        `<video src="${media.url}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>`
                    }
                                    </div>
                                ` : ''}
                            </td>
                            <td class="font-bold">${this.escapeHtml(t.name)}</td>
                            <td>${t.category ? `<span class="badge badge-cat">${t.category}</span>` : '-'}</td>
                            <td>${t.language ? `<span class="badge badge-lang">${t.language}</span>` : '-'}</td>
                            <td class="text-muted text-sm" style="max-width: 300px;">
                                <div class="text-truncate-2">${this.getPreviewText(t)}</div>
                            </td>
                            <td>
                                <div style="display:flex; gap:0.25rem;">

                                     <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.handleClone('${t.id}')" title="Clone">
                                        📄
                                    </button>
                                    <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.deleteTemplate('${t.id}')" title="Delete">
                                        🗑️
                                    </button>
                                </div>
                            </td>
                        </tr>
                        `;
        }).join('')}
                </tbody>
            </table >
            `;
    }

    handleSort(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'asc';
        }
        this.renderList();
    }

    filterTemplates() {
        const searchText = document.getElementById('search-templates').value.toLowerCase();
        const langFilter = document.getElementById('filter-language').value;
        const catFilter = document.getElementById('filter-category').value;

        let filtered = this.templates.filter(t => {
            const matchesSearch = t.name.toLowerCase().includes(searchText) ||
                t.id.toLowerCase().includes(searchText) ||
                (t.content && t.content.text && t.content.text.toLowerCase().includes(searchText));

            const matchesLang = !langFilter || t.language === langFilter;
            const matchesCat = !catFilter || t.category === catFilter;

            return matchesSearch && matchesLang && matchesCat;
        });

        // Sorting
        if (this.sortField) {
            filtered.sort((a, b) => {
                const valA = String(a[this.sortField] || '').toLowerCase();
                const valB = String(b[this.sortField] || '').toLowerCase();
                if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
                if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return filtered;
    }

    renderDetailedView(templates) {
        this.listContainer.innerHTML = templates.map(t => {
            const media = this.getMediaUrl(t);
            return `
            <div class="template-card" onclick="window.tmplMgr.openEditor('${t.id}')" style="flex-direction: column; gap: 1rem; max-width: 400px; margin: 0 auto;">
                 <!-- Top: Name and Actions -->
                 <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                     <div class="template-card-title" style="font-size: 1.1rem; word-break: break-word;">${this.escapeHtml(t.name)}</div>
                     <div style="display:flex; gap:0.25rem; flex-shrink: 0;">
                          <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.handleClone('${t.id}')" title="Clone">
                             📄
                         </button>
                          <button class="action-btn-icon" onclick="event.stopPropagation(); window.tmplMgr.deleteTemplate('${t.id}')" title="Delete">
                             🗑️
                         </button>
                     </div>
                 </div>
                 
                 <!-- Middle: Media (Full Width) -->
                 ${media ? `
                 <div style="width: 100%;">
                    <div style="width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05);">
                        ${media.type === 'image' ?
                        `<img src="${media.url}" alt="Template media" style="width: 100%; height: 100%; object-fit: cover;" />` :
                        `<video src="${media.url}" style="width: 100%; height: 100%; object-fit: cover;" muted></video>`
                    }
                    </div>
                 </div>
                 ` : ''}

                 <!-- Text Content (Under Media) -->
                 <div style="width: 100%;">
                    <div class="template-card-preview" style="-webkit-line-clamp: 6; display: -webkit-box; -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 0;">
                        ${this.getPreviewText(t)}
                    </div>
                 </div>
                 
                 <!-- Bottom: Badges -->
                 <div class="template-card-badges" style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: auto;">
                     ${t.language ? `<span class="badge badge-lang">${t.language}</span>` : ''}
                     ${t.category ? `<span class="badge badge-cat">${t.category}</span>` : ''}
                 </div>
            </div>
            `;
        }).join('');
    }

    getPreviewText(t) {
        if (t.content && t.content.text) return this.escapeHtml(t.content.text);
        if (t.content && t.content.caption) return '📷 ' + this.escapeHtml(t.content.caption);
        if (t.content && t.content.body) return this.escapeHtml(t.content.body); // WhatsApp API format sometimes
        return 'No text content';
    }

    getMediaUrl(t) {
        if (!t.content) return null;
        if (t.content.image && t.content.image.url) return { url: t.content.image.url, type: 'image' };
        if (t.content.video && t.content.video.url) return { url: t.content.video.url, type: 'video' };
        return null;
    }

    /* --- OLD METHODS ADAPTED --- */

    /* --- OLD METHODS ADAPTED --- */

    /* renderSessions moved to DATA section */

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
        // Store languages for dashboard stats
        this.languages = languages || [];

        // Populate editor dropdown
        const select = document.getElementById('template-language-select');
        if (select) {
            select.innerHTML = '<option value="">Select Language</option>' +
                languages.map(lang => `<option value="${this.escapeHtml(lang)}">${this.escapeHtml(lang)}</option>`).join('');
        }

        // Populate filter dropdown on main page
        const filterSelect = document.getElementById('filter-language');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">All Languages</option>' +
                languages.map(lang => `<option value="${this.escapeHtml(lang)}">${this.escapeHtml(lang)}</option>`).join('');
        }

        // Update dashboard stats with new languages
        this.updateDashboardStats();
    }

    populateCategories(categories) {
        // Populate editor dropdown
        const select = document.getElementById('template-category-select');
        if (select) {
            select.innerHTML = '<option value="">Select Category</option>' +
                categories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('');
        }

        // Populate filter dropdown on main page
        const filterSelect = document.getElementById('filter-category');
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="">All Categories</option>' +
                categories.map(cat => `<option value="${this.escapeHtml(cat)}">${this.escapeHtml(cat)}</option>`).join('');
        }
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
        if (!this.sessionSelect) return;

        if (sessions.length === 0) {
            this.sessionSelect.innerHTML = '<option value="">No connected devices</option>';
        } else {
            this.sessionSelect.innerHTML = sessions.map(s =>
                `<option value="${s.id}">${s.name || 'Device'} (${s.phoneNumber || 'Unknown'})</option>`
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
                if (b.name === 'cta_url') {
                    // Check if it's a wa.me link (chat button)
                    const url = params.url || '';
                    if (url.includes('wa.me/')) {
                        type = 'chat';
                        // Parse wa.me URL to extract phone and text
                        const urlObj = new URL(url);
                        const phone = urlObj.pathname.replace('/', '');
                        const text = urlObj.searchParams.get('text') || '';
                        val = `${phone}|${text}`;
                    } else {
                        type = 'url';
                        val = url;
                    }
                }
                if (b.name === 'cta_call') { type = 'call'; val = params.phone_number; }
                if (b.name === 'cta_copy') { type = 'copy'; val = params.copy_code; }
                return {
                    type,
                    text: params.display_text,
                    value: val,
                    dynamicKam: params.dynamicKam || false
                };
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
            this.showDashboard(); // Return to list after delete
        } catch (e) { alert('Failed to delete'); }
    }



    async handleClone(id) {
        const t = this.templates.find(temp => temp.id === id);
        if (!t) return;

        // Open editor in "clone mode" - NEW template with cloned content
        this.openEditor('NEW');

        // Wait for editor to be ready
        await new Promise(resolve => setTimeout(resolve, 100));

        // Populate with cloned content
        const content = t.content || {};

        // Set metadata (but leave name empty)
        document.getElementById('template-name-input').value = '';
        document.getElementById('template-name-input').placeholder = `Copy of ${t.name}`;

        const languageSelect = document.getElementById('template-language-select');
        const categorySelect = document.getElementById('template-category-select');
        if (languageSelect) languageSelect.value = t.language || '';
        if (categorySelect) categorySelect.value = t.category || '';

        // Populate text content
        const textPreview = document.getElementById('wa-text-preview');
        const footerPreview = document.getElementById('wa-footer-preview');

        if (textPreview) textPreview.innerText = content.text || content.caption || '';
        if (footerPreview) {
            footerPreview.innerText = content.footer || '';
            if (content.footer) footerPreview.classList.remove('hidden');
        }

        // Populate media
        let mediaUrl = '';
        let mediaType = 'none';
        if (content.image) { mediaUrl = content.image.url; mediaType = 'image'; }
        if (content.video) { mediaUrl = content.video.url; mediaType = 'video'; }

        document.getElementById('media-url-input').value = mediaUrl;
        document.getElementById('media-type-select').value = mediaType;

        // Populate buttons
        this.buttons = [];
        if (content.interactiveButtons) {
            this.buttons = content.interactiveButtons.map(b => {
                const params = JSON.parse(b.buttonParamsJson);
                let type = 'reply';
                let val = '';
                if (b.name === 'cta_url') {
                    // Check if it's a wa.me link (chat button)
                    const url = params.url || '';
                    if (url.includes('wa.me/')) {
                        type = 'chat';
                        // Parse wa.me URL to extract phone and text
                        const urlObj = new URL(url);
                        const phone = urlObj.pathname.replace('/', '');
                        const text = urlObj.searchParams.get('text') || '';
                        val = `${phone}|${text}`;
                    } else {
                        type = 'url';
                        val = url;
                    }
                }
                if (b.name === 'cta_call') { type = 'call'; val = params.phone_number; }
                if (b.name === 'cta_copy') { type = 'copy'; val = params.copy_code; }
                return {
                    type,
                    text: params.display_text,
                    value: val,
                    dynamicKam: params.dynamicKam || false
                };
            });
        }

        this.renderButtonsInline();
        this.updateUI();

        // Focus on name input
        document.getElementById('template-name-input').focus();
    }

    async refreshTemplates() {
        this.templates = await this.service.getTemplates();
        this.updateDashboardStats(); // Update dashboard stats
        if (this.activeTemplateId) {
            // If editing, maybe just update internal state or do nothing?
            // For now, if we are in editor, we don't strictly need to re-render the list immediately unless we go back.
        } else {
            this.renderList();
        }
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

        // Footer Visibility Logic: Show if buttons exist or footer has content
        const footerEl = document.getElementById('wa-footer-preview');
        if (footerEl) {
            const hasContent = footerEl.innerText && footerEl.innerText.trim().length > 0;
            if (this.buttons.length > 0 || hasContent) {
                footerEl.classList.remove('hidden');
            } else {
                footerEl.classList.add('hidden');
            }
        }

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
        const btnType = button ? button.type : 'reply';
        document.getElementById('btn-type-input').value = btnType;
        document.getElementById('btn-text-input').value = button ? button.text : '';

        // Clear all value fields first
        document.getElementById('btn-value-input').value = '';
        const chatPhoneInput = document.getElementById('btn-chat-phone-input');
        const chatMessageInput = document.getElementById('btn-chat-message-input');
        if (chatPhoneInput) chatPhoneInput.value = '';
        if (chatMessageInput) chatMessageInput.value = '';

        // Handle chat button separately
        if (btnType === 'chat' && button) {
            const parts = (button.value || '').split('|');
            const phone = parts[0] || '';
            const message = parts[1] || '';

            if (chatPhoneInput) chatPhoneInput.value = phone;
            if (chatMessageInput) chatMessageInput.value = message;
        } else if (button) {
            document.getElementById('btn-value-input').value = button.value || '';
        }

        // Show/hide value input based on type
        this.updateButtonValueInput(btnType);

        // Show form, hide add button
        form.classList.remove('hidden');
        if (addBtn) addBtn.classList.add('hidden');

        // Toggle Delete Button
        const deleteBtn = document.getElementById('btn-delete-button');
        if (deleteBtn) {
            if (button) deleteBtn.classList.remove('hidden');
            else deleteBtn.classList.add('hidden');
        }

        // Dynamic KAM Logic - Set checkbox state WITHOUT triggering change event yet
        const dynamicKamCb = document.getElementById('btn-dynamic-kam');
        if (dynamicKamCb) {
            const isKam = button ? !!button.dynamicKam : false;
            dynamicKamCb.checked = isKam;

            // Manually update the input state based on KAM status
            if (isKam) {
                if (btnType === 'chat') {
                    if (chatPhoneInput) {
                        chatPhoneInput.disabled = true;
                        chatPhoneInput.value = 'KAM Phone Number';
                        chatPhoneInput.classList.add('disabled-input');
                    }
                    // Keep the message value intact - don't overwrite it
                } else if (btnType === 'call') {
                    const valueInput = document.getElementById('btn-value-input');
                    if (valueInput) {
                        valueInput.disabled = true;
                        valueInput.value = 'KAM Phone Number';
                        valueInput.classList.add('disabled-input');
                    }
                }
            }
        }
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
        const chatPhoneInput = document.getElementById('btn-chat-phone-input');
        const chatMessageInput = document.getElementById('btn-chat-message-input');
        const dynamicKamWrapper = document.getElementById('btn-dynamic-kam-wrapper');
        const dynamicKamCb = document.getElementById('btn-dynamic-kam');

        // Hide all inputs first
        valueInput.classList.add('hidden');
        if (chatPhoneInput) chatPhoneInput.classList.add('hidden');
        if (chatMessageInput) chatMessageInput.classList.add('hidden');
        if (dynamicKamWrapper) dynamicKamWrapper.classList.add('hidden');

        if (type === 'reply') {
            // Nothing to show for reply
        } else if (type === 'chat') {
            // Show chat-specific fields
            if (chatPhoneInput) chatPhoneInput.classList.remove('hidden');
            if (chatMessageInput) chatMessageInput.classList.remove('hidden');
            // Show KAM option for chat buttons too
            if (dynamicKamWrapper) dynamicKamWrapper.classList.remove('hidden');
        } else {
            // Show standard value input for other types
            valueInput.classList.remove('hidden');

            // Show Dynamic KAM option only for 'call'
            if (dynamicKamWrapper) {
                if (type === 'call') {
                    dynamicKamWrapper.classList.remove('hidden');
                } else {
                    if (dynamicKamCb) {
                        dynamicKamCb.checked = false;
                        valueInput.disabled = false;
                    }
                }
            }

            if (type === 'url') valueInput.placeholder = 'https://example.com';
            else if (type === 'call') valueInput.placeholder = '+919876543210';
            else if (type === 'copy') valueInput.placeholder = 'Promo Code';
        }
    }

    confirmButton() {
        const type = document.getElementById('btn-type-input').value;
        const text = document.getElementById('btn-text-input').value;
        let value = '';

        if (!text) {
            alert('Button label is required');
            return;
        }

        const dynamicKamCb = document.getElementById('btn-dynamic-kam');
        const isDynamicKam = dynamicKamCb && dynamicKamCb.checked && (type === 'call' || type === 'chat');

        // Get value based on type
        if (type === 'chat') {
            const phone = document.getElementById('btn-chat-phone-input').value.trim();
            const message = document.getElementById('btn-chat-message-input').value.trim();

            if (!isDynamicKam && !phone) {
                alert('Phone number is required for chat button');
                return;
            }

            value = `${isDynamicKam ? '{{KAM_PHONE}}' : phone}|${message}`;
        } else if (type !== 'reply') {
            value = document.getElementById('btn-value-input').value;

            if (!isDynamicKam && !value) {
                alert('Value is required for this button type');
                return;
            }
        }

        const buttonData = {
            type,
            text,
            value: type === 'reply' ? '' : value,  // Use the value as-is, it's already formatted correctly
            dynamicKam: isDynamicKam
        };

        if (this.editingButtonIndex !== null && this.editingButtonIndex < this.buttons.length) {
            // Edit existing
            this.buttons[this.editingButtonIndex] = buttonData;
        } else {
            // Add new
            this.buttons.push(buttonData);
        }

        this.hideButtonEditForm();
        this.renderButtonsInline();
        this.updateUI();
    }

    editButtonInline(index) {
        this.editingButtonIndex = index;
        this.showButtonEditForm(this.buttons[index]);
    }

    removeButton(index) {
        this.buttons.splice(index, 1);
        this.renderButtonsInline();
        this.updateUI();
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
            if (btn.type === 'chat') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>';
            if (btn.type === 'reply') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>';
            if (btn.type === 'copy') icon = '<svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>';

            btnEl.innerHTML = `
                <div class="wa-button-content">
                    <span>${icon}</span>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        <span>${this.escapeHtml(btn.text) || 'Button'}</span>
                        ${btn.dynamicKam ? '<span style="font-size:0.6rem; color:var(--primary); opacity:0.8;">(Dynamic: KAM Phone)</span>' : ''}
                    </div>
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
            // For text/value updates, only update the PREVIEW (Media/Buttons part)
            this.renderer.renderLivePreview({
                // text: document.getElementById('message-body').value,
                // footer: document.getElementById('footer-input').value,
                mediaUrl: document.getElementById('media-url-input').value,
                mediaType: document.getElementById('media-type-select').value,
                buttons: this.buttons
            });
            // Ensure placeholders state is consistent without re-rendering
            this.updatePreviewPlaceholders();
        }
    }



    /* --- EVENTS --- */

    setupEventListeners() {
        // NAV: New Message
        document.getElementById('btn-new-template').addEventListener('click', () => this.openEditor('NEW'));

        // NAV: Back to List
        const backBtn = document.getElementById('btn-back-to-list');
        if (backBtn) backBtn.addEventListener('click', () => this.showDashboard());

        // Translation Button
        const translateBtn = document.getElementById('btn-translate-editor');
        if (translateBtn) {
            translateBtn.onclick = () => this.translateEditorContent();
        }

        // SEARCH & FILTERS
        const searchInput = document.getElementById('search-templates');
        const langSelect = document.getElementById('filter-language');
        const catSelect = document.getElementById('filter-category');

        if (searchInput) searchInput.addEventListener('input', () => this.renderList());
        if (langSelect) langSelect.addEventListener('change', () => this.renderList());
        if (catSelect) catSelect.addEventListener('change', () => this.renderList());

        // Inputs -> Live Preview (Media/Buttons only now)
        ['media-url-input', 'media-type-select'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.updateUI());
        });

        // Media Placeholder Click - Focus URL Input (Controls are always visible now)
        const mediaPlaceholder = document.getElementById('wa-media-placeholder');
        if (mediaPlaceholder) {
            mediaPlaceholder.addEventListener('click', () => {
                const urlInput = document.getElementById('media-url-input');
                if (urlInput) urlInput.focus();
            });
        }

        // Inline Text Listeners (Optional: logic if distinct actions needed on input)
        // document.getElementById('wa-text-preview').addEventListener('input', () => { ... });

        // Auto-resize Textarea (Removed)

        // Media Library
        const libBtn = document.getElementById('btn-open-media-library');
        if (libBtn) {
            libBtn.addEventListener('click', () => {
                const currentType = document.getElementById('media-type-select').value;
                this.mediaSelector.open(
                    currentType === 'none' ? null : currentType,
                    (mediaItem) => {
                        document.getElementById('media-url-input').value = mediaItem.url;

                        // Auto-update type
                        const typeSelect = document.getElementById('media-type-select');
                        if (mediaItem.type === 'video' || (mediaItem.mimeType && mediaItem.mimeType.startsWith('video'))) {
                            typeSelect.value = 'video';
                        } else {
                            typeSelect.value = 'image';
                        }

                        this.updateUI();
                    }
                );
            });
        }
        // Inline Button Controls
        const addButtonBtn = document.getElementById('wa-button-add');
        if (addButtonBtn) {
            addButtonBtn.querySelector('button').addEventListener('click', () => this.addButtonInline());
        }

        const confirmBtn = document.getElementById('btn-confirm');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => this.confirmButton());
        }

        const deleteBtn = document.getElementById('btn-delete-button');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                if (this.editingButtonIndex !== null && confirm('Delete this button?')) {
                    this.removeButton(this.editingButtonIndex);
                    this.hideButtonEditForm();
                }
            });
        }

        // Dynamic KAM Checkbox Listener
        const dynamicKamCb = document.getElementById('btn-dynamic-kam');
        if (dynamicKamCb) {
            dynamicKamCb.addEventListener('change', (e) => {
                const btnType = document.getElementById('btn-type-input').value;
                const valueInput = document.getElementById('btn-value-input');
                const chatPhoneInput = document.getElementById('btn-chat-phone-input');

                if (btnType === 'call' && valueInput) {
                    valueInput.disabled = e.target.checked;
                    if (e.target.checked) {
                        valueInput.value = 'KAM Phone Number';
                        valueInput.classList.add('disabled-input');
                    } else {
                        valueInput.value = '';
                        valueInput.classList.remove('disabled-input');
                    }
                } else if (btnType === 'chat' && chatPhoneInput) {
                    chatPhoneInput.disabled = e.target.checked;
                    if (e.target.checked) {
                        chatPhoneInput.value = 'KAM Phone Number';
                        chatPhoneInput.classList.add('disabled-input');
                    } else {
                        chatPhoneInput.value = '';
                        chatPhoneInput.classList.remove('disabled-input');
                    }
                }
            });
        }

        const btnTypeInput = document.getElementById('btn-type-input');
        if (btnTypeInput) {
            btnTypeInput.addEventListener('change', (e) => this.updateButtonValueInput(e.target.value));
        }

        // Actions
        // New Message button handled at top of method now

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
                if (b.type === 'chat') {
                    // Parse phone|text format and create wa.me URL
                    const parts = b.value.split('|');
                    const phone = parts[0] || '';
                    const text = parts[1] || '';
                    const waUrl = `https://wa.me/${phone}${text ? '?text=' + encodeURIComponent(text) : ''}`;
                    name = 'cta_url';
                    params.url = params.merchant_url = waUrl;
                }
                if (b.type === 'copy') { name = 'cta_copy'; params.copy_code = b.value; }
                if (b.type === 'call') { name = 'cta_call'; params.phone_number = b.value; }
                if (b.type === 'reply') { params.id = 'btn_' + Math.random().toString(36).substr(2, 9); }
                // Preserve dynamicKam flag for call buttons
                if (b.dynamicKam) params.dynamicKam = true;
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

    async translateEditorContent() {
        const editor = document.getElementById('wa-text-preview');

        if (!editor) return;

        const currentText = editor.innerText.trim();
        if (!currentText) return alert('Please enter some text to translate.');

        // Simple language selection
        const languages = [
            'ta (Tamil)', 'kn (Kannada)', 'ml (Malayalam)',
            'hi (Hindi)', 'te (Telugu)', 'mr (Marathi)',
            'gu (Gujarati)', 'bn (Bengali)', 'pa (Punjabi)'
        ];

        const langCode = prompt(`Translate to which language?\n(Enter code e.g. 'ta', 'hi')\n\n${languages.join('\n')}`, 'ta');
        if (!langCode) return;

        try {
            // UI Feedback
            const btn = document.getElementById('btn-translate-editor');
            const originalBtnText = btn ? btn.innerText : '🌍 Translate';

            if (btn) btn.innerText = '⏳ Translating...';
            editor.style.opacity = '0.5';

            // Call Service
            const translatedText = await this.service.translateText(currentText, langCode.trim().toLowerCase());

            // Update Editor
            editor.innerText = translatedText;

            // Update Language Dropdown if exists
            const langSelect = document.getElementById('template-language-select');
            if (langSelect) {
                // Check if option exists, if not add it temp? Or just set value
                // For now, just set value if it matches known options
                langSelect.value = langCode.trim().toLowerCase();
            }

        } catch (e) {
            console.error(e);
            alert('Translation failed: ' + e.message);
        } finally {
            // Restore UI
            if (document.getElementById('btn-translate-editor')) {
                document.getElementById('btn-translate-editor').innerText = '🌍 Translate';
            }
            editor.style.opacity = '1';
        }
    }
}

// End of TemplateManager
window.TemplateManager = TemplateManager;

/**
 * MediaSelector Component
 * Reusable modal for selecting media from the library.
 */
class MediaSelector {
    constructor() {
        this.service = new window.MediaService();
        this.media = [];
        this.languages = [];
        this.categories = [];
        this.filter = {
            search: '',
            language: '',
            category: '',
            type: '' // 'image' or 'video'
        };
        this.onSelectCallback = null;

        this.init();
    }

    init() {
        this.createDom();
        this.setupEventListeners();
    }

    createDom() {
        // Create modal DOM and append to body
        const modalHtml = `
            <div id="media-selector-modal" class="modal-overlay hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); z-index: 99999; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(5px);">
                <div class="modal-content" style="background: var(--bg-panel); padding: 2rem; border-radius: 16px; border: 1px solid var(--border); width: 900px; max-width: 95%; height: 80vh; display: flex; flex-direction: column; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
                    
                    <!-- Header -->
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-shrink: 0;">
                        <h2 style="font-size: 1.5rem; font-weight: 700; color: var(--text-primary);">Select Media</h2>
                        <button id="ms-btn-close" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 5px; font-size: 1.5rem;">✕</button>
                    </div>

                    <!-- Controls -->
                    <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem; flex-shrink: 0; flex-wrap: wrap;">
                         <input type="text" id="ms-search" class="search-input" placeholder="🔍 Search..." style="flex: 1; min-width: 200px;">
                         <select id="ms-filter-lang" class="filter-select" style="min-width: 150px;">
                            <option value="">All Languages</option>
                         </select>
                         <select id="ms-filter-cat" class="filter-select" style="min-width: 150px;">
                            <option value="">All Categories</option>
                         </select>
                    </div>

                    <!-- Grid -->
                    <div id="ms-grid" style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; padding-right: 5px;">
                        <!-- Content -->
                    </div>

                    <!-- Footer -->
                     <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center; color: var(--text-muted); font-size: 0.9rem;">
                        <span id="ms-status">Loading...</span>
                        <button id="ms-btn-cancel" class="action-btn-secondary">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = modalHtml;
        document.body.appendChild(div.firstElementChild);

        this.modal = document.getElementById('media-selector-modal');
        this.grid = document.getElementById('ms-grid');
    }

    setupEventListeners() {
        // Close
        document.getElementById('ms-btn-close').addEventListener('click', () => this.close());
        document.getElementById('ms-btn-cancel').addEventListener('click', () => this.close());
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.close();
        });

        // Filters
        document.getElementById('ms-search').addEventListener('input', (e) => {
            this.filter.search = e.target.value;
            this.renderGrid();
        });
        document.getElementById('ms-filter-lang').addEventListener('change', (e) => {
            this.filter.language = e.target.value;
            this.renderGrid();
        });
        document.getElementById('ms-filter-cat').addEventListener('change', (e) => {
            this.filter.category = e.target.value;
            this.renderGrid();
        });
    }

    async open(type = null, onSelect) {
        this.filter.type = type; // 'image' or 'video' or null
        this.onSelectCallback = onSelect;

        // Reset and Show with Brute Force
        this.modal.classList.remove('hidden');

        const s = this.modal.style;
        s.setProperty('display', 'flex', 'important');
        s.setProperty('visibility', 'visible', 'important');
        s.setProperty('opacity', '1', 'important');
        s.setProperty('z-index', '2147483647', 'important'); // Max int
        s.setProperty('top', '0', 'important');
        s.setProperty('left', '0', 'important');
        s.setProperty('width', '100vw', 'important');
        s.setProperty('height', '100vh', 'important');
        s.setProperty('background', 'rgba(0,0,0,0.8)', 'important');
        s.setProperty('pointer-events', 'auto', 'important'); // Fix click-through
        s.setProperty('cursor', 'default', 'important');

        await this.loadData();
    }

    close() {
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none';
        this.onSelectCallback = null;
    }

    async loadData() {
        document.getElementById('ms-status').textContent = 'Loading library...';
        this.grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">Loading...</div>';

        try {
            // Load Media
            this.media = await this.service.getMedia();

            // Load Settings (Languages/Categories)
            // Ideally we pass this in or cache it, but fetching is safe
            const { db } = window.firebaseContext;
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const settingsSnap = await getDoc(doc(db, 'settings', 'general'));
            if (settingsSnap.exists()) {
                const data = settingsSnap.data();
                this.languages = data.template_languages || [];
                this.categories = data.template_categories || [];
                this.populateDropdowns();
            }

            this.renderGrid();
            document.getElementById('ms-status').textContent = `${this.media.length} items found`;

        } catch (e) {
            console.error('MediaSelector: Load failed', e);
            document.getElementById('ms-status').textContent = 'Error loading library';
        }
    }

    populateDropdowns() {
        const langSel = document.getElementById('ms-filter-lang');
        const catSel = document.getElementById('ms-filter-cat');

        langSel.innerHTML = '<option value="">All Languages</option>' +
            this.languages.map(l => `<option value="${l}">${l}</option>`).join('');

        catSel.innerHTML = '<option value="">All Categories</option>' +
            this.categories.map(c => `<option value="${c}">${c}</option>`).join('');
    }

    renderGrid() {
        const typeStart = this.filter.type === 'video' ? 'video' : 'image';

        const filtered = this.media.filter(m => {
            // Type Filter
            if (this.filter.type) {
                // Check if mimeType or type matches
                const isVideo = m.type === 'video' || m.mimeType?.startsWith('video');
                const isImage = m.type === 'image' || m.mimeType?.startsWith('image');
                const isDocument = m.type === 'document' || (!isVideo && !isImage);

                if (this.filter.type === 'video' && !isVideo) return false;
                if (this.filter.type === 'image' && !isImage) return false;
                if (this.filter.type === 'document' && !isDocument) return false;
            }

            // Search & Select Filters
            const matchesSearch = !this.filter.search || m.name.toLowerCase().includes(this.filter.search.toLowerCase());
            const matchesLang = !this.filter.language || m.language === this.filter.language;
            const matchesCat = !this.filter.category || m.category === this.filter.category;

            return matchesSearch && matchesLang && matchesCat;
        });

        if (filtered.length === 0) {
            this.grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--text-muted);">No media found.</div>';
            return;
        }

        this.grid.innerHTML = filtered.map(m => this.createCardHtml(m)).join('');

        // Add click listeners to cards
        this.grid.querySelectorAll('.ms-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                const item = this.media.find(m => m.id === id);
                if (item && this.onSelectCallback) {
                    this.onSelectCallback(item);
                    this.close();
                }
            });
        });
    }

    createCardHtml(m) {
        let previewHtml = '';
        let badgeHtml = '';

        if (m.type === 'video' || m.mimeType?.startsWith('video')) {
            previewHtml = `<video src="${m.url}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;"></video>`;
            badgeHtml = 'VIDEO';
        } else if (m.type === 'image' || m.mimeType?.startsWith('image')) {
            previewHtml = `<img src="${m.url}" alt="${this.escapeHtml(m.name)}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;">`;
            badgeHtml = 'IMAGE';
        } else {
            // Document / PDF Fallback
            previewHtml = `
                <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-muted);">
                    <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                    </svg>
                </div>
            `;
            badgeHtml = 'DOC';
        }

        return `
            <div class="ms-card" data-id="${m.id}" style="
                background: rgba(255,255,255,0.05); 
                border: 1px solid var(--border); 
                border-radius: 8px; 
                overflow: hidden; 
                cursor: pointer; 
                transition: all 0.2s; 
                display: flex; 
                flex-direction: column;
            ">
                <div style="aspect-ratio: 1; position: relative;">
                    ${previewHtml}
                    <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px; font-size: 0.6rem; color: white;">
                        ${badgeHtml}
                    </div>
                </div>
                <div style="padding: 0.8rem;">
                    <div style="font-weight: 600; font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--text-main); margin-bottom: 0.4rem;">
                        ${this.escapeHtml(m.name)}
                    </div>
                     <div style="display: flex; gap: 0.3rem; flex-wrap: wrap;">
                         ${m.language ? `<span class="badge badge-lang" style="font-size: 0.6rem;">${m.language}</span>` : ''}
                         ${m.category ? `<span class="badge badge-cat" style="font-size: 0.6rem;">${m.category}</span>` : ''}
                    </div>
                </div>
            </div>
        `;
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }
}
window.MediaSelector = MediaSelector;

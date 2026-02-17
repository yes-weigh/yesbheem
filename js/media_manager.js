/**
 * MediaManager (Controller)
 * Handles UI interactions for Media Page
 */
class MediaManager {
    constructor() {
        this.service = new window.MediaService();

        // State
        this.media = [];
        this.languages = [];
        this.categories = [];
        this.filter = {
            search: '',
            language: '',
            category: ''
        };
        this.uploadFile = null;
        this.editingMediaId = null;

        // UI Refs
        this.gridContainer = document.getElementById('media-grid-container');
        this.modal = document.getElementById('upload-modal');

        // Move modal to body to avoid stacking context issues
        if (this.modal && this.modal.parentElement !== document.body) {
            document.body.appendChild(this.modal);
        }

        if (this.modal) {
            this.modal.style.display = 'none'; // Ensure hidden initially
        }

        this.progressContainer = document.getElementById('upload-progress-container');
        this.progressBar = document.getElementById('upload-progress-bar');
        this.statusText = document.getElementById('upload-status-text');

        this.init();
    }

    async init() {
        console.log('MediaManager Initializing...');
        this.setupEventListeners();

        try {
            await Promise.all([
                this.loadSettings(),
                this.loadMedia()
            ]);

            this.renderFilteredGrid();

        } catch (e) {
            console.error('MediaManager Init Failed', e);
            this.gridContainer.innerHTML = `<div class="text-danger">Failed to load media: ${e.message}</div>`;
        }
    }

    /* --- DATA LOADING --- */

    async loadMedia() {
        this.media = await this.service.getMedia();
        this.updateStats();
        // Do not render here; init() or the caller will handle rendering
    }

    async loadSettings() {
        try {
            const { db } = window.firebaseContext;
            const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
            const docRef = doc(db, 'settings', 'general');
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                this.languages = data.template_languages || [];
                this.categories = data.template_categories || [];

                this.populateDropdowns();
            }
        } catch (e) {
            console.error('Failed to load settings:', e);
        }
    }

    /* --- RENDERING --- */

    populateDropdowns() {
        // Filter Dropdowns
        const langFilter = document.getElementById('filter-language');
        const catFilter = document.getElementById('filter-category');

        // Upload Modal Dropdowns
        const uploadLang = document.getElementById('upload-language');
        const uploadCat = document.getElementById('upload-category');

        const langOpts = this.languages.map(l => `<option value="${l}">${l}</option>`).join('');
        const catOpts = this.categories.map(c => `<option value="${c}">${c}</option>`).join('');

        const updateSelect = (el, opts, defaultText) => {
            if (el) el.innerHTML = `<option value="">${defaultText}</option>` + opts;
        };

        updateSelect(langFilter, langOpts, 'All Languages');
        updateSelect(catFilter, catOpts, 'All Categories');
        updateSelect(uploadLang, langOpts, 'Select Language');
        updateSelect(uploadCat, catOpts, 'Select Category');
    }

    updateStats() {
        const container = document.getElementById('media-stats-container');
        if (!container) return;

        const total = this.media.length;

        // 1. Total Card
        const totalCardHtml = `
            <div class="stat-card stat-total">
                <div class="stat-number">${total}</div>
                <div class="stat-label">TOTAL MEDIA</div>
            </div>
        `;

        // 2. Language Cards
        let langCardsHtml = '';
        const allowedLanguages = ['Malayalam', 'Tamil', 'Hindi', 'Kannada', 'Telugu'];

        if (this.languages && this.languages.length > 0) {
            // Filter languages to only the allowed ones (case-insensitive matching)
            const targetLanguages = this.languages.filter(lang =>
                allowedLanguages.some(allowed => allowed.toLowerCase() === lang.toLowerCase())
            );

            // Sort to match the user's preferred order
            targetLanguages.sort((a, b) => {
                const indexA = allowedLanguages.findIndex(l => l.toLowerCase() === a.toLowerCase());
                const indexB = allowedLanguages.findIndex(l => l.toLowerCase() === b.toLowerCase());
                return indexA - indexB;
            });

            langCardsHtml = targetLanguages.map(lang => {
                const count = this.media.filter(m =>
                    m.language?.toLowerCase() === lang.toLowerCase()
                ).length;

                return `
                    <div class="stat-card stat-language">
                        <div class="stat-number">${count}</div>
                        <div class="stat-label">${this.escapeHtml(lang).toUpperCase()}</div>
                    </div>
                `;
            }).join('');
        }

        container.innerHTML = totalCardHtml + langCardsHtml;
    }

    renderFilteredGrid() {
        // Generate a unique ID for this render cycle
        const renderId = Symbol('renderId');
        this.currentRenderId = renderId;

        const filtered = this.media.filter(m => {
            const matchesSearch = !this.filter.search || m.name.toLowerCase().includes(this.filter.search.toLowerCase());
            const matchesLang = !this.filter.language || m.language === this.filter.language;
            const matchesCat = !this.filter.category || m.category === this.filter.category;
            return matchesSearch && matchesLang && matchesCat;
        });

        if (filtered.length === 0) {
            this.gridContainer.innerHTML = '<div class="text-muted" style="grid-column: 1/-1; text-align: center; padding: 2rem;">No media found matching filters.</div>';
            return;
        }

        this.gridContainer.innerHTML = filtered.map(m => this.createCardHtml(m)).join('');

        // Generate PDF thumbnails only for PDFs without server thumbnails
        const pdfsNeedingClientRendering = filtered.filter(m =>
            (m.type === 'document' || m.mimeType === 'application/pdf') && !m.thumbnailUrl
        );
        if (pdfsNeedingClientRendering.length > 0) {
            this.generatePdfThumbnails(pdfsNeedingClientRendering, renderId);
        }
    }

    createCardHtml(m) {
        let previewHtml = '';
        let badgeHtml = '';
        if (m.type === 'video' || m.mimeType?.startsWith('video')) {
            previewHtml = `<video src="${m.url}" style="width: 100%; height: 100%; object-fit: cover;"></video>`;
            badgeHtml = 'VIDEO';
        } else if (m.type === 'image' || m.mimeType?.startsWith('image')) {
            previewHtml = `<img src="${m.url}" alt="${this.escapeHtml(m.name)}" style="width: 100%; height: 100%; object-fit: cover;">`;
            badgeHtml = 'IMAGE';
        } else if (m.type === 'document' || m.mimeType === 'application/pdf') {
            // PDF - Check if we have a server-generated thumbnail
            if (m.thumbnailUrl) {
                // Use fast server thumbnail
                previewHtml = `<img src="${m.thumbnailUrl}" alt="${this.escapeHtml(m.name)}" style="width: 100%; height: 100%; object-fit: contain; background: #f0f0f0;">`;
            } else {
                // Fallback to canvas placeholder for client-side rendering
                previewHtml = `
                    <canvas id="pdf-thumb-${m.id}" style="width: 100%; height: 100%; object-fit: cover;"></canvas>
                    <div id="pdf-loading-${m.id}" style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.05); color: var(--text-muted);">
                        <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                            <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                        </svg>
                    </div>
                `;
            }
            badgeHtml = 'PDF';
        } else {
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
            <div class="template-card" style="flex-direction: column; gap: 0.8rem; padding: 0.8rem; cursor: pointer;" onclick="window.mediaMgr.editMedia('${m.id}')">
                <div style="width: 100%; aspect-ratio: 1; border-radius: 8px; overflow: hidden; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); position: relative;">
                    ${previewHtml}
                    <div style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; color: white;">
                        ${badgeHtml}
                    </div>
                </div>
                
                <div style="flex: 1; min-width: 0;">
                    <div style="font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.4rem;" title="${this.escapeHtml(m.name)}">
                        ${this.escapeHtml(m.name)}
                    </div>
                    <div class="template-card-badges" style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                         ${m.language ? `<span class="badge badge-lang" style="font-size: 0.7rem;">${m.language}</span>` : ''}
                         ${m.category ? `<span class="badge badge-cat" style="font-size: 0.7rem;">${m.category}</span>` : ''}
                    </div>
                </div>

                <div style="display: flex; justify-content: flex-end; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
                    <button class="action-btn-icon" onclick="event.stopPropagation(); window.mediaMgr.deleteMedia('${m.id}', '${m.storagePath || ''}')" title="Delete" style="color: #ef4444;">
                        🗑️
                    </button>
                    <!-- Potential for Copy URL button -->
                    <button class="action-btn-icon" onclick="event.stopPropagation(); window.mediaMgr.copyUrl('${m.url}')" title="Copy URL">
                        📋
                    </button>
                </div>
            </div>
        `;
    }

    /* --- INTERACTIONS --- */

    setupEventListeners() {
        console.log('MediaManager: Setting up event listeners');

        const safeAddListener = (id, event, handler) => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener(event, handler);
            } else {
                console.warn(`MediaManager: Element ${id} not found for ${event} listener`);
            }
        };

        // Filters
        safeAddListener('search-media', 'input', (e) => {
            console.log('Search input');
            this.filter.search = e.target.value;
            this.renderFilteredGrid();
        });

        safeAddListener('filter-language', 'change', (e) => {
            this.filter.language = e.target.value;
            this.renderFilteredGrid();
        });

        safeAddListener('filter-category', 'change', (e) => {
            this.filter.category = e.target.value;
            this.renderFilteredGrid();
        });

        // Modal Open/Close
        safeAddListener('btn-new-media', 'click', () => {
            console.log('Upload button clicked');
            this.openModal();
        });

        safeAddListener('btn-close-modal', 'click', () => this.closeModal());
        safeAddListener('btn-cancel-upload', 'click', () => this.closeModal());

        safeAddListener('upload-modal', 'click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });

        // File Input
        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('file-input');

        if (dropZone && fileInput) {
            dropZone.addEventListener('click', () => fileInput.click());
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--primary)';
            });
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--border)';
            });
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.style.borderColor = 'var(--border)';
                if (e.dataTransfer.files.length > 0) {
                    this.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files[0]));
        }

        const changeFileBtn = document.getElementById('btn-change-file');
        if (changeFileBtn) {
            changeFileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (fileInput) fileInput.click();
            });
        }

        const downloadBtn = document.getElementById('btn-download-file');
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.downloadCurrentMedia();
            });
        }

        // Upload Action
        safeAddListener('btn-confirm-upload', 'click', () => this.upload());
    }

    openModal() {
        this.resetModal();
        this.modal.classList.remove('hidden');

        // Brute force visibility
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

        console.log('Modal opened (properties enforced)');
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.modal.style.display = 'none'; // Force hidden
    }

    resetModal() {
        this.uploadFile = null;
        this.editingMediaId = null;
        this.currentMediaUrl = null; // Track current media URL for downloading
        document.getElementById('file-input').value = '';
        document.getElementById('upload-prompt').classList.remove('hidden');
        document.getElementById('file-preview').classList.add('hidden');
        document.getElementById('preview-container').innerHTML = '';
        document.getElementById('upload-name').value = '';
        document.getElementById('upload-language').value = '';
        document.getElementById('upload-category').value = '';

        const btn = document.getElementById('btn-confirm-upload');
        btn.disabled = true;
        btn.textContent = 'Upload'; // Reset text

        // Hide download button by default
        const downloadBtn = document.getElementById('btn-download-file');
        if (downloadBtn) downloadBtn.classList.add('hidden');

        this.progressContainer.classList.add('hidden');
    }

    handleFileSelect(file) {
        if (!file) return;
        if (!file.type.startsWith('image/') && !file.type.startsWith('video/') && file.type !== 'application/pdf') {
            alert('Please select an image, video, or PDF file.');
            return;
        }

        this.uploadFile = file;
        this.showFilePreview(file);

        // Auto-fill name if empty
        const nameInput = document.getElementById('upload-name');
        if (!nameInput.value) {
            // Remove extension and replace underscore/dash with spaces for a cleaner default name
            const cleanName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
            nameInput.value = cleanName;
        }

        document.getElementById('btn-confirm-upload').disabled = false;
    }

    showFilePreview(file) {
        const container = document.getElementById('preview-container');
        document.getElementById('upload-prompt').classList.add('hidden');
        document.getElementById('file-preview').classList.remove('hidden');
        document.getElementById('file-name-display').textContent = file.name;

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.onload = () => URL.revokeObjectURL(img.src);
            container.innerHTML = '';
            container.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const vid = document.createElement('video');
            vid.src = URL.createObjectURL(file);
            vid.controls = true;
            vid.style.maxWidth = '100%';
            vid.style.maxHeight = '100%';
            container.innerHTML = '';
            container.appendChild(vid);
        } else if (file.type === 'application/pdf') {
            // PDF Preview
            const iframe = document.createElement('iframe');
            iframe.src = URL.createObjectURL(file);
            iframe.style.width = '100%';
            iframe.style.height = '400px';
            iframe.style.border = 'none';
            iframe.style.borderRadius = '8px';
            container.innerHTML = '';
            container.appendChild(iframe);
        } else {
            // Document Fallback
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">📄</div>
                    <div style="font-size: 0.9rem;">${file.type}</div>
                </div>
            `;
        }
    }

    editMedia(id) {
        const m = this.media.find(x => x.id === id);
        if (!m) return;

        this.openModal();
        this.editingMediaId = id;

        // Hide file upload prompt as we are editing metadata
        // For now, let's keep it simple: just pre-fill metadata. 
        // If they want to change file, they can drag/drop new one (handled by existing logic)

        document.getElementById('upload-name').value = m.name || '';
        document.getElementById('upload-language').value = m.language || '';
        document.getElementById('upload-category').value = m.category || '';

        // Show current preview from Firestore URL
        const container = document.getElementById('preview-container');
        document.getElementById('upload-prompt').classList.add('hidden');
        document.getElementById('file-preview').classList.remove('hidden');
        document.getElementById('file-name-display').textContent = m.name;

        if (m.type === 'image' || m.mimeType?.startsWith('image')) {
            container.innerHTML = `<img src="${m.url}" style="max-width:100%; max-height:100%;">`;
        } else if (m.type === 'video' || m.mimeType?.startsWith('video')) {
            container.innerHTML = `<video src="${m.url}" controls style="max-width:100%; max-height:100%;"></video>`;
        } else if (m.type === 'document' || m.mimeType === 'application/pdf') {
            // PDF Preview
            container.innerHTML = `<iframe src="${m.url}" style="width:100%; height:400px; border:none; border-radius:8px;"></iframe>`;
        } else {
            container.innerHTML = `
                <div style="text-align: center; color: var(--text-muted); padding: 2rem;">
                    <div style="font-size: 3rem; margin-bottom: 0.5rem;">📄</div>
                    <div style="font-size: 0.9rem;">${m.type || m.mimeType}</div>
                </div>
            `;
        }

        const btn = document.getElementById('btn-confirm-upload');
        btn.textContent = 'Update';
        btn.disabled = false;

        // Store URL for downloading and show download button
        this.currentMediaUrl = m.url;
        const downloadBtn = document.getElementById('btn-download-file');
        if (downloadBtn) downloadBtn.classList.remove('hidden');
    }

    async upload() {
        // Validation check
        // If editing, we don't strictly *need* a new file, but if new file provided, we use it.
        // Actually, replacing file is complex (Storage path change etc). 
        // Let's assume for this iteration: EDIT = Metadata Update Only.

        const isEdit = !!this.editingMediaId;
        if (!isEdit && !this.uploadFile) return;

        const name = document.getElementById('upload-name').value;
        const language = document.getElementById('upload-language').value;
        const category = document.getElementById('upload-category').value;

        if (!name) {
            alert('Please enter a name for the media.');
            return;
        }

        // UI State
        const btn = document.getElementById('btn-confirm-upload');
        btn.disabled = true;
        document.getElementById('btn-cancel-upload').disabled = true;
        this.progressContainer.classList.remove('hidden');
        this.updateProgress(10, isEdit ? 'Updating...' : 'Starting upload...');

        try {
            const metadata = { name, language, category };

            if (isEdit) {
                // Update Metadata Only
                await this.service.updateMediaMetadata(this.editingMediaId, metadata);
                this.updateProgress(100, 'Updated!');
            } else {
                // New Upload
                setTimeout(() => this.updateProgress(40, 'Uploading to Storage...'), 500);
                await this.service.uploadMedia(this.uploadFile, metadata);
                this.updateProgress(100, 'Done!');
            }

            setTimeout(() => {
                this.closeModal();
                this.loadMedia(); // Refresh grid
                this.showToast(isEdit ? 'Media updated!' : 'Media uploaded successfully!');
            }, 800);

        } catch (e) {
            console.error('Action Failed', e);
            alert((isEdit ? 'Update' : 'Upload') + ' Failed: ' + e.message);
            this.updateProgress(0, 'Failed');
            btn.disabled = false;
            document.getElementById('btn-cancel-upload').disabled = false;
        }
    }

    updateProgress(percent, text) {
        this.progressBar.style.width = percent + '%';
        this.statusText.textContent = text;
    }

    downloadCurrentMedia() {
        if (!this.currentMediaUrl) {
            this.showToast('No file available for download');
            return;
        }

        const fileName = document.getElementById('upload-name').value || 'download';
        const link = document.createElement('a');
        link.href = this.currentMediaUrl;
        link.download = fileName;
        link.target = '_blank'; // Fallback if download doesn't work
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        this.showToast('Download started');
    }

    async generatePdfThumbnails(mediaItems, renderId) {
        // Filter PDF items
        const pdfItems = mediaItems.filter(m =>
            m.type === 'document' || m.mimeType === 'application/pdf'
        );

        if (pdfItems.length === 0 || typeof pdfjsLib === 'undefined') return;

        // Generate thumbnails for each PDF
        for (const item of pdfItems) {
            // Check if this render cycle is still active
            if (this.currentRenderId !== renderId) {
                console.log('Stopped obsolete PDF thumbnail generation');
                break;
            }

            try {
                await this.renderPdfThumbnail(item.id, item.url);
            } catch (e) {
                console.warn(`Failed to generate thumbnail for ${item.name}:`, e);
            }
        }
    }

    async renderPdfThumbnail(itemId, url) {
        const canvas = document.getElementById(`pdf-thumb-${itemId}`);
        const loadingDiv = document.getElementById(`pdf-loading-${itemId}`);

        if (!canvas) return;

        try {
            // Load PDF
            const loadingTask = pdfjsLib.getDocument(url);
            const pdf = await loadingTask.promise;

            // Get first page
            const page = await pdf.getPage(1);

            // Set canvas dimensions
            const viewport = page.getViewport({ scale: 1.5 });
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render page to canvas
            const context = canvas.getContext('2d');
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            // Hide loading indicator
            if (loadingDiv) loadingDiv.style.display = 'none';

            // Hybrid: Upload generated thumbnail to Firebase
            // This ensures next time it loads fast from server URL
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                try {
                    console.log(`Uploading generated thumbnail for ${itemId}...`);
                    await this.service.uploadThumbnail(itemId, blob);
                    console.log(`Thumbnail uploaded and linked for ${itemId}`);
                } catch (err) {
                    console.error('Failed to upload background thumbnail:', err);
                }
            }, 'image/jpeg', 0.85);

        } catch (e) {
            console.error('PDF thumbnail render error:', e);
            // Keep loading placeholder if render fails
        }
    }

    async deleteMedia(id, path) {
        if (!confirm('Are you sure you want to delete this media? This cannot be undone.')) return;

        try {
            await this.service.deleteMedia(id, path);
            this.showToast('Media deleted');
            // Optimistic update
            this.media = this.media.filter(m => m.id !== id);
            this.renderFilteredGrid();
            this.updateStats();
        } catch (e) {
            alert('Delete failed: ' + e.message);
        }
    }

    copyUrl(url) {
        navigator.clipboard.writeText(url).then(() => {
            this.showToast('URL copied to clipboard');
        });
    }

    showToast(msg) {
        // Reuse global toast or simple alert if missing
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.textContent = msg;
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.background = '#10b981';
        toast.style.color = 'white';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '8px';
        toast.style.zIndex = '2000';
        toast.style.animation = 'fadeIn 0.3s';
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
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
}

window.MediaManager = MediaManager;

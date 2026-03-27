/**
 * ProductManager — Zoho Product Catalog Frontend
 * Calls zohoGetProducts / zohoGetProductDetail Firebase functions
 */

class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.categoryPreviews = {};
        this.currentView = localStorage.getItem('pm-view') || 'folder';
        this.currentPage = 1;
        this.perPage = 48;
        this.total = 0;
        this.searchQuery = '';
        this.selectedGroup = '';
        this.loading = false;
        this.syncedAt = null;
        this.callZohoGetProducts = null;
        this.callZohoGetProductDetail = null;
    }

    async init() {
        console.log('[ProductManager] Initializing...');
        await this._loadFirebase();
        this._render();
        await this.loadProducts();
    }

    async _loadFirebase() {
        try {
            const basePath = (window.appConfig && window.appConfig.getBasePath()) || '/';
            const configPath = `${basePath}js/services/firebase_config.js`.replace('//', '/');
            const { app } = await import(configPath);
            const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js');
            const functions = getFunctions(app, 'us-central1');
            this.callZohoGetProducts = httpsCallable(functions, 'zohoGetProducts');
            this.callZohoGetProductDetail = httpsCallable(functions, 'zohoGetProductDetail');
            this.callZohoSyncProducts = httpsCallable(functions, 'zohoSyncProducts');
            this.callZohoUploadProductImage = httpsCallable(functions, 'zohoUploadProductImage');
            this.callUploadCategoryThumbnail = httpsCallable(functions, 'uploadCategoryThumbnail');
            this.callUpdateCategoryOrder = httpsCallable(functions, 'updateCategoryOrder');
            console.log('[ProductManager] Firebase functions ready');
        } catch (err) {
            console.error('[ProductManager] Firebase init failed:', err);
        }
    }

    _render() {
        const container = document.getElementById('product-page');
        if (!container) return;
        container.innerHTML = `
            <div class="pm-titlebar">
                <div class="pm-breadcrumb">
                    <span class="pm-bc-item">Yes Bheem</span>
                    <span class="pm-bc-sep">/</span>
                    <span class="pm-bc-item active">Products</span>
                </div>
                <div class="pm-header-actions">
                    <span class="pm-sync-info" id="pm-sync-info"></span>
                    <button class="pm-btn-sync" id="pm-sync-btn" title="Sync from Zoho">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/></svg>
                        Sync
                    </button>
                </div>
            </div>

            <div class="pm-toolbar">
                <div class="pm-search-wrap">
                    <svg class="pm-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
                    <input type="text" id="pm-search" class="pm-search" placeholder="Search products, SKU..." autocomplete="off">
                </div>
                <select id="pm-category-filter" class="pm-category-select">
                    <option value="">All Groups</option>
                </select>
                <div class="pm-view-toggles" id="pm-view-toggles">
                    <button class="pm-view-btn ${this.currentView === 'folder' ? 'active' : ''}" data-view="folder" title="Folder View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z"/></svg>
                    </button>
                    <button class="pm-view-btn ${this.currentView === 'grid' ? 'active' : ''}" data-view="grid" title="Grid View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>
                    </button>
                    <button class="pm-view-btn ${this.currentView === 'list' ? 'active' : ''}" data-view="list" title="List View">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    </button>
                </div>
                <span class="pm-count" id="pm-count"></span>
            </div>

            <div class="pm-grid-wrap">
                <div class="pm-grid" id="pm-grid">
                    <div class="pm-loading"><div class="pm-spinner"></div><span>Loading products from Zoho...</span></div>
                </div>
                <div class="pm-pagination" id="pm-pagination"></div>
            </div>

            <!-- Product Detail Modal -->
            <div class="pm-modal-overlay" id="pm-modal" style="display:none">
                <div class="pm-modal">
                    <button class="pm-modal-close" id="pm-modal-close">✕</button>
                    <div class="pm-modal-body" id="pm-modal-body"></div>
                </div>
            </div>
        `;
        this._attachToolbarEvents();
    }

    _attachToolbarEvents() {
        const searchEl = document.getElementById('pm-search');
        const catEl = document.getElementById('pm-category-filter');
        const syncBtn = document.getElementById('pm-sync-btn');
        const modalOverlay = document.getElementById('pm-modal');
        const modalClose = document.getElementById('pm-modal-close');

        let searchTimer;
        searchEl?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                this.searchQuery = e.target.value.trim();
                this.currentPage = 1;
                this.loadProducts();
            }, 350);
        });

        catEl?.addEventListener('change', (e) => {
            this.selectedGroup = e.target.value;
            this.currentPage = 1;
            this.loadProducts();
        });

        syncBtn?.addEventListener('click', () => this.syncNow());

        modalClose?.addEventListener('click', () => this.closeModal());
        modalOverlay?.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeModal();
        });

        const viewBtns = document.querySelectorAll('.pm-view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                this.currentView = btn.dataset.view;
                localStorage.setItem('pm-view', this.currentView);
                viewBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderActiveView();
            });
        });
    }

    async loadProducts() {
        if (this.loading) return;
        this.loading = true;
        this._showGridLoading();

        try {
            const result = await this.callZohoGetProducts({
                search: this.searchQuery,
                group: this.selectedGroup,
                page: this.currentPage,
                perPage: this.perPage
            });

            const { products, total, groups, groupPreviews, syncedAt, hasMore } = result.data;
            this.products = products;
            this.total = total;
            this.syncedAt = syncedAt;
            if (groupPreviews) {
                this.categoryPreviews = groupPreviews;
            }

            if (groups && groups.length) {
                this.categories = groups;
                this._populateCategories(groups);
            }

            this._renderActiveView();
            this._renderPagination(total, hasMore);
            this._updateSyncInfo(syncedAt);
            this._updateCount(total);

        } catch (err) {
            console.error('[ProductManager] loadProducts error:', err);
            this._showError(err.message);
        } finally {
            this.loading = false;
        }
    }

    _showGridLoading() {
        const grid = document.getElementById('pm-grid');
        if (grid) grid.innerHTML = `<div class="pm-loading"><div class="pm-spinner"></div><span>Loading...</span></div>`;
    }

    _showError(msg) {
        const grid = document.getElementById('pm-grid');
        if (grid) grid.innerHTML = `
            <div class="pm-error">
                <div class="pm-error-icon">⚠️</div>
                <p>Failed to load products</p>
                <small>${msg}</small>
                <button class="pm-btn-retry" onclick="window.productManager && window.productManager.loadProducts()">Retry</button>
            </div>`;
    }

    _populateCategories(categories) {
        const catEl = document.getElementById('pm-category-filter');
        if (!catEl) return;
        const current = catEl.value;
        catEl.innerHTML = '<option value="">All Groups</option>' +
            categories.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
    }

    _renderActiveView() {
        const grid = document.getElementById('pm-grid');
        if (!grid) return;
        
        grid.className = '';
        
        if (this.currentView === 'folder') {
            this._renderFolder(grid);
        } else if (this.currentView === 'list') {
            this._renderList(grid);
        } else {
            this._renderGridArray(grid);
        }
    }

    _renderGridArray(grid) {
        if (!this.products || this.products.length === 0) {
            grid.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon">📦</div><p>No products found</p><small>Try adjusting your search or filter</small></div>`;
            return;
        }
        grid.className = 'pm-grid';
        grid.innerHTML = this.products.map(p => this._productCard(p)).join('');
        grid.querySelectorAll('.pm-card').forEach(card => {
            card.addEventListener('click', () => this.openDetail(card.dataset.id));
        });
    }

    _renderList(grid) {
        if (!this.products || this.products.length === 0) {
            grid.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon">📦</div><p>No products found</p><small>Try adjusting your search or filter</small></div>`;
            return;
        }
        grid.className = 'pm-list';
        grid.innerHTML = this.products.map(p => this._listCard(p)).join('');
        grid.querySelectorAll('.pm-list-card').forEach(card => {
            card.addEventListener('click', () => this.openDetail(card.dataset.id));
        });
    }

    _listCard(p) {
        const stockClass = { in_stock: 'pm-stock-in', low_stock: 'pm-stock-low', out_of_stock: 'pm-stock-out' }[p.stockStatus] || 'pm-stock-in';
        return `
        <div class="pm-list-card" data-id="${p.id}">
            <div class="pm-list-img">
                ${p.imageUrl ? `<img src="${p.imageUrl}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=pm-list-icon>📦</div>'">` : '<div class="pm-list-icon">📦</div>'}
            </div>
            <div class="pm-list-info">
                <div class="pm-list-main">
                    <span class="pm-list-name">${p.name}</span>
                    <span class="pm-list-sku">${p.sku ? 'SKU: ' + p.sku : ''} <span style="margin-left:8px;" class="pm-list-cat">${p.groupName || ''}</span></span>
                </div>
                <div class="pm-list-stock-col">
                    <span class="pm-list-price">₹${(p.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    <div class="pm-stock-badge ${stockClass}"><span>${p.stock}</span> <span class="pm-stock-qty">${p.unit || 'units'}</span></div>
                </div>
            </div>
        </div>`;
    }

    _renderFolder(grid) {
        if (!this.categories || this.categories.length === 0) {
            grid.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon">📁</div><p>No groups found</p><small>No categories exist in the catalog.</small></div>`;
            return;
        }
        grid.className = 'pm-folder-grid';
        
        let groupsToShow = this.categories;
        if (this.selectedGroup) {
            groupsToShow = [this.selectedGroup];
        }

        grid.innerHTML = groupsToShow.map(cat => {
            const previewData = this.categoryPreviews[cat];
            let imageHtml = '';
            
            if (typeof previewData === 'string') {
                // Custom single thumbnail
                imageHtml = `<div class="pm-folder-custom-thumb"><img src="${previewData}" loading="lazy" onerror="this.style.display='none'"></div>`;
            } else {
                const images = previewData || [];
                if (images.length > 0) {
                    const padded = [...images, null, null, null, null].slice(0, 4);
                    let collageHtml = padded.map(src => 
                        src ? `<div class="pm-folder-thumb"><img src="${src}" loading="lazy" onerror="this.style.display='none'"></div>` 
                            : `<div class="pm-folder-thumb"></div>`
                    ).join('');
                    imageHtml = `<div class="pm-folder-collage">${collageHtml}</div>`;
                } else {
                    imageHtml = `<div class="pm-folder-icon">📁</div>`;
                }
            }

            return `
            <div class="pm-folder-card" data-cat="${cat}" draggable="true">
                <div class="pm-folder-overlay" id="pm-f-overlay-${cat}">
                    <label class="pm-folder-edit-btn" onclick="event.stopPropagation()">
                        📷 Edit Image
                        <input type="file" style="display:none" accept="image/*" onchange="window.productManager && window.productManager.uploadCategoryThumb('${cat}', this.files[0])">
                    </label>
                </div>
                ${imageHtml}
                <div class="pm-folder-name">${cat}</div>
            </div>`;
        }).join('');

        let draggedElement = null;

        grid.querySelectorAll('.pm-folder-card').forEach(card => {
            card.addEventListener('click', (e) => {
                // Prevent navigation if interacting with the overlay edit button
                if (e.target.closest('.pm-folder-edit-btn') || e.target.closest('.pm-folder-overlay')) return;

                const cat = card.dataset.cat;
                const filter = document.getElementById('pm-category-filter');
                if (filter) filter.value = cat;
                this.selectedGroup = cat;
                this.currentView = 'grid'; // Default to grid when opening a folder
                localStorage.setItem('pm-view', 'grid');
                
                document.querySelectorAll('.pm-view-btn').forEach(b => {
                    b.classList.toggle('active', b.dataset.view === 'grid');
                });
                
                this.currentPage = 1;
                this.loadProducts();
            });

            // Drag and Drop Events
            card.addEventListener('dragstart', (e) => {
                // Ensure edit buttons and text selection aren't firing drag
                if (e.target.tagName.toLowerCase() === 'label' || e.target.tagName.toLowerCase() === 'input') {
                    e.preventDefault();
                    return;
                }
                draggedElement = card;
                e.dataTransfer.effectAllowed = 'move';
                setTimeout(() => card.classList.add('dragging'), 0);
            });

            card.addEventListener('dragend', () => {
                draggedElement = null;
                card.classList.remove('dragging');
                grid.querySelectorAll('.pm-folder-card').forEach(c => c.classList.remove('drag-over'));
            });

            card.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (card !== draggedElement && draggedElement) {
                    card.classList.add('drag-over');
                }
            });

            card.addEventListener('dragleave', () => {
                card.classList.remove('drag-over');
            });

            card.addEventListener('drop', async (e) => {
                e.preventDefault();
                card.classList.remove('drag-over');
                
                if (draggedElement && draggedElement !== card) {
                    const allCards = [...grid.querySelectorAll('.pm-folder-card')];
                    const draggedIdx = allCards.indexOf(draggedElement);
                    const droppedIdx = allCards.indexOf(card);
                    
                    if (draggedIdx < droppedIdx) {
                        card.after(draggedElement);
                    } else {
                        card.before(draggedElement);
                    }
                    
                    const newOrder = [...grid.querySelectorAll('.pm-folder-card')].map(c => c.dataset.cat);
                    this.categories = newOrder;
                    this._populateCategories(this.categories);
                    
                    try {
                        if (this.callUpdateCategoryOrder) {
                            await this.callUpdateCategoryOrder({ orderedCategories: newOrder });
                            console.log('[ProductManager] Category order saved globally.');
                        }
                    } catch (err) {
                        console.error('[ProductManager] Failed to save category order:', err);
                    }
                }
            });
        });
    }

    async uploadCategoryThumb(cat, file) {
        if (!file) return;
        const overlay = document.getElementById(`pm-f-overlay-${cat}`);
        if (overlay) {
            overlay.style.opacity = '1';
            overlay.innerHTML = `<div class="pm-folder-edit-loading"><div class="pm-spinner-sm"></div> Uploading...</div>`;
        }

        try {
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            if (this.callUploadCategoryThumbnail) {
                const res = await this.callUploadCategoryThumbnail({
                    groupName: cat,
                    imageBase64: base64,
                    mimeType: file.type
                });

                if (res.data && res.data.success) {
                    this.categoryPreviews[cat] = res.data.url;
                    
                    if (overlay) {
                        overlay.innerHTML = `<div class="pm-folder-edit-loading" style="color:#22c55e">✓ Done</div>`;
                        setTimeout(() => this._renderActiveView(), 1000);
                    } else {
                        this._renderActiveView();
                    }
                }
            }
        } catch (err) {
            console.error('[ProductManager] Error uploading thumbnail:', err);
            if (overlay) {
                overlay.innerHTML = `<div class="pm-folder-edit-loading" style="color:#ef4444">✗ Failed</div>`;
                setTimeout(() => {
                    this._renderActiveView();
                }, 2000);
            }
        }
    }

    _productCard(p) {
        const stockClass = { in_stock: 'pm-stock-in', low_stock: 'pm-stock-low', out_of_stock: 'pm-stock-out' }[p.stockStatus] || 'pm-stock-in';
        const stockLabel = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }[p.stockStatus] || 'In Stock';
        const stockIcon = { in_stock: '●', low_stock: '◐', out_of_stock: '○' }[p.stockStatus] || '●';
        const qtyColor = { in_stock: 'pm-qty-in', low_stock: 'pm-qty-low', out_of_stock: 'pm-qty-out' }[p.stockStatus] || 'pm-qty-in';

        return `
        <div class="pm-card" data-id="${p.id}">
            <div class="pm-card-img">
                ${p.imageUrl
                    ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" onerror="this.parentElement.innerHTML='<div class=pm-card-icon>📦</div>'">`
                    : '<div class="pm-card-icon">📦</div>'}
                <div class="pm-qty-badge ${qtyColor}">
                    <span class="pm-qty-num">${p.stockStatus === 'out_of_stock' ? '0' : p.stock}</span>
                    <span class="pm-qty-label">${p.unit || 'units'}</span>
                </div>
            </div>
            <div class="pm-card-body">
                <div class="pm-card-cat">${p.groupName || ''}</div>
                <div class="pm-card-name">${p.name}</div>
                ${p.sku ? `<div class="pm-card-sku">SKU: ${p.sku}</div>` : ''}
                <div class="pm-card-footer">
                    <div class="pm-card-price">₹${(p.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div class="pm-stock-badge ${stockClass}">
                        <span>${stockIcon}</span> ${stockLabel}
                    </div>
                </div>
            </div>
        </div>`;
    }

    _renderPagination(total, hasMore) {
        const el = document.getElementById('pm-pagination');
        if (!el) return;

        const totalPages = Math.ceil(total / this.perPage);
        if (totalPages <= 1) { el.innerHTML = ''; return; }

        const pages = [];
        for (let i = 1; i <= totalPages; i++) {
            if (totalPages <= 7 || i === 1 || i === totalPages || Math.abs(i - this.currentPage) <= 1) {
                pages.push(i);
            } else if (pages[pages.length - 1] !== '…') {
                pages.push('…');
            }
        }

        el.innerHTML = `
            <button class="pm-pg-btn" ${this.currentPage === 1 ? 'disabled' : ''} data-page="${this.currentPage - 1}">‹</button>
            ${pages.map(p => p === '…'
                ? `<span class="pm-pg-ellipsis">…</span>`
                : `<button class="pm-pg-btn ${p === this.currentPage ? 'active' : ''}" data-page="${p}">${p}</button>`
            ).join('')}
            <button class="pm-pg-btn" ${!hasMore ? 'disabled' : ''} data-page="${this.currentPage + 1}">›</button>
        `;

        el.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const pg = parseInt(btn.dataset.page);
                if (!isNaN(pg) && pg !== this.currentPage) {
                    this.currentPage = pg;
                    this.loadProducts();
                    document.getElementById('pm-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            });
        });
    }

    _updateSyncInfo(syncedAt) {
        const el = document.getElementById('pm-sync-info');
        if (!el) return;
        if (syncedAt) {
            const d = new Date(syncedAt);
            el.textContent = `Last synced: ${d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
        } else {
            el.textContent = '';
        }
    }

    _updateCount(total) {
        const el = document.getElementById('pm-count');
        if (el) el.textContent = `${total} product${total !== 1 ? 's' : ''}`;
    }

    async openDetail(itemId) {
        const modal = document.getElementById('pm-modal');
        const body = document.getElementById('pm-modal-body');
        if (!modal || !body) return;

        // Show modal with loading
        modal.style.display = 'flex';
        body.innerHTML = `<div class="pm-loading"><div class="pm-spinner"></div><span>Loading details...</span></div>`;

        // Try from cache first
        const cached = this.products.find(p => p.id === itemId);

        try {
            const result = await this.callZohoGetProductDetail({ itemId });
            const p = result.data.product;
            body.innerHTML = this._detailHTML(p);

        // Wire up upload button after render
        const input = document.getElementById(`pm-upload-input-${p.id}`);
        if (input) {
            input.addEventListener('change', (e) => this.uploadImage(p.id, e.target.files[0]));
        }
        } catch (err) {
            // Fallback to cached card data
            if (cached) {
                body.innerHTML = this._detailHTML(cached);
                const input = document.getElementById(`pm-upload-input-${cached.id}`);
                if (input) input.addEventListener('change', (e) => this.uploadImage(cached.id, e.target.files[0]));
            } else {
                body.innerHTML = `<div class="pm-error"><p>Failed to load product details</p><small>${err.message}</small></div>`;
            }
        }
    }

    _detailHTML(p) {
        const stockClass = { in_stock: 'pm-stock-in', low_stock: 'pm-stock-low', out_of_stock: 'pm-stock-out' }[p.stockStatus] || 'pm-stock-in';
        const stockLabel = { in_stock: 'In Stock', low_stock: 'Low Stock', out_of_stock: 'Out of Stock' }[p.stockStatus] || 'In Stock';

        return `
        <div class="pm-detail">
            <div class="pm-detail-header">
                <div class="pm-detail-img">
                    ${p.imageUrl
                        ? `<img src="${p.imageUrl}" alt="${p.name}" onerror="this.parentElement.innerHTML='<div class=pm-detail-icon>📦</div>'">`
                        : '<div class="pm-detail-icon">📦</div>'}
                </div>
                <div class="pm-detail-info">
                    <div class="pm-detail-cat">${p.groupName || ''}</div>
                    <h2 class="pm-detail-name">${p.name}</h2>
                    ${p.sku ? `<div class="pm-detail-sku">SKU: <strong>${p.sku}</strong></div>` : ''}
                    <div class="pm-detail-price">₹${(p.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span class="pm-detail-unit">/ ${p.unit || 'pcs'}</span></div>
                    <div class="pm-stock-badge ${stockClass}" style="margin-top:10px;display:inline-flex;">${stockLabel} — ${p.stock} ${p.unit || 'units'}</div>
                </div>
            </div>

            <div class="pm-upload-row">
                <label class="pm-upload-btn" id="pm-upload-label-${p.id}">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Upload Image to Zoho
                    <input type="file" id="pm-upload-input-${p.id}" accept="image/jpeg,image/png,image/gif,image/webp" style="display:none">
                </label>
                <span class="pm-upload-status" id="pm-upload-status-${p.id}"></span>
            </div>

            <div class="pm-detail-grid">
                ${p.description ? `<div class="pm-detail-section"><div class="pm-detail-label">Description</div><div class="pm-detail-val">${p.description}</div></div>` : ''}
                ${p.hsn ? `<div class="pm-detail-section"><div class="pm-detail-label">HSN / SAC</div><div class="pm-detail-val">${p.hsn}</div></div>` : ''}
                ${p.taxName ? `<div class="pm-detail-section"><div class="pm-detail-label">Tax</div><div class="pm-detail-val">${p.taxName} (${p.taxPercentage}%)</div></div>` : ''}
                ${p.reorderLevel ? `<div class="pm-detail-section"><div class="pm-detail-label">Reorder Level</div><div class="pm-detail-val">${p.reorderLevel} ${p.unit || 'units'}</div></div>` : ''}
                ${p.preferredVendor ? `<div class="pm-detail-section"><div class="pm-detail-label">Preferred Vendor</div><div class="pm-detail-val">${p.preferredVendor}</div></div>` : ''}
            </div>

            ${p.warehouses && p.warehouses.length ? `
            <div class="pm-detail-warehouses">
                <div class="pm-detail-label">Stock by Warehouse</div>
                ${p.warehouses.map(w => `
                    <div class="pm-wh-row">
                        <span>${w.name}</span>
                        <span class="pm-wh-stock">${w.stock} ${p.unit || 'units'}</span>
                    </div>`).join('')}
            </div>` : ''}
        </div>`;
    }

    async uploadImage(itemId, file) {
        if (!file) return;
        const statusEl = document.getElementById(`pm-upload-status-${itemId}`);
        const labelEl  = document.getElementById(`pm-upload-label-${itemId}`);
        if (!statusEl || !labelEl) return;

        // Show uploading state
        statusEl.className = 'pm-upload-status uploading';
        statusEl.textContent = 'Uploading…';
        labelEl.classList.add('disabled');

        try {
            // Read file as base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const result = await this.callZohoUploadProductImage({
                itemId,
                imageBase64: base64,
                mimeType: file.type
            });

            // Update the image displayed in the modal
            const detailImg = document.querySelector('.pm-detail-img');
            if (detailImg && result.data.imageUrl) {
                detailImg.innerHTML = `<img src="${result.data.imageUrl}&t=${Date.now()}" alt="Product" onerror="this.parentElement.innerHTML='<div class=pm-detail-icon>📦</div>'">`;
            }

            statusEl.className = 'pm-upload-status success';
            statusEl.textContent = '✓ Uploaded to Zoho!';
            setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'pm-upload-status'; }, 4000);

        } catch (err) {
            console.error('[ProductManager] uploadImage error:', err);
            statusEl.className = 'pm-upload-status error';
            statusEl.textContent = `✗ ${err.message || 'Upload failed'}`;
        } finally {
            labelEl.classList.remove('disabled');
        }
    }

    closeModal() {
        const modal = document.getElementById('pm-modal');
        if (modal) modal.style.display = 'none';
    }

    async syncNow() {
        const btn = document.getElementById('pm-sync-btn');
        if (!btn) return;
        btn.disabled = true;
        btn.innerHTML = `<div class="pm-spinner-sm"></div> Syncing…`;

        try {
            const result = await this.callZohoSyncProducts({});
            const { count } = result.data;
            btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/></svg> Sync`;
            document.getElementById('pm-sync-info').textContent = `Synced ${count} products just now`;
            this.currentPage = 1;
            await this.loadProducts();
        } catch (err) {
            console.error('[ProductManager] syncNow error:', err);
            btn.innerHTML = `⚠ Failed`;
            setTimeout(() => {
                btn.disabled = false;
                btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10"/><path d="M20.49 15a9 9 0 01-14.85 3.36L1 14"/></svg> Sync`;
            }, 3000);
            return;
        }

        btn.disabled = false;
    }
}

window.ProductManager = ProductManager;

/**
 * ProductManager — Zoho Product Catalog Frontend
 * Calls zohoGetProducts / zohoGetProductDetail Firebase functions
 */

class ProductManager {
    constructor() {
        this.products = [];
        this.categories = [];
        this.currentPage = 1;
        this.perPage = 48;
        this.total = 0;
        this.searchQuery = '';
        this.selectedCategory = '';
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
                    <option value="">All Categories</option>
                </select>
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
            this.selectedCategory = e.target.value;
            this.currentPage = 1;
            this.loadProducts();
        });

        syncBtn?.addEventListener('click', () => this.syncNow());

        modalClose?.addEventListener('click', () => this.closeModal());
        modalOverlay?.addEventListener('click', (e) => {
            if (e.target === modalOverlay) this.closeModal();
        });
    }

    async loadProducts() {
        if (this.loading) return;
        this.loading = true;
        this._showGridLoading();

        try {
            const result = await this.callZohoGetProducts({
                search: this.searchQuery,
                category: this.selectedCategory,
                page: this.currentPage,
                perPage: this.perPage
            });

            const { products, total, categories, syncedAt, hasMore } = result.data;
            this.products = products;
            this.total = total;
            this.syncedAt = syncedAt;

            if (categories && categories.length) {
                this._populateCategories(categories);
            }

            this._renderGrid(products);
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
        catEl.innerHTML = '<option value="">All Categories</option>' +
            categories.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
    }

    _renderGrid(products) {
        const grid = document.getElementById('pm-grid');
        if (!grid) return;

        if (!products || products.length === 0) {
            grid.innerHTML = `<div class="pm-empty"><div class="pm-empty-icon">📦</div><p>No products found</p><small>Try adjusting your search or filter</small></div>`;
            return;
        }

        grid.innerHTML = products.map(p => this._productCard(p)).join('');

        // Attach click events
        grid.querySelectorAll('.pm-card').forEach(card => {
            card.addEventListener('click', () => this.openDetail(card.dataset.id));
        });
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
                <div class="pm-card-cat">${p.categoryName || 'General'}</div>
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
        } catch (err) {
            // Fallback to cached card data
            if (cached) {
                body.innerHTML = this._detailHTML(cached);
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
                    <div class="pm-detail-cat">${p.categoryName || 'General'}</div>
                    <h2 class="pm-detail-name">${p.name}</h2>
                    ${p.sku ? `<div class="pm-detail-sku">SKU: <strong>${p.sku}</strong></div>` : ''}
                    <div class="pm-detail-price">₹${(p.rate || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })} <span class="pm-detail-unit">/ ${p.unit || 'pcs'}</span></div>
                    <div class="pm-stock-badge ${stockClass}" style="margin-top:10px;display:inline-flex;">${stockLabel} — ${p.stock} ${p.unit || 'units'}</div>
                </div>
            </div>

            <div class="pm-detail-grid">
                ${p.description ? `<div class="pm-detail-section"><div class="pm-detail-label">Description</div><div class="pm-detail-val">${p.description}</div></div>` : ''}
                <div class="pm-detail-section"><div class="pm-detail-label">Purchase Rate</div><div class="pm-detail-val">₹${(p.purchaseRate || 0).toFixed(2)}</div></div>
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

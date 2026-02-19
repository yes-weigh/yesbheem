/**
 * B2BLeadsManager
 * Controller for the B2B Leads Page
 */
import { B2BLeadsService } from './services/b2b_leads_service.js';
import { AudienceService } from './services/audience_service.js';
import { DataManager } from './data_manager.js';
import { DealerValidator } from './components/dealer-validator.js'; // Import Validator
import FormatUtils from './utils/format-utils.js';
import { Toast } from './utils/toast.js';

import { StateSelector } from './components/state-selector.js'; // Import StateSelector

if (!window.B2BLeadsManager) {
    window.B2BLeadsManager = class B2BLeadsManager {
        constructor() {
            this.leads = [];
            this.filteredLeads = []; // Total results after filter

            this.service = new B2BLeadsService();
            this.audienceService = new AudienceService();
            this.dataManager = new DataManager();
            this.validator = new DealerValidator(); // Initialize Validator

            // Components
            this.stateSelector = new StateSelector({
                containerId: 'state-selector-container',
                onChange: (selectedStates) => {
                    this.stateFilter = selectedStates;
                    this.currentPage = 1;
                    this.updateDistrictFilter();
                    this.applyFilters();
                }
            });

            // Filters
            this.searchQuery = '';
            this.stateFilter = []; // Array for multi-select
            this.districtFilter = 'all';
            this.statusFilter = 'all';
            this.kamFilter = 'all';

            // Sorting
            this.sortColumn = 'updatedAt';
            this.sortDirection = 'desc';

            // Pagination
            this.currentPage = 1;
            this.itemsPerPage = 20;

            // Selection
            this.selectedLeads = new Set();

            // Modal state
            this.isModalOpen = false;

            this.isModalOpen = false;

            // Expose migration tool
            window.startB2BDataMigration = () => this.runMigration();

            this.init();
        }

        async runMigration() {
            if (confirm('Start B2B Data Migration? This will convert 5000+ docs to shards and DELETE legacy docs. This cannot be undone.')) {
                try {
                    console.log('Starting Migration UI...');
                    // Optional: Show loading UI
                    const result = await this.service.migrateData();
                    if (result) {
                        alert('Migration Successful! Reloading data...');
                        this.loadData();
                    } else {
                        alert('Migration Failed or Aborted. Check console.');
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error: ' + e.message);
                }
            }
        }

        async init() {
            console.log('B2BLeadsManager initializing...');
            this.setupEventListeners();
            if (this.dataManager) {
                await this.dataManager.loadGeneralSettings();
            }
            this.renderKPICards(); // Initialize cards with settings
            await this.loadData();
        }

        async loadData() {
            const startLoad = performance.now();
            console.log('[Performance] Starting B2B Data Load...');
            this.showLoadingState();
            try {
                this.leads = await this.service.getAllLeads();

                // Normalization
                this.leads = this.leads.map(lead => {
                    const normState = this.validator ? this.validator.normalizeState(lead.state) : (lead.state || '');
                    return {
                        ...lead,
                        state: normState,
                        searchString: `${lead.name || ''} ${lead.phone || ''} ${lead.business_name || ''} ${normState || ''} ${lead.district || ''}`.toLowerCase()
                    };
                });

                this.renderKPICards();
                this.renderFilters();
                this.applyFilters();

                const endLoad = performance.now();
                console.log(`[Performance] Total B2B Page Load took: ${(endLoad - startLoad).toFixed(2)}ms`);

            } catch (error) {
                console.error('Failed to load leads:', error);
                this.showErrorState(error.message);
                if (Toast) Toast.error('Failed to load leads: ' + error.message);
            }
        }

        showLoadingState() {
            const tableBody = document.getElementById('leads-table-body');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 3rem; color: var(--text-muted);"><div class="loading-spinner"></div> Loading leads...</td></tr>';
            }
        }

        showErrorState(msg) {
            const tableBody = document.getElementById('leads-table-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 2rem; color: #ef4444;">Error: ${msg}</td></tr>`;
            }
        }

        setupEventListeners() {
            this.attachDOMListeners();
            if (!this.globalListenersAttached) {
                this.attachGlobalListeners();
                this.globalListenersAttached = true;
            }
        }

        attachDOMListeners() {
            // Search
            const searchInput = document.getElementById('lead-search');
            if (searchInput) {
                // Remove old listener if any (cleaner, though strictly not necessary if element is new)
                searchInput.oninput = (e) => {
                    this.searchQuery = e.target.value.toLowerCase();
                    this.currentPage = 1; // Reset page on search
                    this.applyFilters();
                };
            }

            // Select All
            const selectAll = document.getElementById('select-all-leads');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    this.toggleSelectAll(e.target.checked);
                });
            }

            // Close modals on overlay click (delegate - these are new elements)
            document.querySelectorAll('.modal-overlay').forEach(overlay => {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.closeModal();
                        this.closeAudienceModal();
                        this.closeBulkKAMModal();
                    }
                });
            });

            // Move Modals to Body (Stacking Context Fix)
            const kamModal = document.getElementById('bulk-kam-modal');
            if (kamModal && kamModal.parentElement !== document.body) document.body.appendChild(kamModal);

            const audModal = document.getElementById('save-audience-modal');
            if (audModal && audModal.parentElement !== document.body) document.body.appendChild(audModal);
        }

        attachGlobalListeners() {
            // Filters (Delegated on document)
            document.addEventListener('change', (e) => {
                // state-selector handles its own events via callback
                if (['filter-district', 'filter-status', 'filter-kam'].includes(e.target.id)) {
                    if (e.target.id === 'filter-district') {
                        this.districtFilter = e.target.value;
                    } else if (e.target.id === 'filter-status') {
                        this.statusFilter = e.target.value;
                    } else if (e.target.id === 'filter-kam') {
                        this.kamFilter = e.target.value;
                    }
                    this.currentPage = 1; // Reset page on filter
                    this.applyFilters();
                }
            });
        }

        renderFilters() {
            // Populate State Filter via Component
            const states = [...new Set(this.leads.map(l => l.state).filter(Boolean))].sort();
            if (this.stateSelector) {
                this.stateSelector.setStates(states);
                // this.stateSelector.setValue(this.stateFilter); // Default is empty/all
            }

            this.updateDistrictFilter();

            // Populate KAM Filter
            const kams = [...new Set(this.leads.map(l => l.kam).filter(Boolean))].sort();
            const kamSelect = document.getElementById('filter-kam');
            if (kamSelect) {
                let html = '<option value="all">All KAMs</option>';
                kams.forEach(k => html += `<option value="${k}">${k}</option>`);
                kamSelect.innerHTML = html;
                kamSelect.value = this.kamFilter;
            }

            // Populate Status Filter
            const statusSelect = document.getElementById('filter-status');
            if (statusSelect && this.dataManager && this.dataManager.generalSettings && this.dataManager.generalSettings.lead_stages) {
                let html = '<option value="all">All Status</option>';
                this.dataManager.generalSettings.lead_stages.forEach(s => html += `<option value="${s}">${s}</option>`);
                statusSelect.innerHTML = html;
                statusSelect.value = this.statusFilter;
            }
        }

        updateDistrictFilter() {
            const districtSelect = document.getElementById('filter-district');
            if (!districtSelect) return;

            const wrapper = districtSelect.closest('.filter-wrapper');
            // Show district filter if at least one state is selected (or if we want to show all districts when no state is selected, but usually dependent)
            // Dealer logic: shows all districts if no state selected? Or hides?
            // "if (this.stateFilter === 'all')" logic in old code.
            // New logic: if array is empty, show all? Or hide?
            // DealerManager shows all states districts if empty.

            let relevantLeads = this.leads;
            if (this.stateFilter.length > 0) {
                relevantLeads = this.leads.filter(l => this.stateFilter.includes(l.state));
            }

            const districts = [...new Set(relevantLeads.map(l => l.district).filter(Boolean))].sort();

            let html = '<option value="all">All Districts</option>';
            districts.forEach(d => html += `<option value="${d}">${d}</option>`);
            districtSelect.innerHTML = html;

            // Reset selection if current district is not in new list
            if (this.districtFilter !== 'all' && !districts.includes(this.districtFilter)) {
                this.districtFilter = 'all';
            }
            districtSelect.value = this.districtFilter;

            // Ensure it's visible
            if (wrapper) wrapper.style.display = 'flex';
        }



        applyFilters() {
            this.filteredLeads = this.leads.filter(lead => {
                const matchesSearch = !this.searchQuery || lead.searchString.includes(this.searchQuery);
                // Multi-state check
                const matchesState = this.stateFilter.length === 0 || (lead.state && this.stateFilter.includes(lead.state));

                const matchesDistrict = this.districtFilter === 'all' || (lead.district && lead.district.toLowerCase() === this.districtFilter.toLowerCase());
                const matchesStatus = this.statusFilter === 'all' || lead.status === this.statusFilter;
                const matchesKam = this.kamFilter === 'all' || lead.kam === this.kamFilter;

                return matchesSearch && matchesState && matchesDistrict && matchesStatus && matchesKam;
            });

            this.sortLeads();
            this.renderTable();
            this.updateStats();
            this.renderActiveFilters(); // Update chips
        }

        renderActiveFilters() {
            const container = document.getElementById('active-filters-list');
            const bar = document.getElementById('active-filter-bar');

            if (!container || !bar) return;

            container.innerHTML = '';
            let hasFilters = false;

            const createChip = (label, value, type, originalValue) => {
                hasFilters = true;
                const chip = document.createElement('div');
                chip.className = 'filter-chip';
                chip.innerHTML = `
                    <span class="filter-chip-label">${label}:</span>
                    <span>${value}</span>
                    <button class="filter-chip-remove" title="Remove filter">×</button>
                `;
                chip.querySelector('.filter-chip-remove').addEventListener('click', () => {
                    this.removeFilter(type, originalValue);
                });
                container.appendChild(chip);
            };

            if (this.searchQuery) {
                createChip('Search', this.searchQuery, 'search');
            }
            // State Chips
            if (this.stateFilter.length > 0) {
                this.stateFilter.forEach(state => {
                    createChip('State', state, 'state', state);
                });
            }

            if (this.districtFilter && this.districtFilter !== 'all') {
                createChip('District', this.districtFilter, 'district');
            }
            if (this.statusFilter && this.statusFilter !== 'all') {
                createChip('Status', this.statusFilter, 'status');
            }
            if (this.kamFilter && this.kamFilter !== 'all') {
                createChip('KAM', this.kamFilter, 'kam');
            }

            // Show/Hide bar based on filters
            bar.style.display = hasFilters ? 'flex' : 'none';
        }

        removeFilter(type, value) {
            if (type === 'search') {
                this.searchQuery = '';
                const searchInput = document.getElementById('lead-search');
                if (searchInput) searchInput.value = '';
            } else if (type === 'state') {
                // Remove specific state from array
                this.stateFilter = this.stateFilter.filter(s => s !== value);
                if (this.stateSelector) this.stateSelector.setValue(this.stateFilter);
                this.updateDistrictFilter();
            } else if (type === 'district') {
                this.districtFilter = 'all';
            } else if (type === 'status') {
                this.statusFilter = 'all';
            } else if (type === 'kam') {
                this.kamFilter = 'all';
            }

            // Update UI selectors (standard ones)
            this.updateFilterSelectors();
            this.applyFilters();
        }

        clearAllFilters() {
            this.searchQuery = '';
            this.stateFilter = [];
            this.districtFilter = 'all';
            this.statusFilter = 'all';
            this.kamFilter = 'all';

            const searchInput = document.getElementById('lead-search');
            if (searchInput) searchInput.value = '';

            if (this.stateSelector) this.stateSelector.reset();

            this.updateFilterSelectors();
            this.applyFilters();
        }

        updateFilterSelectors() {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.value = val;
            };
            // setVal('filter-state', this.stateFilter); // Handled by component now
            setVal('filter-district', this.districtFilter);
            setVal('filter-status', this.statusFilter);
            setVal('filter-kam', this.kamFilter);

            this.updateDistrictFilter();
            setVal('filter-district', this.districtFilter);
        }

        sortLeads() {
            if (!this.sortColumn) return;
            const dir = this.sortDirection === 'asc' ? 1 : -1;

            this.filteredLeads.sort((a, b) => {
                let valA = a[this.sortColumn] || '';
                let valB = b[this.sortColumn] || '';

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
            });

            this.updateSortIcons();
        }

        sortBy(column) {
            if (this.sortColumn === column) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumn = column;
                this.sortDirection = 'asc';
            }
            this.sortLeads();
            this.renderTable();
            this.renderPagination();
        }

        updateSortIcons() {
            const headers = document.querySelectorAll('.leads-table th.sortable');
            headers.forEach(th => {
                th.classList.remove('asc', 'desc');
                if (th.getAttribute('onclick').includes(this.sortColumn)) {
                    th.classList.add(this.sortDirection);
                }
            });
        }

        // --- Pagination ---

        renderPagination() {
            const container = document.getElementById('pagination-container');
            if (!container) return;

            const totalItems = this.filteredLeads.length;

            if (totalItems === 0) {
                container.innerHTML = '';
                return;
            }

            let infoText = '';
            let controlsHtml = '';

            // Default to enabled if not set
            if (this.isPaginationEnabled === undefined) this.isPaginationEnabled = true;

            if (this.isPaginationEnabled) {
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);

                // Ensure current page is valid
                if (this.currentPage > totalPages) this.currentPage = totalPages;
                if (this.currentPage < 1) this.currentPage = 1;

                const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
                const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

                infoText = `Showing ${startItem}-${endItem} of ${totalItems}`;
                controlsHtml = `
                    <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.b2bLeadsManager.changePage(${this.currentPage - 1})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                        Prev
                    </button>
                    <span class="page-current">Page ${this.currentPage} of ${totalPages}</span>
                    <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.b2bLeadsManager.changePage(${this.currentPage + 1})">
                        Next
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                `;
            } else {
                infoText = `Showing all ${totalItems} leads`;
                controlsHtml = '';
            }

            const toggleBtnText = this.isPaginationEnabled ? 'View All' : 'Paginate';

            container.innerHTML = `
                <div class="pagination-controls" style="display: flex; align-items: center; padding: 1rem 1.5rem; border-top: 1px solid #334155; background: rgba(30, 41, 59, 0.5); color: #94a3b8; border-bottom-left-radius: 8px; border-bottom-right-radius: 8px;">
                     <div class="pagination-info" style="flex: 1;">
                        ${infoText}
                    </div>
                    <div class="pagination-actions" style="display: flex; align-items: center; gap: 8px;">
                        ${controlsHtml}
                        <div style="width: 1px; height: 16px; background: #475569; margin: 0 10px;"></div>
                        <button class="page-btn" onclick="window.b2bLeadsManager.togglePagination()">
                            ${toggleBtnText}
                        </button>
                    </div>
                </div>
            `;
        }

        togglePagination() {
            this.isPaginationEnabled = !this.isPaginationEnabled;
            if (this.isPaginationEnabled) {
                this.currentPage = 1;
            }
            this.renderTable();
        }

        changePage(newPage) {
            if (!this.isPaginationEnabled) return;

            const totalItems = this.filteredLeads.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);

            if (newPage < 1 || newPage > totalPages) return;

            this.currentPage = newPage;
            this.renderTable();

            // Scroll to top of table
            const tableContainer = document.querySelector('.leads-table-container');
            if (tableContainer) tableContainer.scrollTop = 0;
            else {
                const table = document.getElementById('leads-table');
                if (table) table.scrollIntoView({ behavior: 'smooth' });
            }
        }


        // --- Stats & Helpers ---

        setStatusFilter(status) {
            const select = document.getElementById('filter-status');
            if (select) {
                select.value = status;
                // Trigger change event manually
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        renderKPICards() {
            const container = document.getElementById('kpi-grid');
            if (!container) return;

            // Default stages if settings not loaded
            let stages = this.dataManager?.generalSettings?.lead_stages || ['New', 'Contacted', 'Converted', 'Lost'];

            // Calculate counts for sorting (using ALL leads to allow stable sort)
            // If data not loaded yet, counts are 0, order is default.
            const counts = { total: (this.leads || []).length };

            // Initialize counts
            stages.forEach(stage => counts[stage] = 0);

            // Count all leads
            (this.leads || []).forEach(lead => {
                const status = lead.status || 'New';
                // Case-insensitive match? For now, exact or capitalize first letter
                // In loadData we normalized status to capitalized
                if (counts.hasOwnProperty(status)) {
                    counts[status]++;
                }
            });

            // Create array for sorting
            // Total is special, handle separately or inclusion?
            // User wants decreasing order. Total is max.
            // Let's create card objects
            let cards = [];

            // Add Stage Cards
            stages.forEach(stage => {
                if (stage.toLowerCase() === 'all' || stage.toLowerCase() === 'total' || stage.toLowerCase() === 'cold') return;
                cards.push({
                    type: 'stage',
                    label: stage,
                    count: counts[stage] || 0,
                    filter: stage,
                    color: '' // assign later
                });
            });

            // Sort Stage Cards by Count Descending
            cards.sort((a, b) => b.count - a.count);

            // Define Total Card
            const totalCard = {
                type: 'total',
                label: 'TOTAL',
                count: counts.total,
                filter: 'all',
                color: 'card-blue'
            };

            // Combine: Total First, then sorted stages
            // Or if strictly decreasing, Total is first anyway. 
            // Let's keep Total pinned first for UX consistency, then other stages sorted by volume.
            const finalCards = [totalCard, ...cards];

            // Colors to cycle through for stages
            const colors = ['card-teal', 'card-indigo', 'card-green', 'card-red', 'card-yellow', 'card-purple', 'card-orange', 'card-pink'];

            let html = '';
            finalCards.forEach((card, index) => {
                let colorClass = card.color;
                if (!colorClass) {
                    // Assign color based on index (skipping 0 which is Total's blue if we used it, but here we manage 'colors' array separately)
                    // We want stable colors for stages? Or colors dependent on rank?
                    // Request is "arranged in decreasing order". 
                    // If we use rank-based colors, "New" (highest) gets 'card-teal'.
                    // If we want fixed colors per stage, we need a map. 
                    // Current code: `colors[(index + 1) % colors.length]`. This assigns color based on *position*.
                    // Let's stick to position-based coloring for the gradient effect.
                    colorClass = colors[(index - 1) % colors.length];
                }

                const safeId = card.type === 'total' ? 'total' : `stage-${card.label.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
                const label = card.type === 'total' ? 'TOTAL' : card.label.toUpperCase();

                html += `
                <div class="kpi-card ${colorClass}" onclick="window.b2bLeadsManager.setStatusFilter('${card.filter}')" style="cursor: pointer;">
                    <div class="kpi-content">
                        <span class="kpi-value" id="stats-${safeId}">${card.count}</span>
                    </div>
                    <div class="kpi-header">
                        <span class="kpi-label">${label}</span>
                    </div>
                </div>
            `;
            });

            container.innerHTML = html;
            container.style.gridTemplateColumns = `repeat(auto-fit, minmax(180px, 1fr))`;
        }

        updateHeaderStats() {
            // If cards not rendered yet (e.g. first load), render them
            // But renderKPICards now depends on data. 
            // We should call renderKPICards in loadData AFTER data fetch.
            // updateHeaderStats just updates values for *filtered* view?
            // Wait, if we sorted by Total, but updateStats shows *Filtered* counts...
            // Then the order might not match the displayed numbers (e.g. Total=10, New=10, Lost=0. Filter by Lost -> Total=0, New=0, Lost=0?)
            // Actually updateStats updates with `this.filteredLeads.length`.

            // If I filter by "Lost", filtered leads = 0 (if valid lost leads).
            // If I use the search bar, counts change.

            // Let's just update the numbers. The Order remains fixed based on Global Volume (calculated at load time).
            // This is standard. "Most popular stages first".

            if (!document.getElementById('stats-total')) {
                this.renderKPICards();
            }

            const stages = this.dataManager?.generalSettings?.lead_stages || ['New', 'Contacted', 'Converted', 'Lost'];
            const stats = { total: this.filteredLeads.length };

            // Initialize counts
            stages.forEach(stage => {
                stats[stage] = 0;
            });

            // Count
            this.filteredLeads.forEach(l => {
                const status = l.status || 'New';
                // Normalize status to match stage keys if needed (Capitalized)
                // We assume l.status is clean or we normalized it in loadData
                // But let's be safe: find case-insensitive match
                const match = stages.find(s => s.toLowerCase() === status.toLowerCase());
                if (match) {
                    stats[match]++;
                } else {
                    // Fallback?
                    if (stats.hasOwnProperty(status)) stats[status]++;
                }
            });

            // Update DOM
            const updateEl = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                    // Small animation effect
                    // Check if value changed to avoid DOM thrashing?
                    // Text content check is cheap.
                    if (el.textContent !== val.toString()) {
                        el.textContent = val;
                    }
                }
            };

            updateEl('stats-total', stats.total);

            stages.forEach(stage => {
                const safeId = stage.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
                updateEl(`stats-stage-${safeId}`, stats[stage]);
            });

            // Update Header Count Display
            const countDisplay = document.getElementById('lead-count-display');
            if (countDisplay) {
                countDisplay.textContent = `${stats.total} Lead${stats.total !== 1 ? 's' : ''}`;
                countDisplay.style.color = 'var(--text-main)';
            }
        }

        updateStats() {
            this.updateHeaderStats();
        }

        // --- Table Rendering ---

        renderTable() {
            const tbody = document.getElementById('leads-table-body');
            if (!tbody) return;

            if (this.filteredLeads.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="10" style="text-align:center; padding: 4rem;">
                            <div style="display:flex;flex-direction:column;align-items:center;gap:12px;opacity:0.6;">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                                <span>No leads found matching your criteria.</span>
                            </div>
                        </td>
                    </tr>
                `;
                this.renderPagination();
                return;
            }

            // Slice for pagination
            let startIdx = 0;
            let pageData = this.filteredLeads;

            if (this.isPaginationEnabled) {
                // Ensure current page is valid
                const totalPages = Math.ceil(this.filteredLeads.length / this.itemsPerPage);
                if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);

                startIdx = (this.currentPage - 1) * this.itemsPerPage;
                pageData = this.filteredLeads.slice(startIdx, startIdx + this.itemsPerPage);
            }

            tbody.innerHTML = pageData.map((lead, index) => `
                <tr class="lead-row" onclick="window.b2bLeadsManager.openEditModal('${lead.id}')">
                    <td style="text-align:center" onclick="event.stopPropagation()">
                        <input type="checkbox" 
                            ${this.selectedLeads.has(lead.id) ? 'checked' : ''} 
                            onchange="window.b2bLeadsManager.toggleSelection('${lead.id}', this.checked)">
                    </td>
                    <td style="text-align:center; color:var(--text-muted); font-size: 0.8rem;">${startIdx + index + 1}</td>
                    <td style="font-weight:500;">${lead.name || '-'}</td>
                    <td>${lead.business_name || '-'}</td>
                    <td class="editable-cell" onclick="event.stopPropagation(); window.b2bLeadsManager.showInlineEdit('${lead.id}', 'phone', this)" style="font-family:monospace; opacity:0.9;">${lead.phone || '-'}</td>
                    <td>${lead.state || '-'}</td>
                    <td>${lead.district || '-'}</td>
                    <td class="editable-cell" onclick="event.stopPropagation(); window.b2bLeadsManager.showInlineEdit('${lead.id}', 'status', this)"><span class="status-badge ${lead.status || 'new'}">${lead.status || 'New'}</span></td>
                    <td>${lead.kam || '-'}</td>
                    <td style="text-align:center;" onclick="event.stopPropagation()">
                        <button class="icon-btn delete" onclick="window.b2bLeadsManager.deleteLead('${lead.id}')" title="Delete">
                           🗑️
                        </button>
                    </td>
                </tr>
            `).join('');

            // Select All Checkbox state
            const selectAll = document.getElementById('select-all-leads');
            if (selectAll) {
                // If every item on THIS PAGE is selected, check the box (or global check? Usually global for 'All', but let's stick to current view behavior or maintain global selection set)
                // If we want Select All to select ALL filtered leads, checking logic is different.
                // Current implementation: selectAll toggles filteredLeads.
                const allSelected = this.filteredLeads.length > 0 && this.filteredLeads.every(l => this.selectedLeads.has(l.id));
                // Or checking page only?
                // const pageAllSelected = pageData.length > 0 && pageData.every(l => this.selectedLeads.has(l.id));
                selectAll.checked = allSelected;
                selectAll.indeterminate = !allSelected && this.selectedLeads.size > 0;
            }

            // Update pagination controls
            this.renderPagination();
        }

        toggleSelection(id, checked) {
            if (checked) {
                this.selectedLeads.add(id);
            } else {
                this.selectedLeads.delete(id);
            }
            this.updateBulkActions();
            this.renderTable(); // To update checkbox UI if needed (rarely needed for single row)
        }

        toggleSelectAll(checked) {
            if (checked) {
                this.filteredLeads.forEach(l => this.selectedLeads.add(l.id));
            } else {
                this.selectedLeads.clear();
            }
            this.renderTable();
            this.updateBulkActions();
        }

        updateBulkActions() {
            const bar = document.getElementById('bulk-actions-bar');
            const countEl = document.getElementById('bulk-selected-count');

            if (bar && countEl) {
                const count = this.selectedLeads.size;
                countEl.textContent = count;
                if (count > 0) {
                    bar.classList.add('visible');
                    // bar.style.display = 'flex'; // Handled by CSS
                } else {
                    bar.classList.remove('visible');
                    // bar.style.display = 'none';
                }
            }
        }

        clearSelection() {
            this.selectedLeads.clear();
            const selectAll = document.getElementById('select-all-leads');
            if (selectAll) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
            this.renderTable();
            this.updateBulkActions();
        }

        // --- Modals ---

        openAddModal() {
            this.openEditModal(null);
        }

        openEditModal(leadId) {
            const isEdit = !!leadId;
            const lead = isEdit ? this.leads.find(l => l.id === leadId) : {};

            if (!lead && isEdit) {
                if (Toast) Toast.error('Lead not found.');
                return;
            }

            // Close correct modal
            this.closeEditModal();

            // Load settings? Assuming dataManager has them
            const settings = this.dataManager ? this.dataManager.generalSettings : {};

            const html = window.UIRenderer.renderB2BLeadModal(lead, settings);
            document.body.insertAdjacentHTML('beforeend', html);
            this.isModalOpen = true;
            this.currentEditingLogId = null; // Reset edit state

            if (isEdit) {
                this.renderLogsList(leadId);
            }
        }

        closeEditModal() {
            this.isModalOpen = false;
            const modal = document.querySelector('.dealer-modal-overlay');
            if (modal) modal.remove();
        }

        // toggleEditField removed as fields are directly editable.

        async handlePopupZipChange(inputField) {
            const zipCode = inputField.value.trim();
            if (!zipCode || !/^\d{6}$/.test(zipCode)) return;

            const container = inputField.parentElement;
            const spinner = container.querySelector('.zip-loading-spinner');
            if (spinner) spinner.style.display = 'block';

            try {
                // Use dataManager to get location
                const location = await this.dataManager.getLocationFromZip(zipCode);
                if (location) {
                    // Find fields within the modal
                    const modal = inputField.closest('.dealer-modal');
                    if (modal) {
                        const districtInput = modal.querySelector('input[data-field="district"]');
                        const stateInput = modal.querySelector('input[data-field="state"]');

                        if (districtInput) {
                            districtInput.value = location.district;
                            // Flash effect?
                            districtInput.style.transition = 'background 0.2s';
                            districtInput.style.background = 'rgba(59, 130, 246, 0.2)';
                            setTimeout(() => districtInput.style.background = '', 500);
                        }
                        if (stateInput) {
                            stateInput.value = location.state;
                            stateInput.style.transition = 'background 0.2s';
                            stateInput.style.background = 'rgba(59, 130, 246, 0.2)';
                            setTimeout(() => stateInput.style.background = '', 500);
                        }
                    }
                }
            } catch (error) {
                console.error('Error fetching zip location:', error);
            } finally {
                if (spinner) spinner.style.display = 'none';
            }
        }

        async saveLeadDetails(leadId) {
            const modal = document.querySelector('.dealer-modal');
            if (!modal) return;

            const saveBtn = modal.querySelector('.btn-save');
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            const data = {};
            // Scrape all data-field inputs
            modal.querySelectorAll('[data-field]').forEach(input => {
                const field = input.dataset.field;
                const val = input.value; // .trim() done inside?
                if (field) data[field] = val;
            });

            try {
                if (leadId) {
                    await this.service.updateLead(leadId, data);
                    // Update local state
                    const index = this.leads.findIndex(l => l.id === leadId);
                    if (index !== -1) {
                        this.leads[index] = { ...this.leads[index], ...data };
                        // Update search string too
                        this.leads[index].searchString = `${this.leads[index].name || ''} ${this.leads[index].phone || ''} ${this.leads[index].business_name || ''} ${this.leads[index].state || ''} ${this.leads[index].district || ''}`.toLowerCase();
                    }
                    if (Toast) Toast.success('Lead updated successfully');
                } else {
                    const newLead = await this.service.addLead(data);
                    // Add to local state
                    newLead.searchString = `${newLead.name || ''} ${newLead.phone || ''} ${newLead.business_name || ''} ${newLead.state || ''} ${newLead.district || ''}`.toLowerCase();
                    this.leads.unshift(newLead); // Add to top
                    if (Toast) Toast.success('Lead added successfully');
                }

                this.closeEditModal();
                this.applyFilters();
            } catch (error) {
                if (Toast) Toast.error('Error saving lead: ' + error.message);
                if (saveBtn) {
                    saveBtn.disabled = false; // Re-enable
                    saveBtn.textContent = leadId ? 'Save Changes' : 'Create Lead';
                }
            }
        }

        async deleteLead(leadId) {
            if (!confirm('Are you sure you want to delete this lead?')) return;

            try {
                await this.service.deleteLead(leadId);
                this.leads = this.leads.filter(l => l.id !== leadId);
                this.selectedLeads.delete(leadId);

                this.applyFilters(); // Re-render
                if (Toast) Toast.success('Lead deleted successfully');
            } catch (error) {
                console.error(error);
                if (Toast) Toast.error('Failed to delete lead');
            }
        }

        // --- LOGS TAB MANAGEMENT ---

        // --- LOGS SECTION MANAGEMENT ---

        // switchEditModalTab removed as tabs are no longer used.

        renderLogsList(leadId) {
            const container = document.getElementById('b2b-logs-list');
            if (!container) return;

            const lead = this.leads.find(l => l.id === leadId);
            // Ensure logs array exists
            if (!lead.logs) {
                lead.logs = [];
            }

            if (lead.logs.length === 0) {
                container.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 40px; font-style: italic; opacity: 0.7;">No logs recorded yet.</div>';
                return;
            }

            // Sort logs: newest date first
            const logs = [...lead.logs].sort((a, b) => new Date(b.date) - new Date(a.date));

            container.innerHTML = logs.map(log => {
                const dateObj = new Date(log.date); // Manual (Due) Date
                const createdAtObj = log.createdAt ? new Date(log.createdAt) : null;
                const type = log.activityType || 'Log';

                // Format Manual Date (Due Date)
                const dueDateTimeStr = dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

                // Format Created At
                const createdStr = createdAtObj ? createdAtObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';

                return `
                <div class="log-item" style="position: relative; padding-left: 24px; border-left: 2px solid rgba(255,255,255,0.1); padding-bottom: 24px;">
                    <div style="position: absolute; left: -5px; top: 0; width: 10px; height: 10px; border-radius: 50%; background: var(--accent-color); box-shadow: 0 0 0 4px var(--modal-bg-gradient);"></div>
                    
                    <div style="margin-bottom: 8px; display: flex; justify-content: space-between; align-items: flex-start;">
                        <div style="display:flex; flex-direction: column; gap: 4px;">
                            <!-- Top Row: Created Date + Badge -->
                            <div style="display:flex; gap:8px; align-items:center;">
                                ${createdStr ? `<span style="font-size: 0.75rem; color: var(--text-muted); opacity: 0.7;">Logged: ${createdStr}</span>` : ''}
                                <span style="font-size: 0.65rem; padding: 2px 8px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; color: #60a5fa; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">${type}</span>
                            </div>
                            
                            <!-- Second Row: Due Date (Prominent) -->
                            <div style="display:flex; align-items: center; gap: 6px; color: var(--text-main); font-weight: 600; font-size: 0.85rem;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.8;"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                Due: ${dueDateTimeStr}
                            </div>
                        </div>
                        
                        <!-- Actions removed (Read only) -->
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 8px; font-size: 0.95rem; color: var(--modal-input-text); line-height: 1.6; white-space: pre-wrap; border: 1px solid rgba(255,255,255,0.05);">${this.escapeHtml(log.content)}</div>
                </div>
            `}).join('') + `
            <style>
                .log-item:last-child { border-left-color: transparent; padding-bottom: 0; }
            </style>
            `;
        }

        async addLog(leadId) {
            const dateInput = document.getElementById('new-log-date');
            const timeInput = document.getElementById('new-log-time');
            const contentInput = document.getElementById('new-log-content');

            if (!dateInput || !contentInput) return;

            const dateVal = dateInput.value;
            const timeVal = timeInput ? timeInput.value : '00:00';

            // Combine Date and Time
            const dateTime = new Date(`${dateVal}T${timeVal}`).toISOString();

            const activeChip = document.querySelector('.activity-chip.active');
            const type = activeChip ? activeChip.getAttribute('data-value') : 'Log';
            const content = contentInput.value.trim();

            if (!content) {
                if (Toast) Toast.warning('Please enter notes.');
                return;
            }

            // Find Lead
            const lead = this.leads.find(l => l.id === leadId);
            if (!lead) return;
            if (!lead.logs) lead.logs = [];

            // Remove Edit Mode logic as logs are now read-only history
            this.currentEditingLogId = null;

            // CREATE NEW LOG
            const newLog = {
                id: 'log_' + Date.now(),
                date: dateTime, // Combined manual timestamp
                activityType: type,
                content: content,
                createdAt: new Date().toISOString()
            };
            lead.logs.push(newLog);

            // Optimistic Update
            this.renderLogsList(leadId);

            // Clear Inputs
            contentInput.value = '';
            dateInput.value = new Date().toISOString().split('T')[0];
            if (timeInput) timeInput.value = new Date().toTimeString().split(' ')[0].substring(0, 5);
            document.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));

            // API Save
            try {
                await this.service.updateLead(leadId, { logs: lead.logs });
                if (Toast) Toast.success('Log saved successfully');
            } catch (error) {
                console.error('Failed to save log:', error);
                if (Toast) Toast.error('Failed to save log');
                // Revert? For now assume success or user will retry.
            }
        }


        // --- Inline Editing ---

        showInlineEdit(leadId, field, cell) {
            this.closeInlineEdit(); // Close any open edits

            const lead = this.leads.find(l => l.id === leadId);
            if (!lead) return;

            const currentValue = lead[field] || '';

            // Handle Status Dropdown
            if (field === 'status') {
                const options = (this.dataManager && this.dataManager.generalSettings && this.dataManager.generalSettings.lead_stages)
                    ? this.dataManager.generalSettings.lead_stages
                    : ['New', 'Contacted', 'Converted', 'Lost'];

                const dropdown = document.createElement('div');
                dropdown.className = 'inline-edit-dropdown';
                dropdown.innerHTML = `
                    <select class="inline-edit-select">
                        ${options.map(opt => `<option value="${opt}" ${opt === currentValue ? 'selected' : ''}>${opt}</option>`).join('')}
                    </select>
                    <div class="inline-edit-actions">
                        <button class="inline-edit-btn save-btn" title="Save">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                        </button>
                        <button class="inline-edit-btn cancel-btn" title="Cancel">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                `;
                this.setupInlineEditEvents(dropdown, leadId, field, cell, 'select');
            }
            // Handle Phone/Text Input
            else if (field === 'phone') {
                const dropdown = document.createElement('div');
                dropdown.className = 'inline-edit-dropdown';
                dropdown.style.flexDirection = 'row';
                dropdown.style.alignItems = 'center';
                dropdown.innerHTML = `
                    <input type="text" class="inline-edit-input" value="${currentValue}" style="margin-right:0.5rem;">
                    <div class="inline-edit-actions">
                        <button class="inline-edit-btn save-btn" title="Save">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                        </button>
                        <button class="inline-edit-btn cancel-btn" title="Cancel">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                    </div>
                `;
                this.setupInlineEditEvents(dropdown, leadId, field, cell, 'input');
            }
        }

        setupInlineEditEvents(dropdown, leadId, field, cell, inputType) {
            const saveBtn = dropdown.querySelector('.save-btn');
            const cancelBtn = dropdown.querySelector('.cancel-btn');
            const input = dropdown.querySelector(inputType === 'select' ? 'select' : 'input');

            // Save Handler
            saveBtn.onclick = (e) => {
                e.stopPropagation();
                // Get value depending on input type
                const newValue = input.value;
                this.saveInlineEdit(leadId, field, newValue, cell);
            };

            // Cancel Handler
            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeInlineEdit();
            };

            // Prevent click propagation inside dropdown
            dropdown.addEventListener('click', (e) => e.stopPropagation());

            // Position and Append
            const rect = cell.getBoundingClientRect();

            // Improved positioning logic from DealerManager
            dropdown.style.top = `${rect.top + window.scrollY - 4}px`; // Overlap slightly
            // Check right edge
            const isRightEdge = (window.innerWidth - rect.right) < 200;
            if (isRightEdge) {
                dropdown.style.right = `${window.innerWidth - rect.right - window.scrollX}px`;
                dropdown.style.left = 'auto';
            } else {
                dropdown.style.left = `${rect.left + window.scrollX - 4}px`;
            }
            dropdown.style.minWidth = `${Math.max(180, rect.width)}px`;


            // Mark cell
            cell.dataset.originalContent = cell.innerHTML;
            cell.classList.add('editing');

            document.body.appendChild(dropdown);

            // Focus and Outside Click
            setTimeout(() => {
                input.focus();
                const closeHandler = (e) => {
                    // Check if click is inside dropdown or on the editing cell itself
                    if (!e.target.closest('.inline-edit-dropdown') && !e.target.closest('.editing')) {
                        this.closeInlineEdit();
                        document.removeEventListener('click', closeHandler);
                        document.removeEventListener('keydown', keyHandler);
                    }
                };
                const keyHandler = (e) => {
                    if (e.key === 'Escape') {
                        this.closeInlineEdit();
                        document.removeEventListener('click', closeHandler);
                        document.removeEventListener('keydown', keyHandler);
                    } else if (e.key === 'Enter' && inputType !== 'textarea') {
                        // Optional: Save on Enter
                        // this.saveInlineEdit(...)
                    }
                };

                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', keyHandler);
            }, 50);
        }

        closeInlineEdit() {
            const dropdown = document.querySelector('.inline-edit-dropdown');
            if (dropdown) dropdown.remove();

            document.querySelectorAll('.editing').forEach(cell => {
                // Restore original (unless we saved, in which case re-render handles it,
                // but if we cancel we need this. If we saved, this might briefly flash old content before refresh)
                // Actually saveInlineEdit calls refresh which re-renders table, so this only runs on cancel.
                if (cell.dataset.originalContent) {
                    cell.innerHTML = cell.dataset.originalContent;
                    delete cell.dataset.originalContent;
                }
                cell.classList.remove('editing');
            });
        }

        async saveInlineEdit(leadId, field, newValue, cell) {
            this.closeInlineEdit(); // Close UI
            if (cell) {
                // Show saving state
                cell.innerHTML = '<span style="opacity:0.6; font-size:0.85rem;">Saving...</span>';
            }

            try {
                // Determine update object. Use service.
                const updateData = { [field]: newValue };
                await this.service.updateLead(leadId, updateData);

                // Update local state
                const lead = this.leads.find(l => l.id === leadId);
                if (lead) {
                    lead[field] = newValue;
                    // Re-calculate search string if needed
                    if (field === 'phone') {
                        lead.searchString = `${lead.name || ''} ${lead.phone || ''} ${lead.business_name || ''} ${lead.state || ''} ${lead.district || ''}`.toLowerCase();
                    }
                }

                if (Toast) Toast.success('Lead updated');
                // Re-apply filters to refresh view (and re-sort/filter if affected)
                this.applyFilters();
            } catch (error) {
                console.error('Save failed:', error);
                if (Toast) Toast.error('Failed to save: ' + error.message);
                this.renderTable(); // Revert visual state
            }
        }

        async bulkDelete() {
            if (this.selectedLeads.size === 0) return;

            if (!confirm(`Are you sure you want to delete ${this.selectedLeads.size} leads? This cannot be undone.`)) return;

            try {
                // Sequential deletion (Firestore batch limit is 500, but simple loop is safer for now unless huge volume)
                // For better UX, might want to implement a batchDelete in service if not exists.
                // Checking service... B2BLeadsService doesn't have batch delete. Let's do parallel promises.

                const idsToDelete = Array.from(this.selectedLeads);
                const deletePromises = idsToDelete.map(id => this.service.deleteLead(id));

                await Promise.all(deletePromises);

                this.leads = this.leads.filter(l => !this.selectedLeads.has(l.id));
                this.clearSelection();
                this.applyFilters();

                if (Toast) Toast.success(`Deleted ${idsToDelete.length} leads successfully`);
            } catch (error) {
                console.error(error);
                if (Toast) Toast.error('Failed to delete some leads');
            }
        }

        // --- BULK KAM ASSIGNMENT ---

        bulkAssignKAM() {
            if (this.selectedLeads.size === 0) return;

            const modal = document.getElementById('bulk-kam-modal');
            const select = document.getElementById('bulk-kam-select');
            const countEl = document.getElementById('bulk-kam-count');

            if (!modal || !select) return;

            // Populate KAMs
            if (this.dataManager && this.dataManager.generalSettings && this.dataManager.generalSettings.key_accounts) {
                let html = '<option value="">Not Assigned</option>';
                this.dataManager.generalSettings.key_accounts.forEach(kam => {
                    const name = typeof kam === 'object' ? kam.name : kam;
                    html += `<option value="${name}">${name}</option>`;
                });
                select.innerHTML = html;
            }

            if (countEl) countEl.textContent = this.selectedLeads.size;

            modal.style.display = 'flex';
            // Force reflow
            void modal.offsetWidth;
            modal.classList.add('active');
        }

        closeBulkKAMModal() {
            const modal = document.getElementById('bulk-kam-modal');
            if (modal) {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 200);
            }
        }

        async confirmBulkAssign() {
            const select = document.getElementById('bulk-kam-select');
            if (!select) return;

            const kam = select.value;
            const ids = Array.from(this.selectedLeads);

            if (ids.length === 0) return;

            this.closeBulkKAMModal();

            if (Toast) Toast.info(`Assigning KAM to ${ids.length} leads...`);

            try {
                const updates = ids.map(id => this.service.updateLead(id, { kam: kam }));
                await Promise.all(updates);

                // Update local data
                ids.forEach(id => {
                    const lead = this.leads.find(l => l.id === id);
                    if (lead) lead.kam = kam;
                });

                this.clearSelection();
                this.applyFilters(); // Refresh view

                if (Toast) Toast.success(`Successfully assigned KAM to ${ids.length} leads`);
            } catch (error) {
                console.error('Bulk assign failed:', error);
                if (Toast) Toast.error('Failed to assign KAM: ' + error.message);
                this.applyFilters(); // Refresh anyway
            }
        }

        // --- AUDIENCE ACTIONS ---

        openAudienceModal() {
            console.log('openAudienceModal called');
            this.audienceModal = document.getElementById('save-audience-modal');
            this.audienceNameInput = document.getElementById('audience-name-input');
            this.audienceCountPreview = document.getElementById('audience-count-preview');

            if (!this.audienceModal) {
                console.error('Audience modal not found!');
                return;
            }

            // Reset inputs
            this.audienceNameInput.value = '';

            const radio = document.querySelector('input[name="audienceType"][value="static"]');
            if (radio) radio.checked = true;

            // Update preview
            this.updateAudiencePreview();

            // Ensure display is set (override inline styles)
            this.audienceModal.style.display = 'flex';
            // Force reflow
            void this.audienceModal.offsetWidth;
            this.audienceModal.classList.add('active');

            if (this.audienceNameInput) setTimeout(() => this.audienceNameInput.focus(), 100);
        }

        closeAudienceModal() {
            if (this.audienceModal) {
                this.audienceModal.classList.remove('active');
                setTimeout(() => {
                    this.audienceModal.style.display = 'none';
                }, 200);
            }
        }

        toggleAudienceTypeDescription() {
            this.updateAudiencePreview();
        }

        updateAudiencePreview() {
            const typeRadio = document.querySelector('input[name="audienceType"]:checked');
            if (!typeRadio) return;

            const type = typeRadio.value;
            const desc = document.getElementById('audience-type-desc');
            const countEl = document.getElementById('audience-count-preview');

            if (!desc || !countEl) return;

            if (type === 'static') {
                const count = this.selectedLeads.size > 0 ? this.selectedLeads.size : this.filteredLeads.length;
                countEl.textContent = count;
                desc.innerHTML = `Save the <strong style="color:var(--accent-color)">${count}</strong> currently selected/visible leads as a fixed list. Future changes won't affect this list.`;
            } else {
                // Dynamic
                const count = this.filteredLeads.length;
                countEl.textContent = count;
                desc.innerHTML = `Save the current <strong>filter criteria</strong> (matches ${count} leads). The list will automatically update as leads match these criteria.`;
            }
        }

        async confirmSaveAudience() {
            if (!this.audienceNameInput) return;

            const name = this.audienceNameInput.value.trim();
            const type = document.querySelector('input[name="audienceType"]:checked').value;

            if (!name) {
                if (Toast) Toast.warning('Please enter an audience name');
                return;
            }

            const payload = {
                name: name,
                source: type === 'static' ? 'static_list' : 'b2b_leads_filter',
                count: 0
            };

            if (type === 'static') {
                // If specific checkboxes selected, use those. Else use all currently filtered.
                let ids = Array.from(this.selectedLeads);

                // If no manual selection, use all currently filtered leads (bulk action on view)
                if (ids.length === 0) {
                    ids = this.filteredLeads.map(l => l.id);
                }

                if (ids.length === 0) {
                    if (Toast) Toast.warning('No leads selected to save.');
                    return;
                }

                // Resolve IDs to full Contact Objects
                const selectedContacts = this.leads
                    .filter(l => ids.includes(l.id))
                    .map(l => {
                        const rawPhone = l.phone || '';
                        const formattedPhone = FormatUtils.formatPhoneNumber ? FormatUtils.formatPhoneNumber(rawPhone) : rawPhone;
                        return {
                            phone: formattedPhone,
                            name: l.name || l.business_name || 'Unknown'
                        };
                    })
                    .filter(c => c.phone); // Filter out invalid phone numbers

                if (selectedContacts.length === 0) {
                    if (Toast) Toast.error('Selected leads have no valid phone numbers.');
                    return;
                }

                payload.contacts = selectedContacts;
                payload.staticIds = ids; // Keep for reference
                payload.count = selectedContacts.length;

            } else {
                // Dynamic
                payload.filterConfig = {
                    search: this.searchQuery,
                    state: this.stateFilter,
                    district: this.districtFilter,
                    status: this.statusFilter,
                    kam: this.kamFilter,
                    source: 'b2b_leads' // Differentiate from dealer filters
                };

                const filteredContacts = this.filteredLeads.map(l => ({
                    phone: l.phone || '',
                    name: l.name || l.business_name || 'Unknown'
                })).filter(c => c.phone && c.phone.length >= 10); // Basic length check if format util fails or as backup

                payload.contacts = filteredContacts; // Snapshot
                payload.count = filteredContacts.length;
            }

            try {
                // Show loading?
                await this.audienceService.createAudience(payload);

                if (Toast) Toast.success('Audience saved successfully!');

                this.closeAudienceModal();
                this.clearSelection();
            } catch (error) {
                console.error('Failed to save audience:', error);
                if (Toast) Toast.error('Failed to save audience.');
            }
        }

        // --- CSV Import/Export ---

        openImportModal() {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = e => this.handleCSVUpload(e.target.files[0]);
            input.click();
        }

        async handleCSVUpload(file) {
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (e) => {
                const text = e.target.result;
                const rows = text.split('\n').map(r => r.trim()).filter(r => r);
                if (rows.length < 2) {
                    if (Toast) Toast.error('CSV file is empty or missing headers');
                    return;
                }

                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

                // Helper to normalize phone
                const normalizePhone = (p) => {
                    if (!p) return '';
                    return p.toString().replace(/\D/g, '').slice(-10); // Last 10 digits
                };

                // 1. Fetch existing data for deduplication
                this.showLoadingState();
                // We need to keep the table loading while we process, but showLoadingState replaced content. 
                // Maybe better to run this before asking confirmation? 
                // Let's do it inside the confirmation flow or before. 

                // Fetch Dealers
                let dealers = [];
                try {
                    // Try to get from DataManager if available globally or fetch fresh
                    if (window.dataManager) {
                        // DataManager typically fetches sheet data. 
                        // If we are on B2B page, DataManager might not have loaded "Dealers" report yet unless we force it.
                        // Let's try to use the raw fetch if internal API exists, or fallback to FirestoreService.
                        // Assuming valid "ALL_REPORTS" fetch or similar.
                        // For safety/speed, let's assume we can fetch "Dealers" collection if it existed as a simple collection,
                        // but here it seems Dealers come from "Reports".

                        // Strategy: We'll fetch ALL sheet data via DataManager to be safe, 
                        // matching how DealerManager does it.
                        dealers = await window.dataManager.fetchSheetData();
                    }
                } catch (err) {
                    console.error('Error fetching dealers for dedup:', err);
                    // Continue? Risk of duplication. better warn.
                    if (!confirm('Could not fetch existing Dealers for deduplication. Import anyway?')) {
                        this.renderTable();
                        return;
                    }
                }

                const existingDealerPhones = new Set(dealers.map(d => normalizePhone(d.phone)).filter(p => p.length === 10));
                const existingLeadPhones = new Set(this.leads.map(l => normalizePhone(l.phone)).filter(p => p.length === 10));
                const newImportPhones = new Set();

                const validLeads = [];
                let duplicatesInFile = 0;
                let existingInB2B = 0;
                let existingInDealers = 0;
                let noPhone = 0;

                for (let i = 1; i < rows.length; i++) {
                    // Handle potential comma inside quotes? Simple split for now as per previous code.
                    const values = rows[i].split(',').map(v => v.trim());
                    if (values.length < 1) continue;

                    const lead = {};
                    headers.forEach((h, index) => {
                        // Remove quotes if present
                        let val = values[index] || '';
                        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
                        lead[h] = val;
                    });

                    // 1. Check Phone Existence
                    if (!lead.phone) {
                        noPhone++;
                        continue;
                    }

                    const rawPhone = lead.phone;
                    const norm = normalizePhone(rawPhone);

                    if (norm.length < 10) {
                        // Invalid phone length? Treat as no phone or invalid
                        noPhone++;
                        continue;
                    }

                    // 2. Check Duplicates in File
                    if (newImportPhones.has(norm)) {
                        duplicatesInFile++;
                        continue;
                    }

                    // 3. Check Existing B2B
                    if (existingLeadPhones.has(norm)) {
                        existingInB2B++;
                        continue;
                    }

                    // 4. Check Existing Dealers
                    if (existingDealerPhones.has(norm)) {
                        existingInDealers++;
                        continue;
                    }

                    // Valid

                    // Default Status to 'New' if missing or empty
                    if (!lead.status || !lead.status.trim()) {
                        lead.status = 'New';
                    }

                    // Normalize case just in case
                    lead.status = lead.status.charAt(0).toUpperCase() + lead.status.slice(1).toLowerCase();

                    // Normalize State
                    if (lead.state && this.validator) {
                        lead.state = this.validator.normalizeState(lead.state);
                    }

                    newImportPhones.add(norm);
                    validLeads.push(lead);
                }

                // Restore validation state (remove loading)
                this.renderTable();

                const summary = `
Import Summary:
----------------
Total Rows: ${rows.length - 1}
Valid New Leads: ${validLeads.length}

Ignored:
- No Phone/Invalid: ${noPhone}
- Duplicate in File: ${duplicatesInFile}
- Existing B2B Lead: ${existingInB2B}
- Existing Dealer: ${existingInDealers}

Proceed with import?
                `.trim();

                if (validLeads.length === 0) {
                    if (Toast) Toast.warning('No valid new leads found to import.');
                    // alert(summary); // Fallback if toast missed
                    return;
                }

                if (confirm(summary)) {
                    try {
                        this.showLoadingState();
                        await this.service.importLeads(validLeads);
                        await this.loadData(); // Reload all
                        if (Toast) Toast.success(`Imported ${validLeads.length} leads successfully`);
                    } catch (err) {
                        if (Toast) Toast.error('Import failed: ' + err.message);
                        this.renderTable(); // Restore view
                    }
                }
            };
            reader.readAsText(file);
        }

        downloadImportTemplate() {
            const headers = ['name', 'phone', 'business_name', 'state', 'district', 'status', 'kam'];
            const sampleRow = ['John Doe', '9876543210', 'Doe Traders', 'Kerala', 'Ernakulam', 'New', ''];

            const csvContent = [
                headers.join(','),
                sampleRow.join(',')
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `b2b_leads_import_template.csv`;
            link.click();
        }

        exportCSV() {
            const headers = ['id', 'phone', 'name', 'business_name', 'state', 'district', 'pincode', 'status', 'kam'];
            // Export ALL filtered leads (ignoring pagination)
            const csvContent = [
                headers.join(','),
                ...this.filteredLeads.map(lead =>
                    headers.map(h => `"${(lead[h] || '').toString().replace(/"/g, '""')}"`).join(',')
                )
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `b2b_leads_export_${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
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
}

if (window.B2BLeadsManager) {
    if (!window.b2bLeadsManager) {
        window.b2bLeadsManager = new window.B2BLeadsManager();
        // Export to global for debug
        window.b2bLeadsManagerInstance = window.b2bLeadsManager;
    } else {
        // Re-initialize existing instance to attach to new DOM elements from fresh page load
        console.log('Re-using existing B2BLeadsManager instance');
        window.b2bLeadsManager.init();
    }
}

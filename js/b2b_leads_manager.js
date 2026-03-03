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
import { db } from './services/firebase_config.js';
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

if (!window.B2BLeadsManager) {
    window.B2BLeadsManager = class B2BLeadsManager {
        constructor() {
            this.leads = [];
            this.filteredLeads = []; // Total results after filter

            this.service = new B2BLeadsService();
            this.audienceService = new AudienceService();
            this.dataManager = new DataManager();
            this.validator = new DealerValidator(); // Initialize Validator

            // Services for WhatsApp Expansion
            this.templateService = window.TemplateService ? new window.TemplateService() : null;
            this.mediaService = window.MediaService ? new window.MediaService() : null;
            this.templates = [];
            this.selectedMedia = null;

            // Components — deferred to init() to ensure DOM is ready
            this.stateSelector = null;

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

            // this.init(); // Defer init until view is loaded by nav_controller
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

            // Instantiate StateSelector here — DOM for b2b-leads page is ready by now
            this.stateSelector = new StateSelector({
                containerId: 'state-selector-container',
                onChange: (selectedStates) => {
                    this.stateFilter = selectedStates;
                    this.currentPage = 1;
                    this.updateDistrictFilter();
                    this.applyFilters();
                }
            });

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
            // Move Modals to Body (Stacking Context Fix)
            // Cleanup stale modals from body first to avoid duplicates
            const cleanStale = (id) => {
                const stale = document.body.querySelector(`body > #${id}`);
                if (stale) stale.remove();
            };
            cleanStale('bulk-kam-modal');
            cleanStale('save-audience-modal');

            const kamModal = document.getElementById('bulk-kam-modal');
            if (kamModal && kamModal.parentElement !== document.body) document.body.appendChild(kamModal);

            const audModal = document.getElementById('save-audience-modal');
            if (audModal && audModal.parentElement !== document.body) document.body.appendChild(audModal);

            // Filter Clear Buttons Logic
            const filterIds = ['filter-kam', 'filter-status', 'filter-district'];

            filterIds.forEach(filterId => {
                const select = document.getElementById(filterId);
                // Listen to change to trigger updates
                if (select) {
                    const btn = document.querySelector(`.filter-clear-btn[data-for="${filterId}"]`);
                    if (btn) {
                        select.addEventListener('change', () => {
                            btn.style.display = select.value !== 'all' ? 'flex' : 'none';
                        });
                        btn.addEventListener('click', () => {
                            select.value = 'all';
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        });
                        // Init state
                        btn.style.display = select.value !== 'all' ? 'flex' : 'none';
                    }
                }
            });
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
            const clearBtn = wrapper ? wrapper.querySelector('.filter-clear-btn') : null;

            const selectedStates = this.stateFilter;

            if (!selectedStates || selectedStates.length === 0) {
                // Hide District Filter
                if (wrapper) wrapper.style.display = 'none';

                // Reset Selection
                districtSelect.value = 'all';
                this.districtFilter = 'all';

                // Hide clear button if visible
                if (clearBtn) clearBtn.style.display = 'none';

                return;
            }

            // Show District Filter
            if (wrapper) wrapper.style.display = 'flex';

            let relevantLeads = this.leads;
            if (this.stateFilter.length > 0) {
                relevantLeads = this.leads.filter(l => this.stateFilter.includes(l.state));
            }

            const districts = [...new Set(relevantLeads.map(l => l.district).filter(Boolean))].sort();

            // Preserve selection if valid, otherwise reset
            const currentVal = districtSelect.value;
            let newVal = 'all';
            if (districts.includes(currentVal)) {
                newVal = currentVal;
            } else {
                this.districtFilter = 'all';
            }

            let html = '<option value="all">All Districts</option>';
            districts.forEach(d => {
                html += `<option value="${d}">${d}</option>`;
            });
            districtSelect.innerHTML = html;
            districtSelect.value = newVal;

            // Manage clear button state based on new val
            if (clearBtn) {
                clearBtn.style.display = newVal !== 'all' ? 'flex' : 'none';
            }
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
                if (el) {
                    el.value = val;
                    // Sync clear button
                    const btn = document.querySelector(`.filter-clear-btn[data-for="${id}"]`);
                    if (btn) btn.style.display = val !== 'all' ? 'flex' : 'none';
                }
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

        async openEditModal(leadId) {
            console.log('Opening Edit Modal for:', leadId);
            const isEdit = !!leadId;
            const lead = isEdit ? this.leads.find(l => l.id === leadId) : {};

            if (!lead && isEdit) {
                if (Toast) Toast.error('Lead not found.');
                return;
            }

            this.selectedMedia = null; // Reset selection
            this.isModalOpen = true; // Set modal state
            this.currentEditingLogId = null; // Reset edit state

            // Render Modal
            const settings = this.dataManager ? this.dataManager.generalSettings : {};
            const html = window.UIRenderer.renderB2BLeadModal(lead, settings);

            // Clean up existing modal
            const existing = document.querySelector('.dealer-modal-overlay');
            if (existing) existing.remove();

            document.body.insertAdjacentHTML('beforeend', html);

            // Background Load WhatsApp Instances
            this.loadWhatsAppInstances().then(() => {
                if (this.isModalOpen) {
                    const kam = document.getElementById('inp_kam')?.value || lead.kam;
                    this.updateWhatsAppInterface(kam);
                }
            });

            // Load Templates
            this.loadWATemplates();

            if (isEdit) {
                this.renderLogsList(leadId);
            }
        }

        closeEditModal() {
            this.isModalOpen = false;
            // Tear down real-time chat listener if active
            if (this.chatUnsubscribe) {
                this.chatUnsubscribe();
                this.chatUnsubscribe = null;
            }
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

        async saveLeadDetails(leadId, isAutoSave = false) {
            const modal = document.querySelector('.dealer-modal');
            if (!modal) return;

            const saveBtn = modal.querySelector('.btn-save');
            if (saveBtn && !isAutoSave) {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Saving...';
            }

            const data = {};
            // Scrape all data-field inputs
            modal.querySelectorAll('[data-field]').forEach(input => {
                const field = input.dataset.field;
                const val = input.value;
                if (field) data[field] = val;
            });

            try {
                if (leadId) {
                    // --- OPTIMISTIC UPDATE ---
                    const startTime = performance.now();
                    const index = this.leads.findIndex(l => l.id === leadId);

                    if (index !== -1) {
                        // 1. Capture previous state for rollback
                        const previousState = { ...this.leads[index] };

                        // 2. Update Local State Immediately
                        this.leads[index] = { ...this.leads[index], ...data };
                        this.leads[index].searchString = `${this.leads[index].name || ''} ${this.leads[index].phone || ''} ${this.leads[index].business_name || ''} ${this.leads[index].state || ''} ${this.leads[index].district || ''}`.toLowerCase();

                        // 3. Update UI Immediately
                        if (!isAutoSave) {
                            if (Toast) Toast.info('Updating in background...');
                            this.closeEditModal();
                            this.applyFilters(); // Re-render table
                        }

                        // 4. Perform Background Sync
                        try {
                            const shardId = previousState._shardId;
                            console.log(`[Debug] Syncing LeadId: ${leadId}, ShardId: ${shardId} (AutoSave: ${isAutoSave})`);

                            await this.service.updateLead(leadId, data, shardId);

                            const duration = (performance.now() - startTime).toFixed(2);
                            console.log(`[Performance] Background Update took: ${duration}ms`);

                            // Only show success toast if not already closed
                            if (Toast) Toast.success(`Synced successfully (${duration}ms)`);

                            // Re-render table in background if auto-saving
                            if (isAutoSave) {
                                this.applyFilters();
                            }
                        } catch (syncError) {
                            console.error('Background Sync Failed:', syncError);
                            // Revert Local State
                            this.leads[index] = previousState;
                            this.applyFilters();
                            if (Toast) Toast.error('Sync Failed: ' + syncError.message);
                            if (!isAutoSave) alert('Failed to save changes to server. The lead has been reverted.');
                        }
                    }
                } else {
                    // Create New Lead - Keep standard await flow for now to get ID
                    const startTime = performance.now();
                    const newLead = await this.service.addLead(data);

                    const duration = (performance.now() - startTime).toFixed(2);
                    console.log(`[Performance] Lead Create took: ${duration}ms`);

                    // Add to local state
                    newLead.searchString = `${newLead.name || ''} ${newLead.phone || ''} ${newLead.business_name || ''} ${newLead.state || ''} ${newLead.district || ''}`.toLowerCase();
                    this.leads.unshift(newLead); // Add to top

                    if (Toast) Toast.success(`Lead added successfully (${duration}ms)`);
                    this.closeEditModal();
                    this.applyFilters();
                }
            } catch (error) {
                console.error('Error in saveLeadDetails:', error);
                if (Toast) Toast.error('Error saving: ' + error.message);
                if (saveBtn) {
                    saveBtn.disabled = false;
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

            // Sort logs: oldest date first so newest log is at the bottom (closest to composer)
            const logs = [...lead.logs].sort((a, b) => {
                const dateA = new Date(a.date || a.createdAt || 0);
                const dateB = new Date(b.date || b.createdAt || 0);
                return dateA - dateB;
            });

            container.innerHTML = logs.map(log => {
                const hasDueDate = !!log.date;
                const type = log.activityType || 'Log';
                const createdAtObj = log.createdAt ? new Date(log.createdAt) : null;
                const dateObj = hasDueDate ? new Date(log.date) : null;

                // Color mapping for activities
                const colors = {
                    'Call': '#3b82f6',    // Blue
                    'Meeting': '#a855f7', // Purple
                    'Visit': '#a855f7',   // Purple
                    'Message': '#22c55e', // Green
                    'Email': '#22c55e',   // Green
                    'Followup': '#f59e0b',// Orange
                    'Note': '#64748b'     // Gray
                };
                const themeColor = colors[type] || colors['Note'];

                const createdStr = createdAtObj ? createdAtObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';
                const dueStr = dateObj ? dateObj.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '';

                const tooltipData = this.escapeHtml(JSON.stringify(log, null, 2));

                return `
                <div class="log-thread-item" style="position: relative; padding-left: 20px; border-left: 1px solid rgba(255,255,255,0.1); font-size: 0.85rem;" title="${tooltipData}">
                    <!-- Timeline Dot -->
                    <div style="position: absolute; left: -4px; top: 4px; width: 7px; height: 7px; border-radius: 50%; background: ${themeColor}; box-shadow: 0 0 8px ${themeColor}66;"></div>
                    
                    <!-- Metadata Header (Single Compact Row) -->
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
                        <span style="font-weight: 700; color: ${themeColor}; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">${type}</span>
                        <span style="color: var(--text-muted); opacity: 0.6; font-size: 0.75rem;">${createdStr}</span>
                        ${hasDueDate ? `
                            <span style="display: flex; align-items: center; gap: 4px; background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 500;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                                Due: ${dueStr}
                            </span>
                        ` : ''}
                    </div>
                    
                    <!-- Content (Direct Flow) -->
                    <div style="color: var(--text-main); line-height: 1.5; white-space: pre-wrap; opacity: 0.9;">${this.escapeHtml(log.content)}</div>
                </div>
            `}).join('') + `
            <style>
                .log-thread-item:last-child { border-left-color: transparent; margin-bottom: 0; }
            </style>
            `;
        }

        // --- WHATSAPP INTEGRATION ---

        async loadWhatsAppInstances() {
            try {
                // 1. Fetch live sessions
                let liveSessions = [];
                try {
                    const response = await fetch(`${window.appConfig.apiUrl}/api/auth/sessions`);
                    const data = await response.json();
                    if (data.success && Array.isArray(data.sessions)) {
                        liveSessions = data.sessions;
                    }
                } catch (e) {
                    console.warn('[WhatsApp] Backend fetch failed:', e);
                }

                // 2. Fetch metadata from Firestore
                const metaDocs = [];
                try {
                    let _getDocs = typeof getDocs !== 'undefined' ? getDocs : window.getDocs;
                    let _collection = typeof collection !== 'undefined' ? collection : window.collection;
                    let _db = typeof db !== 'undefined' ? db : window.db;

                    if (!_getDocs || !_collection || !_db) {
                        try {
                            const fb = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                            _getDocs = fb.getDocs;
                            _collection = fb.collection;
                            const config = await import("./services/firebase_config.js");
                            _db = config.db;
                        } catch (err) {
                            console.warn("Dynamic import for WA instances failed", err);
                        }
                    }

                    if (_getDocs && _collection && _db) {
                        const firestoreSnap = await _getDocs(_collection(_db, "whatsapp_instances"));
                        firestoreSnap.forEach(doc => metaDocs.push({ ...doc.data(), id: doc.id }));
                    }
                } catch (e) {
                    console.warn('[WhatsApp] Firestore metadata fetch failed:', e);
                }

                if (liveSessions.length > 0) {
                    this.whatsappInstances = liveSessions.map(session => {
                        const meta = metaDocs.find(m => m.sessionId === (session.id || session.sessionId));
                        return {
                            ...session,
                            id: session.id || session.sessionId,
                            name: meta ? meta.name : (session.name || 'Unnamed'),
                            kam: meta ? meta.kam : null,
                            tier: meta ? meta.tier : 'standard',
                            connected: true
                        };
                    });
                } else {
                    this.whatsappInstances = metaDocs.map(meta => ({
                        id: meta.sessionId,
                        name: meta.name || 'Unnamed Instance',
                        kam: meta.kam,
                        connected: false
                    }));
                }
            } catch (e) {
                console.error('[WhatsApp] Error loading instances:', e);
                this.whatsappInstances = [];
            }
        }

        async loadWATemplates() {
            if (!this.templateService) return;
            try {
                this.templates = await this.templateService.getTemplates();
                const select = document.getElementById('wa-template-select');
                if (select) {
                    select.innerHTML = '<option value="">Select Template...</option>';
                    this.templates.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.name;
                        select.appendChild(opt);
                    });
                }
            } catch (e) {
                console.error('[WhatsApp] Template load failed', e);
            }
        }

        handleWATemplateChange(templateId) {
            const template = this.templates.find(t => t.id === templateId);
            const textarea = document.getElementById('wa-message-body');
            if (!template || !textarea) return;

            // Extract content (Standard logic from TemplateRenderer/CampaignManager)
            let content = '';
            if (Array.isArray(template.components)) {
                const body = template.components.find(c => c.type === 'BODY');
                content = body ? body.text : (template.components.find(c => c.type === 'HEADER')?.text || '');
            } else if (template.content) {
                if (typeof template.content === 'string') content = template.content;
                else content = template.content.body || template.content.text || template.content.caption || '';
            }

            textarea.value = content;
        }

        async openMediaGallery() {
            if (!this.mediaService) return;
            try {
                const mediaItems = await this.mediaService.getMedia();
                this.cachedMedia = mediaItems;
                this.galleryFilter = { search: '', type: '', lang: '', cat: '', sort: 'newest' };

                const settings = this.dataManager?.generalSettings || {};
                const languages = settings.template_languages || [];
                const categories = settings.template_categories || [];

                const langOptions = languages.map(l => `<option value="${l}" style="background: #1e293b; color: #f8fafc;">${l}</option>`).join('');
                const catOptions = categories.map(c => `<option value="${c}" style="background: #1e293b; color: #f8fafc;">${c}</option>`).join('');

                const dropdownStyle = `background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px; color: white; font-size: 0.85rem; outline: none; appearance: none; -webkit-appearance: none; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right 10px top 50%; background-size: 10px auto; padding-right: 30px;`;

                const modalHtml = `
                    <div id="gallery-picker-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 10000; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(12px);">
                        <div style="background: #1a1b1e; width: 900px; height: 85vh; border-radius: 24px; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px rgba(0,0,0,0.6);">
                            <div style="padding: 24px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(255,255,255,0.02);">
                                <div>
                                    <h3 style="margin: 0; color: white; font-size: 1.25rem;">Media Gallery</h3>
                                    <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">Select an asset to attach</p>
                                </div>
                                <div style="display: flex; align-items: center; gap: 12px;">
                                    <div style="position: relative;">
                                        <input type="text" id="gallery-search" placeholder="Search gallery..." 
                                            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; color: white; font-size: 0.85rem; width: 160px; outline: none;"
                                            oninput="window.b2bLeadsManager.applyGalleryFilters()">
                                    </div>
                                    <select id="gallery-filter-lang" onchange="window.b2bLeadsManager.applyGalleryFilters()" style="${dropdownStyle}">
                                        <option value="" style="background: #1e293b; color: #f8fafc;">All Languages</option>
                                        ${langOptions}
                                    </select>
                                    <select id="gallery-filter-cat" onchange="window.b2bLeadsManager.applyGalleryFilters()" style="${dropdownStyle}">
                                        <option value="" style="background: #1e293b; color: #f8fafc;">All Categories</option>
                                        ${catOptions}
                                    </select>
                                    <select id="gallery-filter-type" onchange="window.b2bLeadsManager.applyGalleryFilters()" style="${dropdownStyle}">
                                        <option value="" style="background: #1e293b; color: #f8fafc;">All Types</option>
                                        <option value="image" style="background: #1e293b; color: #f8fafc;">Images</option>
                                        <option value="video" style="background: #1e293b; color: #f8fafc;">Videos</option>
                                        <option value="document" style="background: #1e293b; color: #f8fafc;">PDFs</option>
                                    </select>
                                    <button onclick="this.closest('#gallery-picker-modal').remove()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.8rem; width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; transition: 0.2s;" onmouseover="this.style.color='white'" onmouseout="this.style.color='var(--text-muted)'">&times;</button>
                                </div>
                            </div>
                            <div id="gallery-grid" style="flex: 1; overflow-y: auto; padding: 24px; display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: max-content; gap: 24px;">
                                <!-- Grid content rendered via applyGalleryFilters -->
                            </div>
                            <style>
                                #gallery-grid::-webkit-scrollbar {
                                    width: 8px;
                                }
                                #gallery-grid::-webkit-scrollbar-track {
                                    background: rgba(255, 255, 255, 0.02);
                                    border-radius: 4px;
                                }
                                #gallery-grid::-webkit-scrollbar-thumb {
                                    background: rgba(255, 255, 255, 0.1);
                                    border-radius: 4px;
                                }
                                #gallery-grid::-webkit-scrollbar-thumb:hover {
                                    background: rgba(255, 255, 255, 0.2);
                                }
                            </style>
                        </div>
                    </div>
                `;
                document.body.insertAdjacentHTML('beforeend', modalHtml);
                this.applyGalleryFilters();
            } catch (e) {
                console.error('[WhatsApp] Gallery load failed', e);
            }
        }

        applyGalleryFilters() {
            const search = document.getElementById('gallery-search')?.value.toLowerCase() || '';
            const type = document.getElementById('gallery-filter-type')?.value || '';
            const lang = document.getElementById('gallery-filter-lang')?.value || '';
            const cat = document.getElementById('gallery-filter-cat')?.value || '';

            const filtered = this.cachedMedia.filter(m => {
                const matchesSearch = !search || m.name.toLowerCase().includes(search) ||
                    (m.category && m.category.toLowerCase().includes(search));
                const matchesType = !type || m.type === type || (type === 'document' && m.mimeType === 'application/pdf');
                const matchesLang = !lang || (m.language && m.language.toLowerCase() === lang.toLowerCase());
                const matchesCat = !cat || (m.category && m.category.toLowerCase() === cat.toLowerCase());

                return matchesSearch && matchesType && matchesLang && matchesCat;
            });

            // Re-render grid
            const grid = document.getElementById('gallery-grid');
            if (!grid) return;

            if (filtered.length === 0) {
                grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted);">No media found matching filters.</div>`;
                return;
            }

            const renderId = Date.now();
            this.currentGalleryRenderId = renderId;

            grid.innerHTML = filtered.map(m => {
                const isVideo = (m.type === 'video' || (m.mimeType || '').startsWith('video/'));
                const isDoc = (m.type === 'document' || (m.mimeType || '').startsWith('application/'));

                let previewHtml = '';
                if (m.thumbnailUrl) {
                    previewHtml = `<img src="${m.thumbnailUrl}" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else if (m.type === 'image') {
                    previewHtml = `<img src="${m.url}" style="width: 100%; height: 100%; object-fit: cover;">`;
                } else {
                    const icon = isVideo ? '🎬' : (isDoc ? '📄' : '📁');
                    const label = isVideo ? 'GENERATING THUMB...' : (m.type || 'Media');
                    const placeholderId = isVideo ? `gallery-placeholder-${m.id}` : '';
                    const canvasId = isVideo ? `gallery-canvas-${m.id}` : '';

                    previewHtml = `
                        <div id="${placeholderId}" style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #2a2b2e; color: #666;">
                            <span style="font-size: 2rem; margin-bottom: 8px;">${icon}</span>
                            <span style="font-size: 0.5rem; text-transform: uppercase; letter-spacing: 1px; padding: 0 4px; text-align: center;">${label}</span>
                        </div>
                        ${isVideo ? `<canvas id="${canvasId}" style="width: 100%; height: 100%; object-fit: cover; display: none;"></canvas>` : ''}
                    `;
                }

                return `
                    <div onclick="window.b2bLeadsManager.selectMediaFromGallery('${m.id}')" 
                         title="${this.escapeHtml(m.name)}"
                         style="aspect-ratio: 1; background: #000; border-radius: 16px; cursor: pointer; overflow: hidden; border: 2px solid transparent; transition: 0.2s; position: relative; box-shadow: 0 4px 12px rgba(0,0,0,0.2);" 
                         onmouseover="this.style.borderColor='var(--accent-color)'; this.style.transform='translateY(-4px)'" 
                         onmouseout="this.style.borderColor='transparent'; this.style.transform='translateY(0)'">
                        ${previewHtml}
                        <div style="position: absolute; bottom: 0; left: 0; right: 0; padding: 10px; background: linear-gradient(transparent, rgba(0,0,0,0.9)); font-size: 0.7rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;">
                            ${m.name || 'Untitled'}
                        </div>
                    </div>
                `;
            }).join('');

            // Trigger video thumbnail generation for those needing it
            const videosNeedThumb = filtered.filter(m => (m.type === 'video' || (m.mimeType || '').startsWith('video/')) && !m.thumbnailUrl);
            if (videosNeedThumb.length > 0) {
                this.generateGalleryVideoThumbnails(videosNeedThumb, renderId);
            }
        }

        async generateGalleryVideoThumbnails(videos, renderId) {
            for (const video of videos) {
                if (this.currentGalleryRenderId !== renderId) break;
                try {
                    await new Promise((resolve, reject) => {
                        const v = document.createElement('video');
                        v.src = video.url;
                        v.crossOrigin = 'anonymous';
                        v.muted = true;
                        v.preload = 'metadata';

                        const timeout = setTimeout(() => { v.src = ''; reject(); }, 10000);

                        v.onloadeddata = () => { v.currentTime = 0.5; };
                        v.onseeked = async () => {
                            clearTimeout(timeout);
                            const canvas = document.createElement('canvas');
                            canvas.width = v.videoWidth;
                            canvas.height = v.videoHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(v, 0, 0, canvas.width, canvas.height);

                            // Update UI if still in view
                            const placeholder = document.getElementById(`gallery-placeholder-${video.id}`);
                            const cardCanvas = document.getElementById(`gallery-canvas-${video.id}`);
                            if (placeholder && cardCanvas) {
                                cardCanvas.width = canvas.width;
                                cardCanvas.height = canvas.height;
                                cardCanvas.getContext('2d').drawImage(v, 0, 0, canvas.width, canvas.height);
                                cardCanvas.style.display = 'block';
                                placeholder.style.display = 'none';
                            }

                            // Persistence
                            canvas.toBlob(async (blob) => {
                                if (blob) try { await this.mediaService.uploadThumbnail(video.id, blob); } catch (e) { }
                            }, 'image/jpeg', 0.8);

                            v.src = ''; resolve();
                        };
                        v.onerror = () => { clearTimeout(timeout); reject(); };
                    });
                } catch (e) { }
            }
        }

        selectMediaFromGallery(mediaId) {
            const media = this.cachedMedia.find(m => m.id === mediaId);
            if (media) {
                this.updateMediaPreview(media);
                document.getElementById('gallery-picker-modal')?.remove();
            }
        }

        async handleWAMediaUpload(file) {
            if (!file || !this.mediaService) return;
            try {
                Toast.info('Uploading media...');
                const result = await this.mediaService.uploadMedia(file, { name: file.name });
                this.updateMediaPreview(result);
                Toast.success('Media uploaded!');
            } catch (e) {
                console.error('[WhatsApp] Upload failed', e);
                Toast.error('Upload failed: ' + e.message);
            }
        }

        updateMediaPreview(media) {
            this.selectedMedia = media;
            const container = document.getElementById('wa-media-preview');
            if (!container) return;

            const isVideo = (media.type === 'video' || (media.mimeType || '').startsWith('video/'));
            const isDoc = (media.type === 'document' || (media.mimeType || '').startsWith('application/pdf'));

            container.style.display = 'block';

            let previewElement = '';
            if (isVideo) {
                if (media.thumbnailUrl) {
                    previewElement = `<img src="${media.thumbnailUrl}" style="width: 100%; height: 100px; object-fit: cover;">`;
                } else {
                    previewElement = `<video src="${media.url}" style="width: 100%; height: 100px; object-fit: cover; opacity: 0.8;" muted></video>`;
                }
            } else if (isDoc) {
                previewElement = `
                    <div style="width: 100%; height: 100px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; flex-direction: column; font-size: 2rem;">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity: 0.5; color: #10b981;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    </div>
                `;
            } else {
                previewElement = `<img src="${media.url}" style="width: 100%; height: 100px; object-fit: cover;">`;
            }

            container.innerHTML = `
                <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.5); width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; color: white; z-index: 10; font-size: 14px; backdrop-filter: blur(4px); border: 1px solid rgba(255,255,255,0.1);" onclick="window.b2bLeadsManager.clearMediaSelection()">
                    &times;
                </div>
                ${previewElement}
                <div style="padding: 8px 12px; font-size: 0.75rem; color: #10b981; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(16, 185, 129, 0.1);">
                    ${media.name || 'Selected Media'}
                </div>
            `;
        }

        clearMediaSelection() {
            this.selectedMedia = null;
            const container = document.getElementById('wa-media-preview');
            if (container) {
                container.style.display = 'none';
                container.innerHTML = '';
            }
        }

        updateWhatsAppInterface(kamName) {
            const statusEl = document.getElementById('wa-instance-status');
            const sendBtn = document.querySelector('.wa-send-btn');

            if (!statusEl) return;

            // Reset state
            statusEl.classList.remove('connected');
            statusEl.style.background = ''; // Clear old inline styles

            // 1. Handle "No KAM Selected"
            if (!kamName) {
                statusEl.innerHTML = `
                    <span class="wa-status-dot"></span>
                    <span style="color: var(--text-muted); opacity: 0.5;">Select KAM</span>
                `;
                if (sendBtn) sendBtn.disabled = true;
                return;
            }

            // 2. Find Instance for KAM
            const instance = (this.whatsappInstances || []).find(i => (i.kam || '').toLowerCase() === kamName.toLowerCase());

            if (!instance) {
                // 3. No Instance Found
                statusEl.innerHTML = `
                    <span class="wa-status-dot" style="background: #ef4444;"></span>
                    <span style="color: #ef4444; opacity: 0.8;">No Session</span>
                `;
                statusEl.title = `No instance assigned to KAM: ${kamName}`;
                if (sendBtn) sendBtn.disabled = true;
            } else if (!instance.connected && !instance.status === 'authenticated') {
                // 4. Instance Found but Disconnected
                statusEl.innerHTML = `
                    <span class="wa-status-dot" style="background: #ef4444;"></span>
                    <span style="color: #ef4444; opacity: 0.8;">${instance.name} (OFF)</span>
                `;
                if (sendBtn) sendBtn.disabled = true;
            } else {
                // 5. Connected & Ready
                statusEl.classList.add('connected');
                statusEl.innerHTML = `
                    <span class="wa-status-dot"></span>
                    <span style="color: #fff; font-weight: 600;">Via: ${instance.name}</span>
                `;
                if (sendBtn) sendBtn.disabled = false;

                // Load Chat History
                const phone = document.getElementById('inp_phone')?.value;
                if (phone) {
                    this.loadChatHistory(phone, instance.id);
                }
            }
        }

        async createAutomatedLog(leadId, content) {
            const lead = this.leads.find(l => l.id === leadId);
            if (!lead) return;
            if (!lead.logs) lead.logs = [];

            const newLog = {
                id: 'log_' + Date.now(),
                activityType: 'WhatsApp',
                content: content,
                createdAt: new Date().toISOString()
            };

            lead.logs.push(newLog);

            // Only render if we are currently looking at this lead's logs
            const logList = document.getElementById('b2b-logs-list');
            if (logList) this.renderLogsList(leadId);

            try {
                await this.service.updateLead(leadId, { logs: lead.logs });
            } catch (error) {
                console.error('[WhatsApp Log] Failed to save automated log:', error);
            }
        }

        async sendWhatsAppMessage(leadId) {
            const messageBody = document.getElementById('wa-message-body').value.trim();
            const kamName = document.getElementById('inp_kam').value;
            const templateId = document.getElementById('wa-template-select').value;

            // 🔒 Secret command: permanently wipe WhatsApp chat from Firestore
            if (messageBody.toLowerCase() === 'lazafron') {
                document.getElementById('wa-message-body').value = '';
                const lead = this.leads.find(l => l.id === leadId);
                if (!lead || !lead.phone) return;

                const digits = lead.phone.replace(/\D/g, '');
                const leadPhone = digits.length === 10 ? '91' + digits : digits;

                const chatHistory = document.getElementById('wa-chat-history');
                if (chatHistory) chatHistory.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#334155;font-size:0.8rem;font-style:italic;"><div style="font-size:1.5rem;margin-bottom:8px;opacity:0.4;">🗑️</div>Deleting...</div></div>`;

                try {
                    const { collection, query, where, getDocs, deleteDoc, writeBatch } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                    const { db } = await import("./services/firebase_config.js");

                    // Find all matching chat docs (primary + remoteJid fallback)
                    const queries = [
                        getDocs(query(collection(db, 'wa_chats'), where('leadPhone', '==', leadPhone))),
                        getDocs(query(collection(db, 'wa_chats'), where('key.remoteJid', '==', leadPhone + '@s.whatsapp.net')))
                    ];
                    const snapshots = await Promise.all(queries);
                    const chatDocs = [];
                    snapshots.forEach(snap => snap.forEach(d => { if (!chatDocs.find(x => x.id === d.id)) chatDocs.push(d); }));

                    if (chatDocs.length === 0) {
                        if (window.Toast) window.Toast.warning('No chat history found in Firestore.');
                        if (chatHistory) chatHistory.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#334155;font-size:0.8rem;"><div style="font-size:1.5rem;margin-bottom:8px;opacity:0.4;">🔇</div>No messages yet</div></div>`;
                        return;
                    }

                    // Delete messages subcollection + parent chat doc for each
                    for (const chatDoc of chatDocs) {
                        const msgSnap = await getDocs(collection(db, 'wa_chats', chatDoc.id, 'messages'));
                        const batch = writeBatch(db);
                        msgSnap.forEach(msgDoc => batch.delete(msgDoc.ref));
                        batch.delete(chatDoc.ref);
                        await batch.commit();
                    }

                    if (chatHistory) chatHistory.innerHTML = `<div style="flex:1;display:flex;align-items:center;justify-content:center;"><div style="text-align:center;color:#334155;font-size:0.8rem;font-style:italic;"><div style="font-size:1.5rem;margin-bottom:8px;opacity:0.4;">💬</div>Chat cleared.</div></div>`;
                    if (window.Toast) window.Toast.success('Chat history deleted.');
                } catch (e) {
                    console.error('[lazafron] Failed to delete chat:', e);
                    if (window.Toast) window.Toast.error('Failed to delete: ' + e.message);
                }
                return;
            }

            if (!kamName) {
                if (window.Toast) window.Toast.warning('Please select a KAM first.');
                return;
            }

            // Must have either body, template, or media
            if (!messageBody && !templateId && !this.selectedMedia) {
                if (window.Toast) window.Toast.warning('Please enter a message or select media/template.');
                return;
            }

            // Resolve Instance
            const instance = (this.whatsappInstances || []).find(i => (i.kam || '').toLowerCase() === kamName.toLowerCase());

            if (!instance) {
                if (window.Toast) window.Toast.error('No WhatsApp instance found for this KAM.');
                return;
            }

            // Find Lead
            const lead = this.leads.find(l => l.id === leadId);
            if (!lead || !lead.phone) {
                if (window.Toast) window.Toast.error('Lead has no phone number.');
                return;
            }

            let phone = lead.phone.replace(/\D/g, '');
            if (phone.length === 10) phone = '91' + phone;

            const sendBtn = document.getElementById('wa-whatsapp-send-btn') || document.querySelector('.wa-send-btn[onclick*="sendWhatsAppMessage"]');
            if (!sendBtn) {
                console.error('[WhatsApp] Send button not found in DOM');
                return;
            }
            const originalText = sendBtn.innerHTML;
            sendBtn.innerHTML = '<span class="loading-spinner"></span> Sending...';
            sendBtn.disabled = true;

            try {
                let payload = {
                    sessionId: instance.id,
                    to: phone
                };

                let endpoint = '/messages/text';

                // Case 1: Template selected (priority)
                if (templateId) {
                    endpoint = '/messages/template';

                    // Fetch KAM phone from settings for dynamic variables
                    let kamPhone = '';
                    try {
                        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                        const { db } = await import("./services/firebase_config.js");
                        const settingsDoc = await getDoc(doc(db, "settings", "general"));
                        if (settingsDoc.exists()) {
                            const kamList = settingsDoc.data().key_accounts || [];
                            const kamObj = kamList.find(k => (k.name || k) === kamName);
                            if (kamObj && kamObj.phone) {
                                kamPhone = kamObj.phone;
                            }
                        }
                    } catch (e) {
                        console.warn("Failed to fetch KAM phone for template variables", e);
                    }

                    payload.templateId = templateId;
                    payload.variables = {
                        'KAM_PHONE': kamPhone,
                        'name': lead.contactPerson || lead.companyName || 'Valued Customer'
                    };
                }
                // Case 2: Media Attachment
                else if (this.selectedMedia) {
                    const mediaType = this.selectedMedia.type || 'image';
                    endpoint = '/messages/interactive';

                    // Format for Baileys fork (top level type, nested url + meta)
                    payload.content = {
                        [mediaType]: {
                            url: this.selectedMedia.url,
                            mimetype: this.selectedMedia.mimeType,
                            fileName: this.selectedMedia.name
                        },
                        caption: messageBody
                    };
                }
                // Case 3: Plain Text
                else {
                    payload.text = messageBody;
                }

                const response = await fetch(`${window.appConfig.apiUrl}/api${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (result.success) {
                    if (window.Toast) window.Toast.success('Message sent!');

                    // Only log template messages (not plain text or media sends)
                    if (templateId) {
                        const templateSelect = document.getElementById('wa-template-select');
                        const templateName = templateSelect.options[templateSelect.selectedIndex]?.text || templateId;
                        this.createAutomatedLog(leadId, `WhatsApp Template: ${templateName}`);
                    }

                    document.getElementById('wa-message-body').value = '';
                    this.clearMediaSelection();
                    document.getElementById('wa-template-select').value = '';
                }
                else {
                    throw new Error(result.error || result.message || 'Failed to send');
                }
            } catch (error) {
                console.error('[WhatsApp] Send Failed:', error);
                if (window.Toast) window.Toast.error('Failed to send: ' + error.message);
            } finally {
                sendBtn.innerHTML = originalText;
                sendBtn.disabled = false;
            }
        }

        async addLog(leadId) {
            const toggleWrapper = document.getElementById('toggle-due-date');
            const dateInput = document.getElementById('new-log-date');
            const timeInput = document.getElementById('new-log-time');
            const contentInput = document.getElementById('new-log-content');

            if (!contentInput) return;

            const activeChip = document.querySelector('.activity-chip.active');
            const type = activeChip ? activeChip.getAttribute('data-value') : 'Log';
            const content = contentInput.value.trim();

            if (!content) {
                if (Toast) Toast.warning('Please enter notes.');
                return;
            }

            // 🔒 Secret dev command: wipe all logs
            if (content.toLowerCase() === 'clear all') {
                const lead = this.leads.find(l => l.id === leadId);
                if (!lead) return;
                lead.logs = [];
                contentInput.value = '';
                this.renderLogsList(leadId);
                try {
                    await this.service.updateLead(leadId, { logs: [] });
                    if (Toast) Toast.success('All logs cleared.');
                } catch (e) {
                    if (Toast) Toast.error('Failed to clear logs: ' + e.message);
                }
                return;
            }

            // Determine Due Date
            let dueDateTime = null;
            if (toggleWrapper && toggleWrapper.checked && dateInput) {
                const dateVal = dateInput.value;
                const timeVal = timeInput ? timeInput.value : '00:00';
                if (dateVal) {
                    dueDateTime = new Date(`${dateVal}T${timeVal}`).toISOString();
                }
            }

            // Find Lead
            const lead = this.leads.find(l => l.id === leadId);
            if (!lead) return;
            if (!lead.logs) lead.logs = [];

            this.currentEditingLogId = null;

            // CREATE NEW LOG
            const newLog = {
                id: 'log_' + Date.now(),
                // date: dueDateTime, // Only set if exists
                activityType: type,
                content: content,
                createdAt: new Date().toISOString()
            };

            // Only add 'date' property if due date is set
            if (dueDateTime) {
                newLog.date = dueDateTime;
            }

            lead.logs.push(newLog);

            // Optimistic Update
            this.renderLogsList(leadId);

            // Clear Inputs
            contentInput.value = '';
            // Reset Date inputs but keep toggle state? Or reset toggle? 
            // Usually nice to reset inputs for next log.
            if (toggleWrapper) toggleWrapper.checked = false;
            const container = document.getElementById('due-date-container');
            if (container) container.style.display = 'none';

            // Reset date pickers to now (ready for next use)
            if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
            if (timeInput) timeInput.value = new Date().toTimeString().split(' ')[0].substring(0, 5);

            document.querySelectorAll('.activity-chip').forEach(c => c.classList.remove('active'));

            // API Save
            try {
                await this.service.updateLead(leadId, { logs: lead.logs });
                if (Toast) Toast.success('Log saved successfully');
            } catch (error) {
                console.error('Failed to save log:', error);
                if (Toast) Toast.error('Failed to save log');
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

                const filteredContacts = this.filteredLeads.map(l => {
                    const rawPhone = l.phone || '';
                    const formattedPhone = FormatUtils.formatPhoneNumber ? FormatUtils.formatPhoneNumber(rawPhone) : rawPhone;
                    return {
                        phone: formattedPhone,
                        name: l.name || l.business_name || 'Unknown'
                    };
                }).filter(c => c.phone); // Basic length check if format util fails or as backup

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

        refreshChatHistory(phone) {
            // Real-time via onSnapshot — no manual refresh needed, kept for API compat
            this.loadChatHistory(phone);
        }

        async loadChatHistory(phone) {
            const container = document.getElementById('wa-chat-history');
            if (!container) return;

            // Cancel any existing listener
            if (this.chatUnsubscribe) {
                this.chatUnsubscribe();
                this.chatUnsubscribe = null;
            }

            container.innerHTML = `
                <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                    <div style="text-align: center; color: #334155; font-size: 0.8rem; font-style: italic;">
                        <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.4;">⏳</div>
                        Connecting...
                    </div>
                </div>`;

            try {
                if (!window.firebaseContext || !window.firebaseContext.db) throw new Error('Firebase not initialized');
                const { db } = window.firebaseContext;
                const { collection, query, where, orderBy, limit, getDocs, onSnapshot } = await import(
                    'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js'
                );

                const normalize = (raw) => {
                    const digits = String(raw).replace(/\D/g, '');
                    if (digits.length === 10) return '91' + digits;
                    if (digits.length === 11 && digits.startsWith('0')) return '91' + digits.slice(1);
                    return digits;
                };
                const leadPhone = normalize(phone);

                // Step 1: Find chat doc IDs for this lead
                const chatSnapshot = await getDocs(query(
                    collection(db, 'wa_chats'),
                    where('leadPhone', '==', leadPhone)
                ));

                if (chatSnapshot.empty) {
                    container.innerHTML = `
                        <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                            <div style="text-align: center; color: #334155; font-size: 0.8rem;">
                                <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.3;">🔇</div>
                                No messages yet
                            </div>
                        </div>`;
                    return;
                }

                // Step 2: Subscribe to all chat docs' messages with onSnapshot
                const messageMap = new Map();
                const allUnsubscribers = [];
                let firstLoad = true;

                const scheduleRender = (() => {
                    let raf = null;
                    return () => {
                        if (raf) return;
                        raf = requestAnimationFrame(() => {
                            raf = null;
                            this.renderChatHistory(Array.from(messageMap.values()));
                        });
                    };
                })();

                for (const chatDoc of chatSnapshot.docs) {
                    const msgsQuery = query(
                        collection(db, 'wa_chats', chatDoc.id, 'messages'),
                        orderBy('timestamp', 'asc'),
                        limit(60)
                    );

                    const unsub = onSnapshot(msgsQuery, (snap) => {
                        snap.docChanges().forEach(change => {
                            if (change.type === 'added' || change.type === 'modified') {
                                messageMap.set(change.doc.id, { id: change.doc.id, ...change.doc.data() });
                            } else if (change.type === 'removed') {
                                messageMap.delete(change.doc.id);
                            }
                        });
                        scheduleRender();
                    }, (err) => console.error('[WhatsApp RT]', err));

                    allUnsubscribers.push(unsub);
                }

                this.chatUnsubscribe = () => allUnsubscribers.forEach(fn => fn());

            } catch (e) {
                console.error('[WhatsApp] Chat history load failed:', e);
                container.innerHTML = `<div style="text-align: center; color: #ef4444; padding: 20px; font-size: 0.8rem;">Failed to load chat.</div>`;
            }
        }



        renderChatHistory(messages) {
            const container = document.getElementById('wa-chat-history');
            if (!container) return;

            if (!messages || messages.length === 0) {
                container.innerHTML = `
                    <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                        <div style="text-align: center; color: #334155; font-size: 0.8rem;">
                            <div style="font-size: 1.5rem; margin-bottom: 8px; opacity: 0.3;">🔇</div>
                            No messages yet
                        </div>
                    </div>`;
                return;
            }

            const sorted = [...messages].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

            let lastDateStr = null;
            const html = sorted.map(msg => {
                const isMe = msg.direction === 'outbound' || msg.from === 'me';
                const rawContent = msg.content?.text || msg.content?.caption || msg.body || '';
                const content = rawContent || (msg.content?.image ? '📷 Image' : msg.content?.video ? '🎬 Video' : msg.content?.document ? '📄 Document' : '📎 Media');

                const ts = msg.timestamp ? new Date(msg.timestamp) : null;
                const timeStr = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                const dateStr = ts ? ts.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '';

                let separator = '';
                if (dateStr && dateStr !== lastDateStr) {
                    lastDateStr = dateStr;
                    separator = `
                        <div style="display: flex; align-items: center; gap: 10px; margin: 12px 0 8px; opacity: 0.45;">
                            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                            <span style="font-size: 0.65rem; font-weight: 700; color: #94a3b8; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.05em;">${dateStr}</span>
                            <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
                        </div>`;
                }

                const tooltipData = this.escapeHtml(JSON.stringify(msg, null, 2));
                const bubble = isMe ? `
                    <div style="display: flex; justify-content: flex-end; margin-bottom: 2px;" title="${tooltipData}">
                        <div style="
                            max-width: 80%; background: linear-gradient(135deg, #10b981, #059669);
                            color: #fff; border-radius: 18px 18px 4px 18px;
                            padding: 9px 13px; font-size: 0.82rem; line-height: 1.45;
                            box-shadow: 0 2px 8px rgba(16,185,129,0.25);
                            word-break: break-word;
                        ">
                            ${this.escapeHtml(content)}
                            <div style="font-size: 0.6rem; opacity: 0.75; text-align: right; margin-top: 3px;">✓✓ ${timeStr}</div>
                        </div>
                    </div>` : `
                    <div style="display: flex; justify-content: flex-start; margin-bottom: 2px;" title="${tooltipData}">
                        <div style="
                            max-width: 80%; background: rgba(255,255,255,0.07);
                            color: #e2e8f0; border-radius: 18px 18px 18px 4px;
                            padding: 9px 13px; font-size: 0.82rem; line-height: 1.45;
                            border: 1px solid rgba(255,255,255,0.08);
                            word-break: break-word;
                        ">
                            ${this.escapeHtml(content)}
                            <div style="font-size: 0.6rem; opacity: 0.5; margin-top: 3px;">${timeStr}</div>
                        </div>
                    </div>`;

                return separator + bubble;
            }).join('');

            container.innerHTML = html;
            container.scrollTop = container.scrollHeight;
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

// B2BLeadsManager is initialised by nav_controller PAGE_REGISTRY when the b2b-leads page is loaded.

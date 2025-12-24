/**
 * DealerManager
 * Controller for the Dealer Management Page
 * Handles data fetching, filtering, and table rendering.
 */

import { DealerValidator } from './components/dealer-validator.js';
import { TABLE_UI } from './config/constants.js';
import { DealerService } from './services/dealer-service.js';
import { DealerFilterService } from './services/dealer-filter-service.js';
import { CategorySelector } from './components/category-selector.js';

if (!window.DealerManager) {
    window.DealerManager = class DealerManager {
        constructor() {
            this.dealers = [];
            this.filteredDealers = [];
            this.generalSettings = {};

            // Initialize validator
            this.validator = new DealerValidator();

            // Initialize DealerService (will be set after dataManager is available)
            this.dealerService = null;

            // Initialize DealerFilterService
            this.filterService = new DealerFilterService();

            // Filters
            this.searchQuery = '';
            this.stageFilter = 'all';
            this.kamFilter = 'all';
            this.districtFilter = 'all';
            this.stateFilter = 'all';
            this.categoryFilter = [];

            // Pagination
            this.currentPage = 1;
            this.itemsPerPage = 100; // Increased default to 100 based on user preference, but paginated
            this.isPaginationEnabled = true;

            // Sorting
            this.sortColumn = 'customer_name'; // Default sort
            this.sortDirection = 'asc';

            // Bulk Selection
            this.selectedDealers = new Set();

            this.init();
        }

        async init() {
            console.log('DealerManager initializing...');
            this.showLoadingState();

            try {
                // Ensure DataManager exists and is loaded
                if (!window.dataManager) {
                    console.log('DataManager instance not found, creating new instance...');
                    if (typeof window.DataManager === 'function') {
                        window.dataManager = new window.DataManager();
                        // We must trigger data loading since we just created it
                        await window.dataManager.loadGeneralSettings();
                        // Trigger main load - defaulting to Kerala for now as per dashboard logic
                        // We need to know which report to load... DataManager defaults might be empty if not told.
                        // Dashboard logic loads reports list then loads first report.
                        // We should replicate that or expose a helper in DataManager to "Initialize Default".

                        // For now, let's try to list reports and load first one like Dashboard does.
                        const reports = await window.dataManager.listReports();
                        if (reports && reports.length > 0) {
                            const reportId = reports[0].id; // Use report ID instead of URL
                            console.log('DealerManager loading default report:', reportId);
                            await window.dataManager.loadData('', [], reportId); // Empty state = all dealers
                        } else {
                            console.warn('No reports found to load.');
                        }
                    } else {
                        throw new Error('DataManager Class not available. Script missing?');
                    }
                }

                await this.waitForDataManager();

                // Initialize DealerService now that dataManager is available
                this.dealerService = new DealerService(window.dataManager);

                // Ensure settings are loaded
                if (!window.dataManager.generalSettings || !window.dataManager.generalSettings.key_accounts) {
                    await window.dataManager.loadGeneralSettings();
                }

                // Populate Report Selector
                await this.loadReportsList();

                this.renderFilters();

                // Init Category Selector
                this.categorySelector = new CategorySelector({
                    containerId: 'category-selector-container',
                    onChange: (selected) => {
                        this.categoryFilter = selected;
                        this.applyFilters();
                    }
                });

                this.setupEventListeners();

            } catch (error) {
                console.error('DealerManager init failed:', error);
                const tableBody = document.getElementById('dealer-table-body');
                if (tableBody) {
                    tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Failed to load data. Please refresh. <br> <small>${error.message}</small></td></tr>`;
                }
            }
        }

        async waitForDataManager() {
            return new Promise((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50;
                const check = () => {
                    attempts++;
                    if (window.dataManager) resolve();
                    else if (attempts >= maxAttempts) reject(new Error('Timeout waiting for DataManager'));
                    else setTimeout(check, 200);
                };
                check();
            });
        }

        async loadReportsList() {
            const selector = document.getElementById('dealer-report-selector');
            if (!selector) return;

            // Simplified: Always use All Reports
            selector.innerHTML = '';

            const allOpt = document.createElement('option');
            allOpt.value = 'ALL_REPORTS';
            allOpt.textContent = 'All Reports (Aggregated)';
            allOpt.style.fontWeight = 'bold';
            selector.appendChild(allOpt);

            selector.value = 'ALL_REPORTS';

            // Trigger Load
            this.handleReportChange(selector.value);
        }

        setTopFilter(type, value) {
            console.log(`Setting top filter: ${type} = ${value}`);
            if (type === 'stage') {
                this.stageFilter = value;
                // Update dropdown to match if exists
                const stageSelect = document.getElementById('filter-stage');
                if (stageSelect) stageSelect.value = value;
            } else if (type === 'kam') {
                this.kamFilter = value;
                // Update dropdown to match if exists
                const kamSelect = document.getElementById('filter-kam');
                if (kamSelect) kamSelect.value = value;
            }
            this.applyFilters();
        }

        setStageFilter(value) {
            this.setTopFilter('stage', value);
        }

        async handleReportChange(url) {
            if (!url) return;
            this.showLoadingState();
            console.log('Switching to report:', url);

            try {
                // Set active report in data layer
                if (url === 'ALL_REPORTS') {
                    window.dataManager.dataLayer.setActiveReport(null);
                } else {
                    window.dataManager.dataLayer.setActiveReport(url);
                }

                // Load data using DataLayer (with caching)
                await this.loadData();
                this.applyFilters();
            } catch (e) {
                console.error('Failed to load report data:', e);
            }
        }

        showLoadingState() {
            const tableBody = document.getElementById('dealer-table-body');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading dealer data...</td></tr>';
            }
        }

        async loadData(forceRefresh = false) {
            // Force check again just in case (e.g. if we skipped wait due to race condition which shouldn't happen with await)
            if (!window.dataManager || !window.dataManager.dataLayer) {
                console.warn('DataManager or DataLayer not ready in loadData');
                return;
            }

            console.log('[DealerManager] Loading dealer data from DataLayer...');

            try {
                // Use DataLayer to get merged dealer data (with optional cache bypass)
                const mergedDealers = await window.dataManager.dataLayer.getDealerManagementData(forceRefresh);
                console.log(`[DealerManager] Loaded ${mergedDealers.length} dealers from DataLayer`);

                // Process dealers for table display
                this.dealers = mergedDealers.map((d, index) => {
                    // INJECT DISTRICT if not already present
                    if (!d.district && window.dataManager.zipCache) {
                        let zip = d.billing_zipcode || d.shipping_zipcode;
                        if (zip) {
                            zip = zip.replace(/\s/g, '');
                            d.district = window.dataManager.zipCache[zip] || 'Unknown';
                        }
                    }

                    // Normalizing State using DealerValidator
                    const rawState = d.billing_state || d.shipping_state || '';
                    const state = this.validator.normalizeState(rawState);

                    // Ensure ID exists
                    const uniqueId = d.id || d.cust_id || `temp_id_${index}`;

                    return {
                        ...d, // Includes overrides and original data flags
                        state: state, // Normalized state
                        _internalId: uniqueId, // Explicit internal ID for selection
                        id: d.id || uniqueId, // Fallback
                        searchString: `${d.customer_name} ${d.first_name || ''} ${d.mobile_phone || ''} ${d.billing_zipcode || ''} ${state || ''} ${d.district || ''}`.toLowerCase()
                    };
                });

                this.generalSettings = window.dataManager.generalSettings || {};

                // Initialize filteredDealers to all dealers
                this.filteredDealers = [...this.dealers];

                // Update dynamic filters after data is loaded
                this.updateKAMFilter();
                this.updateDistrictFilter();
                this.updateStateFilter();
                this.updateStageFilter();

                // Populate Categories
                const allCategories = new Set();
                this.dealers.forEach(d => {
                    if (Array.isArray(d.categories)) {
                        d.categories.forEach(c => allCategories.add(c));
                    }
                });
                if (this.categorySelector) {
                    this.categorySelector.setCategories(Array.from(allCategories));
                }

                console.log(`[DealerManager] Processed ${this.dealers.length} dealers, ${this.filteredDealers.length} filtered`);
            } catch (error) {
                console.error('[DealerManager] Failed to load data from DataLayer:', error);
                throw error;
            }
        }

        setupEventListeners() {
            // Report Selector
            const reportSelector = document.getElementById('dealer-report-selector');
            if (reportSelector) {
                reportSelector.addEventListener('change', (e) => {
                    this.handleReportChange(e.target.value);
                });
            }

            // Search Input
            const searchInput = document.getElementById('dealer-search');
            if (searchInput) {
                let searchTimeout;
                searchInput.addEventListener('input', (e) => {
                    const query = e.target.value.toLowerCase();
                    clearTimeout(searchTimeout);
                    searchTimeout = setTimeout(() => {
                        this.searchQuery = query;
                        this.applyFilters();
                    }, 300);
                });
            }

            // Filters (delegated if they are dynamically rendered, or direct)
            document.addEventListener('change', (e) => {
                if (e.target.id === 'filter-stage') {
                    this.stageFilter = e.target.value;
                    this.applyFilters();
                }
                if (e.target.id === 'filter-kam') {
                    this.kamFilter = e.target.value;
                    this.applyFilters();
                }
                if (e.target.id === 'filter-district') {
                    this.districtFilter = e.target.value;
                    this.applyFilters();
                }
                if (e.target.id === 'filter-state') {
                    this.stateFilter = e.target.value;
                    this.updateDistrictFilter(); // Update dependent filter
                    this.applyFilters();
                }
            });

            // Clear All Button Logic (New)
            const clearAllBtn = document.getElementById('clear-all-filters');
            if (clearAllBtn) {
                clearAllBtn.addEventListener('click', () => {
                    this.clearAllFilters();
                });
            }

            // Filter Clear Buttons Logic (Legacy - keep for individual clear)
            const filterIds = ['filter-kam', 'filter-stage', 'filter-state', 'filter-district'];

            filterIds.forEach(filterId => {
                const select = document.getElementById(filterId);
                // Listen to change to trigger updates
                if (select) {
                    // We don't need the old clear buttons logic as much if we have chips,
                    // but keeping them for consistency with the dropdowns themselves.
                    // The logic below updating visibility of the 'x' inside the dropdown wrapper:
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

            // Listen for data refresh events (e.g. after save)
            // Check if we can hook into window.viewController.saveDealerInfo which calls reload
            // Ideally we poll or simply re-render when we know data changed.

            // Setup Sorting
            this.setupSorting();

            // Setup Bulk Actions
            this.setupBulkActions();
        }


        renderFilters() {
            // Populate KAM Filter
            // Only run if we have settings
            if (this.generalSettings.key_accounts) {
                const kamSelect = document.getElementById('filter-kam');
                if (kamSelect) {
                    let html = '<option value="all">All KAMs</option>';
                    this.generalSettings.key_accounts.forEach(kam => {
                        html += `<option value="${kam}">${kam}</option>`;
                    });
                    kamSelect.innerHTML = html;
                }
            }

            // Populate Stage Filter
            // Populate Stage Filter (Dynamic from data)
            this.updateStageFilter();

            // Populate District Filter (extract from actual data)
            // District Filter (Dynamic)
            this.updateDistrictFilter();

            // Populate State Filter (extract from actual data)
            this.updateStateFilter();
        }

        updateKAMFilter() {
            const kamSelect = document.getElementById('filter-kam');
            if (!kamSelect) return;

            // Preserve current selection if it exists
            const currentVal = kamSelect.value || 'all';

            let html = '<option value="all">All KAMs</option>';
            html += '<option value="not_assigned">Not Assigned</option>';

            // Only populate if we have settings with key_accounts
            if (this.generalSettings && this.generalSettings.key_accounts && this.generalSettings.key_accounts.length > 0) {
                this.generalSettings.key_accounts.forEach(kam => {
                    html += `<option value="${kam}">${kam}</option>`;
                });
            }

            kamSelect.innerHTML = html;

            // Restore selection if it still exists in the options
            if (currentVal !== 'all') {
                const optionExists = this.generalSettings?.key_accounts?.includes(currentVal);
                kamSelect.value = optionExists ? currentVal : 'all';
            }
        }

        updateDistrictFilter() {
            const districtSelect = document.getElementById('filter-district');
            if (!districtSelect) return;

            const wrapper = districtSelect.closest('.filter-wrapper');
            const clearBtn = wrapper ? wrapper.querySelector('.filter-clear-btn') : null;

            // Dependent on State Filter
            const selectedState = this.stateFilter; // Assuming this is set BEFORE this method is called

            if (!selectedState || selectedState === 'all') {
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

            if (this.dealers.length > 0) {
                // Filter districts by selected state
                const relevantDealers = this.dealers.filter(d => {
                    return d.state === selectedState;
                });

                const districts = [...new Set(relevantDealers.map(d => d.district).filter(Boolean).filter(d => d !== 'Unknown'))].sort();

                // Preserve selection if valid, otherwise reset
                const currentVal = districtSelect.value;
                let newVal = 'all';
                if (districts.includes(currentVal)) {
                    newVal = currentVal;
                } else {
                    this.districtFilter = 'all'; // Trigger filter update implicitly next time applyFilters runs? 
                    // No, applyFilters reads this.districtFilter. ensure it matches.
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
        }

        updateStateFilter() {
            const stateSelect = document.getElementById('filter-state');
            if (stateSelect && this.dealers.length > 0) {
                const states = [...new Set(this.dealers.map(d => d.state).filter(Boolean))].sort();
                const val = stateSelect.value;

                let html = '<option value="all">All States</option>';
                states.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
                stateSelect.innerHTML = html;
                stateSelect.value = val;
            }
        }

        updateStageFilter() {
            const stageSelect = document.getElementById('filter-stage');
            if (stageSelect && this.dealers.length > 0) {
                const stages = [...new Set(this.dealers.map(d => d.dealer_stage).filter(Boolean))].sort();
                const val = stageSelect.value;

                let html = '<option value="all">All Stages</option>';
                stages.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
                stageSelect.innerHTML = html;
                stageSelect.value = val;
            }
        }

        // normalizeState() and getLevenshteinDistance() moved to DealerValidator component
        // Kept as wrapper methods for backward compatibility
        normalizeState(state) {
            return this.validator.normalizeState(state);
        }

        getLevenshteinDistance(a, b) {
            return this.validator.getLevenshteinDistance(a, b);
        }

        setupSorting() {
            const table = document.querySelector('.dealer-table');
            if (!table) return;

            const headers = table.querySelectorAll('th.sortable');
            headers.forEach(th => {
                th.addEventListener('click', () => {
                    const field = th.dataset.sort;
                    if (field) {
                        this.handleSort(field);
                    }
                });
            });
            this.updateSortIcons();
        }

        handleSort(field) {
            if (this.sortField === field) {
                // Toggle direction
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortField = field;
                this.sortDirection = 'asc';
            }

            // Re-apply filters which triggers sort and render
            this.applyFilters();
            this.updateSortIcons();
        }

        updateSortIcons() {
            const headers = document.querySelectorAll('.dealer-table th.sortable');
            headers.forEach(th => {
                th.classList.remove('asc', 'desc');
                if (th.dataset.sort === this.sortField) {
                    th.classList.add(this.sortDirection);
                }
            });
        }

        sortDealers() {
            if (!this.sortColumn) return;

            const field = this.sortColumn;
            const dir = this.sortDirection === 'asc' ? 1 : -1;

            this.filteredDealers.sort((a, b) => {
                let valA = a[field] || '';
                let valB = b[field] || '';

                // Special handling for State/District combined column sorting
                // If sorting by 'state', we actually want to sort by State THEN District
                if (field === 'state') {
                    const stateA = (a.state || '').toLowerCase().trim();
                    const stateB = (b.state || '').toLowerCase().trim();

                    if (stateA !== stateB) {
                        return (stateA < stateB ? -1 : 1) * dir;
                    }
                    // Same state, sort by district
                    const distA = (a.district || '').toLowerCase().trim();
                    const distB = (b.district || '').toLowerCase().trim();
                    if (distA < distB) return -1 * dir;
                    if (distA > distB) return 1 * dir;
                    return 0;
                }

                // Handle array fields (like Categories)
                if (Array.isArray(valA)) valA = valA.join(', ');
                if (Array.isArray(valB)) valB = valB.join(', ');

                if (typeof valA === 'string') valA = valA.toLowerCase();
                if (typeof valB === 'string') valB = valB.toLowerCase();

                if (valA < valB) return -1 * dir;
                if (valA > valB) return 1 * dir;
                return 0;
            });
        }

        applyFilters() {
            // Sync current filters to service
            this.filterService.setFilter('search', this.searchQuery);
            this.filterService.setFilter('kam', this.kamFilter);
            this.filterService.setFilter('stage', this.stageFilter);
            this.filterService.setFilter('state', this.stateFilter);
            this.filterService.setFilter('district', this.districtFilter);
            this.filterService.setFilter('categories', this.categoryFilter);

            // Apply filters using the service
            this.filteredDealers = this.filterService.applyFilters(this.dealers);

            // Screen reader announcement
            const statusEl = document.getElementById('a11y-status');
            if (statusEl) {
                statusEl.textContent = `Showing ${this.filteredDealers.length} of ${this.dealers.length} dealers`;
            }

            // Apply Sorting
            this.sortDealers();

            // Reset pagination
            this.currentPage = 1;

            this.renderFilterChips(); // Update chips UI

            this.renderTable();
            this.updateStats();

            // Ensure first column stays at correct width (uses TABLE_UI constant from Prompt 6)
            const table = document.querySelector('.dealer-table');
            if (table) {
                const firstCol = table.querySelector('colgroup col:first-child');
                const firstHeader = table.querySelector('th:first-child');
                if (firstCol) firstCol.style.width = TABLE_UI.FIRST_COLUMN_WIDTH + 'px';
                if (firstHeader) firstHeader.style.width = TABLE_UI.FIRST_COLUMN_WIDTH + 'px';
            }
        }

        updateStats() {
            const count = this.filteredDealers.length;
            const total = this.dealers.length;
            const el = document.getElementById('dealer-count-display');
            if (el) el.textContent = `Showing ${count} of ${total}`;
        }

        renderFilterChips() {
            const container = document.getElementById('active-filters-list');
            const bar = document.getElementById('active-filter-bar');

            if (!container || !bar) return;

            container.innerHTML = '';
            let hasFilters = false;

            const createChip = (label, value, type) => {
                hasFilters = true;
                const chip = document.createElement('div');
                chip.className = 'filter-chip';
                chip.innerHTML = `
                    <span class="filter-chip-label">${label}:</span>
                    <span>${value}</span>
                    <button class="filter-chip-remove" title="Remove filter">×</button>
                `;
                chip.querySelector('.filter-chip-remove').addEventListener('click', () => {
                    this.removeFilter(type);
                });
                container.appendChild(chip);
            };

            if (this.kamFilter && this.kamFilter !== 'all') {
                createChip('KAM', this.kamFilter, 'kam');
            }
            if (this.stageFilter && this.stageFilter !== 'all') {
                createChip('Stage', this.stageFilter, 'stage');
            }
            if (this.stateFilter && this.stateFilter !== 'all') {
                createChip('State', this.stateFilter, 'state');
            }
            if (this.districtFilter && this.districtFilter !== 'all') {
                createChip('District', this.districtFilter, 'district');
            }
            if (this.categoryFilter && this.categoryFilter.length > 0) {
                createChip('Categories', this.categoryFilter.length + ' selected', 'categories');
            }

            // Show/Hide bar based on filters
            bar.style.display = hasFilters ? 'flex' : 'none';
        }

        setStageFilter(stage) {
            // Update local state
            this.stageFilter = stage;

            // Update dropdown UI if matching option exists
            const select = document.getElementById('filter-stage');
            if (select) {
                // If stage is 'not_assigned', value might not match options, so we might need to handle that or let it stay on "All Stages" visually but filter is active.
                // Or "Active" / "Non Active" should match.
                select.value = stage;
                // If value doesn't exist, it won't select anything (or stay as is). 
                // But we will manually trigger logic anyway.
            }

            this.applyFilters();
        }

        removeFilter(type) {
            const idMap = {
                kam: 'filter-kam',
                stage: 'filter-stage',
                state: 'filter-state',
                district: 'filter-district'
            };

            if (type === 'categories') {
                if (this.categorySelector) this.categorySelector.reset(); // Logic handled in reset
                // But wait, reset clears all? No reset() in selector clears selection.
                // We need to trigger apply.
                // Assuming reset() calls or we trigger apply.
                // Actually CategorySelector.reset() clears and re-renders but doesn't trigger callback unless we want it to?
                // Let's manually clear.
                this.categoryFilter = [];
                // Selector internal state
                if (this.categorySelector) {
                    this.categorySelector.selectedCategories.clear();
                    this.categorySelector.renderList();
                    this.categorySelector.updateTriggerText();
                }
                this.applyFilters();
                return;
            }

            const el = document.getElementById(idMap[type]);
            if (el) {
                el.value = 'all';
                el.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        clearAllFilters() {
            // Reset local state (will be synced by change events anyway, but good to be explicit)
            const map = {
                'filter-kam': 'all',
                'filter-stage': 'all',
                'filter-state': 'all',
                'filter-district': 'all'
            };

            // Trigger change on all selects to reset logic
            Object.keys(map).forEach(id => {
                const el = document.getElementById(id);
                if (el && el.value !== 'all') {
                    el.value = 'all';
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                }
            });

            // Clear Categories
            this.categoryFilter = [];
            if (this.categorySelector) {
                this.categorySelector.reset();
            }
            // Search query? 
            // if (this.searchQuery) ...
        }

        // ==========================================
        // BULK ACTIONS
        // ==========================================

        setupBulkActions() {
            // Select All Checkbox
            const selectAll = document.getElementById('select-all-dealers');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    this.toggleSelectAll(e.target.checked);
                });
            }

            // Move Modal to Body to avoid stacking context issues
            const modal = document.getElementById('bulk-kam-modal');
            if (modal && modal.parentElement !== document.body) {
                document.body.appendChild(modal);
            }
        }

        toggleSelectAll(checked) {
            // Select only currently filtered dealers
            const visibleIds = this.filteredDealers.map(d => d.id || d.cust_id).filter(Boolean); // Prefer ID, fallback cust_id

            if (checked) {
                visibleIds.forEach(id => this.selectedDealers.add(id));
            } else {
                visibleIds.forEach(id => this.selectedDealers.delete(id));
            }
            this.renderTable(); // Re-render to update checkboxes
            this.updateBulkActionBar();
        }

        toggleSelectRow(id, checked) {
            console.log(`toggleSelectRow: ${id} -> ${checked}`); // Debug Log
            if (checked) {
                this.selectedDealers.add(id);
            } else {
                this.selectedDealers.delete(id);
            }
            console.log(`Selected Count: ${this.selectedDealers.size}`);
            this.updateBulkActionBar();

            // Update Select All Checkbox state
            this.updateSelectAllCheckbox();
        }

        updateSelectAllCheckbox() {
            const selectAll = document.getElementById('select-all-dealers');
            if (!selectAll) return;

            const visibleIds = this.filteredDealers.map(d => d.id || d.cust_id).filter(Boolean);
            if (visibleIds.length === 0) {
                selectAll.checked = false;
                selectAll.indeterminate = false;
                return;
            }

            const selectedVisible = visibleIds.filter(id => this.selectedDealers.has(id));

            if (selectedVisible.length === visibleIds.length) {
                selectAll.checked = true;
                selectAll.indeterminate = false;
            } else if (selectedVisible.length > 0) {
                selectAll.checked = false;
                selectAll.indeterminate = true;
            } else {
                selectAll.checked = false;
                selectAll.indeterminate = false;
            }
        }

        updateBulkActionBar() {
            const bar = document.getElementById('bulk-actions-bar');
            const countEl = document.getElementById('bulk-selected-count');

            if (!bar || !countEl) return;

            const count = this.selectedDealers.size;
            countEl.textContent = count;

            if (count > 0) {
                bar.classList.add('visible');
            } else {
                bar.classList.remove('visible');
            }
        }

        clearSelection() {
            this.selectedDealers.clear();
            this.renderTable();
            this.updateBulkActionBar();
            this.updateSelectAllCheckbox();
        }

        bulkExport() {
            if (this.selectedDealers.size === 0) return;

            // Filter dealers to export
            const dealersToExport = this.dealers.filter(d => this.selectedDealers.has(d.id || d.cust_id));
            if (dealersToExport.length === 0) return;

            // Simple CSV Export Logic
            const headers = ['Dealer Name', 'Contact', 'Mobile', 'State', 'District', 'KAM', 'Stage'];
            const rows = dealersToExport.map(d => [
                d.customer_name,
                d.first_name,
                d.mobile_phone,
                d.state,
                d.district,
                d.key_account,
                d.dealer_stage
            ]);

            let csvContent = "data:text/csv;charset=utf-8,"
                + headers.join(",") + "\n"
                + rows.map(e => e.join(",")).join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `dealers_export_${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // Uses Toast instead of alert
            import('./utils/toast.js').then(module => {
                module.Toast.success(`Exported ${dealersToExport.length} dealers`);
            }).catch(() => alert(`Exported ${dealersToExport.length} dealers`));
            this.clearSelection();
        }

        async bulkDeactivate() {
            if (this.selectedDealers.size === 0) return;

            const confirmMsg = `Are you sure you want to deactivate ${this.selectedDealers.size} dealers? They will be removed from the view.`;
            if (!confirm(confirmMsg)) return;

            const password = prompt("Enter password to confirm deactivation:");
            if (password !== "1011") {
                import('./utils/toast.js').then(module => {
                    module.Toast.error("Incorrect password. Deactivation cancelled.");
                }).catch(() => alert("Incorrect password. Deactivation cancelled."));
                return;
            }

            // Get names to deactivate
            // Use _internalId map if possible, but deactivation is by NAME
            // So we need to map IDs back to Customer Names
            const dealersToDeactivate = this.dealers
                .filter(d => this.selectedDealers.has(d._internalId || d.id || d.cust_id))
                .map(d => d.customer_name); // use customer_name for deactivation

            if (dealersToDeactivate.length === 0) return;

            import('./utils/toast.js').then(module => {
                module.Toast.info(`Deactivating ${dealersToDeactivate.length} dealers...`);
            });

            try {
                // Call DataLayer
                await window.dataManager.dataLayer.deactivateDealers(dealersToDeactivate);

                // Refresh Table
                await this.refresh();

                import('./utils/toast.js').then(module => {
                    module.Toast.success(`Deactivated ${dealersToDeactivate.length} dealers`);
                });
                this.clearSelection();

            } catch (error) {
                console.error('Deactivation failed:', error);
                import('./utils/toast.js').then(module => {
                    module.Toast.error('Deactivation failed: ' + error.message);
                });
            }
        }

        bulkAssignKAM() {
            console.log('bulkAssignKAM clicked - Version 4');
            const modal = document.getElementById('bulk-kam-modal');
            const select = document.getElementById('bulk-kam-select');
            const countEl = document.getElementById('bulk-kam-count');

            if (!modal || !select) {
                alert('Error: Modal not found!');
                return;
            }

            // Safe populate select
            if (select && this.generalSettings && Array.isArray(this.generalSettings.key_accounts)) {
                let html = '<option value="">Not Assigned</option>'; // First option to clear KAM
                this.generalSettings.key_accounts.forEach(kam => {
                    html += `<option value="${kam}">${kam}</option>`;
                });
                select.innerHTML = html;
            }

            // Update count
            if (countEl) countEl.textContent = this.selectedDealers.size;

            // Show modal with forced styles AND active class (required by CSS)
            modal.classList.add('active'); // CRITICAL: Required by settings.css/discussions.css
            modal.style.position = 'fixed';
            modal.style.top = '0';
            modal.style.left = '0';
            modal.style.width = '100vw';
            modal.style.height = '100vh';
            modal.style.zIndex = '99999';
            modal.style.display = 'flex';
            modal.style.visibility = 'visible';
            modal.style.opacity = '1';

            console.log('Modal forced visible (v6 with active class)');
        }

        closeBulkKAMModal() {
            const modal = document.getElementById('bulk-kam-modal');
            if (modal) {
                modal.style.display = 'none';
                modal.classList.remove('active');
            }
        }

        async confirmBulkAssign() {
            const select = document.getElementById('bulk-kam-select');
            const kam = select ? select.value : null;

            // Allow empty string (Not Assigned) to clear KAM, but not null/undefined
            if (kam === null || kam === undefined) {
                import('./utils/toast.js').then(module => {
                    module.Toast.warning('Error: KAM selection not found');
                });
                return;
            }

            // Close modal immediately for better UX
            this.closeBulkKAMModal();

            // Get list of dealers to update
            const dealersToUpdate = this.dealers.filter(d =>
                this.selectedDealers.has(d._internalId || d.id || d.cust_id)
            );

            if (dealersToUpdate.length === 0) {
                import('./utils/toast.js').then(module => {
                    module.Toast.warning('No dealers selected');
                });
                return;
            }

            // Determine action message
            const action = kam === '' ? 'Clearing' : `Assigning ${kam} to`;

            // Show progress toast
            import('./utils/toast.js').then(module => {
                module.Toast.info(`${action} ${dealersToUpdate.length} dealers...`);
            });

            try {
                // Update each dealer via DataLayer (follows existing architecture)
                // This persists to Firebase via dealer_overrides
                const updatePromises = dealersToUpdate.map(dealer => {
                    const dealerName = dealer.customer_name;
                    return window.dataManager.saveDealerOverride(dealerName, {
                        key_account_manager: kam || '' // Empty string to clear
                    });
                });

                await Promise.all(updatePromises);

                // Refresh table to show updated data
                await this.refresh();

                const successMsg = kam === ''
                    ? `Cleared KAM for ${dealersToUpdate.length} dealers`
                    : `Assigned ${kam} to ${dealersToUpdate.length} dealers`;

                import('./utils/toast.js').then(module => {
                    module.Toast.success(successMsg);
                });

                this.clearSelection();

            } catch (error) {
                console.error('Failed to bulk assign KAM:', error);
                import('./utils/toast.js').then(module => {
                    module.Toast.error('Failed to save changes: ' + error.message);
                });
                // Refresh anyway to show current state
                await this.refresh();
            }
        }

        getStageColorClass(stage) {
            if (!stage) return 'new';
            const s = stage.toLowerCase();
            if (s === 'active') return 'active';
            if (s === 'new') return 'new';
            if (s.includes('black')) return 'blacklisted';
            if (s.includes('archived')) return 'archived';
            return 'new'; // Default
        }

        sortBy(column) {
            if (this.sortColumn === column) {
                this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
            } else {
                this.sortColumn = column;
                this.sortDirection = 'asc';
            }

            this.applyFilters();
        }

        renderTable() {
            const tableBody = document.getElementById('dealer-table-body');
            if (!tableBody) return;

            if (this.filteredDealers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="10" style="text-align:center; padding: 2rem; color: var(--text-muted);">No dealers found matching criteria.</td></tr>';
                this.renderPagination();
                return;
            }

            // Calculate pagination
            const totalItems = this.filteredDealers.length;

            if (this.isPaginationEnabled) {
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);

                // Bounds check
                if (this.currentPage > totalPages) this.currentPage = totalPages;
                if (this.currentPage < 1) this.currentPage = 1;
            }

            let startIndex = 0;
            let displayData = this.filteredDealers;

            if (this.isPaginationEnabled) {
                startIndex = (this.currentPage - 1) * this.itemsPerPage;
                const endIndex = Math.min(startIndex + this.itemsPerPage, totalItems);
                displayData = this.filteredDealers.slice(startIndex, endIndex);
            }

            const fragment = document.createDocumentFragment();

            displayData.forEach((d, index) => {
                // console.log('Rendering row', index);
                try {
                    const kam = d.key_account_manager;
                    const kamHtml = kam ? `<span class="kam-badge">${kam}</span>` : `<span class="kam-empty">-</span>`;

                    const stage = d.dealer_stage || '-';
                    // Using existing helper if available or default color logic
                    const stageClass = this.getStageClass ? this.getStageClass(stage) : (stage.toLowerCase().replace(/\s+/g, '-'));

                    const phone = d.mobile_phone || '-';
                    const district = d.district || '-';
                    const name = d.customer_name || 'Unknown';

                    const rowNumber = startIndex + index + 1; // Correct row number based on pagination
                    const uniqueId = d._internalId || d.id || d.cust_id;
                    const isSelected = this.selectedDealers.has(uniqueId);

                    // Checkbox HTML
                    const checkboxHtml = `
                        <td style="padding: 0 10px; text-align: center;">
                            <input type="checkbox" class="table-checkbox row-checkbox" 
                                ${isSelected ? 'checked' : ''}
                                onclick="event.stopPropagation(); window.dealerManager.toggleSelectRow('${uniqueId}', this.checked)">
                        </td>
                    `;

                    const categories = d.categories || [];
                    const categoriesHtml = categories.length > 0
                        ? categories.map(c => `<span class="category-badge">${c}</span>`).join(' ')
                        : '-';

                    const tr = document.createElement('tr');
                    tr.className = 'dealer-row';
                    tr.innerHTML = `
                        ${checkboxHtml}
                        <td style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">${rowNumber}</td>
                        <td>
                            <div class="row-title" title="${name}">${name}</div>
                        </td>
                        <td class="contact-cell" onclick="window.dealerManager.showInlineContactNameEdit('${name.replace(/'/g, "\\'")}', this)">
                            <div class="row-text">${d.first_name || '-'}</div>
                        </td>
                        <td class="contact-cell" onclick="window.dealerManager.showInlinePhoneEdit('${name.replace(/'/g, "\\'")}', this)">
                            <div class="row-text">${phone}</div>
                        </td>
                        <td onclick="window.dealerManager.showInlineEdit('${name.replace(/'/g, "\\'")}', 'key_account_manager', this)">
                             ${kamHtml}
                        </td>
                        <td>
                            <div class="row-text">${d.state || '-'}</div>
                        </td>
                        <td>
                            <div class="row-text">${district}</div>
                        </td>
                        <td class="categories-cell" onclick="window.dealerManager.editDealerCategories('${uniqueId}', '${name.replace(/'/g, "\\'")}', this)">
                            ${categoriesHtml}
                        </td>
                        <td class="stage-cell" onclick="window.dealerManager.showInlineEdit('${name.replace(/'/g, "\\'")}', 'dealer_stage', this)">
                            <span class="status-pill status-${stageClass}">${stage}</span>
                        </td>
                    `;
                    fragment.appendChild(tr);
                } catch (e) {
                    console.error('Error rendering row:', e, d);
                }
            });

            tableBody.innerHTML = '';
            tableBody.appendChild(fragment);

            // Render pagination controls
            this.renderPagination();
            this.updateHeaderStats();
        }

        updateHeaderStats() {
            const stats = {
                total: this.filteredDealers.length,
                active: 0,
                nonActive: 0,
                notAssigned: 0,
                blacklisted: 0,
                kamUnassigned: 0
            };

            this.filteredDealers.forEach(d => {
                const stage = (d.dealer_stage || '').toLowerCase();
                const cleanStage = stage.replace(/\s+/g, '');

                if (!stage) {
                    stats.notAssigned++;
                } else if (cleanStage === 'active') {
                    stats.active++;
                } else if (cleanStage === 'nonactive' || cleanStage === 'inactive') {
                    stats.nonActive++;
                } else if (cleanStage === 'blacklisted') {
                    stats.blacklisted++;
                }

                if (!d.key_account_manager) {
                    stats.kamUnassigned++;
                }
            });

            const updateEl = (id, val) => {
                const el = document.getElementById(id);
                if (el) el.textContent = val;
            };

            updateEl('stats-total', stats.total);
            updateEl('stats-active', stats.active);
            updateEl('stats-non-active', stats.nonActive);
            updateEl('stats-not-assigned', stats.notAssigned);
            updateEl('stats-blacklisted', stats.blacklisted);
            updateEl('stats-kam-unassigned', stats.kamUnassigned);
        }

        renderPagination() {
            const container = document.getElementById('pagination-container');
            if (!container) return;

            const totalItems = this.filteredDealers.length;

            if (totalItems === 0) {
                container.innerHTML = '';
                return;
            }

            let infoText = '';
            let controlsHtml = '';

            if (this.isPaginationEnabled) {
                const totalPages = Math.ceil(totalItems / this.itemsPerPage);
                const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
                const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

                infoText = `Showing ${startItem}-${endItem} of ${totalItems}`;
                controlsHtml = `
                    <button class="page-btn" ${this.currentPage === 1 ? 'disabled' : ''} onclick="window.dealerManager.changePage(${this.currentPage - 1})">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
                        Prev
                    </button>
                    <span class="page-current">Page ${this.currentPage} of ${totalPages}</span>
                    <button class="page-btn" ${this.currentPage === totalPages ? 'disabled' : ''} onclick="window.dealerManager.changePage(${this.currentPage + 1})">
                        Next
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
                    </button>
                `;
            } else {
                infoText = `Showing all ${totalItems} dealers`;
                controlsHtml = '';
            }

            const toggleBtnText = this.isPaginationEnabled ? 'View All' : 'Paginate';

            container.innerHTML = `
                <div class="pagination-info">
                    ${infoText}
                </div>
                <!-- Pagination Controls -->
                <div class="pagination-controls" style="margin-left:auto; margin-right: 20px;">
                    ${controlsHtml}
                    <div style="width: 1px; height: 16px; background: var(--border-light); margin: 0 10px;"></div>
                    <button class="page-btn" onclick="window.dealerManager.togglePagination()">
                        ${toggleBtnText}
                    </button>
                </div>
                
                <!-- Action Buttons (Footer) -->
                <div style="display: flex; gap: 10px;">
                    <button class="btn-secondary" onclick="window.dealerManager.exportCSV()" style="padding: 6px 12px; font-size: 0.85rem;">
                        Export CSV
                    </button>
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

            const totalItems = this.filteredDealers.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);

            if (newPage < 1 || newPage > totalPages) return;

            this.currentPage = newPage;
            this.renderTable();
            // Scroll to top of table
            const tableContainer = document.querySelector('.dealer-table-container');
            if (tableContainer) tableContainer.scrollTop = 0;
        }

        getStageColorClass(stage) {
            const s = (stage || '').toLowerCase();
            if (s === 'active') return 'success';
            if (s === 'lead') return 'info';
            if (s === 'churned') return 'danger';
            if (s === 'inactive') return 'warning';
            return 'neutral';
        }

        handleEdit(dealerName) {
            console.log(`handleEdit called for: ${dealerName}`);

            if (!window.UIRenderer) {
                console.error('UIRenderer missing.');
                alert('System Error: UI Renderer component missing. Please refresh.');
                return;
            }

            // 1. Create/Get Side Panel
            let panel = document.getElementById('dealer-side-panel');
            let overlay = document.getElementById('dealer-panel-overlay');

            if (!panel) {
                // Create Overlay
                overlay = document.createElement('div');
                overlay.id = 'dealer-panel-overlay';
                overlay.style.cssText = `
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0,0,0,0.5); z-index: 1999;
                    opacity: 0; transition: opacity 0.3s; pointer-events: none;
                `;
                overlay.onclick = () => this.cancelEdit();
                document.body.appendChild(overlay);

                // Create Panel
                panel = document.createElement('div');
                panel.id = 'dealer-side-panel';
                panel.style.cssText = `
                    position: fixed; top: 0; right: 0; bottom: 0; width: 400px;
                    background: var(--bg-secondary); box-shadow: -4px 0 15px rgba(0,0,0,0.5);
                    z-index: 2000; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                    display: flex; flex-direction: column; max-width: 90vw;
                    border-left: 1px solid var(--border-light);
                `;
                document.body.appendChild(panel);
            }

            // 2. Find Data
            const dealerData = this.dealers.find(d => d.customer_name === dealerName);
            if (!dealerData) {
                console.error('Dealer data not found for:', dealerName);
                alert('Error: Dealer data not found.');
                return;
            }

            // 3. Render Form
            try {
                // Use UIRenderer (static method)
                let html = window.UIRenderer.renderDealerEditForm(
                    dealerName,
                    dealerData.billing_zipcode,
                    dealerData.shipping_zipcode,
                    dealerData,
                    this.generalSettings
                );

                // Re-bind to DealerManager
                html = html.replace(/window\.viewController\./g, 'window.dealerManager.');

                // Wrap in scrollable container with styles for dropdowns
                const contentHtml = `
                    <style>
                        #dealer-side-panel select {
                            background-color: #0f172a !important; /* var(--bg-primary) fallback */
                            color: #f1f5f9 !important; /* var(--text-main) fallback */
                            border: 1px solid rgba(255,255,255,0.1) !important;
                        }
                        #dealer-side-panel select option {
                            background-color: #0f172a;
                            color: #f1f5f9;
                        }
                        /* Ensure inputs are also visible */
                        #dealer-side-panel input {
                             background-color: rgba(255,255,255,0.05);
                             color: #f1f5f9;
                             border: 1px solid rgba(255,255,255,0.1);
                        }
                    </style>
                    <div style="padding: 20px; overflow-y: auto; flex: 1;">
                        <h2 style="margin-top: 0; margin-bottom: 20px; font-size: 1.25rem; border-bottom: 1px solid var(--border-light); padding-bottom: 10px; color: var(--text-main);">Edit Dealer</h2>
                        ${html}
                    </div>
                `;

                panel.innerHTML = contentHtml;

                // 4. Show Panel
                requestAnimationFrame(() => {
                    panel.style.transform = 'translateX(0)';
                    overlay.style.pointerEvents = 'auto'; // Enable clicks
                    overlay.style.opacity = '1';
                });

            } catch (e) {
                console.error('Error rendering edit form:', e);
                alert('Error showing edit form: ' + e.message);
            }
        }

        async editDealerCategories(dealerId, dealerName, element) {
            // Check if settings loaded
            if (!this.generalSettings || !this.generalSettings.dealer_categories) {
                import('./utils/toast.js').then(module => {
                    module.Toast.warning('Categories configuration not loaded');
                });
                return;
            }

            const categories = this.generalSettings.dealer_categories;
            const dealer = this.dealers.find(d => (d._internalId || d.id || d.cust_id) === dealerId);
            if (!dealer) return;
            const currentCategories = dealer.categories || [];

            // Remove existing
            const existingPopover = document.getElementById('category-popover');
            if (existingPopover) existingPopover.remove();

            const popover = document.createElement('div');
            popover.id = 'category-popover';
            // Fancy styling matching CategorySelector
            popover.style.cssText = `
                position: absolute;
                background: #1e293b;
                border: 1px solid var(--border-light);
                border-radius: 12px;
                padding: 0;
                box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                z-index: 9999;
                min-width: 240px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                opacity: 0;
                transform: translateY(-10px);
                transition: opacity 0.2s ease, transform 0.2s ease;
            `;

            // Sort categories
            const sortedCategories = [...categories].sort();

            let listHtml = '';
            sortedCategories.forEach(cat => {
                const isChecked = currentCategories.includes(cat);
                listHtml += `
                    <div class="popover-item ${isChecked ? 'selected' : ''}" data-value="${cat}" onclick="this.classList.toggle('selected')">
                        <div class="popover-checkbox"></div>
                        <span>${cat}</span>
                    </div>
                `;
            });

            popover.innerHTML = `
                <style>
                    .popover-item {
                        display: flex;
                        align-items: center;
                        padding: 8px 16px;
                        cursor: pointer;
                        transition: background 0.15s;
                        color: var(--text-main);
                        font-size: 0.9rem;
                        gap: 12px;
                    }
                    .popover-item:hover {
                        background: rgba(255,255,255,0.05);
                    }
                    .popover-checkbox {
                        width: 16px;
                        height: 16px;
                        border: 2px solid var(--border-light);
                        border-radius: 4px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        transition: all 0.2s;
                        flex-shrink: 0;
                    }
                    .popover-item.selected .popover-checkbox {
                        background: var(--accent-color, #3b82f6);
                        border-color: var(--accent-color, #3b82f6);
                    }
                    .popover-item.selected .popover-checkbox::after {
                        content: '✓';
                        font-size: 10px;
                        color: white;
                        font-weight: bold;
                    }
                </style>
                <div style="padding: 12px 16px; font-weight: 700; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                    Edit Categories
                </div>
                <div class="popover-list" style="max-height: 250px; overflow-y: auto; padding: 6px 0;">
                    ${listHtml}
                </div>
                <div style="padding: 10px; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.05);">
                    <button id="save-cat-btn" style="width: 100%; background: var(--accent-color, #3b82f6); color: white; border: none; padding: 8px; border-radius: 6px; font-size: 0.85rem; font-weight: 500; cursor: pointer; transition: opacity 0.2s;">Apply Changes</button>
                </div>
            `;

            document.body.appendChild(popover);

            // Positioning Logic
            if (element) {
                const rect = element.getBoundingClientRect();
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

                // Align right edge of popover with right edge of cell usually
                // But element is the cell.
                // Let's align top-right of popover to bottom-right of cell content or similarly
                // Actually, let's center it slightly or align right to prevent overflow

                const popWidth = 240;
                let top = rect.bottom + scrollTop + 4;
                let left = rect.right + scrollLeft - popWidth; // Align right edges

                // Check bounds
                if (left < 10) left = 10;

                // If bottom overflow, flip up
                if (top + 300 > document.body.offsetHeight) {
                    top = rect.top + scrollTop - 310; // approximate height
                }

                popover.style.top = `${top}px`;
                popover.style.left = `${left}px`;
            } else {
                popover.style.top = '50%';
                popover.style.left = '50%';
                popover.style.transform = 'translate(-50%, -50%)';
            }

            // Animate In
            requestAnimationFrame(() => {
                popover.style.opacity = '1';
                if (!element) {
                    popover.style.transform = 'translate(-50%, -50%)'; // Keep center
                } else {
                    popover.style.transform = 'translateY(0)';
                }
            });

            // Event Listeners
            const closeHandler = (e) => {
                const isClickOutside = e.type === 'click' && !popover.contains(e.target) && e.target !== element && !element.contains(e.target);
                const isEsc = e.type === 'keydown' && e.key === 'Escape';

                if (isClickOutside || isEsc) {
                    popover.style.opacity = '0';
                    popover.style.transform = 'translateY(-10px)';
                    setTimeout(() => popover.remove(), 200);

                    document.removeEventListener('click', closeHandler);
                    document.removeEventListener('keydown', closeHandler);
                }
            };

            const saveHandler = async (e) => {
                e.stopPropagation();
                // Gather selected values
                const selectedItems = Array.from(popover.querySelectorAll('.popover-item.selected')).map(el => el.getAttribute('data-value'));

                const saveBtn = document.getElementById('save-cat-btn');
                if (saveBtn) {
                    saveBtn.textContent = 'Saving...';
                    saveBtn.style.opacity = '0.7';
                }

                await this.dealerService.saveDealerOverride(dealerName, { categories: selectedItems });
                dealer.categories = selectedItems;
                this.renderTable(); // Re-render table row

                // Close
                popover.style.opacity = '0';
                popover.style.transform = 'translateY(-10px)';
                setTimeout(() => popover.remove(), 200);

                document.removeEventListener('click', closeHandler);
                document.removeEventListener('keydown', closeHandler);
            };

            document.getElementById('save-cat-btn').addEventListener('click', saveHandler);

            // Delay adding click listener
            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', closeHandler);
            }, 100);
        }

        async saveDealerInfo(dealerName) {
            console.log('Saving dealer:', dealerName);
            const panel = document.getElementById('dealer-side-panel');
            if (!panel) {
                console.error('Side panel not found');
                return;
            }

            // Find inputs within the panel
            const inputs = panel.querySelectorAll('.edit-field-input');
            const overrides = {};

            inputs.forEach(input => {
                const key = input.getAttribute('data-field');
                let value = input.value.trim();
                if (input.tagName === 'SELECT') {
                    value = input.value;
                }

                if (key) {
                    overrides[key] = value;
                }
            });

            const saveBtn = panel.querySelector('button[onclick*="saveDealerInfo"]');
            if (saveBtn) {
                saveBtn.textContent = 'Saving...';
                saveBtn.disabled = true;
            }

            try {
                // Use the service
                await this.dealerService.saveDealerOverride(dealerName, overrides);
                console.log('Save successful');
                await this.refresh(); // Wait for refresh to complete
                this.cancelEdit(); // Close panel
            } catch (e) {
                console.error('Save failed:', e);
                alert('Failed to save changes: ' + e.message);
                if (saveBtn) {
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                }
            }
        }

        cancelEdit() {
            console.log('cancelEdit called - closing side panel');
            const panel = document.getElementById('dealer-side-panel');
            const overlay = document.getElementById('dealer-panel-overlay');

            if (panel) {
                panel.style.transform = 'translateX(100%)';
                console.log('Panel hidden');
            } else {
                console.warn('Panel element not found');
            }

            if (overlay) {
                overlay.style.opacity = '0';
                overlay.style.pointerEvents = 'none';
                console.log('Overlay hidden');
            } else {
                console.warn('Overlay element not found');
            }
        }

        toggleEditField(btn) {
            const container = btn.parentElement;
            const input = container.querySelector('.edit-field-input');
            if (input) {
                if (input.disabled) {
                    input.disabled = false;
                    input.focus();
                    btn.style.opacity = '1';
                    btn.style.color = 'var(--accent-color)';
                } else {
                    input.disabled = true;
                    btn.style.opacity = '0.5';
                    btn.style.color = 'var(--text-muted)';
                }
            }
        }

        // Called by global save function if we want to refresh table
        async refresh() {
            console.log('Refreshing dealer table...');

            // Reload dealer overrides from Firestore to get latest changes
            await window.dataManager.loadDealerOverridesFromFirebase();

            // Reload the current report to apply new overrides
            const selector = document.getElementById('dealer-report-selector');
            if (selector && selector.value) {
                // Use empty string for first arg to load all data (no state filtering) same as handleReportChange
                await window.dataManager.loadData('', [], selector.value);
            }

            // Refresh the table with updated data (force cache bypass to get fresh data with overrides)
            await this.loadData(true); // Pass true to force refresh and bypass cache
            this.applyFilters();
        }

        exportCSV() {
            if (!this.filteredDealers || this.filteredDealers.length === 0) {
                alert('No data to export');
                return;
            }

            const headers = ['Customer Name', 'Customer ID', 'Contact Name', 'Phone', 'District', 'State', 'Zip Code', 'KAM', 'Stage', 'Sales'];
            const keys = ['customer_name', 'customer_id', 'first_name', 'mobile_phone', 'district', 'billing_state', 'billing_zipcode', 'key_account_manager', 'dealer_stage', 'sales'];

            const csvRows = [headers.join(',')];

            this.filteredDealers.forEach(d => {
                const row = keys.map(k => {
                    let val = d[k] || '';
                    val = val.toString().replace(/"/g, '""'); // Escape quotes
                    if (val.search(/("|,|\n)/g) >= 0) val = `"${val}"`; // Quote if needed
                    return val;
                });
                csvRows.push(row.join(','));
            });

            const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
            const encodedUri = encodeURI(csvContent);

            // Download link
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", "dealers_export.csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        /**
         * Show inline edit dropdown for KAM or STAGE
         */
        showInlineEdit(dealerName, field, cell) {
            this.closeInlineEdit();

            const dealer = this.dealers.find(d => d.customer_name === dealerName);
            if (!dealer) return;

            const currentValue = dealer[field] || '';
            const options = field === 'key_account_manager'
                ? this.generalSettings.key_accounts || []
                : this.generalSettings.dealer_stages || [];

            const dropdown = document.createElement('div');
            dropdown.className = 'inline-edit-dropdown';
            dropdown.innerHTML = `
                <select class="inline-edit-select">
                    ${field !== 'dealer_stage' ? `<option value="" ${currentValue === '' ? 'selected' : ''}>Not Assigned</option>` : ''}
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

            // Setup events
            const select = dropdown.querySelector('select');
            const saveBtn = dropdown.querySelector('.save-btn');
            const cancelBtn = dropdown.querySelector('.cancel-btn');

            saveBtn.onclick = (e) => {
                e.stopPropagation();
                this.saveInlineEdit(dealerName, field, select.value, cell);
            };

            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeInlineEdit();
            };

            // Trap click inside
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            // Position relative to cell but attached to body to escape overflow
            const rect = cell.getBoundingClientRect();
            dropdown.style.position = 'absolute';
            dropdown.style.top = `${rect.top + window.scrollY - 4}px`; // Slight offset
            dropdown.style.left = `${rect.left + window.scrollX - 4}px`;
            dropdown.style.minWidth = `${rect.width + 8}px`; // Match cell width + padding
            dropdown.style.zIndex = '2000';

            // Mark cell as editing and store original
            cell.dataset.originalContent = cell.innerHTML;
            cell.classList.add('editing');

            document.body.appendChild(dropdown);

            // Focus select
            setTimeout(() => select.focus(), 0);

            // Close on click outside or Esc key
            setTimeout(() => {
                const closeHandler = (e) => {
                    const isClickOutside = e.type === 'click' && !e.target.closest('.inline-edit-dropdown') && !e.target.closest('.editing');
                    const isEsc = e.type === 'keydown' && e.key === 'Escape';

                    if (isClickOutside || isEsc) {
                        this.closeInlineEdit();
                        document.removeEventListener('click', closeHandler);
                        document.removeEventListener('keydown', closeHandler);
                    }
                };
                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', closeHandler);
            }, 100);
        }

        closeInlineEdit() {
            // Remove dropdown from body
            const dropdown = document.querySelector('.inline-edit-dropdown');
            if (dropdown) {
                dropdown.remove();
            }

            // Restore cells
            const editingCells = document.querySelectorAll('.editing');
            editingCells.forEach(cell => {
                if (cell.dataset.originalContent) {
                    cell.innerHTML = cell.dataset.originalContent;
                    delete cell.dataset.originalContent;
                }
                cell.classList.remove('editing');
            });
        }

        async saveInlineEdit(dealerName, field, newValue, cell) {
            // Close the dropdown immediately so it doesn't get stuck
            this.closeInlineEdit();

            // Show loading state in the cell (which was just restored by closeInlineEdit, but we overwrite it now)
            if (cell) {
                cell.innerHTML = '<span style="opacity:0.5; font-size: 12px;">Saving...</span>';
            }

            try {
                // Save to Firestore (empty string to clear the value)
                await window.dataManager.saveDealerOverride(dealerName, { [field]: newValue || '' });
                await this.refresh();
            } catch (error) {
                console.error('Failed to save:', error);
                alert('Failed to save: ' + error.message);
                // If failed, we might want to re-show or just leave it. 
                // Since table might not have refreshed, the cell still says "Saving...".
                // We should probably revert it or re-render.
                this.refresh();
            }
        }

        /**
         * Show inline edit for Contact (Name + Phone)
         */
        /**
         * Show inline edit for Contact Person Name only
         */
        showInlineContactNameEdit(dealerName, cell) {
            this.closeInlineEdit();

            const dealer = this.dealers.find(d => d.customer_name === dealerName);
            if (!dealer) return;

            const currentVal = dealer.first_name || '';

            const dropdown = document.createElement('div');
            dropdown.className = 'inline-edit-dropdown';
            // Simple row layout: Input + Actions
            dropdown.innerHTML = `
                <input type="text" class="inline-edit-input" placeholder="Name" value="${currentVal.replace(/"/g, '&quot;')}" style="margin-right: 8px; flex: 1;" />
                <div class="inline-edit-actions">
                    <button class="inline-edit-btn save-btn" title="Save">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                    </button>
                    <button class="inline-edit-btn cancel-btn" title="Cancel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            `;

            this.setupInlineEdit(dropdown, dealerName, cell, 'first_name');
        }

        /**
         * Show inline edit for Phone only
         */
        showInlinePhoneEdit(dealerName, cell) {
            this.closeInlineEdit();

            const dealer = this.dealers.find(d => d.customer_name === dealerName);
            if (!dealer) return;

            const currentVal = dealer.mobile_phone || '';

            const dropdown = document.createElement('div');
            dropdown.className = 'inline-edit-dropdown';
            // Simple row layout: Input + Actions
            dropdown.innerHTML = `
                <input type="text" class="inline-edit-input" placeholder="Phone" value="${currentVal.replace(/"/g, '&quot;')}" style="margin-right: 8px; flex: 1;" />
                <div class="inline-edit-actions">
                    <button class="inline-edit-btn save-btn" title="Save">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>
                    </button>
                    <button class="inline-edit-btn cancel-btn" title="Cancel">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    </button>
                </div>
            `;

            this.setupInlineEdit(dropdown, dealerName, cell, 'mobile_phone');
        }

        /**
         * Generic setup for single-input inline edits (Name/Phone)
         */
        setupInlineEdit(dropdown, dealerName, cell, fieldKey) {
            // styles matching previous implementation
            dropdown.style.padding = '8px';
            dropdown.style.alignItems = 'center';

            const input = dropdown.querySelector('input');
            const saveBtn = dropdown.querySelector('.save-btn');
            const cancelBtn = dropdown.querySelector('.cancel-btn');

            saveBtn.onclick = (e) => {
                e.stopPropagation();
                const newValue = input.value.trim();
                // Check if changed? (Optional optimization)
                this.saveContactInlineEdit(dealerName, { [fieldKey]: newValue }, cell);
            };

            cancelBtn.onclick = (e) => {
                e.stopPropagation();
                this.closeInlineEdit();
            };

            // Common closing logic
            const closeHandler = (e) => {
                const isClickOutside = e.type === 'click' && !e.target.closest('.inline-edit-dropdown') && !e.target.closest('.editing');
                const isEsc = e.type === 'keydown' && e.key === 'Escape';
                if (isClickOutside || isEsc) {
                    this.closeInlineEdit();
                    document.removeEventListener('click', closeHandler);
                    document.removeEventListener('keydown', closeHandler);
                }
            };

            dropdown.addEventListener('click', (e) => e.stopPropagation());

            setTimeout(() => {
                document.addEventListener('click', closeHandler);
                document.addEventListener('keydown', closeHandler);
            }, 100);

            const rect = cell.getBoundingClientRect();
            dropdown.style.position = 'absolute';
            dropdown.style.top = `${rect.top + window.scrollY - 8}px`;
            dropdown.style.left = `${rect.left + window.scrollX - 8}px`;
            dropdown.style.minWidth = `${rect.width + 16}px`;
            dropdown.style.zIndex = '2000';

            cell.dataset.originalContent = cell.innerHTML;
            cell.classList.add('editing');

            document.body.appendChild(dropdown);
            setTimeout(() => input.focus(), 0);
        }

        async saveContactInlineEdit(dealerName, overrides, cell) {
            this.closeInlineEdit();
            if (cell) cell.innerHTML = '<span style="opacity:0.5; font-size: 12px;">Saving...</span>';

            try {
                await window.dataManager.saveDealerOverride(dealerName, overrides);
                await this.refresh();
            } catch (error) {
                console.error('Failed to save contact:', error);
                alert('Failed to save: ' + error.message);
                this.refresh();
            }
        }
    };
}

// Global hook for the refresh hack
// Always create or re-init
if (window.DealerManager) {
    if (!window.dealerManager) {
        window.dealerManager = new window.DealerManager();
    } else {
        // Just init existing instance
        window.dealerManager.init();
    }
}

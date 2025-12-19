/**
 * DealerManager
 * Controller for the Dealer Management Page
 * Handles data fetching, filtering, and table rendering.
 */
/**
 * DealerManager
 * Controller for the Dealer Management Page
 * Handles data fetching, filtering, and table rendering.
 */

if (!window.DealerManager) {
    window.DealerManager = class DealerManager {
        constructor() {
            this.dealers = [];
            this.filteredDealers = [];
            this.generalSettings = {};

            // Filters
            this.searchQuery = '';
            this.stageFilter = 'all';
            this.kamFilter = 'all';
            this.districtFilter = 'all';
            this.stateFilter = 'all';

            // Pagination
            this.currentPage = 1;
            this.itemsPerPage = 100; // Increased default to 100 based on user preference, but paginated
            this.isPaginationEnabled = true;

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

                // Ensure settings are loaded
                if (!window.dataManager.generalSettings || !window.dataManager.generalSettings.key_accounts) {
                    await window.dataManager.loadGeneralSettings();
                }

                // Populate Report Selector
                await this.loadReportsList();

                this.renderFilters();
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

        async handleReportChange(url) {
            if (!url) return;
            this.showLoadingState();
            console.log('Switching to report:', url);

            try {
                // Load data without state filtering for dealer page (show all dealers)
                await window.dataManager.loadData('', [], url); // Empty state name = no filtering
                this.loadData(); // Process loaded data
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

        loadData() {
            // Force check again just in case (e.g. if we skipped wait due to race condition which shouldn't happen with await)
            if (!window.dataManager || !window.dataManager.rawData) {
                console.warn('DataManager not ready in loadData');
                return;
            }

            // Get raw data and merge with overrides (DataManager.loadData already applies overrides to objects in memory)
            // But we want to ensure we have the latest.
            // Actually, window.dataManager.rawData IS the source. 
            // Let's create our own lightweight objects for the table.

            const raw = window.dataManager.rawData;
            console.log(`DealerManager.loadData: Processing ${raw.length} dealers from DataManager`);

            this.dealers = raw.map(d => {
                // Ensure we have fields we need
                // Override handling is ALREADY DONE in DataManager.loadData() -> it modifies the objects in place or returns processed ones.
                // window.dataManager.rawData holds the objects that MIGHT have been mutated by DataManager.loadData logic if implemented that way.
                // Let's verify DataManager logic. 
                // Yes, viewed code confirms: "APPLY DEALER OVERRIDES TO RAW DATA... for (const row of rawData) ... if (val !== undefined) row[key] = val;"
                // So rawData IS the source of truth with overrides.

                // INJECT DISTRICT if not already present
                if (!d.district && window.dataManager.zipCache) {
                    let zip = d.billing_zipcode || d.shipping_zipcode;
                    if (zip) {
                        zip = zip.replace(/\s/g, '');
                        d.district = window.dataManager.zipCache[zip] || 'Unknown';
                    }
                }

                return {
                    ...d, // Includes overrides applied by DataManager and district
                    searchString: `${d.customer_name} ${d.first_name || ''} ${d.mobile_phone || ''} ${d.billing_zipcode || ''}`.toLowerCase()
                };
            });

            this.generalSettings = window.dataManager.generalSettings || {};

            // Initialize filteredDealers to all dealers
            this.filteredDealers = [...this.dealers];

            // Update dynamic filters after data is loaded
            this.updateDistrictFilter();
            this.updateStateFilter();

            console.log(`DealerManager.loadData: Processed ${this.dealers.length} dealers, ${this.filteredDealers.length} filtered`);
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
                searchInput.addEventListener('input', (e) => {
                    this.searchQuery = e.target.value.toLowerCase();
                    this.applyFilters();
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
                    this.applyFilters();
                }
            });

            // Listen for data refresh events (e.g. after save)
            // Check if we can hook into window.viewController.saveDealerInfo which calls reload
            // Ideally we poll or simply re-render when we know data changed.

            // Setup column resizing
            this.setupColumnResize();
        }

        setupColumnResize() {
            const table = document.querySelector('.dealer-table');
            if (!table) return;

            // Ensure fixed layout for consistent resizing
            table.style.tableLayout = 'fixed';

            const headers = table.querySelectorAll('th');
            const colGroup = table.querySelector('colgroup');
            const cols = colGroup ? colGroup.querySelectorAll('col') : [];

            let isResizing = false;
            let currentHeader = null;
            let currentCol = null;
            let startX = 0;
            let startWidth = 0;

            // Load saved column widths from localStorage
            const savedWidths = this.loadColumnWidths();
            if (savedWidths && cols.length > 0) {
                cols.forEach((col, index) => {
                    if (savedWidths[index]) {
                        col.style.width = savedWidths[index] + 'px';
                    }
                });
            } else if (savedWidths) {
                headers.forEach((header, index) => {
                    if (savedWidths[index]) {
                        header.style.width = savedWidths[index] + 'px';
                    }
                });
            }

            headers.forEach((header, index) => {
                header.addEventListener('mousedown', (e) => {
                    // Only start resize if clicking on the right edge (resize handle)
                    const rect = header.getBoundingClientRect();
                    const isRightEdge = e.clientX > rect.right - 10; // Increased hit area

                    if (isRightEdge) {
                        isResizing = true;
                        currentHeader = header;
                        currentCol = cols[index];
                        startX = e.clientX;
                        // Use current col width (computed) or header width
                        startWidth = currentCol ? (parseFloat(getComputedStyle(currentCol).width) || header.offsetWidth) : header.offsetWidth;

                        header.classList.add('resizing');
                        e.preventDefault();
                    }
                });
            });

            document.addEventListener('mousemove', (e) => {
                if (!isResizing) return;

                const diff = e.clientX - startX;
                const newWidth = Math.max(50, startWidth + diff); // Minimum 50px

                if (currentCol) {
                    currentCol.style.width = newWidth + 'px';
                } else if (currentHeader) {
                    currentHeader.style.width = newWidth + 'px';
                }
            });

            document.addEventListener('mouseup', () => {
                if (isResizing) {
                    if (currentHeader) currentHeader.classList.remove('resizing');

                    // Save column widths to localStorage
                    this.saveColumnWidths();

                    isResizing = false;
                    currentHeader = null;
                    currentCol = null;
                }
            });
        }

        loadColumnWidths() {
            try {
                const saved = localStorage.getItem('dealerTableColumnWidths');
                if (!saved) return null;

                const widths = JSON.parse(saved);
                // Validation: Check if values are reasonable pixels (e.g., > 20px)
                // If any value is too small (likely percentage treated as px), discard all
                const isValid = Object.values(widths).every(w => {
                    const val = parseFloat(w);
                    return !isNaN(val) && val > 30; // 30px minimum sanity check
                });

                if (!isValid) {
                    console.warn('Invalid column widths detected (too small), resetting to defaults.');
                    this.resetColumnWidths(); // Clear bad data
                    return null;
                }

                return widths;
            } catch (e) {
                console.error('Failed to load column widths:', e);
                return null;
            }
        }

        resetColumnWidths() {
            localStorage.removeItem('dealerTableColumnWidths');
            const table = document.querySelector('.dealer-table');
            if (table) {
                // Clear inline styles to revert to CSS defaults
                const cols = table.querySelectorAll('col');
                cols.forEach(col => col.style.width = '');
                const headers = table.querySelectorAll('th');
                headers.forEach(th => th.style.width = '');
            }
            console.log('Column widths reset.');
        }

        saveColumnWidths() {
            try {
                const table = document.querySelector('.dealer-table');
                if (!table) return;

                const colGroup = table.querySelector('colgroup');
                const cols = colGroup ? colGroup.querySelectorAll('col') : [];
                const widths = {};

                // Always use offsetWidth (pixels) instead of style.width (can be %)
                if (cols.length > 0) {
                    cols.forEach((col, index) => {
                        // For col elements, offsetWidth might be 0 if display:table-column
                        // So we look at the corresponding header if possible, or fallback to parsing style if it is px
                        // Actually, the most reliable source for CURRENT rendered width is the th offsetWidth
                        const header = table.querySelectorAll('th')[index];
                        if (header) {
                            widths[index] = header.offsetWidth;
                        }
                    });
                } else {
                    const headers = table.querySelectorAll('th');
                    headers.forEach((header, index) => {
                        widths[index] = header.offsetWidth;
                    });
                }

                localStorage.setItem('dealerTableColumnWidths', JSON.stringify(widths));
            } catch (e) {
                console.error('Failed to save column widths:', e);
            }
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
            // Stage
            if (this.generalSettings.dealer_stages) {
                const stageSelect = document.getElementById('filter-stage');
                if (stageSelect) {
                    let html = '<option value="all">All Stages</option>';
                    this.generalSettings.dealer_stages.forEach(stage => {
                        html += `<option value="${stage}">${stage}</option>`;
                    });
                    stageSelect.innerHTML = html;
                }
            }

            // Populate District Filter (extract from actual data)
            // District Filter (Dynamic)
            this.updateDistrictFilter();

            // Populate State Filter (extract from actual data)
            this.updateStateFilter();
        }

        updateDistrictFilter() {
            const districtSelect = document.getElementById('filter-district');
            if (districtSelect && this.dealers.length > 0) {
                const districts = [...new Set(this.dealers.map(d => d.district).filter(Boolean).filter(d => d !== 'Unknown'))].sort();
                // Preserve selection
                const val = districtSelect.value;

                let html = '<option value="all">All Districts</option>';
                districts.forEach(d => {
                    html += `<option value="${d}">${d}</option>`;
                });
                districtSelect.innerHTML = html;
                districtSelect.value = val;
            }
        }

        updateStateFilter() {
            const stateSelect = document.getElementById('filter-state');
            if (stateSelect && this.dealers.length > 0) {
                const states = [...new Set(this.dealers.map(d => d.billing_state || d.shipping_state).filter(Boolean))].sort();
                const val = stateSelect.value;

                let html = '<option value="all">All States</option>';
                states.forEach(s => {
                    html += `<option value="${s}">${s}</option>`;
                });
                stateSelect.innerHTML = html;
                stateSelect.value = val;
            }
        }

        applyFilters() {
            this.filteredDealers = this.dealers.filter(d => {
                // Search
                if (this.searchQuery && !d.searchString.includes(this.searchQuery)) return false;

                // Stage
                if (this.stageFilter !== 'all' && d.dealer_stage !== this.stageFilter) return false;

                // KAM
                if (this.kamFilter !== 'all' && d.key_account_manager !== this.kamFilter) return false;

                // District
                if (this.districtFilter !== 'all' && d.district !== this.districtFilter) return false;

                // State
                const dealerState = d.billing_state || d.shipping_state || '';
                if (this.stateFilter !== 'all' && dealerState !== this.stateFilter) return false;

                return true;
            });

            // Reset pagination
            this.currentPage = 1;

            // We might want to re-populate district filter based on visible data? Usually filtered list is better.
            // But preventing circular dependency.

            this.renderTable();
            this.updateStats();
        }

        updateStats() {
            const count = this.filteredDealers.length;
            const total = this.dealers.length;
            const el = document.getElementById('dealer-count-display');
            if (el) el.textContent = `Showing ${count} of ${total}`;
        }

        renderTable() {
            const tableBody = document.getElementById('dealer-table-body');
            if (!tableBody) return;

            if (this.filteredDealers.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No dealers found matching criteria.</td></tr>';
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

            let html = '';
            displayData.forEach((d, index) => {
                const kam = d.key_account_manager;
                const kamHtml = kam ? `<span class="kam-badge">${kam}</span>` : `<span class="kam-empty">-</span>`;

                const stage = d.dealer_stage || 'New';
                const stageClass = this.getStageColorClass(stage);

                const phone = d.mobile_phone || '-';
                const district = d.district || '-';
                const state = d.billing_state || d.shipping_state || '-';

                const rowNumber = startIndex + index + 1; // Correct row number based on pagination

                html += `
                <tr class="dealer-row" onclick="window.dealerManager.handleEdit('${d.customer_name.replace(/'/g, "\\'")}')">
                    <td style="text-align: center; color: var(--text-muted); font-size: 0.85rem;">${rowNumber}</td>
                    <td>
                        <div class="row-title" title="${d.customer_name}">${d.customer_name}</div>
                        <div class="row-subtitle">${d.customer_id || ''}</div>
                    </td>
                    <td>
                        <div class="row-text">${d.first_name || '-'}</div>
                        <div class="row-subtext">${phone}</div>
                    </td>
                    <td>${district}</td>
                    <td>${state}</td>
                    <td class="kam-cell" onclick="event.stopPropagation(); window.dealerManager.showInlineEdit('${d.customer_name.replace(/'/g, "\\'")}', 'key_account_manager', this)">
                        ${kamHtml}
                    </td>
                    <td class="stage-cell" onclick="event.stopPropagation(); window.dealerManager.showInlineEdit('${d.customer_name.replace(/'/g, "\\'")}', 'dealer_stage', this)">
                        <span class="status-pill status-${stageClass}">${stage}</span>
                    </td>
                    <td style="text-align: right;">
                        <button class="action-btn edit-btn" title="Edit" onclick="console.log('Edit button clicked'); event.stopPropagation(); window.dealerManager.handleEdit('${d.customer_name.replace(/'/g, "\\'")}')">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                    </td>
                </tr>
            `;
            });

            tableBody.innerHTML = html;

            // Render pagination controls
            this.renderPagination();
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
                <div class="pagination-controls">
                    ${controlsHtml}
                    <div style="width: 1px; height: 20px; background: var(--border-light); margin: 0 10px;"></div>
                    <button class="page-btn" onclick="window.dealerManager.togglePagination()">
                        ${toggleBtnText}
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
                await window.dataManager.saveDealerOverride(dealerName, overrides);
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

            // Refresh the table with updated data
            this.loadData(); // Reloads from window.dataManager.rawData which now has updated overrides
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
                    <option value="" ${currentValue === '' ? 'selected' : ''}>Not Assigned</option>
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
            dropdown.style.top = `${rect.top + window.scrollY - 4}px`; // Slight offset to cover padding
            dropdown.style.left = `${rect.left + window.scrollX - 4}px`;
            dropdown.style.minWidth = `${rect.width + 8}px`; // Match cell width + padding
            dropdown.style.zIndex = '2000';

            // Mark cell as editing and store original
            cell.dataset.originalContent = cell.innerHTML;
            cell.classList.add('editing');

            document.body.appendChild(dropdown);

            // Focus select
            setTimeout(() => select.focus(), 0);

            // Close on click outside
            setTimeout(() => {
                const handleClickOutside = (e) => {
                    if (!e.target.closest('.inline-edit-dropdown') && !e.target.closest('.editing')) {
                        this.closeInlineEdit();
                        document.removeEventListener('click', handleClickOutside);
                    }
                };
                document.addEventListener('click', handleClickOutside);
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

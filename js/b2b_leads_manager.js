/**
 * B2BLeadsManager
 * Controller for the B2B Leads Page
 */
import { B2BLeadsService } from './services/b2b_leads_service.js';
import { AudienceService } from './services/audience_service.js';
import FormatUtils from './utils/format-utils.js';
import { Toast } from './utils/toast.js';

if (!window.B2BLeadsManager) {
    window.B2BLeadsManager = class B2BLeadsManager {
        constructor() {
            this.leads = [];
            this.filteredLeads = []; // Total results after filter
            this.service = new B2BLeadsService();
            this.audienceService = new AudienceService();

            // Filters
            this.searchQuery = '';
            this.stateFilter = 'all';
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

            this.init();
        }

        async init() {
            console.log('B2BLeadsManager initializing...');
            this.setupEventListeners();
            await this.loadData();
        }

        async loadData() {
            this.showLoadingState();
            try {
                this.leads = await this.service.getAllLeads();
                // Normalize data if needed
                this.leads = this.leads.map(lead => ({
                    ...lead,
                    searchString: `${lead.name || ''} ${lead.phone || ''} ${lead.business_name || ''} ${lead.state || ''} ${lead.district || ''}`.toLowerCase()
                }));

                this.applyFilters();
                this.renderFilters();
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
            // Search
            const searchInput = document.getElementById('lead-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchQuery = e.target.value.toLowerCase();
                    this.currentPage = 1; // Reset page on search
                    this.applyFilters();
                });
            }

            // Select All
            const selectAll = document.getElementById('select-all-leads');
            if (selectAll) {
                selectAll.addEventListener('change', (e) => {
                    this.toggleSelectAll(e.target.checked);
                });
            }

            // Filters
            document.addEventListener('change', (e) => {
                if (['filter-state', 'filter-district', 'filter-status', 'filter-kam'].includes(e.target.id)) {
                    if (e.target.id === 'filter-state') {
                        this.stateFilter = e.target.value;
                        this.updateDistrictFilter();
                    } else if (e.target.id === 'filter-district') {
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

            // Close modals on overlay click (delegate)
            document.querySelectorAll('.modal-overlay').forEach(overlay => {
                overlay.addEventListener('click', (e) => {
                    if (e.target === overlay) {
                        this.closeModal();
                        this.closeAudienceModal();
                    }
                });
            });
        }

        renderFilters() {
            // Populate State Filter
            const states = [...new Set(this.leads.map(l => l.state).filter(Boolean))].sort();
            const stateSelect = document.getElementById('filter-state');
            if (stateSelect) {
                let html = '<option value="all">All States</option>';
                states.forEach(s => html += `<option value="${s}">${s}</option>`);
                stateSelect.innerHTML = html;
                stateSelect.value = this.stateFilter;
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
        }

        updateDistrictFilter() {
            const districtSelect = document.getElementById('filter-district');
            if (!districtSelect) return;

            const wrapper = districtSelect.closest('.filter-wrapper');
            if (this.stateFilter === 'all') {
                if (wrapper) wrapper.style.display = 'none';
                this.districtFilter = 'all';
                return;
            }
            if (wrapper) wrapper.style.display = 'flex';

            const relevantLeads = this.leads.filter(l => l.state === this.stateFilter);
            const districts = [...new Set(relevantLeads.map(l => l.district).filter(Boolean))].sort();

            let html = '<option value="all">All Districts</option>';
            districts.forEach(d => html += `<option value="${d}">${d}</option>`);
            districtSelect.innerHTML = html;
            districtSelect.value = this.districtFilter;
        }

        applyFilters() {
            this.filteredLeads = this.leads.filter(lead => {
                const matchesSearch = !this.searchQuery || lead.searchString.includes(this.searchQuery);
                const matchesState = this.stateFilter === 'all' || (lead.state && lead.state.toLowerCase() === this.stateFilter.toLowerCase());
                const matchesDistrict = this.districtFilter === 'all' || (lead.district && lead.district.toLowerCase() === this.districtFilter.toLowerCase());
                const matchesStatus = this.statusFilter === 'all' || lead.status === this.statusFilter;
                const matchesKam = this.kamFilter === 'all' || lead.kam === this.kamFilter;

                return matchesSearch && matchesState && matchesDistrict && matchesStatus && matchesKam;
            });

            this.sortLeads();
            this.renderTable();
            this.renderPagination();
            this.updateStats();
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

        updateStats() {
            const countEl = document.getElementById('lead-count-display');
            if (countEl) countEl.textContent = `${this.filteredLeads.length} leads`;
        }

        // --- Pagination ---

        renderPagination() {
            const totalItems = this.filteredLeads.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);

            // Adjust current page if out of bounds
            if (this.currentPage > totalPages) this.currentPage = Math.max(1, totalPages);

            const startIdx = (this.currentPage - 1) * this.itemsPerPage;
            const endIdx = Math.min(startIdx + this.itemsPerPage, totalItems);

            document.getElementById('pag-start').textContent = totalItems > 0 ? startIdx + 1 : 0;
            document.getElementById('pag-end').textContent = endIdx;
            document.getElementById('pag-total').textContent = totalItems;

            const btnPrev = document.getElementById('btn-prev');
            const btnNext = document.getElementById('btn-next');
            if (btnPrev) btnPrev.disabled = this.currentPage <= 1;
            if (btnNext) btnNext.disabled = this.currentPage >= totalPages;

            // Page numbers
            const numbersContainer = document.getElementById('pagination-numbers');
            if (numbersContainer) {
                let html = '';
                // Simple logic: show first, last, and around current
                // For simplified UX, just show current if many pages, or all if few
                if (totalPages <= 7) {
                    for (let i = 1; i <= totalPages; i++) {
                        html += `<div class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="window.b2bLeadsManager.goToPage(${i})">${i}</div>`;
                    }
                } else {
                    html += `<div class="page-btn ${1 === this.currentPage ? 'active' : ''}" onclick="window.b2bLeadsManager.goToPage(1)">1</div>`;
                    if (this.currentPage > 3) html += `<span style="display:flex;align-items:center;padding:0 4px;color:var(--text-muted)">...</span>`;

                    // Middle
                    let start = Math.max(2, this.currentPage - 1);
                    let end = Math.min(totalPages - 1, this.currentPage + 1);

                    for (let i = start; i <= end; i++) {
                        html += `<div class="page-btn ${i === this.currentPage ? 'active' : ''}" onclick="window.b2bLeadsManager.goToPage(${i})">${i}</div>`;
                    }

                    if (this.currentPage < totalPages - 2) html += `<span style="display:flex;align-items:center;padding:0 4px;color:var(--text-muted)">...</span>`;
                    html += `<div class="page-btn ${totalPages === this.currentPage ? 'active' : ''}" onclick="window.b2bLeadsManager.goToPage(${totalPages})">${totalPages}</div>`;
                }
                numbersContainer.innerHTML = html;
            }
        }

        prevPage() {
            if (this.currentPage > 1) {
                this.currentPage--;
                this.renderTable();
                this.renderPagination();
            }
        }

        nextPage() {
            const totalItems = this.filteredLeads.length;
            const totalPages = Math.ceil(totalItems / this.itemsPerPage);
            if (this.currentPage < totalPages) {
                this.currentPage++;
                this.renderTable();
                this.renderPagination();
            }
        }

        goToPage(page) {
            this.currentPage = page;
            this.renderTable();
            this.renderPagination();
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
                return;
            }

            // Slice for pagination
            const startIdx = (this.currentPage - 1) * this.itemsPerPage;
            const pageData = this.filteredLeads.slice(startIdx, startIdx + this.itemsPerPage);

            tbody.innerHTML = pageData.map((lead, index) => `
                <tr class="lead-row">
                    <td style="text-align:center">
                        <input type="checkbox" 
                            ${this.selectedLeads.has(lead.id) ? 'checked' : ''} 
                            onchange="window.b2bLeadsManager.toggleSelection('${lead.id}', this.checked)">
                    </td>
                    <td style="text-align:center; color:var(--text-muted); font-size: 0.8rem;">${startIdx + index + 1}</td>
                    <td style="font-weight:500;">${lead.name || '-'}</td>
                    <td>${lead.business_name || '-'}</td>
                    <td style="font-family:monospace; opacity:0.9;">${lead.phone || '-'}</td>
                    <td>${lead.state || '-'}</td>
                    <td>${lead.district || '-'}</td>
                    <td><span class="status-badge ${lead.status || 'new'}">${lead.status || 'New'}</span></td>
                    <td>${lead.kam || '-'}</td>
                    <td style="text-align:center;">
                        <button class="icon-btn" onclick="window.b2bLeadsManager.openEditModal('${lead.id}')" title="Edit">
                           ✏️
                        </button>
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

            const modal = document.getElementById('lead-edit-modal');
            const content = document.getElementById('lead-edit-modal-content');

            if (!modal || !content) return;

            content.innerHTML = `
                <div style="padding: 32px 24px 24px;">
                    <h3 style="margin-bottom: 24px; color: var(--text-main); font-size:1.5rem; margin-top:0;">${isEdit ? 'Edit Lead' : 'Add New Lead'}</h3>
                    <form id="lead-form" onsubmit="event.preventDefault(); window.b2bLeadsManager.saveLead('${leadId || ''}')">
                        <div class="form-grid">
                            <div class="form-group">
                                <label>Phone *</label>
                                <input type="text" id="lead-phone" class="modern-input" value="${lead.phone || ''}" required placeholder="91XXXXXXXXXX">
                            </div>
                             <div class="form-group">
                                <label>Name</label>
                                <input type="text" id="lead-name" class="modern-input" value="${lead.name || ''}" placeholder="John Doe">
                            </div>
                             <div class="form-group">
                                <label>Business Name</label>
                                <input type="text" id="lead-business" class="modern-input" value="${lead.business_name || ''}" placeholder="Business Corp">
                            </div>
                             <div class="form-group">
                                <label>State</label>
                                <input type="text" id="lead-state" class="modern-input" value="${lead.state || ''}" placeholder="Kerala">
                            </div>
                             <div class="form-group">
                                <label>District</label>
                                <input type="text" id="lead-district" class="modern-input" value="${lead.district || ''}" placeholder="Ernakulam">
                            </div>
                             <div class="form-group">
                                <label>Pincode</label>
                                <input type="text" id="lead-pincode" class="modern-input" value="${lead.pincode || ''}" placeholder="682001">
                            </div>
                             <div class="form-group">
                                <label>Status</label>
                                <select id="lead-status" class="modern-input">
                                    <option value="New" ${lead.status === 'New' ? 'selected' : ''}>New</option>
                                    <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
                                    <option value="Converted" ${lead.status === 'Converted' ? 'selected' : ''}>Converted</option>
                                     <option value="Lost" ${lead.status === 'Lost' ? 'selected' : ''}>Lost</option>
                                </select>
                            </div>
                             <div class="form-group">
                                <label>KAM</label>
                                <input type="text" id="lead-kam" class="modern-input" value="${lead.kam || ''}" placeholder="Assign to...">
                            </div>
                        </div>
                        <div style="margin-top: 32px; display: flex; justify-content: flex-end; gap: 12px;">
                            <button type="button" class="btn-secondary" onclick="window.b2bLeadsManager.closeModal()">Cancel</button>
                            <button type="submit" class="btn-primary" id="btn-save-lead">Save Lead</button>
                        </div>
                    </form>
                </div>
            `;

            this.isModalOpen = true;
            modal.classList.add('active');
        }

        closeModal() {
            this.isModalOpen = false;
            const modal = document.getElementById('lead-edit-modal');
            if (modal) modal.classList.remove('active');
        }

        async saveLead(leadId) {
            const btn = document.getElementById('btn-save-lead');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Saving...';
            }

            const data = {
                phone: document.getElementById('lead-phone').value,
                name: document.getElementById('lead-name').value,
                business_name: document.getElementById('lead-business').value,
                state: document.getElementById('lead-state').value,
                district: document.getElementById('lead-district').value,
                pincode: document.getElementById('lead-pincode').value,
                status: document.getElementById('lead-status').value,
                kam: document.getElementById('lead-kam').value
            };

            try {
                if (leadId) {
                    await this.service.updateLead(leadId, data);
                    // Update local state
                    const index = this.leads.findIndex(l => l.id === leadId);
                    if (index !== -1) this.leads[index] = { ...this.leads[index], ...data };
                    if (Toast) Toast.success('Lead updated successfully');
                } else {
                    const newLead = await this.service.addLead(data);
                    this.leads.push(newLead);
                    if (Toast) Toast.success('Lead added successfully');
                }

                // Refresh
                this.leads = this.leads.map(lead => ({
                    ...lead,
                    searchString: `${lead.name || ''} ${lead.phone || ''} ${lead.business_name || ''} ${lead.state || ''} ${lead.district || ''}`.toLowerCase()
                }));

                this.closeModal();
                this.applyFilters();
            } catch (error) {
                if (Toast) Toast.error('Error saving lead: ' + error.message);
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = 'Save Lead';
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

        // --- AUDIENCE ACTIONS ---

        openAudienceModal() {
            this.audienceModal = document.getElementById('save-audience-modal');
            this.audienceNameInput = document.getElementById('audience-name-input');
            this.audienceCountPreview = document.getElementById('audience-count-preview');

            if (!this.audienceModal) return;

            // Reset inputs
            this.audienceNameInput.value = '';

            const radio = document.querySelector('input[name="audienceType"][value="static"]');
            if (radio) radio.checked = true;

            // Update preview
            this.updateAudiencePreview();

            this.audienceModal.classList.add('active');

            if (this.audienceNameInput) setTimeout(() => this.audienceNameInput.focus(), 100);
        }

        closeAudienceModal() {
            if (this.audienceModal) {
                this.audienceModal.classList.remove('active');
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
                const headers = rows[0].split(',').map(h => h.trim().toLowerCase());

                const leads = [];
                for (let i = 1; i < rows.length; i++) {
                    const values = rows[i].split(',').map(v => v.trim());
                    if (values.length < 1) continue;

                    const lead = {};
                    headers.forEach((h, index) => {
                        lead[h] = values[index];
                    });

                    if (lead.phone) leads.push(lead);
                }

                if (confirm(`Ready to import ${leads.length} leads?`)) {
                    try {
                        this.showLoadingState();
                        await this.service.importLeads(leads);
                        await this.loadData(); // Reload all
                        if (Toast) Toast.success(`Imported ${leads.length} leads successfully`);
                    } catch (err) {
                        if (Toast) Toast.error('Import failed: ' + err.message);
                        this.renderTable(); // Restore view
                    }
                }
            };
            reader.readAsText(file);
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

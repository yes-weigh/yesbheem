/**
 * B2BLeadsManager
 * Controller for the B2B Leads Page
 */
import { B2BLeadsService } from './services/b2b_leads_service.js';
import { TABLE_UI } from './config/constants.js';

if (!window.B2BLeadsManager) {
    window.B2BLeadsManager = class B2BLeadsManager {
        constructor() {
            this.leads = [];
            this.filteredLeads = [];
            this.service = new B2BLeadsService();

            // Filters
            this.searchQuery = '';
            this.stateFilter = 'all';
            this.districtFilter = 'all';
            this.statusFilter = 'all';
            this.kamFilter = 'all';

            // Sorting
            this.sortColumn = 'updatedAt';
            this.sortDirection = 'desc';

            // Selection
            this.selectedLeads = new Set();

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
            }
        }

        showLoadingState() {
            const tableBody = document.getElementById('leads-table-body');
            if (tableBody) {
                tableBody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Loading leads...</td></tr>';
            }
        }

        showErrorState(msg) {
            const tableBody = document.getElementById('leads-table-body');
            if (tableBody) {
                tableBody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--text-muted);">Error: ${msg}</td></tr>`;
            }
        }

        setupEventListeners() {
            // Search
            const searchInput = document.getElementById('lead-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    this.searchQuery = e.target.value.toLowerCase();
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
                if (e.target.id === 'filter-state') {
                    this.stateFilter = e.target.value;
                    this.updateDistrictFilter();
                    this.applyFilters();
                }
                if (e.target.id === 'filter-district') {
                    this.districtFilter = e.target.value;
                    this.applyFilters();
                }
                if (e.target.id === 'filter-status') {
                    this.statusFilter = e.target.value;
                    this.applyFilters();
                }
                if (e.target.id === 'filter-kam') {
                    this.kamFilter = e.target.value;
                    this.applyFilters();
                }
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
            districtSelect.value = this.districtFilter; // Reset effectively if not found, logic handled in applyFilters
        }

        applyFilters() {
            this.filteredLeads = this.leads.filter(lead => {
                const matchesSearch = !this.searchQuery || lead.searchString.includes(this.searchQuery);
                const matchesState = this.stateFilter === 'all' || lead.state === this.stateFilter;
                const matchesDistrict = this.districtFilter === 'all' || lead.district === this.districtFilter;
                const matchesStatus = this.statusFilter === 'all' || lead.status === this.statusFilter;
                const matchesKam = this.kamFilter === 'all' || lead.kam === this.kamFilter;

                return matchesSearch && matchesState && matchesDistrict && matchesStatus && matchesKam;
            });

            this.sortLeads();
            this.renderTable();
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
            if (countEl) countEl.textContent = `Showing ${this.filteredLeads.length} of ${this.leads.length}`;
        }

        renderTable() {
            const tbody = document.getElementById('leads-table-body');
            if (!tbody) return;

            if (this.filteredLeads.length === 0) {
                tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">No leads found.</td></tr>';
                return;
            }

            tbody.innerHTML = this.filteredLeads.map((lead, index) => `
                <tr class="lead-row">
                    <td style="text-align:center">
                        <input type="checkbox" 
                            ${this.selectedLeads.has(lead.id) ? 'checked' : ''} 
                            onchange="window.b2bLeadsManager.toggleSelection('${lead.id}', this.checked)">
                    </td>
                    <td style="text-align:center">${index + 1}</td>
                    <td>${lead.name || '-'}</td>
                    <td>${lead.business_name || '-'}</td>
                    <td>${lead.phone || '-'}</td>
                    <td>${lead.state || '-'}</td>
                    <td>${lead.district || '-'}</td>
                    <td><span class="status-badge ${lead.status || 'new'}">${lead.status || 'New'}</span></td>
                    <td>${lead.kam || '-'}</td>
                    <td>
                        <button class="icon-btn" onclick="window.b2bLeadsManager.openEditModal('${lead.id}')" title="Edit">
                           ✏️
                        </button>
                    </td>
                </tr>
            `).join('');
        }

        toggleSelection(id, checked) {
            if (checked) {
                this.selectedLeads.add(id);
            } else {
                this.selectedLeads.delete(id);
            }
            this.updateBulkActions();
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
                bar.style.display = count > 0 ? 'flex' : 'none';
            }
        }

        clearSelection() {
            this.selectedLeads.clear();
            const selectAll = document.getElementById('select-all-leads');
            if (selectAll) selectAll.checked = false;
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

            content.innerHTML = `
                <div style="padding: 20px;">
                    <h3 style="margin-bottom: 20px; color: var(--text-main);">${isEdit ? 'Edit Lead' : 'Add New Lead'}</h3>
                    <form id="lead-form" onsubmit="event.preventDefault(); window.b2bLeadsManager.saveLead('${leadId || ''}')">
                        <div class="form-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
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
                        <div style="margin-top: 24px; display: flex; justify-content: flex-end; gap: 12px;">
                            <button type="button" class="btn-secondary" onclick="document.getElementById('lead-edit-modal').style.display='none'">Cancel</button>
                            <button type="submit" class="btn-primary">Save Lead</button>
                        </div>
                    </form>
                </div>
            `;

            modal.style.display = 'flex';
        }

        async saveLead(leadId) {
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
                } else {
                    const newLead = await this.service.addLead(data);
                    this.leads.push(newLead);
                }

                // Refresh
                this.leads = this.leads.map(lead => ({
                    ...lead,
                    searchString: `${lead.name || ''} ${lead.phone || ''} ${lead.business_name || ''} ${lead.state || ''} ${lead.district || ''}`.toLowerCase()
                }));

                document.getElementById('lead-edit-modal').style.display = 'none';
                this.applyFilters();

                // Show success toast (mock)
                console.log('Saved successfully');
            } catch (error) {
                alert('Error saving lead: ' + error.message);
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
                    } catch (err) {
                        alert('Import failed: ' + err.message);
                        this.renderTable(); // Restore view
                    }
                }
            };
            reader.readAsText(file);
        }

        exportCSV() {
            const headers = ['id', 'phone', 'name', 'business_name', 'state', 'district', 'pincode', 'status', 'kam'];
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
    window.b2bLeadsManager = new window.B2BLeadsManager();
}

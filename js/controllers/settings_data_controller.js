/**
 * SettingsDataController
 * Manages CSV report uploads, report management, and KPI data input from Settings page
 */
export class SettingsDataController {
    constructor() {
        this.dataManager = null;
        this.reports = [];

        // DOM Elements
        this.uploadZone = null;
        this.fileInput = null;
        this.reportsList = null;
        this.statusDiv = null;

        this.init();
    }

    async init() {
        console.log('SettingsDataController initializing...');

        // Wait for DataManager
        await this.waitForDataManager();

        // Get or create DataManager instance
        if (window.dataManager) {
            this.dataManager = window.dataManager;
        } else {
            this.dataManager = new DataManager();
            window.dataManager = this.dataManager;
        }

        // Setup DOM references
        this.setupDOMReferences();

        // Setup event listeners
        this.setupEventListeners();

        // Initial render
        await this.renderReportsList();
    }

    async waitForDataManager() {
        return new Promise((resolve) => {
            if (typeof DataManager !== 'undefined') {
                resolve();
            } else {
                const check = setInterval(() => {
                    if (typeof DataManager !== 'undefined') {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);
            }
        });
    }

    setupDOMReferences() {
        this.uploadZone = document.getElementById('upload-zone');
        this.fileInput = document.getElementById('csv-file-input');
        this.reportsList = document.getElementById('reports-list');
        this.statusDiv = document.getElementById('data-status');
    }

    setupEventListeners() {
        // File input change
        if (this.fileInput) {
            this.fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e.target.files);
            });
        }

        // Drag and drop for upload zone
        if (this.uploadZone) {
            this.uploadZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                this.uploadZone.classList.add('drag-over');
            });

            this.uploadZone.addEventListener('dragleave', () => {
                this.uploadZone.classList.remove('drag-over');
            });

            this.uploadZone.addEventListener('drop', (e) => {
                e.preventDefault();
                this.uploadZone.classList.remove('drag-over');
                this.handleFileSelect(e.dataTransfer.files);
            });

            this.uploadZone.addEventListener('click', () => {
                this.fileInput?.click();
            });
        }

        // KPI Modal
        this.setupKPIModal();
    }

    setupKPIModal() {
        const openBtn = document.getElementById('open-kpi-modal-btn');
        const modal = document.getElementById('kpi-modal');
        const closeIcon = document.getElementById('close-kpi-modal-icon');
        const closeBtn = document.getElementById('close-kpi-modal-btn');
        const tableBody = document.getElementById('kpi-table-body');
        const apiUrlInput = document.getElementById('sheet-api-url');
        const syncStatus = document.getElementById('kpi-sync-status');

        if (!openBtn || !modal) return;

        // Open modal
        openBtn.addEventListener('click', () => {
            modal.classList.add('active');
            if (tableBody && tableBody.children.length === 0) {
                this.populateKPITable();
            }
            // Auto-fetch if API URL is set
            const url = apiUrlInput?.value.trim();
            if (url) {
                this.downloadKPIData();
            }
        });

        // Close modal
        const closeModal = () => {
            modal.classList.remove('active');
        };

        if (closeIcon) closeIcon.addEventListener('click', closeModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);

        // Auto-save on input
        if (tableBody) {
            tableBody.addEventListener('input', this.debounce(() => {
                const url = apiUrlInput?.value.trim();
                if (url) {
                    this.setSyncStatus('Saving...', 'info', syncStatus);
                    this.syncKPIData('upload');
                }
            }, 2000));
        }
    }

    populateKPITable() {
        const tableBody = document.getElementById('kpi-table-body');
        if (!tableBody) return;

        const STATES_LIST = [
            "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
            "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat",
            "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala",
            "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
            "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
            "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
        ];

        const KERALA_DISTRICTS_LIST = [
            "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
            "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram", "Thrissur", "Wayanad"
        ];

        // Add India row
        this.addKPIRow('india', 'India');

        // Add states
        STATES_LIST.forEach(state => this.addKPIRow('state', state));

        // Add Kerala districts
        KERALA_DISTRICTS_LIST.forEach(dist => this.addKPIRow('district', dist));
    }

    addKPIRow(scope, name) {
        const tableBody = document.getElementById('kpi-table-body');
        if (!tableBody) return;

        const tr = document.createElement('tr');
        const scopeLabel = scope === 'india' ? 'India' : (scope === 'state' ? 'State' : 'Kerala District');

        tr.innerHTML = `
            <td>
                <input type="text" value="${scopeLabel}" disabled style="opacity: 0.7; font-weight: 500;">
                <input type="hidden" class="row-scope" value="${scope}">
            </td>
            <td>
                <input type="text" class="row-name" value="${name}" disabled style="opacity: 0.9; font-weight: 600;">
            </td>
            <td><input type="text" class="row-pop" placeholder="0"></td>
            <td><input type="text" class="row-gdp" placeholder="0"></td>
            <td><input type="text" class="row-target" placeholder="0"></td>
            <td class="action-cell"></td>
        `;
        tableBody.appendChild(tr);
    }

    async syncKPIData(action) {
        const apiUrlInput = document.getElementById('sheet-api-url');
        const syncStatus = document.getElementById('kpi-sync-status');
        const url = apiUrlInput?.value.trim();

        if (!url) return;

        this.setSyncStatus(action === 'initialize' ? 'Initializing...' : 'Uploading...', 'info', syncStatus);

        try {
            const dataToSend = this.getKPITableData();
            const payload = { action, data: dataToSend };

            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if (result.status === 'success') {
                this.setSyncStatus(result.message || 'Success!', 'success', syncStatus);
            } else {
                this.setSyncStatus('Error: ' + (result.error || 'Unknown'), 'error', syncStatus);
            }
        } catch (e) {
            console.error(e);
            this.setSyncStatus('Network/CORS Error', 'error', syncStatus);
        }
    }

    async downloadKPIData() {
        const apiUrlInput = document.getElementById('sheet-api-url');
        const syncStatus = document.getElementById('kpi-sync-status');
        const tableBody = document.getElementById('kpi-table-body');
        const url = apiUrlInput?.value.trim();

        if (!url) return;

        this.setSyncStatus('Downloading...', 'info', syncStatus);

        try {
            const response = await fetch(url, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'download' })
            });

            const result = await response.json();

            if (result.status === 'success') {
                this.updateKPITable(result.data);
                this.setSyncStatus('Data loaded!', 'success', syncStatus);
            } else {
                this.setSyncStatus('Error: ' + (result.error || 'Unknown'), 'error', syncStatus);
            }
        } catch (e) {
            console.error(e);
            this.setSyncStatus('Download failed', 'error', syncStatus);
        }
    }

    getKPITableData() {
        const rows = [];
        document.querySelectorAll('#kpi-table-body tr').forEach(tr => {
            rows.push({
                scope: tr.querySelector('.row-scope').value,
                name: tr.querySelector('.row-name').value,
                population: tr.querySelector('.row-pop').value,
                gdp: tr.querySelector('.row-gdp').value,
                target: tr.querySelector('.row-target').value
            });
        });
        return rows;
    }

    updateKPITable(data) {
        const tableBody = document.getElementById('kpi-table-body');
        if (!tableBody) return;

        tableBody.innerHTML = '';
        window.dashboardDataCache = {};

        data.forEach(row => {
            // Cache data for dashboard
            if (row.name) {
                const key = this.normalizeName(row.name);
                window.dashboardDataCache[key] = {
                    pop: row.population,
                    gdp: row.gdp,
                    target: row.target
                };
            }

            const tr = document.createElement('tr');
            const scopeLabel = row.scope === 'india' ? 'India' : (row.scope === 'state' ? 'State' : (row.scope === 'district' ? 'Kerala District' : row.scope));

            tr.innerHTML = `
                <td>
                    <input type="text" value="${scopeLabel}" disabled style="opacity: 0.7; font-weight: 500;">
                    <input type="hidden" class="row-scope" value="${row.scope}">
                </td>
                <td>
                    <input type="text" class="row-name" value="${row.name}" disabled style="opacity: 0.9; font-weight: 600;">
                </td>
                <td><input type="text" class="row-pop" value="${row.population}" placeholder="0"></td>
                <td><input type="text" class="row-gdp" value="${row.gdp}" placeholder="0"></td>
                <td><input type="text" class="row-target" value="${row.target}" placeholder="0"></td>
                <td class="action-cell"></td>
            `;
            tableBody.appendChild(tr);
        });
    }

    normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    }

    debounce(func, wait) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    setSyncStatus(msg, type, statusEl) {
        if (!statusEl) statusEl = this.statusDiv;
        if (!statusEl) return;

        statusEl.textContent = msg;
        statusEl.style.color = type === 'error' ? '#ef4444' : (type === 'success' ? '#22c55e' : 'var(--text-muted)');
    }


    async handleFileSelect(files) {
        if (!files || files.length === 0) return;

        this.setStatus('Uploading...', 'info');
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reportName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension

            try {
                this.setStatus(`Uploading ${i + 1}/${files.length}: ${reportName}...`, 'info');
                await this.dataManager.uploadCSV(file, reportName);
                successCount++;
            } catch (e) {
                console.error(`Failed to upload ${file.name}:`, e);
                errorCount++;
            }
        }

        if (errorCount === 0) {
            this.setStatus(`✓ Uploaded ${successCount} file(s) successfully`, 'success');
        } else {
            this.setStatus(`Completed: ${successCount} success, ${errorCount} failed`, 'warning');
        }

        // Refresh list
        await this.renderReportsList();

        // Clear file input
        if (this.fileInput) this.fileInput.value = '';

        // Clear status after 3 seconds
        setTimeout(() => this.setStatus('', 'info'), 3000);
    }

    async renderReportsList() {
        if (!this.reportsList) return;

        this.reportsList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">Loading...</div>';

        try {
            this.reports = await this.dataManager.listReports();

            if (!this.reports || this.reports.length === 0) {
                this.reportsList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No reports uploaded yet.</div>';
                return;
            }

            this.reportsList.innerHTML = '';

            this.reports.forEach((report, index) => {
                const row = document.createElement('div');
                row.className = 'report-item';
                row.draggable = true;
                row.dataset.id = report.id;
                row.dataset.index = index;

                // Drag events
                row.addEventListener('dragstart', () => {
                    row.classList.add('dragging');
                });

                row.addEventListener('dragend', () => {
                    row.classList.remove('dragging');
                    this.saveOrder();
                });

                row.innerHTML = `
                    <div class="drag-handle" title="Drag to reorder">⋮⋮</div>
                    <input type="text" class="report-name-input" value="${this.escapeHtml(report.name)}" 
                        data-original="${this.escapeHtml(report.name)}">
                    <span class="report-date">${new Date(report.timeCreated).toLocaleDateString()}</span>
                    <button class="btn-delete-report" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                `;

                // Rename logic
                const input = row.querySelector('.report-name-input');
                input.addEventListener('blur', async () => {
                    const newName = input.value.trim();
                    const originalName = input.dataset.original;

                    if (newName && newName !== originalName) {
                        this.setStatus('Renaming...', 'info');
                        try {
                            await this.dataManager.renameReport(report, newName);
                            input.dataset.original = newName;
                            report.name = newName;
                            this.setStatus('✓ Renamed', 'success');
                            setTimeout(() => this.setStatus('', 'info'), 2000);
                        } catch (e) {
                            console.error('Rename failed:', e);
                            input.value = originalName;
                            this.setStatus('✗ Rename failed', 'error');
                            setTimeout(() => this.setStatus('', 'info'), 2000);
                        }
                    }
                });

                input.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        input.blur();
                    }
                });

                // Delete logic
                const delBtn = row.querySelector('.btn-delete-report');
                delBtn.addEventListener('click', async () => {
                    if (confirm(`Delete report "${report.name}"?`)) {
                        this.setStatus('Deleting...', 'info');
                        try {
                            await this.dataManager.deleteReport(report);
                            await this.renderReportsList();
                            this.setStatus('✓ Deleted', 'success');
                            setTimeout(() => this.setStatus('', 'info'), 2000);
                        } catch (e) {
                            console.error('Delete failed:', e);
                            this.setStatus('✗ Delete failed', 'error');
                            setTimeout(() => this.setStatus('', 'info'), 2000);
                        }
                    }
                });

                this.reportsList.appendChild(row);
            });

            // Add dragover handler to container
            this.reportsList.addEventListener('dragover', (e) => {
                e.preventDefault();
                const draggingRow = document.querySelector('.dragging');
                if (!draggingRow) return;

                const afterElement = this.getDragAfterElement(this.reportsList, e.clientY);
                if (afterElement == null) {
                    this.reportsList.appendChild(draggingRow);
                } else {
                    this.reportsList.insertBefore(draggingRow, afterElement);
                }
            });

        } catch (e) {
            console.error('Failed to load reports:', e);
            this.reportsList.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-error);">Error loading reports.</div>';
        }

        // Update badge count
        this.updateBadge();
    }

    updateBadge() {
        const badge = document.getElementById('reports-count');
        if (badge) {
            const count = this.reports.length;
            badge.textContent = `${count} ${count === 1 ? 'report' : 'reports'}`;
        }
    }

    async saveOrder() {
        const newOrderIds = Array.from(this.reportsList.children).map(row => row.dataset.id);

        try {
            this.setStatus('Saving order...', 'info');
            const currentReports = await this.dataManager.listReports();
            const map = new Map(currentReports.map(r => [r.id, r]));
            const newItems = newOrderIds.map(id => map.get(id)).filter(Boolean);

            if (newItems.length === currentReports.length) {
                await this.dataManager.saveReportsList(newItems);
                this.setStatus('✓ Order saved', 'success');
                setTimeout(() => this.setStatus('', 'info'), 2000);
            }
        } catch (e) {
            console.warn('Save order failed:', e);
            this.setStatus('✗ Save failed', 'error');
            setTimeout(() => this.setStatus('', 'info'), 2000);
        }
    }

    getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.report-item:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    setStatus(message, type = 'info') {
        if (!this.statusDiv) return;

        this.statusDiv.textContent = message;
        this.statusDiv.className = 'status-msg';

        if (type === 'success') {
            this.statusDiv.style.color = '#22c55e';
        } else if (type === 'error') {
            this.statusDiv.style.color = '#ef4444';
        } else if (type === 'warning') {
            this.statusDiv.style.color = '#f59e0b';
        } else {
            this.statusDiv.style.color = 'var(--text-muted)';
        }
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

// Attach to window for global access
window.SettingsDataController = SettingsDataController;

import { db } from './services/firebase_config.js';
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { KAMSelector } from './components/kam-selector.js';

class InstanceManager {
    constructor() {
        this.VERSION = 'v' + Date.now().toString().slice(-4);
        console.log(`InstanceManager ${this.VERSION}: Initializing...`);
        this.apiBase = window.appConfig.apiUrl + '/api/auth';

        // UI Elements
        this.container = document.getElementById('instance-list');
        this.qrModal = document.getElementById('qr-modal');
        this.setupModal = document.getElementById('setup-modal');
        this.editModal = document.getElementById('edit-modal');
        this.qrContainer = document.getElementById('qr-container');

        // Setup Inputs
        this.nameInput = document.getElementById('new-instance-name');
        this.kamSelect = document.getElementById('new-instance-kam');

        // Edit Inputs
        this.editNameInput = document.getElementById('edit-instance-name');
        this.editKamSelect = document.getElementById('edit-instance-kam');

        this.pollInterval = null;
        this.pendingSessionId = null; // Store ID during setup process
        this.editingSessionId = null; // Store ID during edit

        // View mode state
        this.viewMode = localStorage.getItem('instanceViewMode') || 'list';
        this.instances = []; // Cache instances for re-rendering
        this.filteredInstances = []; // After search/filter

        // Search & Filter state
        this.searchQuery = '';
        this.filterKAM = '';
        this.filterStatus = '';

        // Sorting state
        this.sortKey = '';
        this.sortDirection = 'asc';

        // Pagination state
        this.currentPage = 1;
        this.pageSize = 10;
        this.viewAll = false;

        if (!this.container || !this.qrModal || !this.setupModal || !this.editModal) {
            console.error(`InstanceManager ${this.VERSION}: Critical elements not found`);
            return;
        }

        this.init();
    }

    async init() {
        console.log(`InstanceManager ${this.VERSION}: Calling init...`);
        this.setupEventListeners();
        this.setupViewToggle(); // Setup view mode toggle
        this.setupFilters(); // Setup search and filters
        this.setupPagination(); // Setup pagination controls
        this.setupBulkActions(); // Setup bulk action buttons
        this.applyViewMode(); // Apply saved view mode
        await this.loadKAMs();
        this.populateKAMFilter(); // Populate KAM dropdown
        this.renderLoading();
        this.fetchInstances();
    }

    setupEventListeners() {
        // "Add Instance" Button -> Open Setup Modal
        const addBtn = document.getElementById('btn-add-instance');
        if (addBtn) {
            addBtn.onclick = (e) => {
                e.preventDefault();
                this.openSetupModal();
            };
        }

        // "Next: Scan QR" Button -> Create Session & Show QR
        const createBtn = document.getElementById('btn-create-session');
        if (createBtn) {
            createBtn.onclick = (e) => {
                e.preventDefault();
                this.handleCreateSessionClick();
            };
        }

        // "Save Changes" Button -> Save Edit
        const saveEditBtn = document.getElementById('btn-save-edit');
        if (saveEditBtn) {
            saveEditBtn.onclick = (e) => {
                e.preventDefault();
                this.saveEdit();
            };
        }

        // Close Setup Modal
        const closeSetupBtn = document.getElementById('close-setup-modal');
        if (closeSetupBtn) {
            closeSetupBtn.onclick = () => this.closeSetupModal();
        }

        // Close Edit Modal
        const closeEditBtn = document.getElementById('close-edit-modal');
        if (closeEditBtn) {
            closeEditBtn.onclick = () => this.closeEditModal();
        }

        // Close QR Modal
        const closeQrBtn = document.querySelector('.close-modal');
        if (closeQrBtn) {
            closeQrBtn.onclick = () => this.closeQrModal();
        }

        // Close modals on overlay click
        this.qrModal.addEventListener('click', (e) => {
            if (e.target === this.qrModal) this.closeQrModal();
        });
        this.setupModal.addEventListener('click', (e) => {
            if (e.target === this.setupModal) this.closeSetupModal();
        });
        this.editModal.addEventListener('click', (e) => {
            if (e.target === this.editModal) this.closeEditModal();
        });
    }

    async loadKAMs() {
        try {
            const docRef = doc(db, "settings", "general");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const kams = data.key_accounts || [];
                this.kams = kams; // Store for filter
                this.kamImages = data.key_account_images || {}; // Store images

                // Populate both setup and edit KAM selects (Modals still use native select)
                [this.kamSelect, this.editKamSelect].forEach(select => {
                    if (select) {
                        select.innerHTML = '<option value="">Select KAM...</option>';
                        kams.forEach(kam => {
                            const option = document.createElement('option');
                            option.value = kam;
                            option.textContent = kam;
                            select.appendChild(option);
                        });
                    }
                });
            }
        } catch (e) {
            console.error("Error loading KAMs:", e);
        }
    }

    async fetchInstances() {
        try {
            // 1. Fetch live sessions from Backend
            const backendPromise = fetch(`${this.apiBase}/sessions`).then(r => r.json());

            // 2. Fetch metadata from Firestore
            const firestorePromise = getDocs(collection(db, "whatsapp_instances"));

            const [backendData, firestoreSnap] = await Promise.all([backendPromise, firestorePromise]);

            const liveSessions = (backendData.success && Array.isArray(backendData.sessions)) ? backendData.sessions : [];
            const metaDocs = [];
            firestoreSnap.forEach(doc => metaDocs.push(doc.data()));

            // 3. Merge Data
            // We want to show all instances that are in Firestore.
            // If they are in backend, we show status. If not, they are "Disconnected".
            // Also show "Unmanaged" sessions if they exist in backend but not Firestore.

            const merged = [];

            // A. Map Firestore instances
            metaDocs.forEach(meta => {
                const live = liveSessions.find(s => (s.id || s) === meta.sessionId);
                merged.push({
                    sessionId: meta.sessionId,
                    name: meta.name || 'Unnamed Instance',
                    whatsappName: meta.whatsappName || live?.whatsappName, // Use live.whatsappName from backend
                    profilePictureUrl: meta.profilePictureUrl || live?.profilePictureUrl, // Use live.profilePictureUrl from backend
                    kam: meta.kam || 'Unassigned',
                    phoneNumber: live?.phoneNumber || live?.id?.split(':')[0] || 'Unknown', // Fallback extraction
                    connected: live ? (live.connected ?? false) : false,
                    isManaged: true
                });
            });

            // B. Find orphans (Backend only)
            liveSessions.forEach(live => {
                const id = live.id || live;
                if (!metaDocs.find(m => m.sessionId === id)) {
                    merged.push({
                        sessionId: id,
                        name: 'Unmanaged Instance',
                        kam: '-',
                        phoneNumber: live.phoneNumber || id.split(':')[0] || 'Unknown',
                        connected: live.connected ?? false,
                        isManaged: false
                    });
                }
            });

            // Store instances and apply filters/pagination
            this.instances = merged;
            this.applyFiltersAndRender();

        } catch (error) {
            console.error('Error fetching instances:', error);
            this.container.innerHTML = '<div class="error-state"><p>Failed to load instances. Is the server running?</p></div>';
        }
    }

    renderList(instances) {
        // Cache instances for view switching


        if (instances.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><p class="text-muted">No instances found. Add one to get started.</p></div>';
            return;
        }

        // Route to appropriate view renderer
        if (this.viewMode === 'list') {
            this.renderListView(instances);
        } else if (this.viewMode === 'detailed') {
            this.renderDetailedView(instances);
        } else {
            // Default to card view
            this.renderCardView(instances);
        }

        // Attach event listeners
        this.attachActionListeners();
    }

    renderCardView(instances) {

        this.container.innerHTML = instances.map(inst => `
            <div class="instance-card">
                <div class="instance-header">
                    ${inst.profilePictureUrl
                ? `<img src="${inst.profilePictureUrl}" class="instance-dp" alt="Profile" onerror="this.style.display='none'">`
                : '<div class="instance-dp-placeholder">👤</div>'}
                    <div class="instance-name" title="${inst.name}">${inst.name}</div>
                    <div class="instance-status-dot ${inst.connected ? 'connected' : 'disconnected'}" title="${inst.connected ? 'Connected' : 'Disconnected'}"></div>
                </div>

                <div class="instance-details">
                    <div>${inst.phoneNumber !== 'Unknown' ? inst.phoneNumber : 'No Number'}</div>
                    ${inst.whatsappName ? `<div class="whatsapp-name">📱 ${inst.whatsappName}</div>` : ''}
                    ${inst.isManaged
                ? `<div class="instance-kam-pill">👤 ${inst.kam}</div>`
                : `<div class="managed-badge">Unmanaged</div>`
            }
                </div>

                <div class="instance-actions">
                    <button class="action-btn edit-btn" data-id="${inst.sessionId}" title="Edit Instance">
                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></span>
                        <span class="btn-text">Edit</span>
                    </button>
                    ${inst.connected
                ? `<button class="action-btn logout-btn" data-id="${inst.sessionId}" title="Logout">
                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></span>
                            <span class="btn-text">Logout</span>
                           </button>`
                : `<button class="action-btn showqr-btn" data-id="${inst.sessionId}" title="Show QR">
                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></span>
                            <span class="btn-text">Show QR</span>
                           </button>`
            }
                    <button class="action-btn danger delete-btn" data-id="${inst.sessionId}" title="Delete Instance">
                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></span>
                        <span class="btn-text">Delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderListView(instances) {
        // Professional table view
        const tableHTML = `
            <table class="instance-table">
                <thead>
                    <tr>
                        <th class="col-checkbox">
                            <input type="checkbox" id="select-all">
                        </th>
                        <th class="col-serial">#</th>
                        <th class="col-profile"></th>
                        <th class="sortable" data-sort="name">
                            NAME<span class="sort-icon"></span>
                        </th>
                        <th class="sortable" data-sort="phoneNumber">
                            PHONE<span class="sort-icon"></span>
                        </th>
                        <th class="sortable" data-sort="whatsappName">
                            WHATSAPP<span class="sort-icon"></span>
                        </th>
                        <th class="sortable" data-sort="kam">
                            KAM<span class="sort-icon"></span>
                        </th>
                        <th class="sortable" data-sort="status">
                            STATUS<span class="sort-icon"></span>
                        </th>
                        <th class="col-actions">ACTIONS</th>
                    </tr>
                </thead>
                <tbody>
                    ${instances.map((inst, index) => `
                        <tr data-id="${inst.sessionId}">
                            <td class="col-checkbox">
                                <input type="checkbox" class="row-checkbox" value="${inst.sessionId}">
                            </td>
                            <td class="col-serial">${index + 1}</td>
                            <td class="col-profile">
                                ${inst.profilePictureUrl
                ? `<img src="${inst.profilePictureUrl}" class="table-dp" alt="DP" onerror="this.style.display='none'">`
                : '<div class="table-dp-placeholder">👤</div>'}
                            </td>
                            <td>${inst.name}</td>
                            <td>${inst.phoneNumber !== 'Unknown' ? inst.phoneNumber : 'No Number'}</td>
                            <td>${inst.whatsappName || '-'}</td>
                            <td>
                                ${inst.isManaged
                ? `<span class="kam-badge">${inst.kam}</span>`
                : '<span class="unmanaged-badge">Unmanaged</span>'}
                            </td>
                            <td>
                                <span class="status-badge ${inst.connected ? 'status-connected' : 'status-disconnected'}">
                                    ${inst.connected ? 'Connected' : 'Disconnected'}
                                </span>
                            </td>
                            <td class="col-actions">
                                <div class="table-actions-wrapper">
                                    <button class="table-btn edit-btn" data-id="${inst.sessionId}" title="Edit">
                                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></span>
                                    </button>
                                    ${inst.connected
                ? `<button class="table-btn logout-btn" data-id="${inst.sessionId}" title="Logout">
                                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></span>
                                           </button>`
                : `<button class="table-btn showqr-btn" data-id="${inst.sessionId}" title="Show QR">
                                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></span>
                                           </button>`}
                                    <button class="table-btn delete-btn" data-id="${inst.sessionId}" title="Delete">
                                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></span>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        this.container.innerHTML = tableHTML;

        // Setup sorting after table is rendered
        this.setupSorting();

        // Setup select-all checkbox
        const selectAll = document.getElementById('select-all');
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                document.querySelectorAll('.row-checkbox').forEach(cb => {
                    cb.checked = e.target.checked;
                });
                this.updateBulkActionsUI();
            });
        }

        // Setup individual checkboxes
        document.querySelectorAll('.row-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateBulkActionsUI();
            });
        });
    }

    renderDetailedView(instances) {
        // Detailed cards with rich information
        this.container.innerHTML = instances.map(inst => `
            <div class="instance-card-detailed">
                <div class="detailed-header">
                    ${inst.profilePictureUrl
                ? `<img src="${inst.profilePictureUrl}" class="detailed-dp" alt="Profile" onerror="this.style.display='none'">`
                : '<div class="detailed-dp-placeholder">👤</div>'}
                    <div class="detailed-info">
                        <div class="detailed-name">${inst.name}</div>
                        <div class="detailed-phone">${inst.phoneNumber !== 'Unknown' ? inst.phoneNumber : 'No Number'}</div>
                    </div>
                    <div class="detailed-status-dot ${inst.connected ? 'connected' : 'disconnected'}"></div>
                </div>
                <div class="detailed-meta">
                    ${inst.whatsappName ? `<div class="meta-item"><span class="meta-label">WhatsApp:</span> 📱 ${inst.whatsappName}</div>` : ''}
                    ${inst.isManaged ? `<div class="meta-item"><span class="meta-label">KAM:</span> 👤 ${inst.kam}</div>` : '<div class="meta-item">Unmanaged</div>'}
                    <div class="meta-item"><span class="meta-label">Status:</span> ${inst.connected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                </div>
                <div class="detailed-actions">
                    <button class="action-btn edit-btn" data-id="${inst.sessionId}">
                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg></span>
                        <span class="btn-text">Edit</span>
                    </button>
                    ${inst.connected
                ? `<button class="action-btn logout-btn" data-id="${inst.sessionId}">
                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg></span>
                            <span class="btn-text">Logout</span>
                           </button>`
                : `<button class="action-btn showqr-btn" data-id="${inst.sessionId}">
                            <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg></span>
                            <span class="btn-text">Show QR</span>
                           </button>`}
                    <button class="action-btn danger delete-btn" data-id="${inst.sessionId}">
                        <span class="btn-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg></span>
                        <span class="btn-text">Delete</span>
                    </button>
                </div>
            </div>
        `).join('');
    }

    attachActionListeners() {
        // Edit
        this.container.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.openEditModal(e.currentTarget.dataset.id);
            });
        });

        // Logout
        this.container.querySelectorAll('.logout-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.logoutInstance(e.currentTarget.dataset.id);
            });
        });

        // Show QR
        this.container.querySelectorAll('.showqr-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showQRForInstance(e.currentTarget.dataset.id);
            });
        });

        // Delete
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteInstance(e.currentTarget.dataset.id);
            });
        });
    }

    /* --- ACTIONS --- */

    async unmanageInstance(sessionId) {
        if (!confirm(`Are you sure you want to Unlink this instance? \n\nThis will remove the Name and KAM association, but keep the WhatsApp connection active.`)) return;

        try {
            // Delete ONLY from Firestore
            await deleteDoc(doc(db, "whatsapp_instances", sessionId));

            import('./utils/toast.js').then(m => m.Toast.success ? m.Toast.success('Instance Unlinked') : console.log('Instance Unlinked'));
            this.fetchInstances(); // Refresh list to show as Unmanaged
        } catch (e) {
            console.error(e);
            alert('Error unlinking instance');
        }
    }

    /* --- EDIT MODAL METHODS --- */

    async openEditModal(sessionId) {
        this.editingSessionId = sessionId;

        // Load current data
        try {
            const docRef = doc(db, "whatsapp_instances", sessionId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                this.editNameInput.value = data.name || '';
                this.editKamSelect.value = data.kam || '';
            } else {
                // If no metadata exists, try to get from backend
                const response = await fetch(`${this.apiBase}/sessions`);
                const sessions = await response.json();
                const session = sessions.find(s => s.sessionId === sessionId);

                if (session) {
                    this.editNameInput.value = session.sessionId;
                    this.editKamSelect.value = '';
                }
            }
        } catch (e) {
            console.error('Error loading instance data:', e);
        }

        this.showElement(this.editModal);
    }

    async saveEdit() {
        const name = this.editNameInput.value.trim();
        const kam = this.editKamSelect.value;

        if (!name) {
            alert('Please enter an instance name');
            return;
        }

        /*
        if (!kam) {
            alert('Please select a KAM');
            return;
        }
        */

        try {
            await setDoc(doc(db, "whatsapp_instances", this.editingSessionId), {
                name,
                kam,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            import('./utils/toast.js').then(m => m.Toast.success('Instance updated successfully'));
            this.closeEditModal();
            this.fetchInstances();
        } catch (e) {
            console.error('Error updating instance:', e);
            alert('Failed to update instance');
        }
    }

    closeEditModal() {
        this.hideElement(this.editModal);
        this.editingSessionId = null;
        this.editNameInput.value = '';
        this.editKamSelect.value = '';
    }

    /* --- LOGOUT METHOD --- */

    async logoutInstance(sessionId) {
        if (!confirm('Disconnect this WhatsApp session?\n\nYou can reconnect later by scanning the QR code.')) return;

        try {
            const response = await fetch(`${this.apiBase}/disconnect/${sessionId}`, {
                method: 'POST'
            });

            if (response.ok) {
                import('./utils/toast.js').then(m => m.Toast.success('Instance disconnected successfully'));
                this.fetchInstances();
            } else {
                throw new Error('Disconnect failed');
            }
        } catch (e) {
            console.error('Error disconnecting:', e);
            alert('Failed to disconnect instance');
        }
    }

    /* --- SHOW QR METHOD --- */

    async showQRForInstance(sessionId) {
        try {
            this.pendingSessionId = sessionId;
            this.showElement(this.qrModal);
            this.qrContainer.innerHTML = '<div class="loading-spinner"></div>';

            const response = await fetch(`${this.apiBase}/qr/${sessionId}`);
            const data = await response.json();

            if (data.qr) {
                this.renderQR(data.qr);
                this.startPolling(sessionId);
            } else {
                this.qrContainer.innerHTML = '<p class="text-muted">QR code not available. Instance may already be connected.</p>';
            }
        } catch (e) {
            console.error('Error fetching QR:', e);
            this.qrContainer.innerHTML = '<p class="text-danger">Failed to load QR code</p>';
        }
    }

    /* --- UPDATED DELETE METHOD --- */

    async deleteInstance(sessionId) {
        if (!confirm('⚠️ PERMANENT DELETE\n\nThis will delete:\n• Instance metadata\n• WhatsApp session\n• All associated data\n\nThis action cannot be undone. Continue?')) return;

        try {
            // 1. Delete from Firestore
            await deleteDoc(doc(db, "whatsapp_instances", sessionId));

            // 2. Delete from backend (session + data)
            const response = await fetch(`${this.apiBase}/delete/${sessionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Backend deletion failed');
            }

            import('./utils/toast.js').then(m => m.Toast.success('Instance deleted permanently'));
            this.fetchInstances();
        } catch (e) {
            console.error('Error deleting instance:', e);
            alert('Failed to delete instance completely. Some data may remain.');
        }
    }

    /* --- SETUP FLOW --- */

    openSetupModal(existingSessionId = null) {
        this.nameInput.value = '';
        this.kamSelect.value = '';
        this.claimingSessionId = existingSessionId; // Store content

        const title = this.setupModal.querySelector('h2');
        const btn = document.getElementById('btn-create-session');

        if (this.claimingSessionId) {
            title.textContent = 'Manage Existing Instance';
            btn.textContent = 'Save & Claim';
        } else {
            title.textContent = 'Add New Instance';
            btn.textContent = 'Next: Scan QR';
        }

        this.showElement(this.setupModal);
    }

    closeSetupModal() {
        this.hideElement(this.setupModal);
        this.claimingSessionId = null;
    }

    async handleCreateSessionClick() {
        const name = this.nameInput.value.trim();
        const kam = this.kamSelect.value;

        if (!name) { alert('Please enter an Instance Name'); return; }
        if (!kam) { alert('Please select a Key Account Manager'); return; }

        // Capture state BEFORE closing modal (which clears it)
        const sessionId = this.claimingSessionId || ('session_' + Date.now() + '_' + Math.floor(Math.random() * 1000));
        const isClaiming = !!this.claimingSessionId;

        this.closeSetupModal();

        this.pendingSessionId = sessionId;

        // Save to Firestore First
        try {
            await setDoc(doc(db, "whatsapp_instances", sessionId), {
                sessionId,
                name,
                kam,
                createdAt: new Date(),
                createdBy: 'admin', // TODO: Get actual user
                updatedAt: new Date()
            }, { merge: true }); // Merge is safer for claiming

            if (isClaiming) {
                // If claiming, we don't need QR. Just refresh.
                import('./utils/toast.js').then(m => m.Toast.success ? m.Toast.success('Instance Claimed Successfully!') : alert('Instance Claimed!'));
                this.fetchInstances();
            } else {
                // Proceed to QR for new sessions
                this.requestNewQR(sessionId);
            }

        } catch (e) {
            console.error("Error creating/claiming instance doc:", e);
            alert("Failed to save instance record.");
        }
    }

    /* --- QR & CONNECTION --- */

    async requestNewQR(sessionId) {
        this.showElement(this.qrModal);
        this.renderQRSpinner();

        try {
            const response = await fetch(`${this.apiBase}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const data = await response.json();

            if (data.success) {
                if (data.message === 'Already connected') {
                    alert('This session is already connected!');
                    this.closeQrModal();
                    this.fetchInstances();
                } else if (data.qrCode) {
                    this.renderQR(data.qrCode);
                    this.startPolling(sessionId);
                } else {
                    this.qrContainer.innerHTML = `<div class="error-state"><p>${data.message}</p></div>`;
                }
            } else {
                throw new Error(data.message);
            }

        } catch (e) {
            console.error(e);
            this.qrContainer.innerHTML = '<div class="error-state"><p>Failed to generate QR Code. Check backend.</p></div>';
        }
    }

    startPolling(sessionId) {
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(async () => {
            // Only poll if modal is open to save resources
            if (this.qrModal.classList.contains('hidden')) {
                clearInterval(this.pollInterval);
                return;
            }

            try {
                const response = await fetch(`${this.apiBase}/status?sessionId=${sessionId}`);
                const data = await response.json();

                if (data.connected) {
                    clearInterval(this.pollInterval);
                    this.closeQrModal();

                    // Show success toast or alert
                    import('./utils/toast.js').then(m => m.Toast.success ? m.Toast.success('Connected Successfully!') : alert('Connected!'));

                    // Wait a moment for backend to populate phone number if needed
                    setTimeout(() => this.fetchInstances(), 1000);
                }
            } catch (e) {
                console.warn('Polling error', e);
            }
        }, 2000);
    }

    /* --- ACTIONS --- */

    async reconnectInstance(sessionId) {
        if (!confirm('Generating a new QR code will disconnect any active session for this instance. Continue?')) {
            return;
        }
        this.requestNewQR(sessionId);
    }

    async deleteInstance(sessionId) {
        if (!confirm('⚠️ PERMANENT DELETE\n\nThis will delete:\n• Instance metadata\n• WhatsApp session\n• All associated data\n\nThis action cannot be undone. Continue?')) return;

        try {
            // 1. Delete from Firestore
            await deleteDoc(doc(db, "whatsapp_instances", sessionId));

            // 2. Delete from backend (session + data)
            const response = await fetch(`${this.apiBase}/delete/${sessionId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error('Backend deletion failed');
            }

            import('./utils/toast.js').then(m => m.Toast.success('Instance deleted permanently'));
            this.fetchInstances();
        } catch (e) {
            console.error('Error deleting instance:', e);
            alert('Failed to delete instance completely. Some data may remain.');
        }
    }

    /* --- HELPERS --- */

    showElement(el) {
        el.classList.remove('hidden');
        el.classList.add('active');
        el.style.display = 'flex';
    }

    hideElement(el) {
        el.classList.add('hidden');
        el.classList.remove('active');
        el.style.display = 'none';
        if (el === this.qrContainer) this.qrContainer.innerHTML = '';
        if (el === this.qrModal) {
            if (this.pollInterval) clearInterval(this.pollInterval);
        }
    }

    closeQrModal() {
        this.hideElement(this.qrModal);
    }

    renderLoading() {
        this.container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';
    }

    renderQRSpinner() {
        this.qrContainer.innerHTML = '<div class="spinner"></div><p style="margin-top:1rem">Contacting WhatsApp...</p>';
    }

    renderQR(qrCode) {
        const isDataUri = qrCode.startsWith('data:image');
        const qrUrl = isDataUri ? qrCode : `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`;

        this.qrContainer.innerHTML = `
            <img src="${qrUrl}" alt="Scan me" style="width:250px; height:250px; border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
            <p style="margin-top:1rem; font-size: 0.9rem" class="text-muted">Scan with WhatsApp on your phone</p>
        `;
    }

    /* === VIEW MODE METHODS === */

    applyViewMode() {
        // Update container class
        this.container.className = `instance-container ${this.viewMode}-view`;

        // Update active button
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === this.viewMode);
        });
    }

    switchView(mode) {
        this.viewMode = mode;
        localStorage.setItem('instanceViewMode', mode);
        this.applyViewMode();

        // Re-render with cached instances
        if (this.filteredInstances) {
            this.renderList(this.filteredInstances);
        }
    }

    setupViewToggle() {
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.switchView(view);
            });
        });
    }

    /* === STATS, SEARCH, FILTER, SORT, PAGINATION === */

    updateStats(instances) {
        const total = instances.length;
        const connected = instances.filter(i => i.connected).length;
        const disconnected = total - connected;
        const unmanaged = instances.filter(i => !i.isManaged).length;

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-connected').textContent = connected;
        document.getElementById('stat-disconnected').textContent = disconnected;
        document.getElementById('stat-unmanaged').textContent = unmanaged;
    }

    setupFilters() {
        // Search
        const searchInput = document.getElementById('search-instances');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.currentPage = 1; // Reset to first page
                this.applyFiltersAndRender();
            });
        }

        // KAM filter - Now handled by KAMSelector component in populateKAMFilter
        /* 
        const kamFilter = document.getElementById('filter-kam');
        if (kamFilter) {
            kamFilter.addEventListener('change', (e) => {
                this.filterKAM = e.target.value;
                this.currentPage = 1;
                this.applyFiltersAndRender();
            });
        }
        */

        // Status filter
        const statusFilter = document.getElementById('filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.filterStatus = e.target.value;
                this.currentPage = 1;
                this.applyFiltersAndRender();
            });
        }
    }

    populateKAMFilter() {
        if (!this.kams) return;

        // Initialize Custom KAM Selector
        if (!this.kamSelector) {
            this.kamSelector = new KAMSelector({
                containerId: 'kam-selector-container',
                getKAMImage: (kam) => this.kamImages ? this.kamImages[kam] : null,
                onChange: (val) => {
                    this.filterKAM = val;
                    this.currentPage = 1;
                    this.applyFiltersAndRender();
                }
            });
        }

        this.kamSelector.setKAMs(this.kams);
        this.kamSelector.setValue(this.filterKAM);
    }

    applyFiltersAndRender() {
        let filtered = [...this.instances];

        // Apply search
        if (this.searchQuery) {
            filtered = filtered.filter(inst =>
                inst.name.toLowerCase().includes(this.searchQuery) ||
                inst.phoneNumber.includes(this.searchQuery) ||
                (inst.whatsappName && inst.whatsappName.toLowerCase().includes(this.searchQuery))
            );
        }

        // Apply KAM filter
        if (this.filterKAM && this.filterKAM !== 'all') {
            if (this.filterKAM === 'not_assigned') {
                filtered = filtered.filter(inst => !inst.kam || inst.kam === 'Unassigned' || inst.kam === '-' || inst.kam === 'Not Assigned');
            } else {
                filtered = filtered.filter(inst => inst.kam === this.filterKAM);
            }
        }

        // Apply status filter
        if (this.filterStatus === 'connected') {
            filtered = filtered.filter(inst => inst.connected);
        } else if (this.filterStatus === 'disconnected') {
            filtered = filtered.filter(inst => !inst.connected);
        }

        // Apply sorting
        filtered = this.sortInstances(filtered);

        // Store filtered results
        this.filteredInstances = filtered;

        // Apply pagination
        const paginated = this.paginateInstances(filtered);

        // Render
        this.renderList(paginated);

        // Update stats with filtered data
        this.updateStats(filtered);

        // Update pagination UI
        this.updatePaginationUI(filtered.length);
    }

    sortInstances(instances) {
        if (!this.sortKey) return instances;

        return [...instances].sort((a, b) => {
            let aVal = a[this.sortKey];
            let bVal = b[this.sortKey];

            // Handle special cases
            if (this.sortKey === 'status') {
                aVal = a.connected ? 1 : 0;
                bVal = b.connected ? 1 : 0;
            }

            // String comparison
            if (typeof aVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = (bVal || '').toLowerCase();
            }

            const comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
            return this.sortDirection === 'asc' ? comparison : -comparison;
        });
    }

    setupSorting() {
        // This will be called after table is rendered
        document.querySelectorAll('.sortable').forEach(header => {
            header.addEventListener('click', () => {
                const sortKey = header.dataset.sort;

                // Toggle sort direction
                if (this.sortKey === sortKey) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortKey = sortKey;
                    this.sortDirection = 'asc';
                }

                // Update UI
                document.querySelectorAll('.sortable').forEach(h => {
                    h.classList.remove('sorted-asc', 'sorted-desc');
                });
                header.classList.add(`sorted-${this.sortDirection}`);

                // Re-render
                this.applyFiltersAndRender();
            });
        });
    }

    paginateInstances(instances) {
        if (this.viewAll) return instances;

        const start = (this.currentPage - 1) * this.pageSize;
        const end = start + this.pageSize;
        return instances.slice(start, end);
    }

    updatePaginationUI(totalInstances) {
        const totalPages = Math.ceil(totalInstances / this.pageSize) || 1;
        const start = totalInstances === 0 ? 0 : (this.currentPage - 1) * this.pageSize + 1;
        const end = Math.min(this.currentPage * this.pageSize, totalInstances);

        document.getElementById('page-start').textContent = start;
        document.getElementById('page-end').textContent = end;
        document.getElementById('page-total').textContent = totalInstances;
        document.getElementById('page-indicator').textContent = `Page ${this.currentPage} of ${totalPages}`;

        const prevBtn = document.getElementById('btn-prev-page');
        const nextBtn = document.getElementById('btn-next-page');

        if (prevBtn) prevBtn.disabled = this.currentPage === 1;
        if (nextBtn) nextBtn.disabled = this.currentPage === totalPages;
    }

    setupPagination() {
        const prevBtn = document.getElementById('btn-prev-page');
        const nextBtn = document.getElementById('btn-next-page');
        const viewAllBtn = document.getElementById('btn-view-all');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.applyFiltersAndRender();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredInstances.length / this.pageSize);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.applyFiltersAndRender();
                }
            });
        }

        if (viewAllBtn) {
            viewAllBtn.addEventListener('click', () => {
                this.viewAll = !this.viewAll;
                viewAllBtn.textContent = this.viewAll ? 'Paginate' : 'View All';
                this.applyFiltersAndRender();
            });
        }
    }

    setupBulkActions() {
        const bulkDisconnectBtn = document.getElementById('btn-bulk-disconnect');
        const bulkDeleteBtn = document.getElementById('btn-bulk-delete');
        const bulkClearBtn = document.getElementById('btn-bulk-clear');

        if (bulkDisconnectBtn) {
            bulkDisconnectBtn.addEventListener('click', () => this.bulkDisconnect());
        }

        if (bulkDeleteBtn) {
            bulkDeleteBtn.addEventListener('click', () => this.bulkDelete());
        }

        if (bulkClearBtn) {
            bulkClearBtn.addEventListener('click', () => {
                document.querySelectorAll('.row-checkbox').forEach(cb => cb.checked = false);
                const selectAll = document.getElementById('select-all');
                if (selectAll) selectAll.checked = false;
                this.updateBulkActionsUI();
            });
        }
    }

    updateBulkActionsUI() {
        const selected = this.getSelectedInstances();
        const bulkActions = document.getElementById('bulk-actions');
        const bulkCount = document.getElementById('bulk-count');

        if (bulkActions && bulkCount) {
            if (selected.length > 0) {
                bulkActions.style.display = 'flex';
                bulkCount.textContent = selected.length;
            } else {
                bulkActions.style.display = 'none';
            }
        }
    }

    getSelectedInstances() {
        const checkboxes = document.querySelectorAll('.row-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    async bulkDisconnect() {
        const selected = this.getSelectedInstances();
        if (selected.length === 0) return;

        if (!confirm(`Disconnect ${selected.length} instance(s)?`)) return;

        for (const sessionId of selected) {
            await this.logoutInstance(sessionId);
        }

        await this.fetchInstances();
    }

    async bulkDelete() {
        const selected = this.getSelectedInstances();
        if (selected.length === 0) return;

        if (!confirm(`Delete ${selected.length} instance(s)? This cannot be undone.`)) return;

        for (const sessionId of selected) {
            await this.deleteInstance(sessionId);
        }

        await this.fetchInstances();
    }
}

// Instantiate
new InstanceManager();

import { db } from './services/firebase_config.js';
import { collection, doc, getDoc, setDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

        if (!this.container || !this.qrModal || !this.setupModal || !this.editModal) {
            console.error(`InstanceManager ${this.VERSION}: Critical elements not found`);
            return;
        }

        this.init();
    }

    async init() {
        console.log(`InstanceManager ${this.VERSION}: Calling init...`);
        this.setupEventListeners();
        await this.loadKAMs();
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

                // Populate both setup and edit KAM selects
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

            this.renderList(merged);

        } catch (error) {
            console.error('Error fetching instances:', error);
            this.container.innerHTML = '<div class="error-state"><p>Failed to load instances. Is the server running?</p></div>';
        }
    }

    renderList(instances) {
        if (instances.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><p class="text-muted">No instances found. Add one to get started.</p></div>';
            return;
        }

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
                        <span class="btn-icon">✏️</span>
                        <span class="btn-text">Edit</span>
                    </button>
                    ${inst.connected
                ? `<button class="action-btn logout-btn" data-id="${inst.sessionId}" title="Logout">
                            <span class="btn-icon">🚪</span>
                            <span class="btn-text">Disconnect</span>
                           </button>`
                : `<button class="action-btn showqr-btn" data-id="${inst.sessionId}" title="Show QR Code">
                            <span class="btn-icon">📱</span>
                            <span class="btn-text">Show QR</span>
                           </button>`
            }
                    <button class="action-btn danger delete-btn" data-id="${inst.sessionId}" title="Delete Instance">
                        <span class="btn-icon">🗑️</span>
                        <span class="btn-text">Delete</span>
                    </button>
                </div>
            </div>
        `).join('');

        // Attach event listeners
        this.attachActionListeners();
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

        if (!kam) {
            alert('Please select a KAM');
            return;
        }

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
}

// Instantiate
new InstanceManager();

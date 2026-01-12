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
        this.qrContainer = document.getElementById('qr-container');

        // Setup Inputs
        this.nameInput = document.getElementById('new-instance-name');
        this.kamSelect = document.getElementById('new-instance-kam');

        this.pollInterval = null;
        this.pendingSessionId = null; // Store ID during setup process

        if (!this.container || !this.qrModal || !this.setupModal) {
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

        // Close Setup Modal
        const closeSetupBtn = document.getElementById('close-setup-modal');
        if (closeSetupBtn) {
            closeSetupBtn.onclick = () => this.closeSetupModal();
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
    }

    async loadKAMs() {
        try {
            const docRef = doc(db, "settings", "general");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const kams = data.key_accounts || [];

                this.kamSelect.innerHTML = '<option value="">Select KAM...</option>';
                kams.forEach(kam => {
                    const option = document.createElement('option');
                    option.value = kam;
                    option.textContent = kam;
                    this.kamSelect.appendChild(option);
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
                <div class="instance-info">
                    <div class="instance-icon">
                        ${inst.connected ? '✅' : '🔴'}
                    </div>
                    <div>
                        <h3>${inst.name}</h3>
                        <p class="text-muted" style="margin-bottom:4px;">${inst.phoneNumber !== 'Unknown' ? inst.phoneNumber : 'Not Connected'}</p>
                         ${inst.isManaged ? `<span style="font-size:0.8rem; background:#f1f5f9; padding:2px 8px; border-radius:4px; color:#64748b;">KAM: ${inst.kam}</span>` : '<span style="font-size:0.8rem; background:#fee2e2; padding:2px 8px; border-radius:4px; color:#ef4444;">Unmanaged</span>'}
                    </div>
                </div>
                
                <div class="instance-status ${inst.connected ? 'connected' : 'disconnected'}" style="margin-top:1rem;">
                    ${inst.connected ? 'Active' : 'Offline/Disconnected'}
                </div>

                <div class="instance-actions">
                    <button class="btn-icon delete-btn" data-id="${inst.sessionId}" title="Delete Instance">🗑️</button>
                    ${!inst.isManaged ? `<button class="btn-secondary manage-btn" data-id="${inst.sessionId}" style="margin-right:8px;">Manage</button>` : ''}
                    ${!inst.connected && inst.isManaged ? `<button class="btn-secondary reconnect-btn" data-id="${inst.sessionId}">Reconnect</button>` : ''}
                </div>
            </div>
        `).join('');

        // Re-attach listeners
        this.container.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteInstance(e.currentTarget.dataset.id));
        });

        this.container.querySelectorAll('.reconnect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.reconnectInstance(e.currentTarget.dataset.id));
        });

        this.container.querySelectorAll('.manage-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openSetupModal(e.currentTarget.dataset.id));
        });
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
        if (!confirm(`Are you sure you want to delete instance ${sessionId}? This cannot be undone.`)) return;

        try {
            // 1. Delete from Backend
            await fetch(`${this.apiBase}/session/${sessionId}`, { method: 'DELETE' }); // Best effort

            // 2. Delete from Firestore
            await deleteDoc(doc(db, "whatsapp_instances", sessionId));

            this.fetchInstances(); // Refresh

        } catch (e) {
            console.error(e);
            alert('Error deleting instance');
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

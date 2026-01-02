class InstanceManager {
    constructor() {
        console.log('InstanceManager: Initializing...');
        this.apiBase = window.appConfig.apiUrl + '/api/auth';
        this.container = document.getElementById('instance-list');
        this.modal = document.getElementById('qr-modal');
        this.qrContainer = document.getElementById('qr-container');
        this.pollInterval = null;

        if (!this.container || !this.modal) {
            console.error('InstanceManager: Critical elements not found in DOM');
            return;
        }

        this.init();
    }

    async init() {
        console.log('InstanceManager: Calling init...');
        // Setup listeners immediately so the button works even if network is slow
        this.setupEventListeners();

        this.renderLoading();
        // Don't await this, let it load in background
        this.fetchInstances();
    }

    setupEventListeners() {
        const addBtn = document.getElementById('btn-add-instance');
        console.log('InstanceManager: Setup listeners. Add Button found?', !!addBtn);

        if (addBtn) {
            // Remove old listeners by cloning (simple hack) or just assume fresh DOM
            addBtn.addEventListener('click', () => {
                console.log('InstanceManager: Add Instance Clicked');
                this.createNewSession();
            });
        }

        // Close Modal
        document.querySelector('.close-modal').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on outside click
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) this.closeModal();
        });
    }

    async fetchInstances() {
        try {
            const response = await fetch(`${this.apiBase}/sessions`);
            const data = await response.json();

            if (data.success) {
                // The API returns an object or array of sessions
                // We need to map it to our UI format
                // Assuming data.sessions is an array of IDs or objects

                // If the backend returns just IDs, we might need to fetch status for each or defaults
                const sessions = Array.isArray(data.sessions) ? data.sessions : [];

                // For now, shape it. If backend only sends strings, map object.
                const formattedSessions = sessions.map(s => {
                    return typeof s === 'string' ? { id: s, status: 'unknown' } : s;
                });

                this.renderList(formattedSessions);
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Error fetching instances:', error);
            this.container.innerHTML = '<div class="error-state"><p>Failed to load instances. Is the server running?</p></div>';
        }
    }

    async createNewSession() {
        const sessionId = 'session_' + Math.floor(Math.random() * 10000);
        this.showModal();
        this.renderQRSpinner();

        try {
            const response = await fetch(`${this.apiBase}/qr`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });
            const data = await response.json();

            if (data.success && data.message === 'Already connected') {
                alert('Session ID collision or already connected.');
                this.closeModal();
                this.fetchInstances();
                return;
            }

            if (data.qrCode) {
                this.renderQR(data.qrCode);
                this.startPolling(sessionId);
            } else {
                this.qrContainer.innerHTML = `<div class="error-state"><p>${data.message}</p></div>`;
            }

        } catch (e) {
            console.error(e);
            this.qrContainer.innerHTML = '<div class="error-state"><p>Failed to generate QR.</p></div>';
        }
    }

    startPolling(sessionId) {
        if (this.pollInterval) clearInterval(this.pollInterval);

        this.pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.apiBase}/status?sessionId=${sessionId}`);
                const data = await response.json();

                if (data.connected) {
                    clearInterval(this.pollInterval);
                    this.closeModal();
                    alert('Device Connected Successfully! 🎉');
                    this.fetchInstances();
                }
            } catch (e) {
                console.error('Polling error', e);
            }
        }, 3000); // Check every 3 seconds
    }

    renderLoading() {
        this.container.innerHTML = '<div class="page-loader"><div class="spinner"></div></div>';
    }

    renderList(sessions) {
        if (sessions.length === 0) {
            this.container.innerHTML = '<div class="empty-state"><p class="text-muted">No active instances. Click "Add Instance" to connect.</p></div>';
            return;
        }

        this.container.innerHTML = sessions.map(session => `
            <div class="instance-card">
                <div class="instance-info">
                    <div class="instance-icon">📱</div>
                    <div>
                        <h3>${session.id || session}</h3>
                        <p class="text-muted">${session.connected ? 'Connected' : 'Scanner Ready'}</p>
                    </div>
                </div>
                <div class="instance-status ${session.connected ? 'connected' : 'disconnected'}">
                    ${session.connected ? 'Active' : 'Offline'}
                </div>
                <div class="instance-actions">
                    <button class="btn-icon delete-btn" data-id="${session.id || session}">🗑️</button>
                    ${!session.connected ? `<button class="btn-secondary reconnect-btn" data-id="${session.id || session}">Reconnect</button>` : ''}
                </div>
            </div>
        `).join('');

        // Re-attach listeners
        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                this.deleteInstance(id);
            });
        });

        document.querySelectorAll('.reconnect-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Re-use createNewSession logic but with existing ID?
                // For now, simplify.
                alert('To reconnect, please delete and create a new session.');
            });
        });
    }

    showModal() {
        this.modal.classList.remove('hidden');
    }

    closeModal() {
        this.modal.classList.add('hidden');
        this.qrContainer.innerHTML = '';
        if (this.pollInterval) clearInterval(this.pollInterval);
    }

    renderQRSpinner() {
        this.qrContainer.innerHTML = '<div class="spinner"></div><p style="margin-top:1rem">Generating QR Code...</p>';
    }

    renderQR(qrCode) {
        // Check if the QR code is already a data URI (base64 image)
        const isDataUri = qrCode.startsWith('data:image');

        let qrUrl;
        if (isDataUri) {
            qrUrl = qrCode;
        } else {
            // Use public API to render QR code image from the string
            qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(qrCode)}`;
        }

        this.qrContainer.innerHTML = `
            <img src="${qrUrl}" alt="Scan me" style="border-radius:8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);" />
            <p style="margin-top:1rem; font-size: 0.9rem" class="text-muted">Scan with WhatsApp</p>
        `;
    }

    async deleteInstance(id) {
        if (confirm(`Are you sure you want to disconnect ${id}?`)) {
            try {
                const response = await fetch(`${this.apiBase}/session/${id}`, { method: 'DELETE' });
                const data = await response.json();
                if (data.success) {
                    this.fetchInstances(); // Refresh list
                } else {
                    alert('Failed to delete: ' + data.message);
                }
            } catch (e) {
                console.error(e);
                alert('Error deleting session');
            }
        }
    }
}

// Instantiate
new InstanceManager();

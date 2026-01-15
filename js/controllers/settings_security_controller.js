import { db } from '../services/firebase_config.js';
import { SecurityDashboardView } from './security_dashboard_view.js';

export class SettingsSecurityController {
    constructor() {
        console.log("SettingsSecurityController: Initializing...");
        // Legacy properties might be removed later
        try {
            this.dashboard = new SecurityDashboardView();
            window.securityDashboard = this.dashboard; // Expose for HTML onclicks
            console.log("SettingsSecurityController: Dashboard View Linked.");
        } catch (e) {
            console.error("SettingsSecurityController: Failed to init dashboard view", e);
        }
    }

    openDashboard() {
        console.log("SettingsSecurityController: Opening Dashboard...");
        if (this.dashboard) {
            this.dashboard.mount();
        } else {
            console.error("SettingsSecurityController: Dashboard view instance missing.");
        }
    }

    async loadData() {
        this.setLoading(true);
        try {
            await Promise.all([
                this.loadActiveSessions(),
                this.loadAuditLogs()
            ]);
            this.renderSessions();
            this.renderLogs();
        } catch (error) {
            console.error("Error loading security data:", error);
            Toast.error("Failed to load security data.");
        } finally {
            this.setLoading(false);
        }
    }

    async loadActiveSessions() {
        const q = query(collection(db, "users"), where("active", "==", true));
        const snapshot = await getDocs(q);
        this.activeSessions = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            data.uid = doc.id;
            // Only include if they have active sessions data
            if (data.activeSessions && Object.keys(data.activeSessions).length > 0) {
                this.activeSessions.push(data);
            }
        });
    }

    async loadAuditLogs() {
        // Fetch last 50 logs
        const q = query(collection(db, "user_activity_logs"), orderBy("timestamp", "desc"), limit(50));
        const snapshot = await getDocs(q);
        this.auditLogs = [];
        snapshot.forEach(doc => {
            this.auditLogs.push(doc.data());
        });
    }

    setLoading(loading) {
        const el = document.getElementById('security-loading');
        if (el) el.style.display = loading ? 'block' : 'none';
    }

    renderModal() {
        const modalHtml = `
            <div class="modal" onclick="event.stopPropagation()" style="width: 900px; max-width: 95vw; height: 80vh; display: flex; flex-direction: column;">
                <div class="modal-header">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size: 1.5rem;">🛡️</span>
                        <h3>Security Dashboard</h3>
                    </div>
                    <button class="close-modal-btn" onclick="document.getElementById('security-modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body" style="flex: 1; overflow-y: auto; padding: 20px;">
                    
                    <!-- Statistics -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px;">
                        <div class="stat-card" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); padding: 15px; border-radius: 10px;">
                            <div style="font-size: 0.8rem; color: #10b981; margin-bottom: 5px;">Active Users</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #fff;" id="stat-active-users">-</div>
                        </div>
                        <div class="stat-card" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); padding: 15px; border-radius: 10px;">
                            <div style="font-size: 0.8rem; color: #3b82f6; margin-bottom: 5px;">Total Sessions</div>
                            <div style="font-size: 1.5rem; font-weight: bold; color: #fff;" id="stat-total-sessions">-</div>
                        </div>
                    </div>

                    <!-- Tabs -->
                    <div class="tabs" style="display: flex; gap: 20px; border-bottom: 1px solid var(--border-color); margin-bottom: 20px;">
                        <button class="tab-btn active" onclick="window.settingsSecurityController.switchTab('sessions')" id="tab-btn-sessions" style="background:none; border:none; color:var(--text-primary); padding: 10px 0; border-bottom: 2px solid var(--primary-color); cursor: pointer;">Active Sessions</button>
                        <button class="tab-btn" onclick="window.settingsSecurityController.switchTab('logs')" id="tab-btn-logs" style="background:none; border:none; color:var(--text-secondary); padding: 10px 0; border-bottom: 2px solid transparent; cursor: pointer;">Audit Logs</button>
                    </div>

                    <div id="security-loading" style="text-align: center; padding: 20px; display: none;">
                        <div class="spinner"></div> Loading Security Data...
                    </div>

                    <!-- Sessions View -->
                    <div id="view-sessions">
                        <div id="sessions-list" style="display: flex; flex-direction: column; gap: 15px;"></div>
                    </div>

                    <!-- Logs View -->
                    <div id="view-logs" style="display: none;">
                        <table class="data-table" style="width: 100%; font-size: 0.85rem;">
                            <thead>
                                <tr style="text-align: left; color: var(--text-secondary);">
                                    <th style="padding: 10px;">Time</th>
                                    <th style="padding: 10px;">User</th>
                                    <th style="padding: 10px;">Action</th>
                                    <th style="padding: 10px;">Location (IP)</th>
                                </tr>
                            </thead>
                            <tbody id="logs-list"></tbody>
                        </table>
                    </div>

                </div>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'security-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = modalHtml;
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
        document.body.appendChild(overlay);
    }

    switchTab(tab) {
        document.getElementById('view-sessions').style.display = tab === 'sessions' ? 'block' : 'none';
        document.getElementById('view-logs').style.display = tab === 'logs' ? 'block' : 'none';

        document.getElementById('tab-btn-sessions').style.color = tab === 'sessions' ? 'var(--text-primary)' : 'var(--text-secondary)';
        document.getElementById('tab-btn-sessions').style.borderBottomColor = tab === 'sessions' ? 'var(--primary-color)' : 'transparent';

        document.getElementById('tab-btn-logs').style.color = tab === 'logs' ? 'var(--text-primary)' : 'var(--text-secondary)';
        document.getElementById('tab-btn-logs').style.borderBottomColor = tab === 'logs' ? 'var(--primary-color)' : 'transparent';
    }

    renderSessions() {
        const container = document.getElementById('sessions-list');
        if (!container) return;

        let totalSessions = 0;
        const html = this.activeSessions.map(user => {
            const sessions = user.activeSessions || {};
            const sessionCount = Object.keys(sessions).length;
            totalSessions += sessionCount;

            const sessionItems = Object.entries(sessions).map(([fingerprint, info]) => {
                // Determine if this session is the Admin using strictly logic or just observation
                // We don't know "current" session here easily unless we passed strict fingerprint, 
                // but we can show details.
                const lastActive = info.lastActiveAt ? new Date(info.lastActiveAt.seconds * 1000).toLocaleString() : 'Unknown';

                return `
                    <div style="background: rgba(255,255,255,0.03); padding: 10px; border-radius: 6px; margin-top: 5px; display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--border-color);">
                        <div style="font-size: 0.85rem;">
                            <div style="color: var(--text-primary); font-weight: 500;">
                                📍 ${info.location || 'Unknown Location'} 
                                <span style="opacity: 0.5; font-size: 0.75rem;">(${info.ip})</span>
                            </div>
                            <div style="color: var(--text-secondary); font-size: 0.75rem;">Last Active: ${lastActive}</div>
                            <div style="color: var(--text-muted); font-size: 0.7rem; font-family: monospace;">ID: ${fingerprint.substring(0, 8)}...</div>
                        </div>
                        <button onclick="window.settingsSecurityController.killSession('${user.uid}', '${fingerprint}', '${user.role}')" 
                                style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">
                            Kill Session
                        </button>
                    </div>
                `;
            }).join('');

            return `
                <div class="user-session-card" style="background: var(--bg-card); padding: 15px; border-radius: 8px; border: 1px solid var(--border-color);">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: 600; color: var(--text-primary); font-size: 1rem;">${this.escapeHtml(user.email || user.uid)}</div>
                            <div style="display: flex; gap: 8px; margin-top: 4px;">
                                <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role}</span>
                                <span class="badge" style="background: #3b82f6;">${sessionCount} Device${sessionCount !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    <div class="session-list">
                        ${sessionItems}
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = html || '<div style="text-align: center; color: var(--text-muted);">No active sessions found.</div>';

        // Update Stats
        document.getElementById('stat-active-users').textContent = this.activeSessions.length;
        document.getElementById('stat-total-sessions').textContent = totalSessions;
    }

    renderLogs() {
        const container = document.getElementById('logs-list');
        if (!container) return;

        const html = this.auditLogs.map(log => {
            const time = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'N/A';
            return `
                <tr style="border-bottom: 1px solid var(--border-color);">
                    <td style="padding: 10px; color: var(--text-secondary);">${time}</td>
                    <td style="padding: 10px;">
                        <div style="color: var(--text-primary); font-weight: 500;">${this.escapeHtml(log.email)}</div>
                        <div style="font-size: 0.75rem; color: var(--text-muted);">${log.role}</div>
                    </td>
                    <td style="padding: 10px;">
                        <span class="badge" style="background: rgba(255,255,255,0.1);">${log.action}</span>
                    </td>
                    <td style="padding: 10px;">
                         <div>${this.escapeHtml(log.location || 'Unknown')}</div>
                         <div style="font-size: 0.75rem; color: var(--text-muted);">${log.ip}</div>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = html || '<tr><td colspan="4" style="text-align: center; padding: 20px;">No logs found.</td></tr>';
    }

    async killSession(uid, fingerprint, role) {
        if (!confirm(`Are you sure you want to forcibly logout this device?\nThe user will be blocked immediately.`)) return;

        try {
            const userRef = doc(db, 'users', uid);
            const updatePayload = {
                [`activeSessions.${fingerprint}`]: deleteField()
            };

            if (role === 'admin') {
                updatePayload['authorizedDevices'] = arrayRemove(fingerprint);
            } else {
                // For users, we clear the single authorizedDevice field if it matches
                // But we can't conditionally update in strict Firestore. 
                // We just check if we should clear it.
                // Simpler: Just clear valid active session. The Traitor Check will fail next time if we remove it from authorizedDevice.
                // However, authorizedDevice is a string. Can't use arrayRemove.
                // We will rely on deleting the activeSession to show it's gone in UI, 
                // AND we must invalidate the "Lock". 
                // Since we can't easily check "if current == fingerprint" in an update, 
                // We might wipe it. But that risks wiping a NEW login if race condition.
                // SAFE BET: Just delete activeSession for now, and rely on Admin to use "Authorized Users" list to ban access if needed.
                // BUT, to truly "Kill", we must break the Hardware Lock.
                // Let's assume we want to break the lock.
                updatePayload['authorizedDevice'] = deleteField(); // Brutal but effective. They have to re-login.
            }

            await updateDoc(userRef, updatePayload);
            Toast.success("Session Killed. Device Lock Broken.");

            // Refresh
            await this.loadActiveSessions();
            this.renderSessions();

        } catch (error) {
            console.error("Kill Session Failed:", error);
            Toast.error("Failed to kill session: " + error.message);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

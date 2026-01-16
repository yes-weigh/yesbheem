import { db } from '../services/firebase_config.js';
import { collection, onSnapshot, query, doc, updateDoc, deleteField, arrayRemove, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Toast } from '../utils/toast.js';

export class SecurityDashboardView {
    constructor() {
        this.overlay = null;
        this.unsubscribe = null;
        this.logsUnsubscribe = null;
        this.activeSessions = [];
        this.activityLogs = [];
        this.currentTab = 'sessions';
        this.currentFilter = 'all';
        this.isLoading = false;
        this.map = null;
    }

    mount() {
        this.renderOverlay();
        this.subscribe();
        this.subscribeToActivityLogs();
    }

    unmount() {
        if (this.unsubscribe) this.unsubscribe();
        if (this.logsUnsubscribe) this.logsUnsubscribe();
        if (this.overlay) this.overlay.remove();
        this.overlay = null;
    }

    renderOverlay() {
        // First, inject the CSS into the document head
        const styleId = 'security-dashboard-styles';
        if (!document.getElementById(styleId)) {
            const styleEl = document.createElement('style');
            styleEl.id = styleId;
            styleEl.textContent = `
                .security-overlay {
                    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                    background: rgba(0, 0, 0, 0.85);
                    backdrop-filter: blur(8px);
                    z-index: 2000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-family: 'Inter', sans-serif;
                }
                .security-container {
                    background: #0f172a;
                    width: 95vw;
                    height: 90vh;
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .security-header {
                    padding: 20px 30px;
                    background: rgba(30, 41, 59, 0.5);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .header-left { display: flex; gap: 16px; align-items: center; }
                .shield-icon { font-size: 2rem; }
                .security-header h2 { margin: 0; color: #fff; font-size: 1.5rem; }
                .security-header p { margin: 0; color: #94a3b8; font-size: 0.9rem; }
                .close-btn {
                    background: none; border: none; color: #cbd5e1; font-size: 2rem; cursor: pointer;
                    line-height: 1; padding: 0;
                }
                .close-btn:hover { color: #fff; }

                .security-body {
                    flex: 1;
                    display: flex;
                    overflow: hidden;
                }
                .security-sidebar {
                    width: 300px;
                    background: #1e293b;
                    padding: 20px;
                    border-right: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .stat-box {
                    background: rgba(255,255,255,0.03);
                    padding: 16px;
                    border-radius: 8px;
                    border: 1px solid rgba(255,255,255,0.05);
                }
                .stat-box.active-users { border-left: 4px solid #10b981; }
                .stat-box.total-sessions { border-left: 4px solid #3b82f6; }
                .stat-box label { display: block; font-size: 0.8rem; color: #94a3b8; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
                .stat-box span { font-size: 1.8rem; font-weight: 700; color: #fff; }

                .security-main {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    background: #0f172a;
                }
                .security-map {
                    height: 40%;
                    background: #020617;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    position: relative;
                }
                .session-feed {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                .feed-header {
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .feed-header h3 { margin: 0; color: #e2e8f0; font-size: 1.1rem; }
                .live-indicator { color: #ef4444; font-weight: 600; font-size: 0.8rem; animation: pulse 2s infinite; }
                @keyframes pulse { 0% { opacity: 1; } 50% { opacity: 0.5; } 100% { opacity: 1; } }

                .session-list-container {
                    flex: 1;
                    overflow-y: auto;
                    padding: 20px;
                }
                
                .session-row {
                    display: flex;
                    align-items: center;
                    padding: 12px 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid rgba(255,255,255,0.03);
                    border-radius: 8px;
                    margin-bottom: 8px;
                    transition: all 0.2s;
                }
                .session-row:hover { background: rgba(255,255,255,0.04); }
                .row-user { flex: 1; }
                .user-name { font-weight: 600; color: #e2e8f0; }
                .user-meta { font-size: 0.8rem; color: #94a3b8; display: flex; gap: 8px; align-items: center; }
                .row-location { width: 200px; color: #cbd5e1; font-size: 0.9rem; }
                .row-actions { margin-left: 16px; }
                
                .kill-btn {
                    padding: 6px 12px;
                    background: rgba(239, 68, 68, 0.1);
                    color: #ef4444;
                    border: 1px solid rgba(239, 68, 68, 0.2);
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                }
                .kill-btn:hover { background: rgba(239, 68, 68, 0.2); }
                
                .badge { padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; text-transform: uppercase; }
                .badge-admin { background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
                .badge-user { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }

                .loading-state { text-align: center; padding: 40px; color: #64748b; font-family: monospace; }

                /* Tab Navigation */
                .tab-navigation {
                    display: flex;
                    gap: 4px;
                    padding: 16px 24px 0;
                    background: #0f172a;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .tab-btn {
                    background: transparent;
                    border: none;
                    color: #94a3b8;
                    padding: 12px 20px;
                    cursor: pointer;
                    font-size: 0.9rem;
                    font-weight: 500;
                    border-bottom: 2px solid transparent;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .tab-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.02); }
                .tab-btn.active {
                    color: #fff;
                    border-bottom-color: #3b82f6;
                }
                .tab-btn span { font-size: 1.1rem; }

                .tab-content { display: none; flex: 1; flex-direction: column; overflow: hidden; }
                .tab-content.active { display: flex; }

                /* Activity Logs */
                .logs-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    background: #0f172a;
                }
                .logs-header {
                    padding: 16px 24px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .logs-header h3 { margin: 0; color: #e2e8f0; font-size: 1.1rem; }
                .logs-filters {
                    display: flex;
                    gap: 8px;
                }
                .filter-btn {
                    padding: 6px 14px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.08);
                    color: #94a3b8;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 0.8rem;
                    transition: all 0.2s;
                }
                .filter-btn:hover { background: rgba(255,255,255,0.06); color: #e2e8f0; }
                .filter-btn.active {
                    background: rgba(59, 130, 246, 0.2);
                    border-color: #3b82f6;
                    color: #60a5fa;
                }

                .logs-table-wrapper {
                    flex: 1;
                    overflow-y: auto;
                    padding: 0 24px 24px;
                }
                .logs-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .logs-table thead {
                    position: sticky;
                    top: 0;
                    background: #1e293b;
                    z-index: 10;
                }
                .logs-table th {
                    padding: 12px;
                    text-align: left;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .logs-table td {
                    padding: 12px;
                    color: #cbd5e1;
                    font-size: 0.85rem;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .logs-table tbody tr:hover {
                    background: rgba(255,255,255,0.02);
                }
                .log-time { color: #94a3b8; font-family: monospace; font-size: 0.8rem; }
                .log-user { font-weight: 500; color: #e2e8f0; }
                .log-action {
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    display: inline-block;
                }
                .log-action.login { background: rgba(16, 185, 129, 0.2); color: #10b981; }
                .log-action.logout { background: rgba(245, 158, 11, 0.2); color: #f59e0b; }
                .log-action.security { background: rgba(239, 68, 68, 0.2); color: #ef4444; }
                .log-device { font-family: monospace; font-size: 0.75rem; opacity: 0.7; }
                .log-location { color: #94a3b8; }
                .log-ip { font-family: monospace; font-size: 0.75rem; color: #64748b; }
            `;
            document.head.appendChild(styleEl);
        }

        // Then create the HTML structure without the style tag
        const html = `
            <div id="security-dashboard-overlay" class="security-overlay">
                <div class="security-container">
                    <div class="security-header">
                        <div class="header-left">
                            <div class="shield-icon">🛡️</div>
                            <div>
                                <h2>Security Command Center</h2>
                                <p>Real-time Session Monitoring & Threat Detection</p>
                            </div>
                        </div>
                        <button id="close-security-dashboard" class="close-btn">&times;</button>
                    </div>

                    <div class="security-body">
                        <!-- Left Panel: Stats & Controls -->
                        <div class="security-sidebar">
                            <div class="stat-box active-users">
                                <label>Active Users</label>
                                <span id="sec-stat-users">0</span>
                            </div>
                            <div class="stat-box total-sessions">
                                <label>Connected Devices</label>
                                <span id="sec-stat-sessions">0</span>
                            </div>
                            
                            <div class="chart-container">
                                <canvas id="activityChart"></canvas>
                            </div>
                        </div>

                        <!-- Main Panel: Tabs & Content -->
                        <div class="security-main">
                            <!-- Tab Navigation -->
                            <div class="tab-navigation">
                                <button class="tab-btn active" data-tab="sessions" id="tab-btn-sessions">
                                    <span>📊</span> Active Sessions
                                </button>
                                <button class="tab-btn" data-tab="logs" id="tab-btn-logs">
                                    <span>📜</span> Activity Logs
                                </button>
                            </div>

                            <!-- Sessions Tab -->
                            <div id="tab-sessions" class="tab-content active">
                                <!-- Map Placeholder -->
                                <div id="security-map" class="security-map"></div>

                                <!-- Session List -->
                                <div class="session-feed">
                                    <div class="feed-header">
                                        <h3>Active Sessions</h3>
                                        <span class="live-indicator">● LIVE</span>
                                    </div>
                                    <div id="sec-session-list" class="session-list-container">
                                        <div class="loading-state">Initializing Satellite Uplink...</div>
                                    </div>
                                </div>
                            </div>

                            <!-- Activity Logs Tab -->
                            <div id="tab-logs" class="tab-content">
                                <div class="logs-container">
                                    <div class="logs-header">
                                        <h3>Activity Logs</h3>
                                        <div class="logs-filters">
                                            <button class="filter-btn active" data-filter="all">All</button>
                                            <button class="filter-btn" data-filter="login">Logins</button>
                                            <button class="filter-btn" data-filter="security">Security Events</button>
                                        </div>
                                    </div>
                                    <div class="logs-table-wrapper">
                                        <table class="logs-table">
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>User</th>
                                                    <th>Action</th>
                                                    <th>Device</th>
                                                    <th>Location</th>
                                                    <th>IP</th>
                                                </tr>
                                            </thead>
                                            <tbody id="logs-list">
                                                <tr><td colspan="6" class="loading-state">Loading activity logs...</td></tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const div = document.createElement('div');
        div.innerHTML = html;
        this.overlay = div.firstElementChild;
        document.body.appendChild(this.overlay);

        // Event listeners
        document.getElementById('close-security-dashboard').onclick = () => this.unmount();

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.onclick = () => this.switchTab(btn.dataset.tab);
        });

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = () => this.setFilter(btn.dataset.filter);
        });
    }

    switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === `tab-${tabName}`);
        });
    }

    setFilter(filterType) {
        this.currentFilter = filterType;

        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === filterType);
        });

        // Re-render logs with filter
        this.updateActivityLogsUI();
    }

    subscribe() {
        // ROBUST FETCH: Listen to ALL users, filter client-side activeSessions
        // This avoids index issues and specific 'active' field dependencies
        const q = collection(db, "users");

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            this.activeSessions = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                data.uid = doc.id;

                // Convert flat keys to nested object structure
                // Firestore stores as: "activeSessions.fingerprint": {...}
                // We need: activeSessions: { fingerprint: {...} }
                const activeSessions = {};
                Object.keys(data).forEach(key => {
                    if (key.startsWith('activeSessions.')) {
                        const fingerprint = key.replace('activeSessions.', '');
                        activeSessions[fingerprint] = data[key];
                    }
                });

                // CLIENT-SIDE FILTER
                if (Object.keys(activeSessions).length > 0) {
                    data.activeSessions = activeSessions;
                    this.activeSessions.push(data);
                }
            });
            this.updateUI();
        });
    }

    updateUI() {
        // Update Stats
        let totalSessions = 0;
        this.activeSessions.forEach(u => {
            totalSessions += Object.keys(u.activeSessions).length;
        });

        const usersEl = document.getElementById('sec-stat-users');
        const sessEl = document.getElementById('sec-stat-sessions');
        if (usersEl) usersEl.textContent = this.activeSessions.length;
        if (sessEl) sessEl.textContent = totalSessions;

        // Render List
        const listContainer = document.getElementById('sec-session-list');
        if (listContainer) {
            if (this.activeSessions.length === 0) {
                listContainer.innerHTML = '<div class="loading-state">No Active Sessions Detected. System Secure.</div>';
                return;
            }

            listContainer.innerHTML = this.activeSessions.map(user => {
                // For each session
                return Object.entries(user.activeSessions).map(([fingerprint, info]) => {
                    const time = info.lastActiveAt ? new Date(info.lastActiveAt.seconds * 1000).toLocaleTimeString() : 'Unknown';
                    const ip = info.ip || 'Unknown IP';
                    const loc = info.location || 'Unknown Location';

                    return `
                        <div class="session-row">
                            <div class="row-user">
                                <div class="user-name">${this.escapeHtml(user.email || user.uid)}</div>
                                <div class="user-meta">
                                    <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role || 'User'}</span>
                                    <span>Last signal: ${time}</span>
                                    <span style="font-family:monospace; opacity:0.6">${fingerprint.substring(0, 8)}</span>
                                </div>
                            </div>
                            <div class="row-location">
                                <div>${this.escapeHtml(loc)}</div>
                                <div style="font-size:0.75rem; color:#64748b; font-family:monospace">${ip}</div>
                            </div>
                            <div class="row-actions">
                                <button class="kill-btn" onclick="window.securityDashboard.killSession('${user.uid}', '${fingerprint}', '${user.role || 'user'}')">
                                    Terminating Protocol
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }).join('');
        }
    }

    subscribeToActivityLogs() {
        const logsQuery = query(
            collection(db, "user_activity_logs"),
            orderBy("timestamp", "desc"),
            limit(50)
        );

        this.logsUnsubscribe = onSnapshot(logsQuery, (snapshot) => {
            this.activityLogs = [];
            snapshot.forEach(doc => {
                this.activityLogs.push({ id: doc.id, ...doc.data() });
            });
            this.updateActivityLogsUI();
        });
    }

    updateActivityLogsUI() {
        const logsList = document.getElementById('logs-list');
        if (!logsList) return;

        // Filter logs based on current filter
        let filteredLogs = this.activityLogs;
        if (this.currentFilter === 'login') {
            filteredLogs = this.activityLogs.filter(log => log.action === 'LOGIN');
        } else if (this.currentFilter === 'security') {
            filteredLogs = this.activityLogs.filter(log =>
                log.action === 'UNAUTHORIZED_DEVICE_ATTEMPT' || log.action.includes('SECURITY')
            );
        }

        if (filteredLogs.length === 0) {
            logsList.innerHTML = '<tr><td colspan="6" class="loading-state">No activity logs found.</td></tr>';
            return;
        }

        logsList.innerHTML = filteredLogs.map(log => {
            const time = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString() : 'Unknown';
            const actionClass = log.action === 'LOGIN' ? 'login' :
                (log.action === 'LOGOUT' ? 'logout' : 'security');
            const deviceId = log.deviceFingerprint ? log.deviceFingerprint.substring(0, 8) : 'N/A';

            return `
                <tr>
                    <td class="log-time">${time}</td>
                    <td class="log-user">${this.escapeHtml(log.email || 'Unknown')}</td>
                    <td><span class="log-action ${actionClass}">${log.action}</span></td>
                    <td class="log-device">${deviceId}</td>
                    <td class="log-location">${this.escapeHtml(log.location || 'Unknown')}</td>
                    <td class="log-ip">${log.ip || 'N/A'}</td>
                </tr>
            `;
        }).join('');
    }

    async killSession(uid, fingerprint, role) {
        if (!confirm('CONFIRM TERMINATION: Force logout this device?')) return;

        try {
            console.log(`[Security Dashboard] Terminating session: uid=${uid}, fingerprint=${fingerprint}, role=${role}`);

            const userRef = doc(db, 'users', uid);
            const updatePayload = {
                [`activeSessions.${fingerprint}`]: deleteField()
            };

            // Clean up authorized devices based on role
            if (role === 'admin') {
                updatePayload['authorizedDevices'] = arrayRemove(fingerprint);
            } else {
                // For regular users, clear the single authorized device
                updatePayload['authorizedDevice'] = deleteField();
            }

            await updateDoc(userRef, updatePayload);
            console.log('[Security Dashboard] Session terminated successfully');
            Toast.success("Target Neutralized.");

            // Force UI refresh by manually triggering updateUI
            // The onSnapshot should handle this, but we'll force it just in case
            setTimeout(() => this.updateUI(), 500);
        } catch (error) {
            console.error('[Security Dashboard] Termination failed:', error);
            alert(`Termination Failed: ${error.message}`);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}

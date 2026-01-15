import { db } from '../services/firebase_config.js';
import { collection, onSnapshot, query, doc, updateDoc, deleteField, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Toast } from '../utils/toast.js';

export class SecurityDashboardView {
    constructor() {
        this.overlay = null;
        this.unsubscribe = null;
        this.activeSessions = [];
        this.isLoading = false;
        this.map = null;
    }

    mount() {
        this.renderOverlay();
        this.subscribe();
    }

    unmount() {
        if (this.unsubscribe) this.unsubscribe();
        if (this.overlay) this.overlay.remove();
        this.overlay = null;
    }

    renderOverlay() {
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
                                <label>Total Sessions</label>
                                <span id="sec-stat-sessions">0</span>
                            </div>
                            
                            <div class="chart-container">
                                <canvas id="activityChart"></canvas>
                            </div>
                        </div>

                        <!-- Main Panel: Map & List -->
                        <div class="security-main">
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
                    </div>
                </div>
            </div>
            <style>
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
            </style>
        `;

        const div = document.createElement('div');
        div.innerHTML = html;
        this.overlay = div.firstElementChild;
        document.body.appendChild(this.overlay);

        document.getElementById('close-security-dashboard').onclick = () => this.unmount();
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

                // CLIENT-SIDE FILTER
                if (data.activeSessions && Object.keys(data.activeSessions).length > 0) {
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
                                <button class="kill-btn" onclick="window.securityDashboard.killSession('${user.uid}', '${fingerprint}', '${user.role}')">
                                    Terminating Protocol
                                </button>
                            </div>
                        </div>
                    `;
                }).join('');
            }).join('');
        }
    }

    async killSession(uid, fingerprint, role) {
        if (!confirm('CONFIRM TERMINATION: Force logout this device?')) return;

        try {
            const userRef = doc(db, 'users', uid);
            const updatePayload = {
                [`activeSessions.${fingerprint}`]: deleteField()
            };

            if (role === 'admin') {
                updatePayload['authorizedDevices'] = arrayRemove(fingerprint);
            } else {
                updatePayload['authorizedDevice'] = deleteField();
            }

            await updateDoc(userRef, updatePayload);
            Toast.success("Target Neutralized.");
            // Subscription will auto-update UI
        } catch (error) {
            console.error(error);
            alert("Termination Failed: " + error.message);
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
}

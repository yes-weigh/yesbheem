
import { db } from '../services/firebase_config.js';
import { collection, doc, getDocs, setDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { Toast } from '../utils/toast.js';

export class SettingsUsersController {
    constructor() {
        this.users = [];
        this.isLoading = false;
        this.container = document.getElementById('authorized-users-list');
        this.init();
    }

    async init() {
        console.log('SettingsUsersController Initialized');
        // We will call this from the main SettingsController or just expose a method
    }

    async loadUsers() {
        this.setLoading(true);
        try {
            const querySnapshot = await getDocs(collection(db, "authorized_users"));
            this.users = [];
            querySnapshot.forEach((doc) => {
                this.users.push({ email: doc.id, ...doc.data() });
            });
            this.render();
            this.updateCount();
        } catch (error) {
            console.error("Error loading users:", error);
            Toast.error("Failed to load users.");
        } finally {
            this.setLoading(false);
        }
    }

    setLoading(loading) {
        this.isLoading = loading;
        const spinner = document.getElementById('users-loading-spinner');
        if (spinner) spinner.style.display = loading ? 'block' : 'none';
    }

    render() {
        const list = document.getElementById('authorized-users-list');
        if (!list) return;

        if (this.users.length === 0) {
            list.innerHTML = '<div class="empty-state">No authorized users found.</div>';
            return;
        }

        list.innerHTML = this.users.map(user => `
            <div class="list-item user-item">
                <div class="user-info">
                    <span class="user-email">${this.escapeHtml(user.email)}</span>
                    <span class="user-phone">${this.escapeHtml(user.phone)}</span>
                    <span class="user-role badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
                        ${this.escapeHtml(user.role || 'user')}
                    </span>
                </div>
                <div class="actions">
                    <button class="delete-btn" onclick="window.settingsUsersController.handleDeleteUser('${this.escapeHtml(user.email)}')" title="Revoke Access">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    async handleAddUser(email, phone, role) {
        if (!email || !phone) {
            Toast.error("Email and Phone are required.");
            return;
        }

        // Basic Email Regex
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            Toast.error("Invalid email format.");
            return;
        }

        this.setLoading(true);
        try {
            await setDoc(doc(db, "authorized_users", email), {
                phone: phone,
                role: role || 'user',
                addedAt: new Date().toISOString(),
                active: true
            });
            Toast.success(`User ${email} authorized.`);
            await this.loadUsers();
            return true; // Success
        } catch (error) {
            console.error("Error adding user:", error);
            Toast.error("Failed to authorize user: " + error.message);
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    async handleDeleteUser(email) {
        if (!confirm(`Are you sure you want to revoke access for ${email}?`)) return;

        this.setLoading(true);
        try {
            await deleteDoc(doc(db, "authorized_users", email));
            Toast.success(`Access revoked for ${email}`);
            await this.loadUsers();
        } catch (error) {
            console.error("Error deleting user:", error);
            Toast.error("Failed to delete user.");
        } finally {
            this.setLoading(false);
        }
    }

    updateCount() {
        const badge = document.getElementById('users-count');
        if (badge) badge.textContent = `${this.users.length} users`;
    }

    openManageModal() {
        // Dynamic Modal Creation similar to SettingsController
        const modalHtml = `
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Manage Authorized Users</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('users-modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="add-user-form" style="margin-bottom: 20px; padding: 15px; background: rgba(255,255,255,0.05); border-radius: 8px;">
                        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 10px; margin-bottom: 10px;">
                            <input type="email" id="new-user-email" class="modern-input" placeholder="Email Address">
                            <input type="text" id="new-user-phone" class="modern-input" placeholder="Phone (91XXXXXXXXXX)">
                            <select id="new-user-role" class="modern-input">
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <button id="add-user-btn" class="add-btn" style="width: 100%;">Authorize User</button>
                    </div>
                    <div id="users-loading-spinner" style="display:none; text-align:center; padding:10px;">Loading...</div>
                    <div class="data-list" id="authorized-users-list"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="document.getElementById('users-modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'users-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = modalHtml;
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
        document.body.appendChild(overlay);

        // Bind Events
        document.getElementById('add-user-btn').onclick = async () => {
            const email = document.getElementById('new-user-email').value.trim();
            const phone = document.getElementById('new-user-phone').value.trim();
            const role = document.getElementById('new-user-role').value;
            const success = await this.handleAddUser(email, phone, role);
            if (success) {
                document.getElementById('new-user-email').value = '';
                document.getElementById('new-user-phone').value = '';
            }
        };

        this.loadUsers();
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

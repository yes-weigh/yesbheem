
import { db, storage } from '../services/firebase_config.js';
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { Toast } from '../utils/toast.js';

export class SettingsUsersController {
    constructor() {
        this.users = [];
        this.isLoading = false;
        this.init();
    }

    async init() {
        console.log('SettingsUsersController Initialized');
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
            list.innerHTML = '<div class="empty-state" style="padding: 20px; text-align: center; color: var(--text-secondary);">No authorized users found.</div>';
            return;
        }

        list.innerHTML = this.users.map(user => `
            <div class="list-item user-item" style="padding: 12px 16px; margin-bottom: 8px; border-radius: 12px; border: 1px solid var(--border-color);">
                <div class="user-info" style="display: flex; align-items: center; gap: 16px; flex: 1;">
                    ${this.renderAvatar(user)}
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <span class="user-email" style="font-weight: 600; font-size: 0.95rem; color: var(--text-primary);">${this.escapeHtml(user.displayName || user.email)}</span>
                        <div style="display: flex; gap: 10px; align-items: center; font-size: 0.8rem; color: var(--text-secondary);">
                            <span>${this.escapeHtml(user.email)}</span>
                            <span style="opacity: 0.5;">•</span>
                            <span>${this.escapeHtml(user.phone)}</span>
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <span class="user-role badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">
                        ${this.escapeHtml(user.role || 'user')}
                    </span>
                    <div class="actions" style="display: flex; gap: 8px;">
                         <button class="edit-btn" onclick="window.settingsUsersController.openEditUserModal('${this.escapeHtml(user.email)}')" title="Edit User">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                 <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                 <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="delete-btn" onclick="window.settingsUsersController.handleDeleteUser('${this.escapeHtml(user.email)}')" title="Revoke Access">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    renderAvatar(user) {
        if (user.photoURL) {
            return `<img src="${this.escapeHtml(user.photoURL)}" alt="Avatar" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border-color);">`;
        }
        const initial = (user.displayName || user.email).charAt(0).toUpperCase();
        return `<div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary-color), #7C3AED); color: #fff; display: flex; align-items: center; justify-content: center; font-size: 1rem; font-weight: bold; border: 2px solid rgba(255,255,255,0.1); box-shadow: 0 2px 5px rgba(0,0,0,0.2);">${initial}</div>`;
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
                active: true,
                displayName: email.split('@')[0] // Default display name
            });
            Toast.success(`User ${email} authorized.`);
            await this.loadUsers();
            return true;
        } catch (error) {
            console.error("Error adding user:", error);
            Toast.error("Failed to authorize user: " + error.message);
            return false;
        } finally {
            this.setLoading(false);
        }
    }

    async handleUpdateUser(email, data, file) {
        this.setLoading(true);
        try {
            let photoURL = data.photoURL;

            // Upload Image if present
            if (file) {
                const storageRef = ref(storage, `user_avatars/${email}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                photoURL = await getDownloadURL(storageRef);
            }

            await updateDoc(doc(db, "authorized_users", email), {
                ...data,
                photoURL: photoURL || null
            });

            Toast.success("User updated successfully.");
            // Update local state if needed, or just reload
            await this.loadUsers();

            // Close the specific edit modal
            const editModal = document.getElementById('edit-user-modal-overlay');
            if (editModal) editModal.remove();

        } catch (error) {
            console.error("Error updating user:", error);
            Toast.error("Update failed: " + error.message);
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
        const modalHtml = `
            <div class="modal" onclick="event.stopPropagation()" style="width: 800px; max-width: 95vw;">
                <div class="modal-header">
                    <h3>Manage Authorized Users</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('users-modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="add-user-form" style="margin-bottom: 24px; padding: 20px; background: rgba(255, 255, 255, 0.03); border: 1px solid var(--border-color); border-radius: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                            <h4 style="margin: 0; font-size: 0.95rem; color: var(--text-primary); font-weight: 600;">Add New User</h4>
                        </div>
                        <div style="display: flex; gap: 12px; align-items: flex-end; flex-wrap: wrap;">
                            <div style="flex: 2; min-width: 200px; display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 4px;">Email</label>
                                <input type="email" id="new-user-email" class="modern-input" placeholder="user@example.com" style="background: rgba(0,0,0,0.3); border-color: var(--border-color);">
                            </div>
                            <div style="flex: 1.5; min-width: 160px; display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 4px;">Phone</label>
                                <input type="text" id="new-user-phone" class="modern-input" placeholder="91XXXXXXXXXX" style="background: rgba(0,0,0,0.3); border-color: var(--border-color);">
                            </div>
                            <div style="flex: 1; min-width: 120px; display: flex; flex-direction: column; gap: 6px;">
                                <label style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 4px;">Role</label>
                                <select id="new-user-role" class="modern-input" style="background: rgba(0,0,0,0.3); border-color: var(--border-color);">
                                    <option value="user">User</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div style="flex: 0 0 auto; display: flex; flex-direction: column; gap: 6px;">
                                <button id="add-user-btn" class="add-btn" style="width: 42px; height: 42px;" title="Authorize User">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div id="users-loading-spinner" style="display:none; text-align:center; padding:10px;">Loading...</div>
                    <div class="data-list" id="authorized-users-list" style="padding-right: 8px;"></div>
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

    openEditUserModal(email) {
        const user = this.users.find(u => u.email === email);
        if (!user) return;

        const modalHtml = `
            <div class="modal" onclick="event.stopPropagation()" style="width: 500px;">
                <div class="modal-header">
                    <h3>Edit User: ${this.escapeHtml(email)}</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('edit-user-modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div style="display: flex; flex-direction: column; gap: 15px;">
                        <!-- Avatar Preview -->
                        <div style="text-align: center;">
                            <div class="avatar-preview" style="width: 80px; height: 80px; border-radius: 50%; background: #333; margin: 0 auto; overflow: hidden; display: flex; align-items: center; justify-content: center;">
                                ${user.photoURL ? `<img src="${user.photoURL}" style="width:100%; height:100%; object-fit:cover;">` : `<span style="font-size: 2rem;">${(user.displayName || email).charAt(0).toUpperCase()}</span>`}
                            </div>
                            <input type="file" id="edit-user-avatar" accept="image/*" style="margin-top: 10px; font-size: 0.8rem;">
                        </div>

                        <div>
                            <label style="font-size: 0.8rem; color: var(--text-secondary);">Display Name</label>
                            <input type="text" id="edit-user-name" class="modern-input" value="${this.escapeHtml(user.displayName || '')}" placeholder="Full Name">
                        </div>

                        <div>
                            <label style="font-size: 0.8rem; color: var(--text-secondary);">Phone Number</label>
                            <input type="text" id="edit-user-phone" class="modern-input" value="${this.escapeHtml(user.phone || '')}">
                        </div>

                        <div>
                            <label style="font-size: 0.8rem; color: var(--text-secondary);">Role</label>
                            <select id="edit-user-role" class="modern-input">
                                <option value="user" ${user.role === 'user' ? 'selected' : ''}>User</option>
                                <option value="admin" ${user.role === 'admin' ? 'selected' : ''}>Admin</option>
                            </select>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="document.getElementById('edit-user-modal-overlay').remove()">Cancel</button>
                    <button id="save-user-btn" class="add-btn" style="width: auto; padding: 0 20px;">Save Changes</button>
                </div>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'edit-user-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.style.zIndex = '10000'; // Above the other modal
        overlay.innerHTML = modalHtml;
        overlay.onclick = (e) => {
            if (e.target === overlay) overlay.remove();
        };
        document.body.appendChild(overlay);

        // Bind Save
        document.getElementById('save-user-btn').onclick = () => {
            const newName = document.getElementById('edit-user-name').value.trim();
            const newPhone = document.getElementById('edit-user-phone').value.trim();
            const newRole = document.getElementById('edit-user-role').value;
            const fileInput = document.getElementById('edit-user-avatar');
            const file = fileInput.files[0];

            this.handleUpdateUser(email, {
                displayName: newName,
                phone: newPhone,
                role: newRole,
                photoURL: user.photoURL // Keep existing unless overwritten by new logic or if file uploaded
            }, file);
        };
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

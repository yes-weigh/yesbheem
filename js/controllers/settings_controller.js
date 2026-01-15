import { db, storage } from '../services/firebase_config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

/**
 * SettingsController
 * Manages Key Accounts and Dealer Stages using Firestore
 */
export class SettingsController {
    constructor() {
        this.keyAccounts = [];
        this.dealerStages = [];
        this.dealerCategories = [];
        this.instanceGroups = [];
        this.isLoading = false;

        // DOM Elements
        this.deactivatedList = null;
        this.addKeyAccountInput = null;
        this.addDealerStageInput = null;
        this.addCategoryInput = null;
        this.addGroupInput = null;

        this.init();
    }

    async init() {
        console.log('Settings Controller Initialized');
        await this.loadData();
        this.setupEventListeners();
        this.renderAll();
        this.updateBadges();
    }

    setupEventListeners() {
        // Listeners for Global Modal close are handled in openManageModal

        // Inject Hidden File Input for Image Upload
        if (!document.getElementById('hidden-kam-upload')) {
            const input = document.createElement('input');
            input.type = 'file';
            input.id = 'hidden-kam-upload';
            input.accept = 'image/*';
            input.style.display = 'none';
            document.body.appendChild(input);

            input.addEventListener('change', (e) => this.handleFileSelect(e));
        }
    }

    /**
     * Fetch settings data from Firestore
     */
    async loadData() {
        this.setLoading(true);
        try {
            const docRef = doc(db, "settings", "general");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                this.keyAccounts = data.key_accounts || [];
                this.dealerStages = data.dealer_stages || [];
                this.keyAccounts = data.key_accounts || [];
                this.dealerStages = data.dealer_stages || [];
                this.dealerCategories = data.dealer_categories || [];
                this.instanceGroups = data.instance_groups || [];
                this.keyAccounts = data.key_accounts || [];
                this.dealerStages = data.dealer_stages || [];
                this.dealerCategories = data.dealer_categories || [];
                this.keyAccountImages = data.key_account_images || {};
                this.stageImages = data.stage_images || {};
                this.categoryImages = data.category_images || {};
            } else {
                console.log("No settings document found. Creating default...");
                // Initialize defaults
                this.keyAccounts = [];
                this.dealerStages = ['Contacted', 'Interested', 'Negotiation', 'Closed'];
                this.dealerCategories = [];
                this.instanceGroups = [];
                this.keyAccountImages = {}; // Map: Name -> URL
                await setDoc(docRef, {
                    key_accounts: this.keyAccounts,
                    dealer_stages: this.dealerStages,
                    key_accounts: this.keyAccounts,
                    dealer_stages: this.dealerStages,
                    dealer_categories: this.dealerCategories,
                    instance_groups: this.instanceGroups,
                    key_accounts: this.keyAccounts,
                    dealer_stages: this.dealerStages,
                    dealer_categories: this.dealerCategories,
                    key_account_images: this.keyAccountImages,
                    stage_images: {},
                    category_images: {}
                });
            }

            // Load Deactivated Dealers (Separate Document)
            const deactivatedRef = doc(db, "settings", "deactivated_dealers");
            const deactivatedSnap = await getDoc(deactivatedRef);
            if (deactivatedSnap.exists()) {
                this.deactivatedDealers = deactivatedSnap.data().items || [];
            } else {
                this.deactivatedDealers = [];
            }

        } catch (error) {
            console.error("Error loading settings:", error);
            // Fallback for offline/error
            this.keyAccounts = [];
            this.dealerStages = [];
            this.dealerCategories = [];
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Generic Handle Setting Image
     * @param {string} type - 'kam', 'stage', 'category'
     * @param {string} name - Item Name
     */
    async handleSetItemImage(type, name) {
        this.pendingUpload = { type, name };
        const input = document.getElementById('hidden-kam-upload');
        if (input) {
            input.value = ''; // Reset
            input.click();
        }
    }

    /**
     * Handle File Selection -> Resize -> Upload
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file || !this.pendingUpload) return;

        const { type, name } = this.pendingUpload;
        this.pendingUpload = null; // Clear

        try {
            import('../utils/toast.js').then(m => m.Toast.info(`Processing image for ${name}...`));

            // 1. Resize Image
            const resizedBlob = await this.resizeImage(file, 128, 128);

            // 2. Upload to Firebase Storage
            const folder = type === 'kam' ? 'avatars' : (type === 'stage' ? 'stage_icons' : 'category_icons');
            const filename = `${folder}/${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.jpg`;
            const downloadUrl = await this.uploadToStorage(resizedBlob, filename);

            // 3. Save URL to Firestore & Local State
            let fieldKey = '';

            if (type === 'kam') {
                this.keyAccountImages[name] = downloadUrl;
                fieldKey = 'key_account_images';
                this.renderKeyAccounts();
            } else if (type === 'stage') {
                this.stageImages[name] = downloadUrl;
                fieldKey = 'stage_images';
                this.renderDealerStages();
            } else if (type === 'category') {
                this.categoryImages[name] = downloadUrl;
                fieldKey = 'category_images';
                this.renderDealerCategories();
            }

            if (fieldKey) {
                await this.persistImage(fieldKey, name, downloadUrl);
            }

            import('../utils/toast.js').then(m => m.Toast.success('Image uploaded successfully!'));

        } catch (error) {
            console.error('Image upload failed:', error);
            import('../utils/toast.js').then(m => m.Toast.error('Upload failed: ' + error.message));
        }
    }

    /**
     * Generic Remove Image
     */
    async handleRemoveItemImage(type, name) {
        if (!confirm(`Remove image for ${name}?`)) return;

        let currentUrl = null;
        let fieldKey = '';

        if (type === 'kam') {
            currentUrl = this.keyAccountImages[name];
            delete this.keyAccountImages[name];
            fieldKey = 'key_account_images';
            this.renderKeyAccounts();
        } else if (type === 'stage') {
            currentUrl = this.stageImages[name];
            delete this.stageImages[name];
            fieldKey = 'stage_images';
            this.renderDealerStages();
        } else if (type === 'category') {
            currentUrl = this.categoryImages[name];
            delete this.categoryImages[name];
            fieldKey = 'category_images';
            this.renderDealerCategories();
        }

        if (!currentUrl) return;

        try {
            const docRef = doc(db, "settings", "general");
            const update = {};
            update[`${fieldKey}.${name}`] = deleteField();
            await updateDoc(docRef, update);

            // Try to delete from Storage
            try {
                const fileRef = ref(storage, currentUrl);
                await deleteObject(fileRef);
            } catch (e) {
                console.warn('Could not delete from storage:', e);
            }

            import('../utils/toast.js').then(m => m.Toast.success('Image removed'));

        } catch (error) {
            console.error('Failed to remove image:', error);
            import('../utils/toast.js').then(m => m.Toast.error('Failed to remove image'));
        }
    }

    /**
     * Remove KAM Image
     */
    async handleRemoveKAMImage(kamName) {
        if (!confirm(`Remove image for ${kamName}?`)) return;

        const currentUrl = this.keyAccountImages[kamName];
        if (!currentUrl) return;

        try {
            // 1. Remove from Firestore first (for UI responsiveness)
            delete this.keyAccountImages[kamName];
            this.renderKeyAccounts();

            const docRef = doc(db, "settings", "general");
            const update = {};
            update[`key_account_images.${kamName}`] = deleteField();
            await updateDoc(docRef, update);

            // 2. Try to delete from Storage (cleanup)
            // We need to parse the path from the URL or construct it if predictable
            // URL format: .../o/avatars%2Fname_timestamp.jpg?alt=...
            // It's safer to not crash if this fails.
            try {
                // Construct Ref from URL directly is supported by Firebase SDK
                const fileRef = ref(storage, currentUrl);
                await deleteObject(fileRef);
                console.log('Old image deleted from storage');
            } catch (e) {
                console.warn('Could not delete old image from storage (might already be gone):', e);
            }

            import('../utils/toast.js').then(m => m.Toast.success('Image removed'));

        } catch (error) {
            console.error('Failed to remove image:', error);
            import('../utils/toast.js').then(m => m.Toast.error('Failed to remove image'));
            // Revert local state if critical failure
            // this.loadData();
        }
    }

    /**
     * Resize Image using Canvas
     */
    resizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Calculate Aspect Ratio
                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round(height * (maxWidth / width));
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round(width * (maxHeight / height));
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.85); // 85% Quality JPEG
            };
            img.onerror = reject;
        });
    }

    async uploadToStorage(blob, path) {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, blob);
        return await getDownloadURL(snapshot.ref);
    }

    async persistImage(fieldKey, name, url) {
        try {
            const docRef = doc(db, "settings", "general");
            const update = {};
            update[`${fieldKey}.${name}`] = url;
            await updateDoc(docRef, update);
        } catch (error) {
            console.error('Error saving image:', error);
            alert('Failed to save image URL.');
        }
    }

    /**
     * Generic Add Item Handler
     */
    async handleAddItem(listName, inputElement) {
        const value = inputElement.value.trim();
        if (!value) return;

        // Optimistic UI Update
        if (listName === 'keyAccounts') {
            if (this.keyAccounts.includes(value)) {
                alert('This name already exists!');
                return;
            }
            this.keyAccounts.push(value);
            this.renderKeyAccounts();
            this.updateBadges();
            await this.persistItem(listName, value, 'add');
        } else if (listName === 'dealerStages') {
            if (this.dealerStages.includes(value)) {
                alert('This stage already exists!');
                return;
            }
            this.dealerStages.push(value);
            this.renderDealerStages();
            this.updateBadges();
            await this.persistItem(listName, value, 'add');
        } else if (listName === 'dealerCategories') {
            if (this.dealerCategories.includes(value)) {
                alert('This category already exists!');
                return;
            }
            this.dealerCategories.push(value);
            this.renderDealerCategories();
            this.updateBadges();
            this.updateBadges();
            await this.persistItem(listName, value, 'add');
        } else if (listName === 'instanceGroups') {
            if (this.instanceGroups.includes(value)) {
                alert('This group already exists!');
                return;
            }
            this.instanceGroups.push(value);
            this.renderInstanceGroups();
            this.updateBadges();
            await this.persistItem(listName, value, 'add');
        }

        inputElement.value = '';
    }

    /**
     * Generic Remove Item Handler with Integrity Check
     */
    async handleRemoveItem(listName, value) {
        if (!confirm(`Are you sure you want to remove "${value}"?\nThis will remove it from all assigned dealers.`)) return;

        let fieldName = '';
        if (listName === 'keyAccounts') fieldName = 'key_account_manager';
        else if (listName === 'dealerStages') fieldName = 'dealer_stage';
        else if (listName === 'dealerCategories') fieldName = 'categories';

        // 1. Remove from List
        if (listName === 'keyAccounts') {
            this.keyAccounts = this.keyAccounts.filter(item => item !== value);
            this.renderKeyAccounts();
            await this.persistItem(listName, value, 'remove');
        } else if (listName === 'dealerStages') {
            this.dealerStages = this.dealerStages.filter(item => item !== value);
            this.renderDealerStages();
            await this.persistItem(listName, value, 'remove');
        } else if (listName === 'dealerCategories') {
            this.dealerCategories = this.dealerCategories.filter(item => item !== value);
            this.renderDealerCategories();
            await this.persistItem(listName, value, 'remove');
        } else if (listName === 'instanceGroups') {
            this.instanceGroups = this.instanceGroups.filter(item => item !== value);
            this.renderInstanceGroups();
            await this.persistItem(listName, value, 'remove');
        }

        // 2. Cascade Delete to DataManager Overrides
        if (window.dataManager && fieldName) {
            await window.dataManager.bulkUpdateMetadata(fieldName, value, null);
        }
    }

    /**
     * Rename Item Handler with Integrity Check
     */
    async handleRenameItem(listName, oldValue) {
        this.showRenameModal("Rename Item", oldValue, async (newValue) => {
            if (!newValue || newValue === oldValue || !newValue.trim()) return;

            const trimmedValue = newValue.trim();
            let fieldName = '';

            if (listName === 'keyAccounts') {
                if (this.keyAccounts.includes(trimmedValue)) { alert('Name already exists'); return; }
                const idx = this.keyAccounts.indexOf(oldValue);
                if (idx !== -1) {
                    this.keyAccounts[idx] = trimmedValue;
                    this.renderKeyAccounts();
                    await this.persistRename(listName, oldValue, trimmedValue);
                    fieldName = 'key_account_manager';
                }
            } else if (listName === 'dealerStages') {
                if (this.dealerStages.includes(trimmedValue)) { alert('Stage already exists'); return; }
                const idx = this.dealerStages.indexOf(oldValue);
                if (idx !== -1) {
                    this.dealerStages[idx] = trimmedValue;
                    this.renderDealerStages();
                    await this.persistRename(listName, oldValue, trimmedValue);
                    fieldName = 'dealer_stage';
                }
            } else if (listName === 'dealerCategories') {
                if (this.dealerCategories.includes(trimmedValue)) { alert('Category already exists'); return; }
                const idx = this.dealerCategories.indexOf(oldValue);
                if (idx !== -1) {
                    this.dealerCategories[idx] = trimmedValue;
                    this.renderDealerCategories();
                    await this.persistRename(listName, oldValue, trimmedValue);
                    fieldName = 'categories';
                }
            } else if (listName === 'instanceGroups') {
                if (this.instanceGroups.includes(trimmedValue)) { alert('Group already exists'); return; }
                const idx = this.instanceGroups.indexOf(oldValue);
                if (idx !== -1) {
                    this.instanceGroups[idx] = trimmedValue;
                    this.renderInstanceGroups();
                    await this.persistRename(listName, oldValue, trimmedValue);
                    // No cascade for now, or implement if needed
                }
            }

            // Cascade Rename to DataManager
            if (window.dataManager && fieldName) {
                await window.dataManager.bulkUpdateMetadata(fieldName, oldValue, trimmedValue);
            }
        });
    }

    showRenameModal(title, currentValue, onSave) {
        // Remove existing if any
        const existing = document.getElementById('rename-modal');
        if (existing) existing.remove();

        // Create Modal
        const modal = document.createElement('div');
        modal.id = 'rename-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            backdrop-filter: blur(4px);
            opacity: 0;
            transition: opacity 0.2s;
        `;

        modal.innerHTML = `
            <div style="background: var(--bg-panel, #1e293b); padding: 24px; border-radius: 12px; width: 400px; max-width: 90%; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); border: 1px solid var(--border-light, rgba(255,255,255,0.1)); transform: scale(0.95); transition: transform 0.2s;">
                <h3 style="margin: 0 0 16px 0; font-size: 1.1rem; color: var(--text-main, #f8fafc);">${title}</h3>
                <input type="text" id="rename-input" value="${this.escapeHtml(currentValue)}" style="width: 100%; padding: 10px 12px; border-radius: 6px; border: 1px solid var(--border-light, rgba(255,255,255,0.1)); background: var(--bg-input, #0f172a); color: var(--text-main, #f8fafc); margin-bottom: 20px; font-size: 1rem; outline: none;">
                <div style="display: flex; justify-content: flex-end; gap: 10px;">
                    <button id="rename-cancel" style="padding: 8px 16px; border-radius: 6px; border: 1px solid var(--border-light, rgba(255,255,255,0.1)); background: transparent; color: var(--text-muted, #94a3b8); cursor: pointer; font-weight: 500;">Cancel</button>
                    <button id="rename-save" style="padding: 8px 16px; border-radius: 6px; border: none; background: var(--primary-color, #3b82f6); color: white; cursor: pointer; font-weight: 500;">Save</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Animate in
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            const content = modal.firstElementChild;
            content.style.transform = 'scale(1)';
        });

        const input = modal.querySelector('#rename-input');
        const cancelBtn = modal.querySelector('#rename-cancel');
        const saveBtn = modal.querySelector('#rename-save');

        input.focus();
        input.select();

        const close = () => {
            modal.style.opacity = '0';
            modal.firstElementChild.style.transform = 'scale(0.95)';
            setTimeout(() => modal.remove(), 200);
        };

        const save = () => {
            const val = input.value;
            onSave(val);
            close();
        };

        cancelBtn.onclick = close;
        saveBtn.onclick = save;

        input.onkeydown = (e) => {
            if (e.key === 'Enter') save();
            if (e.key === 'Escape') close();
        };

        modal.onclick = (e) => {
            if (e.target === modal) close();
        };
    }

    async persistRename(listName, oldValue, newValue) {
        // Firestore Arrays don't support simple replace. We must Remove Old and Add New.
        // Warning: This changes order if arrayUnion is used.
        // If order matters, we might need to read-modify-write the whole array.
        // For now, let's just do remove+add, assuming default alphabetic sort or irrelevant order.

        await this.persistItem(listName, oldValue, 'remove');
        await this.persistItem(listName, newValue, 'add');
    }

    /**
     * Write changes to Firestore
     */
    async persistItem(listName, value, action) {
        const docRef = doc(db, "settings", "general");
        let firestoreField;

        if (listName === 'keyAccounts') firestoreField = 'key_accounts';
        else if (listName === 'dealerStages') firestoreField = 'dealer_stages';

        else if (listName === 'dealerCategories') firestoreField = 'dealer_categories';
        else if (listName === 'instanceGroups') {
            firestoreField = 'instance_groups';
        }

        if (!firestoreField) {
            console.error(`Unknown list name: ${listName}`);
            return;
        }

        try {
            if (action === 'add') {
                await updateDoc(docRef, {
                    [firestoreField]: arrayUnion(value)
                });
            } else {
                await updateDoc(docRef, {
                    [firestoreField]: arrayRemove(value)
                });
            }
        } catch (error) {
            console.error(`Error saving ${listName}:`, error);
            // Revert optimistic update (simplified)
            alert("Failed to save changes. Please refresh.");
        }
    }

    /**
     * Restore Deactivated Dealer
     */
    async restoreDeactivatedDealer(name) {
        if (!confirm(`Are you sure you want to restore "${name}"?`)) return;

        try {
            // Use DataLayer to handle logic and cache invalidation
            if (window.dataManager && window.dataManager.dataLayer) {
                await window.dataManager.dataLayer.reactivateDealers([name]);
            } else {
                throw new Error("DataLayer not initialized");
            }

            // Update local view
            this.deactivatedDealers = this.deactivatedDealers.filter(item => item !== name);
            this.renderDeactivatedDealers();
            this.updateBadges();

            // Notify user
            import('../utils/toast.js').then(module => {
                module.Toast.success(`Restored "${name}"`);
            }).catch(() => { });

        } catch (error) {
            console.error("Error restoring dealer:", error);
            alert("Failed to restore dealer.");
        }
    }

    openManageModal(type) {
        let title = '';
        let listId = '';
        let inputId = '';
        let btnId = '';
        let renderMethod = '';
        let placeholder = '';

        if (type === 'keyAccounts') {
            title = 'Manage Key Account Managers';
            listId = 'key-accounts-list';
            inputId = 'add-kam-input';
            btnId = 'add-kam-btn';
            renderMethod = 'renderKeyAccounts';
            placeholder = 'Enter name...';
        } else if (type === 'dealerStages') {
            title = 'Manage Dealer Stages';
            listId = 'dealer-stages-list';
            inputId = 'add-stage-input';
            btnId = 'add-stage-btn';
            renderMethod = 'renderDealerStages';
            placeholder = 'Enter stage name...';
        } else if (type === 'dealerCategories') {
            title = 'Manage Dealer Categories';
            listId = 'dealer-categories-list';
            inputId = 'add-category-input';
            btnId = 'add-category-btn';
            renderMethod = 'renderDealerCategories';
            placeholder = 'Enter category name...';
        } else if (type === 'deactivatedDealers') {
            title = 'Deactivated Dealers';
            listId = 'deactivated-dealers-list';
            inputId = 'search-deactivated-input';
            renderMethod = 'renderDeactivatedDealers';
            placeholder = 'Search deactivated dealers...';
            renderMethod = 'renderDeactivatedDealers';
            placeholder = 'Search deactivated dealers...';
        } else if (type === 'instanceGroups') {
            title = 'Manage Instance Groups';
            listId = 'instance-groups-list';
            inputId = 'add-group-input';
            btnId = 'add-group-btn';
            renderMethod = 'renderInstanceGroups';
            placeholder = 'Enter group name...';
        }

        const modalHtml = `
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="close-modal-btn" onclick="document.getElementById('manage-modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="input-group">
                        <input type="text" id="${inputId}" class="modern-input" placeholder="${placeholder}">
                        ${type !== 'deactivatedDealers' ? `
                        <button id="${btnId}" class="add-btn">
                             <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                        </button>
                        ` : ''}
                    </div>
                    <div class="data-list" id="${listId}"></div>
                </div>
                <div class="modal-footer">
                    <button class="btn-cancel" onclick="document.getElementById('manage-modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;

        const overlay = document.createElement('div');
        overlay.id = 'manage-modal-overlay';
        overlay.className = 'modal-overlay active';
        overlay.innerHTML = modalHtml;
        overlay.onclick = () => overlay.remove();
        document.body.appendChild(overlay);

        // Bind Elements to Class Instances
        if (type === 'keyAccounts') {
            this.keyAccountsList = document.getElementById(listId);
            this.addKeyAccountInput = document.getElementById(inputId);
            document.getElementById(btnId).onclick = () => this.handleAddItem('keyAccounts', this.addKeyAccountInput);
            this.addKeyAccountInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleAddItem('keyAccounts', this.addKeyAccountInput); };
        } else if (type === 'dealerStages') {
            this.dealerStagesList = document.getElementById(listId);
            this.addDealerStageInput = document.getElementById(inputId);
            document.getElementById(btnId).onclick = () => this.handleAddItem('dealerStages', this.addDealerStageInput);
            this.addDealerStageInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleAddItem('dealerStages', this.addDealerStageInput); };
        } else if (type === 'dealerCategories') {
            this.dealerCategoriesList = document.getElementById(listId);
            this.addCategoryInput = document.getElementById(inputId);
            document.getElementById(btnId).onclick = () => this.handleAddItem('dealerCategories', this.addCategoryInput);
            this.addCategoryInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleAddItem('dealerCategories', this.addCategoryInput); };
        } else if (type === 'deactivatedDealers') {
            this.deactivatedList = document.getElementById(listId);
            const searchInput = document.getElementById(inputId);
            searchInput.onkeyup = () => this.filterDeactivatedList(searchInput.value);
        } else if (type === 'instanceGroups') {
            this.instanceGroupsList = document.getElementById(listId);
            this.addGroupInput = document.getElementById(inputId);
            document.getElementById(btnId).onclick = () => this.handleAddItem('instanceGroups', this.addGroupInput);
            this.addGroupInput.onkeypress = (e) => { if (e.key === 'Enter') this.handleAddItem('instanceGroups', this.addGroupInput); };
        }

        // Initial Render
        this[renderMethod]();

        // Focus Input
        if (type === 'deactivatedDealers') document.getElementById(inputId)?.focus();
        else document.getElementById(inputId)?.focus();
    }

    filterDeactivatedList(query) {
        const lowerQuery = query.toLowerCase();
        this.renderDeactivatedDealers(lowerQuery);
    }

    renderAll() {
        this.renderKeyAccounts();
        this.renderDealerStages();
        this.renderDealerCategories();
        this.renderDealerStages();
        this.renderDealerCategories();
        this.renderDeactivatedDealers();
        this.renderInstanceGroups();
    }

    renderDealerCategories() {
        if (!this.dealerCategoriesList) return;
        this.dealerCategoriesList.innerHTML = this.dealerCategories.map(cat => {
            const hasImage = this.categoryImages && this.categoryImages[cat];
            return `
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${hasImage ? `<img src="${this.escapeHtml(this.categoryImages[cat])}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : ''}
                    <span class="item-text">${this.escapeHtml(cat)}</span>
                </div>
                <div class="actions">
                    ${hasImage ? `
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItemImage('category', '${this.escapeHtml(cat)}')" title="Remove Image" style="color:#ef4444; border-color: rgba(239,68,68,0.3); margin-right:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    ` : ''}
                    <button class="edit-btn" onclick="window.settingsController.handleSetItemImage('category', '${this.escapeHtml(cat)}')" title="Set Image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('dealerCategories', '${this.escapeHtml(cat)}')" title="Rename">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('dealerCategories', '${this.escapeHtml(cat)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    renderKeyAccounts() {
        if (!this.keyAccountsList) return;
        this.keyAccountsList.innerHTML = this.keyAccounts.map(name => {
            const hasImage = this.keyAccountImages && this.keyAccountImages[name];
            return `
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${hasImage ? `<img src="${this.escapeHtml(this.keyAccountImages[name])}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : ''}
                    <span class="item-text">${this.escapeHtml(name)}</span>
                </div>
                <div class="actions">
                    ${hasImage ? `
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItemImage('kam', '${this.escapeHtml(name)}')" title="Remove Image" style="color:#ef4444; border-color: rgba(239,68,68,0.3); margin-right:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    ` : ''}
                    <button class="edit-btn" onclick="window.settingsController.handleSetItemImage('kam', '${this.escapeHtml(name)}')" title="${hasImage ? 'Change Image' : 'Set Image'}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('keyAccounts', '${this.escapeHtml(name)}')" title="Rename">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('keyAccounts', '${this.escapeHtml(name)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    renderDealerStages() {
        if (!this.dealerStagesList) return;
        this.dealerStagesList.innerHTML = this.dealerStages.map(stage => {
            const hasImage = this.stageImages && this.stageImages[stage];
            return `
            <div class="list-item">
                <div style="display:flex; align-items:center; gap:10px;">
                    ${hasImage ? `<img src="${this.escapeHtml(this.stageImages[stage])}" style="width:24px; height:24px; border-radius:50%; object-fit:cover;">` : ''}
                    <span class="item-text">${this.escapeHtml(stage)}</span>
                </div>
                <div class="actions">
                    ${hasImage ? `
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItemImage('stage', '${this.escapeHtml(stage)}')" title="Remove Image" style="color:#ef4444; border-color: rgba(239,68,68,0.3); margin-right:4px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    ` : ''}
                    <button class="edit-btn" onclick="window.settingsController.handleSetItemImage('stage', '${this.escapeHtml(stage)}')" title="Set Image">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                    </button>
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('dealerStages', '${this.escapeHtml(stage)}')" title="Rename">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('dealerStages', '${this.escapeHtml(stage)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `}).join('');
    }

    renderInstanceGroups() {
        if (!this.instanceGroupsList) return;
        this.instanceGroupsList.innerHTML = this.instanceGroups.map(group => `
            <div class="list-item">
                <span class="item-text">${this.escapeHtml(group)}</span>
                <div class="actions">
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('instanceGroups', '${this.escapeHtml(group)}')" title="Rename">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('instanceGroups', '${this.escapeHtml(group)}')" title="Delete">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderDeactivatedDealers(filterData = '') {
        if (!this.deactivatedList) return;

        const list = filterData
            ? this.deactivatedDealers.filter(d => d.toLowerCase().includes(filterData))
            : this.deactivatedDealers;

        if (list.length === 0) {
            this.deactivatedList.innerHTML = '<div style="padding: 10px; color: var(--text-muted); font-size: 0.8rem; text-align: center;">No deactivated dealers found</div>';
            return;
        }

        this.deactivatedList.innerHTML = list.map(name => `
            <div class="list-item">
                <span class="item-text" style="color: #f87171;">${this.escapeHtml(name)}</span>
                <button class="delete-btn" title="Restore Dealer" onclick="window.settingsController.restoreDeactivatedDealer('${this.escapeHtml(name)}')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 14 15 8"></polyline>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    setLoading(loading) {
        this.isLoading = loading;
        // Optional: show/hide generic loader
    }

    updateBadges() {
        // Update Key Accounts badge
        const kamBadge = document.getElementById('kam-count');
        if (kamBadge) {
            const count = this.keyAccounts.length;
            kamBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
        }

        // Update Dealer Stages badge
        const stagesBadge = document.getElementById('stages-count');
        if (stagesBadge) {
            const count = this.dealerStages.length;
            stagesBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
            const kamCount = document.getElementById('kam-count');
            const stagesCount = document.getElementById('stages-count');
            const categoriesCount = document.getElementById('categories-count');
            const deactivatedCount = document.getElementById('deactivated-count');
            const groupsCount = document.getElementById('groups-count');

            if (kamCount) kamCount.innerText = `${this.keyAccounts.length} items`;
            if (stagesCount) stagesCount.innerText = `${this.dealerStages.length} items`;
            if (categoriesCount) categoriesCount.innerText = `${this.dealerCategories.length} items`;
            if (groupsCount) groupsCount.innerText = `${this.instanceGroups.length} items`;
            if (deactivatedCount) deactivatedCount.innerText = `${this.deactivatedDealers.length} items`;
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

// Attach to window for global access (needed for inline onclicks)
window.SettingsController = SettingsController;

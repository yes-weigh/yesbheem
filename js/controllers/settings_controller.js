import { db } from '../services/firebase_config.js';
import { doc, getDoc, setDoc, updateDoc, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * SettingsController
 * Manages Key Accounts and Dealer Stages using Firestore
 */
export class SettingsController {
    constructor() {
        this.keyAccounts = [];
        this.dealerStages = [];
        this.dealerCategories = [];
        this.isLoading = false;

        // DOM Elements
        this.keyAccountsList = document.getElementById('key-accounts-list');
        this.dealerStagesList = document.getElementById('dealer-stages-list');
        this.dealerCategoriesList = document.getElementById('dealer-categories-list');
        this.deactivatedList = document.getElementById('deactivated-dealers-list');
        this.addKeyAccountInput = document.getElementById('add-kam-input');
        this.addDealerStageInput = document.getElementById('add-stage-input');
        this.addCategoryInput = document.getElementById('add-category-input');

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
        // Key Accounts Add
        document.getElementById('add-kam-btn')?.addEventListener('click', () => {
            this.handleAddItem('keyAccounts', this.addKeyAccountInput);
        });

        this.addKeyAccountInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddItem('keyAccounts', this.addKeyAccountInput);
        });

        // Dealer Stages Add
        document.getElementById('add-stage-btn')?.addEventListener('click', () => {
            this.handleAddItem('dealerStages', this.addDealerStageInput);
        });

        this.addDealerStageInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddItem('dealerStages', this.addDealerStageInput);
        });

        // Dealer Categories Add
        document.getElementById('add-category-btn')?.addEventListener('click', () => {
            this.handleAddItem('dealerCategories', this.addCategoryInput);
        });

        this.addCategoryInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleAddItem('dealerCategories', this.addCategoryInput);
        });
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
                this.dealerCategories = data.dealer_categories || [];
            } else {
                console.log("No settings document found. Creating default...");
                // Initialize defaults
                this.keyAccounts = [];
                this.dealerStages = ['Contacted', 'Interested', 'Negotiation', 'Closed'];
                this.dealerCategories = [];
                await setDoc(docRef, {
                    key_accounts: this.keyAccounts,
                    dealer_stages: this.dealerStages,
                    dealer_categories: this.dealerCategories
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
        const newValue = prompt("Enter new name:", oldValue);
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
        }

        // Cascade Rename to DataManager
        if (window.dataManager && fieldName) {
            await window.dataManager.bulkUpdateMetadata(fieldName, oldValue, trimmedValue);
        }
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

    filterDeactivatedList(query) {
        const lowerQuery = query.toLowerCase();
        this.renderDeactivatedDealers(lowerQuery);
    }

    renderAll() {
        this.renderKeyAccounts();
        this.renderDealerStages();
        this.renderDealerCategories();
        this.renderDeactivatedDealers();
    }

    renderDealerCategories() {
        if (!this.dealerCategoriesList) return;
        this.dealerCategoriesList.innerHTML = this.dealerCategories.map(name => `
            <div class="list-item">
                <span class="item-text">${this.escapeHtml(name)}</span>
                <div class="actions">
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('dealerCategories', '${this.escapeHtml(name)}')">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('dealerCategories', '${this.escapeHtml(name)}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderKeyAccounts() {
        if (!this.keyAccountsList) return;
        this.keyAccountsList.innerHTML = this.keyAccounts.map(name => `
            <div class="list-item">
                <span class="item-text">${this.escapeHtml(name)}</span>
                <div class="actions">
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('keyAccounts', '${this.escapeHtml(name)}')">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('keyAccounts', '${this.escapeHtml(name)}')">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderDealerStages() {
        if (!this.dealerStagesList) return;
        this.dealerStagesList.innerHTML = this.dealerStages.map(stage => `
            <div class="list-item">
                <span class="item-text">${this.escapeHtml(stage)}</span>
                <div class="actions">
                    <button class="edit-btn" onclick="window.settingsController.handleRenameItem('dealerStages', '${this.escapeHtml(stage)}')">
                         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                    </button>
                    <button class="delete-btn" onclick="window.settingsController.handleRemoveItem('dealerStages', '${this.escapeHtml(stage)}')">
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
        }

        // Update Deactivated Dealers badge
        const deactivatedBadge = document.getElementById('deactivated-count');
        if (deactivatedBadge) {
            const count = this.deactivatedDealers ? this.deactivatedDealers.length : 0;
            deactivatedBadge.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
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

/**
 * @fileoverview Firestore service for all database operations
 * @module services/firestore-service
 */
import { db, app } from './firebase_config.js';
import { doc, getDoc, setDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

/**
 * Service class for handling all Firestore database operations
 */
export class FirestoreService {
    /**
     * Creates a new FirestoreService instance
     */
    constructor() {
        this.db = db;
        this.auth = getAuth(app);
        this._authPromise = new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(this.auth, (user) => {
                resolve(user);
                unsubscribe();
            });
        });
    }

    /**
     * Waits for Firebase Auth to initialize
     * @returns {Promise<User|null>}
     */
    async waitForAuth() {
        return this._authPromise;
    }

    /**
     * Normalizes a key by converting to lowercase and replacing spaces with underscores
     * @param {string} name - The name to normalize
     * @returns {string} Normalized key
     * @private
     */
    normalizeKey(name) {
        return name.toLowerCase().replace(/\s+/g, '_');
    }

    /**
     * Fetches KPI data from Firestore (settings/kpi_data)
     * Includes fallback to legacy Apps Script for migration if not found in Firestore
     * @param {string} kpiAppsScriptUrl - URL for legacy Apps Script fallback
     * @returns {Promise<Object>} KPI data object indexed by normalized state/country names
     */
    async fetchKPIData(kpiAppsScriptUrl) {
        try {
            console.log('Fetching KPI data...');
            await this.waitForAuth();
            const docRef = doc(this.db, "settings", "kpi_data");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log('KPI Data loaded from Firestore.');
                return docSnap.data();
            } else {
                console.log('KPI Data not found in Firestore. Fetching from legacy Apps Script for migration...');
                // Fallback / Migration logic
                const response = await fetch(kpiAppsScriptUrl, {
                    method: 'POST',
                    mode: 'cors',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8',
                    },
                    body: JSON.stringify({ action: 'download' })
                });

                const result = await response.json();
                if (result.status === 'success') {
                    // Index by normalized name for easy lookup
                    const dataToSave = {};
                    result.data.forEach(item => {
                        const key = this.normalizeKey(item.name);
                        dataToSave[key] = item;
                    });

                    // Save to Firestore
                    console.log('Migrating KPI Data to Firestore...');
                    await setDoc(docRef, dataToSave);
                    console.log('KPI Data migration complete.');

                    return dataToSave;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch KPI data:', e);
        }
        return {};
    }

    /**
     * Loads zip code mappings from Firestore (settings/zip_codes)
     * @returns {Promise<Object>} Object containing zip codes mapped to districts
     */
    async loadZipCacheFromFirebase() {
        try {
            console.log('Fetching zip_codes from Firestore...');
            await this.waitForAuth();
            const docRef = doc(this.db, "settings", "zip_codes");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log(`Loaded ${Object.keys(data).length} zip codes from Firestore into cache.`);
                return data;
            } else {
                console.log("No zip_codes document found in Firestore. Creating empty...");
                // Create if not exists so writes don't fail later
                await setDoc(docRef, {});
                return {};
            }
        } catch (e) {
            console.warn('Failed to load zip_codes from Firestore:', e);
            return {};
        }
    }

    /**
     * Loads dealer overrides from Firestore (settings/dealer_overrides)
     * LEGACY METHOD - Use getDealerOverrides() instead
     * @returns {Promise<Object>} Object containing dealer overrides indexed by dealer name
     */
    async loadDealerOverridesFromFirebase() {
        return this.getDealerOverrides();
    }

    /**
     * Get dealer overrides (NEW METHOD for data layer)
     * @returns {Promise<Object>} Object containing dealer overrides indexed by customer_name
     */
    async getDealerOverrides() {
        try {
            console.log('[FirestoreService] Fetching dealer_overrides...');
            await this.waitForAuth();
            const docRef = doc(this.db, "settings", "dealer_overrides");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log(`[FirestoreService] Loaded overrides for ${Object.keys(data).length} dealers.`);
                return data;
            } else {
                // Create empty if needed
                console.log('[FirestoreService] No overrides found, creating empty document');
                await setDoc(docRef, {});
                return {};
            }
        } catch (e) {
            console.warn('[FirestoreService] Failed to load dealer_overrides:', e);
            return {};
        }
    }

    /**
     * Update dealer override (ONLY way to edit dealer data)
     * Updates settings/dealer_overrides, NEVER touches reports_data
     * @param {string} customerName - Customer name (key)
     * @param {Object} updates - Fields to update
     */
    async updateDealerOverride(customerName, updates) {
        try {
            console.log(`[FirestoreService] Updating override for: ${customerName}`, updates);
            const docRef = doc(this.db, "settings", "dealer_overrides");

            // Use dot notation to update nested field
            // To properly merge deep fields without overwriting the entire map entry, 
            // we should technically use updateDoc with dot notation "key.field": value
            // But since customer names can have dots, we use setDoc with merge which works well for maps.
            const updateData = {};
            updateData[customerName] = updates;

            await setDoc(docRef, updateData, { merge: true });
            console.log(`[FirestoreService] Override updated successfully`);
        } catch (error) {
            console.error('[FirestoreService] Failed to update dealer override:', error);
        }
    }




    /**
     * Delete dealer override (revert to original CSV data)
     * @param {string} customerName - Customer name to revert
     */
    async deleteDealerOverride(customerName) {
        try {
            console.log(`[FirestoreService] Deleting override for: ${customerName}`);
            const docRef = doc(this.db, "settings", "dealer_overrides");

            const updateData = {};
            updateData[customerName] = deleteField();

            await updateDoc(docRef, updateData);
            console.log(`[FirestoreService] Override deleted successfully`);
        } catch (error) {
            console.error('[FirestoreService] Failed to delete dealer override:', error);
            throw error;
        }
    }

    /**
     * Lists all available reports from Firestore (settings/reports)
     * @returns {Promise<Array>} Array of report objects
     */
    async listReports() {
        await this.waitForAuth();
        const docRef = doc(this.db, "settings", "reports");
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.items && Array.isArray(data.items)) {
                    console.log(`Loaded ${data.items.length} reports from Firestore.`);
                    return data.items;
                }
            }

            // No reports found
            console.log('No reports found in Firestore.');
            return [];
        } catch (e) {
            console.error('Failed to load reports from Firestore:', e);
            return [];
        }
    }

    /**
     * Loads specific report data from Firestore (reports_data collection)
     * LEGACY METHOD - Use getReportData() instead
     * @param {string} reportId - The unique ID of the report to load
     * @returns {Promise<Array>} Array of parsed CSV data objects
     * @throws {Error} If report is not found or loading fails
     */
    async loadReportDataFromFirestore(reportId) {
        const data = await this.getReportData(reportId);
        return data; // Return unfrozen for legacy compatibility
    }

    /**
     * Get report data (READ-ONLY, FROZEN)
     * CACHED IN MEMORY to prevent excessive reads.
     * Use clearCache() if you need to force refresh.
     * @param {string} reportId - The unique ID of the report to load
     * @returns {Promise<Array>} Frozen array of CSV data (immutable)
     * @throws {Error} If report is not found or loading fails
     */
    async getReportData(reportId) {
        // Initialize cache if needed
        if (!this.reportCache) {
            this.reportCache = new Map();
        }

        // Return from cache if available
        if (this.reportCache.has(reportId)) {
            // console.log(`[FirestoreService] Returning cached data for: ${reportId}`);
            return this.reportCache.get(reportId);
        }

        try {
            console.log(`[FirestoreService] Fetching report data from Network: ${reportId}`);
            await this.waitForAuth();
            const docRef = doc(this.db, 'reports_data', reportId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const reportData = docSnap.data();
                console.log(`[FirestoreService] Loaded ${reportData.rowCount} rows for report "${reportData.name}"`);

                // Freeze to prevent accidental modification
                const data = reportData.data || reportData.rows || [];
                const frozenData = Object.freeze(data);

                // Store in cache
                this.reportCache.set(reportId, frozenData);

                return frozenData;
            } else {
                throw new Error(`Report with ID "${reportId}" not found in Firestore`);
            }
        } catch (error) {
            console.error('[FirestoreService] Error loading report data:', error);
            throw error;
        }
    }

    /**
     * Clears the internal memory cache
     */
    clearCache() {
        this.reportCache = new Map();
        console.log('[FirestoreService] Cache cleared');
    }

    /**
     * Get aggregated report data (all reports combined)
     * @returns {Promise<Array>} Frozen array of aggregated CSV data
     */
    async getAggregatedReportData() {
        try {
            console.log('[FirestoreService] Fetching aggregated report data');
            const reports = await this.listReports();

            if (!reports || reports.length === 0) {
                console.warn('[FirestoreService] No reports found');
                return Object.freeze([]);
            }

            // Fetch all reports in parallel
            const allData = [];
            const fetchPromises = reports.map(async (report) => {
                try {
                    const data = await this.getReportData(report.id);
                    return Array.from(data); // Unfreeze for merging
                } catch (error) {
                    console.error(`[FirestoreService] Failed to load report ${report.id}:`, error);
                    return [];
                }
            });

            const results = await Promise.all(fetchPromises);
            results.forEach(data => allData.push(...data));

            console.log(`[FirestoreService] Aggregated ${allData.length} rows from ${reports.length} reports`);
            return Object.freeze(allData);
        } catch (error) {
            console.error('[FirestoreService] Error loading aggregated data:', error);
            return Object.freeze([]);
        }
    }

    /**
     * Upload new CSV report (Settings page only)
     * Creates a new document in reports_data collection
     * @param {string} reportId - Unique report ID
     * @param {string} reportName - Display name for the report
     * @param {Array} csvData - Parsed CSV data array
     */
    async uploadReport(reportId, reportName, csvData) {
        try {
            console.log(`[FirestoreService] Uploading report: ${reportName} (${csvData.length} rows)`);
            const docRef = doc(this.db, 'reports_data', reportId);
            await setDoc(docRef, {
                name: reportName,
                uploadedAt: new Date().toISOString(),
                data: csvData,
                rowCount: csvData.length
            });
            console.log(`[FirestoreService] Report uploaded successfully`);
        } catch (error) {
            console.error('[FirestoreService] Failed to upload report:', error);
            throw error;
        }
    }

    /**
     * Load general settings (Key Accounts, Dealer Stages, etc.)
     * @returns {Promise<Object>} General settings object
     */
    async loadGeneralSettings() {
        try {
            console.log('[FirestoreService] Fetching general settings...');
            await this.waitForAuth();
            const docRef = doc(this.db, "settings", "general");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log('[FirestoreService] General settings loaded');
                return data;
            } else {
                console.log('[FirestoreService] No general settings found, creating empty');
                await setDoc(docRef, {});
                return {};
            }
        } catch (e) {
            console.warn('[FirestoreService] Failed to load general settings:', e);
            return {};
        }
    }

    /**
     * Get list of deactivated dealers
     * @returns {Promise<Array<string>>} Array of dealer names
     */
    async getDeactivatedDealers() {
        try {
            console.log('[FirestoreService] Fetching deactivated dealers...');
            await this.waitForAuth();
            const docRef = doc(this.db, "settings", "deactivated_dealers");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const items = data.items || [];
                console.log(`[FirestoreService] Loaded ${items.length} deactivated dealers.`);
                return items;
            } else {
                console.log('[FirestoreService] No deactivated dealers list found, creating empty');
                await setDoc(docRef, { items: [] });
                return [];
            }
        } catch (e) {
            console.error('[FirestoreService] Failed to load deactivated dealers:', e);
            return [];
        }
    }

    /**
     * Update the list of deactivated dealers
     * @param {Array<string>} fullList - Complete list of dealer names
     */
    async updateDeactivatedDealers(fullList) {
        try {
            console.log(`[FirestoreService] Updating deactivated dealers list (${fullList.length} items)`);
            const docRef = doc(this.db, "settings", "deactivated_dealers");
            await setDoc(docRef, { items: fullList }, { merge: true });
            console.log('[FirestoreService] Deactivated dealers list updated');
        } catch (e) {
            console.error('[FirestoreService] Failed to update deactivated dealers:', e);
            throw e;
        }
    }
}

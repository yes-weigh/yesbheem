/**
 * @fileoverview Firestore service for all database operations
 * @module services/firestore-service
 */
import { db } from './firebase_config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Service class for handling all Firestore database operations
 */
export class FirestoreService {
    /**
     * Creates a new FirestoreService instance
     */
    constructor() {
        this.db = db;
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
     * @returns {Promise<Object>} Object containing dealer overrides indexed by dealer name
     */
    async loadDealerOverridesFromFirebase() {
        try {
            console.log('Fetching dealer_overrides from Firestore...');
            const docRef = doc(this.db, "settings", "dealer_overrides");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                console.log(`Loaded overrides for ${Object.keys(data).length} dealers.`);
                return data;
            } else {
                // Create empty if needed
                await setDoc(docRef, {});
                return {};
            }
        } catch (e) {
            console.warn('Failed to load dealer_overrides:', e);
            return {};
        }
    }

    /**
     * Lists all available reports from Firestore (settings/reports)
     * @returns {Promise<Array>} Array of report objects
     */
    async listReports() {
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
     * @param {string} reportId - The unique ID of the report to load
     * @returns {Promise<Array>} Array of parsed CSV data objects
     * @throws {Error} If report is not found or loading fails
     */
    async loadReportDataFromFirestore(reportId) {
        try {
            const docRef = doc(this.db, 'reports_data', reportId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const reportData = docSnap.data();
                console.log(`Loaded ${reportData.rowCount} rows for report "${reportData.name}" from Firestore`);
                return reportData.data; // Return the data array
            } else {
                throw new Error(`Report with ID "${reportId}" not found in Firestore`);
            }
        } catch (error) {
            console.error('Error loading report data from Firestore:', error);
            throw error;
        }
    }
}

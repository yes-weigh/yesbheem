/**
 * DataManager
 * Handles fetching real-time data from Firestore and resolving zip codes to districts.
 */
import { db } from './services/firebase_config.js';
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { parseTargetValue } from './utils/data-parser.js';
import { ZipCodeResolver } from './utils/zip-code-resolver.js';
import { FirestoreService } from './services/firestore-service.js';
import { DataAggregator } from './core/data-aggregator.js';

class DataManager {
    constructor() {
        this.currentCSVUrl = null;
        // URL for the 'zip_codes' sheet CSV export

        // Initialize Firestore service
        this.firestoreService = new FirestoreService();

        // Initialize DataAggregator with dependencies
        this.aggregator = new DataAggregator(
            this.firestoreService,
            (name) => this.normalizeKey(name),
            (val) => parseTargetValue(val),
            (a, b) => this.getLevenshteinDistance(a, b)
        );

        // Load cache from localStorage or initialize empty
        this.zipCache = this.loadCacheFromStorage();
        this.processedData = {};

        // Cache for state-level aggregated data
        this.stateDataCache = {};
        this.rawDataCache = null; // Cache the raw sheet data
        this.rawDataTimestamp = null;

        // KPI Data (GDP, Pop, Target)
        this.kpiAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbwCS5-GtpPLFU1rKEKc9CnS81O1ebkzqKR1PkOYZSBe_Gxbi6KSZ96bRhyB3b0v9Hy2gw/exec';
        this.kpiDataCache = null;

        // Blacklist of known invalid zip codes to skip API calls
        this.invalidZips = new Set(['686028', '382487', '403407', '5000074', '505206', '68002', '570024']);

        // Cache for report data to avoid duplicate Firestore reads
        this.reportDataCache = new Map();

        // Initialize ZipCodeResolver with cache and invalid zips
        this.zipResolver = new ZipCodeResolver(this.zipCache, this.invalidZips);

        // Initialize by loading zip sheet
        this.dealerOverrides = {};
        this.loadDealerOverridesFromFirebase();

        this.sheetZips = new Set(); // Track what is IN the remote DB
        this.loadZipCacheFromFirebase();

        // General Settings (Key Accounts, Dealer Stages)
        this.generalSettings = { key_accounts: [], dealer_stages: [] };
        this.loadGeneralSettings();
    }

    /**
     * Load dealer overrides from Firestore (settings/dealer_overrides)
     */
    async loadDealerOverridesFromFirebase() {
        const data = await this.firestoreService.loadDealerOverridesFromFirebase();
        this.dealerOverrides = data;
    }

    /**
     * Save/Update dealer overrides
     * @param {string} dealerName 
     * @param {Object} overrides - Object containing key-value pairs to override
     */
    async saveDealerOverride(dealerName, overrides) {
        if (!dealerName || !overrides) return;
        try {
            console.log(`Saving overrides for ${dealerName}:`, overrides);

            // Update local cache
            // We merge with existing to avoid wiping other fields if we ever partial update
            // But for now UI sends all fields. Let's merge purely.
            this.dealerOverrides[dealerName] = {
                ...(this.dealerOverrides[dealerName] || {}),
                ...overrides
            };

            // Update Firestore
            const docRef = doc(db, "settings", "dealer_overrides");
            await setDoc(docRef, {
                [dealerName]: this.dealerOverrides[dealerName]
            }, { merge: true });

            console.log('Dealer override saved to Firestore.');
        } catch (e) {
            console.error('Failed to save dealer override:', e);
            // Retry logic or error handling if needed, but setDoc with merge is robust.
        }
    }

    /**
     * Load zip codes from Firestore (settings/zip_codes)
     */
    async loadZipCacheFromFirebase() {
        const data = await this.firestoreService.loadZipCacheFromFirebase();
        let count = 0;
        // Data is stored as { zip: district_name } map
        for (const [zip, district] of Object.entries(data)) {
            this.zipCache[zip] = district;
            this.sheetZips.add(zip);
            count++;
        }
        if (count > 0) {
            this.saveCacheToStorage();
        }
    }

    /**
     * Load general settings (Key Accounts, Dealer Stages) from Firestore (settings/general)
     */
    async loadGeneralSettings() {
        try {
            console.log('Fetching general settings from Firestore...');
            const docRef = doc(db, "settings", "general");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                this.generalSettings = docSnap.data();
                console.log('Loaded General Settings:', this.generalSettings);
            } else {
                await setDoc(docRef, { key_accounts: [], dealer_stages: [] });
                this.generalSettings = { key_accounts: [], dealer_stages: [] };
            }
        } catch (e) {
            console.warn('Failed to load general settings:', e);
            this.generalSettings = { key_accounts: [], dealer_stages: [] };
        }
    }

    /**
     * Load zip code cache from localStorage
     */
    loadCacheFromStorage() {
        try {
            const cached = localStorage.getItem('zipCodeCache');
            if (cached) {
                // console.log('Loaded zip code cache from localStorage');
                return JSON.parse(cached);
            }
        } catch (e) {
            console.warn('Failed to load cache from localStorage:', e);
        }
        return {};
    }

    /**
     * Save zip code cache to localStorage
     */
    saveCacheToStorage() {
        try {
            localStorage.setItem('zipCodeCache', JSON.stringify(this.zipCache));
            console.log('Saved zip code cache to localStorage');
        } catch (e) {
            console.warn('Failed to save cache to localStorage:', e);
        }
    }

    /**
     * Fetches data from the Google Sheet (with caching) or CSV URL
     */
    /**
     * Fetch sheet data - now from Firestore or aggregated reports
     */
    async fetchSheetData() {
        if (!this.currentCSVUrl) {
            console.warn('No Data Source Selected.');
            return [];
        }

        // Handle Aggregated "All Reports" Mode
        if (this.currentCSVUrl === 'ALL_REPORTS') {
            return this.fetchAllReportsAndAggregate();
        }

        // currentCSVUrl now contains the report ID instead of URL
        console.log('Loading report data from Firestore:', this.currentCSVUrl);
        try {
            const parsed = await this.loadReportDataFromFirestore(this.currentCSVUrl);
            console.log(`Loaded ${parsed.length} rows from Firestore.`);

            // CACHE RAW DATA FOR EXTERNAL USE (e.g. DealerManager)
            this.rawData = parsed;

            return parsed;
        } catch (e) {
            console.error('Failed to load report data from Firestore:', e);
            throw e;
        }
    }

    async fetchAllReportsAndAggregate() {
        console.log('Starting Aggregation of ALL Reports...');
        try {
            const reports = await this.listReports();
            if (!reports || reports.length === 0) return [];

            const promises = reports.map(async (report) => {
                try {
                    // Load from Firestore instead of fetching CSV
                    return await this.loadReportDataFromFirestore(report.id);
                } catch (e) {
                    console.error(`Failed to load report ${report.name}:`, e);
                    return [];
                }
            });

            const allResults = await Promise.all(promises);
            const mergedMap = new Map();

            allResults.flat().forEach(row => {
                const name = (row['customer_name'] || '').trim();
                // If no name, skip or keep? Let's skip empty names
                if (!name) return;

                const sales = parseFloat(row['sales'] || 0);

                if (mergedMap.has(name)) {
                    const existing = mergedMap.get(name);
                    // Update Sales
                    existing.sales = (parseFloat(existing.sales || 0) + sales).toString();
                } else {
                    // Clone row to avoid reference issues
                    const newRow = { ...row };
                    // Ensure sales is a number for easier addition if we encounter it again
                    newRow.sales = sales;
                    mergedMap.set(name, newRow);
                }
            });

            const aggregated = Array.from(mergedMap.values());
            console.log(`Aggregated Data: ${aggregated.length} unique customers from ${reports.length} reports.`);
            return aggregated;

        } catch (e) {
            console.error('Aggregation failed:', e);
            return [];
        }
    }

    /**
     * Fetch KPI Data (GDP, Population, Target) from Firestore
     * Migrates from Apps Script if not present in Firestore
     */
    async fetchKPIData() {
        if (this.kpiDataCache) {
            return this.kpiDataCache;
        }

        this.kpiDataCache = await this.firestoreService.fetchKPIData(this.kpiAppsScriptUrl);
        return this.kpiDataCache;
    }

    normalizeKey(name) {
        if (!name) return '';
        return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Get aggregated state data enriched with KPIs (GDP, Pop)
     */
    async getStatesWithKPIs() {
        const rawData = await this.fetchSheetData();
        return this.aggregator.getStatesWithKPIs(rawData);
    }

    /**
     * Parse target value string (e.g. "75 L", "5 Cr", "10 K") into number
     * @param {string|number} val - The target value
     * @returns {number} The numeric value
     */
    parseTargetValue(val) {
        return parseTargetValue(val);
    }

    /**
     * Parses CSV text into an array of objects
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        if (lines.length < 1) return [];

        // Normalize headers: trim, remove quotes, lowercase
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim().toLowerCase());
        const data = [];

        for (let i = 1; i < lines.length; i++) {
            const currentLine = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/); // Split by comma ignoring commas in quotes

            if (currentLine.length === headers.length) {
                const row = {};
                for (let j = 0; j < headers.length; j++) {
                    let value = currentLine[j].replace(/"/g, '').trim();
                    row[headers[j]] = value;
                }
                data.push(row);
            }
        }
        return data;
    }

    /**
     * Resolves a Zip code to a District using the external API
     * Implements caching to avoid rate limits
     */
    async getDistrictFromZip(zipCode) {
        return this.zipResolver.getDistrictFromZip(zipCode);
    }

    /**
     * Resolves a Zip code to both District and State using the external API
     * Returns { district, state } or null
     */
    async getLocationFromZip(zipCode) {
        return this.zipResolver.getLocationFromZip(zipCode);
    }

    /**
     * Writes a resolved zip code to Firestore
     */
    async writeZipToFirebase(zip, district) {
        return this.zipResolver.writeZipToFirebase(zip, district);
    }

    /**
     * Normalizes district names to match our internal keys
     */
    normalizeDistrictName(districtName, validList = []) {
        return this.zipResolver.normalizeDistrictName(districtName, validList);
    }

    /**
     * Resolves districts for ALL dealers in the raw data.
     * Checks against cache, fetches missing ones, updates Firebase.
     */
    async resolveMissingDistricts(allData) {
        return this.zipResolver.resolveMissingDistricts(allData, () => this.saveCacheToStorage());
    }

    /**
     * Main function to load and process data
     * @param {string} stateName - Name of the state to filter by (default 'Kerala')
     * @param {Array} districtIds - List of valid district IDs/keys for this state
     * @param {string} csvUrl - Optional URL to override data source
     */
    async loadData(stateName = 'Kerala', districtIds = [], csvUrl = null) {
        if (csvUrl) {
            this.currentCSVUrl = csvUrl;
        }

        console.log(`Starting data load for ${stateName}...`);
        const rawData = await this.fetchSheetData();
        console.log(`Fetched ${rawData.length} rows from sheet.`);

        // AUTOMATICALLY RESOLVE ALL INDIA DEALER DISTRICTS
        await this.resolveMissingDistricts(rawData);

        // APPLY DEALER OVERRIDES TO RAW DATA BEFORE FILTERING
        // This ensures dealers with overridden state/zip show up in correct state views
        for (const row of rawData) {
            const customerName = row['customer_name'];
            if (this.dealerOverrides && this.dealerOverrides[customerName]) {
                const ov = this.dealerOverrides[customerName];
                for (const [key, val] of Object.entries(ov)) {
                    if (val !== undefined) row[key] = val;
                }
            }
        }

        // Filter for specific state (NOW AFTER OVERRIDES)
        const stateLower = stateName.toLowerCase();
        const stateData = rawData.filter(row => {
            const bState = (row['billing_state'] || '').toLowerCase();
            const sState = (row['shipping_state'] || '').toLowerCase();
            // Default to Kerala if both are empty
            if (!bState && !sState && stateName.toLowerCase() === 'kerala') return true;
            return bState.includes(stateLower) || sState.includes(stateLower);
        });

        console.log(`Filtered to ${stateData.length} ${stateName} entries.`);

        const districtStats = {};

        // Use provided district IDs or fallback to Kerala default if empty
        let targets = districtIds;
        if (!targets || targets.length === 0) {
            targets = [
                'kasaragod', 'kannur', 'wayanad', 'kozhikode', 'malappuram',
                'palakkad', 'thrissur', 'ernakulam', 'idukki', 'kottayam',
                'alappuzha', 'pathanamthitta', 'kollam', 'thiruvananthapuram'
            ];
        }

        // Pre-fetch KPI data
        const kpiDataMap = await this.fetchKPIData();

        // Initialize stats
        for (const district of targets) {
            // Capitalize first letter for display name if no specific mapping exists
            const displayName = district.charAt(0).toUpperCase() + district.slice(1).replace(/-/g, ' ');

            // Enrich with KPI data
            const key = this.normalizeKey(district); // e.g., 'kasaragod'
            const kpi = kpiDataMap ? kpiDataMap[key] : null;

            districtStats[district] = {
                name: displayName, // Fallback, normally needs a map but this is okay for now
                population: kpi ? kpi.population : 'N/A',
                gdp: kpi ? kpi.gdp : 'N/A',
                dealerCount: 0,
                currentSales: 0,
                monthlyTarget: kpi && kpi.target ? kpi.target : 500000,
                dealers: []
            };
        }

        // OPTIMIZATION 3: Backfill cached zips to sheet (Background process)
        // Moved into resolveMissingDistricts for better consolidation, but keeping specific sheet backfill if needed
        // (Actually, resolveMissingDistricts manages Firebase, which IS the persistence layer here)
        // So we can remove the old manual logic or leave it as safety.
        // Let's rely on resolveMissingDistricts for the fetching part.


        // OPTIMIZATION 3: Backfill - Removed as resolveMissingDistricts handles global resolution.


        // Process each row using cached data
        for (const row of stateData) {
            // (Note: Overrides already applied in previous loop to the 'row' object ref)
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) continue;
            zip = zip.replace(/\s/g, '');

            const districtName = this.zipCache[zip];
            // Normalize: try to match against our key list
            const districtKey = this.normalizeDistrictName(districtName, targets);

            // INJECT DISTRICT INTO RAW DATA FOR UI
            // This ensures renderDealerEditForm sees it
            row['district'] = districtName || 'Unknown';

            if (districtKey && districtStats[districtKey]) {
                const customerName = row['customer_name'] || 'Unknown Dealer';
                const isYesCloud = customerName.toLowerCase().startsWith('yescloud');

                // ONLY increment count if NOT yescloud
                if (!isYesCloud) {
                    districtStats[districtKey].dealerCount += 1;
                }

                let sales = parseFloat(row['sales'] || 0);
                if (isNaN(sales)) sales = 0;
                districtStats[districtKey].currentSales += sales;

                districtStats[districtKey].dealers.push({
                    name: customerName,
                    sales: sales,
                    isYesCloud: isYesCloud, // Flag for UI filtering
                    billingZip: row['billing_zipcode'],
                    shippingZip: row['shipping_zipcode'],
                    rawData: row // Store full raw data for display
                });
            }
        }

        // Finalize stats
        for (const key in districtStats) {
            const stats = districtStats[key];
            // Sort dealers by sales descending
            stats.dealers.sort((a, b) => b.sales - a.sales);

            // Calculate Achievement based on fixed 5 lakh monthly target
            // Achievement = (Current Sales / Monthly Target) * 100
            const target = stats.monthlyTarget;
            if (target > 0) {
                stats.achievement = ((stats.currentSales / target) * 100).toFixed(1) + "%";
            } else {
                stats.achievement = "0.0%";
            }

            // Keep currentSales as number for calculations, will format in UI
            // No need to format here: stats.currentSales = stats.currentSales.toFixed(2);
        }

        console.log("Data processing complete:", districtStats);

        // Store the loaded data for dealer page to access
        this.rawData = stateData;

        return districtStats;
    }

    /**
     * Get districts sorted by total sales (for Kerala)
     * @param {Object} districtStats - District statistics object from loadData
     * @returns {Array} Array of {name, totalSales} objects sorted by sales descending
     */
    getDistrictsSortedBySales(districtStats) {
        return this.aggregator.getDistrictsSortedBySales(districtStats);
    }

    /**
     * Levenshtein Distance Algorithm
     */
    getLevenshteinDistance(a, b) {
        const matrix = [];
        let i, j;

        if (a.length === 0) return b.length;
        if (b.length === 0) return a.length;

        for (i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (i = 1; i <= b.length; i++) {
            for (j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        Math.min(
                            matrix[i][j - 1] + 1, // insertion
                            matrix[i - 1][j] + 1 // deletion
                        )
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }

    /**
     * Normalize state name to handle variations (e.g. Tamilnadu -> Tamil Nadu)
     */
    normalizeStateName(rawStateName) {
        return this.aggregator.normalizeStateName(rawStateName);
    }


    /**
     * Get list of all known state names
     */
    getAllStateNames() {
        return this.aggregator.getAllStateNames();
    }

    /**
     * Get aggregated data for a specific state (other than Kerala which uses districts)
     * @param {string} stateId - State ID (e.g., 'IN-TN' for Tamil Nadu)
     * @returns {Promise<object>} Aggregated state data
     */
    async getStateData(stateId) {
        const rawData = await this.fetchSheetData();
        return this.aggregator.getStateData(
            stateId,
            rawData,
            this.dealerOverrides,
            this.zipCache,
            this.stateDataCache,
            (data) => this.resolveMissingDistricts(data),
            (name) => this.normalizeStateName(name)
        );
    }
    /**
     * Get aggregated data for the entire country (Pan India)
     * @returns {Promise<object>} Aggregated country data
     */
    async getCountryData() {
        const rawData = await this.fetchSheetData();
        return this.aggregator.getCountryData(
            rawData,
            this.dealerOverrides,
            this.zipCache,
            (data) => this.resolveMissingDistricts(data)
        );
    }

    /**
     * Aggregate dealer sales by state
     * @param {Array} dealers - List of dealer objects
     */
    aggregateByState(dealers) {
        return this.aggregator.aggregateByState(dealers);
    }

    // --- Firebase Storage Methods ---

    /**
     * Upload CSV file - parses and saves directly to Firestore
     * @param {File} file - CSV file
     * @param {string} customName - Custom name for the report
     */
    async uploadCSV(file, customName) {
        try {
            // 1. Read and parse CSV file
            const csvText = await file.text();
            const parsedData = this.parseCSV(csvText);

            if (parsedData.length === 0) {
                throw new Error('CSV file is empty or could not be parsed');
            }

            // 2. Generate ID and timestamp
            const reportId = Math.random().toString(36).substr(2, 9);
            const timestamp = new Date().toISOString();

            // 3. Save parsed data to reports_data collection
            await setDoc(doc(db, 'reports_data', reportId), {
                id: reportId,
                name: customName,
                data: parsedData,
                uploadedAt: timestamp,
                rowCount: parsedData.length
            });

            console.log(`Saved ${parsedData.length} rows for report "${customName}" to Firestore`);

            // 4. Update settings/reports metadata
            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            let currentItems = [];
            if (docSnap.exists()) {
                currentItems = docSnap.data().items || [];
            }

            // Create metadata entry (no url or fullPath)
            const newItem = {
                id: reportId,
                name: customName,
                timeCreated: timestamp
            };

            // Prepend new item
            currentItems.unshift(newItem);
            await setDoc(docRef, { items: currentItems });

            console.log('Report metadata updated in Firestore.');

            // Clear cache to ensure fresh data on next load
            this.reportDataCache.clear();

            return newItem;
        } catch (e) {
            console.error('Upload failed:', e);
            throw e;
        }
    }


    /**
     * Delete a report from Firestore (both collections)
     */
    async deleteReport(report) {
        if (!report || !report.id) return;

        try {
            const { deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            // 1. Delete from reports_data collection
            await deleteDoc(doc(db, 'reports_data', report.id));
            console.log('Deleted from reports_data:', report.id);

            // 2. Delete from settings/reports metadata
            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const updatedItems = data.items.filter(item => item.id !== report.id);
                await setDoc(docRef, { items: updatedItems });
                console.log('Deleted from settings/reports:', report.id);
            }

            // Clear cache to ensure fresh data on next load
            this.reportDataCache.delete(report.id);

            return true;
        } catch (e) {
            console.error('Delete failed:', e);
            throw e;
        }
    }

    /**
     * Rename a report in Firestore (both collections)
     */
    async renameReport(report, newName) {
        if (!report || !newName) return;

        try {
            // 1. Update name in reports_data collection
            const dataDocRef = doc(db, 'reports_data', report.id);
            await updateDoc(dataDocRef, { name: newName });
            console.log('Updated name in reports_data:', report.id, newName);

            // 2. Update name in settings/reports metadata
            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const items = data.items || [];

                const index = items.findIndex(item => item.id === report.id);
                if (index !== -1) {
                    items[index].name = newName;
                    await setDoc(docRef, { items: items });
                    console.log('Updated name in settings/reports:', report.id, newName);
                }
            }

            return true;
        } catch (e) {
            console.error('Rename failed:', e);
            throw e;
        }
    }

    /**
     * Get the latest upload timestamp from Firestore reports_data collection
     */
    async getLastStorageUpdate() {
        try {
            const { collection, getDocs, query, orderBy, limit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

            const reportsRef = collection(db, 'reports_data');
            const q = query(reportsRef, orderBy('uploadedAt', 'desc'), limit(1));
            const snapshot = await getDocs(q);

            if (snapshot.empty) {
                return null;
            }

            const latestReport = snapshot.docs[0].data();
            return latestReport.uploadedAt;
        } catch (e) {
            console.error('Could not fetch last update time:', e);
            return null;
        }
    }

    /**
     * Save the reordered list to Firestore
     */
    async saveReportsList(items) {
        try {
            const docRef = doc(db, "settings", "reports");
            await setDoc(docRef, { items: items });
            console.log('Reports order saved.');
        } catch (e) {
            console.error('Failed to save report order:', e);
            throw e;
        }
    }

    /**
     * List available reports from Firestore (settings/reports)
     */
    async listReports() {
        return this.firestoreService.listReports();
    }

    /**
     * Load report data from Firestore reports_data collection
     * @param {string} reportId - Report ID
     * @returns {Array} Parsed CSV data (array of objects)
     */
    async loadReportDataFromFirestore(reportId) {
        // Check cache first
        if (this.reportDataCache.has(reportId)) {
            console.log(`Loaded ${this.reportDataCache.get(reportId).length} rows for report from cache (reportId: ${reportId})`);
            return this.reportDataCache.get(reportId);
        }

        const data = await this.firestoreService.loadReportDataFromFirestore(reportId);
        // Cache the data
        this.reportDataCache.set(reportId, data);
        return data;
    }
}

// Attach to window for global access
window.DataManager = DataManager;

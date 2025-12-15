/**
 * DataManager
 * Handles fetching real-time data from Google Sheets and resolving zip codes to districts.
 */
import { storage, db } from './services/firebase_config.js';
import { ref, uploadBytes, getDownloadURL, listAll, getMetadata, deleteObject } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { doc, getDoc, setDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class DataManager {
    constructor() {
        this.currentCSVUrl = null;
        // URL for the 'zip_codes' sheet CSV export


        this.zipApiUrl = 'https://api.postalpincode.in/pincode/';

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

        // Initialize by loading zip sheet


        this.sheetZips = new Set(); // Track what is IN the remote DB
        this.loadZipCacheFromFirebase();
    }

    /**
     * Load zip codes from Firestore (settings/zip_codes)
     */
    async loadZipCacheFromFirebase() {
        try {
            console.log('Fetching zip_codes from Firestore...');
            const docRef = doc(db, "settings", "zip_codes");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                let count = 0;
                // Data is stored as { zip: district_name } map
                for (const [zip, district] of Object.entries(data)) {
                    this.zipCache[zip] = district;
                    this.sheetZips.add(zip);
                    count++;
                }
                console.log(`Loaded ${count} zip codes from Firestore into cache.`);
                this.saveCacheToStorage();
            } else {
                console.log("No zip_codes document found in Firestore. Creating empty...");
                // Create if not exists so writes don't fail later
                await setDoc(docRef, {});
            }
        } catch (e) {
            console.warn('Failed to load zip_codes from Firestore:', e);
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
     * Fetches data from the Custom CSV URL
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

        console.log('Fetching from Custom CSV URL:', this.currentCSVUrl);
        try {
            const response = await fetch(this.currentCSVUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const csvText = await response.text();
            const parsed = this.parseCSV(csvText);
            console.log(`Parsed CSV: ${parsed.length} rows.`);
            return parsed;
        } catch (e) {
            console.error('Failed to fetch custom CSV (likely CORS or Network):', e);
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
                    const res = await fetch(report.url);
                    const text = await res.text();
                    return this.parseCSV(text);
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
     * Fetch KPI Data (GDP, Population, Target) from Apps Script
     */
    /**
     * Fetch KPI Data (GDP, Population, Target) from Firestore
     * Migrates from Apps Script if not present in Firestore
     */
    async fetchKPIData() {
        if (this.kpiDataCache) {
            return this.kpiDataCache;
        }

        try {
            console.log('Fetching KPI data...');
            const docRef = doc(db, "settings", "kpi_data");
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                console.log('KPI Data loaded from Firestore.');
                this.kpiDataCache = docSnap.data();
                return this.kpiDataCache;
            } else {
                console.log('KPI Data not found in Firestore. Fetching from legacy Apps Script for migration...');
                // Fallback / Migration logic
                const response = await fetch(this.kpiAppsScriptUrl, {
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

                    this.kpiDataCache = dataToSave;
                    return this.kpiDataCache;
                }
            }
        } catch (e) {
            console.warn('Failed to fetch KPI data:', e);
        }
        return {};
    }

    normalizeKey(name) {
        if (!name) return '';
        return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    }

    /**
     * Get aggregated state data enriched with KPIs (GDP, Pop)
     */
    async getStatesWithKPIs() {
        // Ensure both data sources are ready
        const [dealers, kpiData] = await Promise.all([
            this.fetchSheetData(),
            this.fetchKPIData() // Now this works
        ]);

        // 1. Aggregate Sales by State
        const stateMap = {};
        const allStates = this.getAllStateNames();

        allStates.forEach(name => {
            stateMap[name] = {
                name: name,
                sales: 0,
                dealerCount: 0,
                population: 'N/A',
                gdp: 'N/A'
            };
        });

        // Fill Sales
        if (dealers && Array.isArray(dealers)) {
            dealers.forEach(row => {
                const rawState = row['billing_state'] || row['shipping_state'] || 'Unknown';
                const stateName = this.normalizeStateName(rawState);
                const sales = parseFloat(row['sales'] || 0);

                if (stateMap[stateName]) {
                    stateMap[stateName].sales += isNaN(sales) ? 0 : sales;

                    const customerName = row['customer_name'] || '';
                    if (!customerName.toLowerCase().startsWith('yescloud')) {
                        stateMap[stateName].dealerCount += 1;
                    }
                }
            });
        }

        // Fill KPIs
        Object.values(stateMap).forEach(state => {
            const key = this.normalizeKey(state.name);
            const kpi = kpiData ? kpiData[key] : null;
            if (kpi) {
                state.population = kpi.population || 'N/A';
                state.gdp = kpi.gdp || 'N/A';
            }
        });

        const results = Object.values(stateMap);
        // Default Sort by Sales
        return results.sort((a, b) => b.sales - a.sales);
    }

    /**
     * Parse target value string (e.g. "75 L", "5 Cr", "10 K") into number
     * @param {string|number} val - The target value
     * @returns {number} The numeric value
     */
    parseTargetValue(val) {
        if (typeof val === 'number') return val;
        if (!val) return 0;

        const str = val.toString().trim().toUpperCase();

        let multiplier = 1;
        let numPart = str;

        if (str.includes('CR')) {
            multiplier = 10000000;
            numPart = str.replace('CR', '');
        } else if (str.includes('L')) {
            multiplier = 100000;
            numPart = str.replace('L', '');
        } else if (str.includes('K')) {
            multiplier = 1000;
            numPart = str.replace('K', '');
        }

        const num = parseFloat(numPart.replace(/[^0-9.]/g, ''));
        const result = isNaN(num) ? 0 : num * multiplier;
        // console.log(`[ParseTarget] In: "${val}" -> Str: "${str}" -> Num: ${num} * ${multiplier} = ${result}`);
        if (str.includes('L') && multiplier !== 100000) console.warn('Parse Logic Warning: L detected but wrong multiplier?');
        return result;
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
        if (!zipCode) return null;

        // Check cache first (now includes sheet data)
        if (this.zipCache[zipCode]) {
            return this.zipCache[zipCode];
        }

        try {
            // Add a small delay to be nice to the API if we are making many requests
            const response = await fetch(`${this.zipApiUrl}${zipCode}`);
            const data = await response.json();

            if (data && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                const district = data[0].PostOffice[0].District;

                // Update local cache
                this.zipCache[zipCode] = district;

                // Write back to Firestore
                this.writeZipToFirebase(zipCode, district);

                return district;
            }
        } catch (error) {
            console.warn(`Failed to resolve zip ${zipCode}:`, error);
        }
        return null;
    }

    /**
     * Writes a resolved zip code to Firestore
     */
    async writeZipToFirebase(zip, district) {
        try {
            console.log(`[Debug] Writing zip to Firestore: ${zip}, ${district}`);
            const docRef = doc(db, "settings", "zip_codes");

            // Use updateDoc to add/merge a specific field
            await updateDoc(docRef, {
                [zip]: district
            });
            console.log(`[Debug] Saved zip ${zip} to Firestore.`);
        } catch (e) {
            console.warn('[Debug] Failed to write zip to Firestore:', e);
            // If document doesn't exist (edge case if creation failed), try setDoc with merge
            if (e.code === 'not-found') {
                await setDoc(doc(db, "settings", "zip_codes"), { [zip]: district }, { merge: true });
            }
        }
    }

    /**
     * Normalizes district names to match our internal keys
     */
    normalizeDistrictName(districtName, validList = []) {
        if (!districtName) return null;
        const lower = districtName.toLowerCase().trim();
        const cleanId = lower.replace(/\s+/g, '-');

        // Check against valid list first
        if (validList.includes(cleanId)) return cleanId;
        if (validList.includes(lower)) return lower;

        // Fallback for complex matches (Kerala legacy)
        const map = {
            'trivandrum': 'thiruvananthapuram',
            'calicut': 'kozhikode',
            'alleppey': 'alappuzha',
            'cochin': 'ernakulam',
            'kochi': 'ernakulam',
            'trichur': 'thrissur',
            'palghat': 'palakkad',
            'cannanore': 'kannur',
            'kasargod': 'kasaragod'
        };

        const mapped = map[lower];
        if (mapped && validList.includes(mapped)) return mapped;

        return null;
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

        // Filter for specific state
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

        // OPTIMIZATION 1: Collect unique zip codes that need resolution or syncing
        const uniqueZips = new Set();
        const zipsToBackfill = new Set();

        for (const row of stateData) {
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) continue;
            zip = zip.replace(/\s/g, '');

            // Case 1: Completely unknown (not in cache)
            if (!this.zipCache[zip]) {
                uniqueZips.add(zip);
            }
            // Case 2: In cache, but NOT in sheet (Needs backfill)
            // We check if this.sheetZips has it. If not, we queue for write.
            else if (this.sheetZips && !this.sheetZips.has(zip)) {
                zipsToBackfill.add(zip);
            }
        }

        // OPTIMIZATION 2: Resolve only unique uncached zip codes
        if (uniqueZips.size > 0) {
            console.log(`Resolving ${uniqueZips.size} unique uncached zip codes...`);
            let resolvedCount = 0;
            for (const zip of uniqueZips) {
                await this.getDistrictFromZip(zip);
                resolvedCount++;
                if (resolvedCount % 10 === 0) console.log(`Resolved ${resolvedCount}/${uniqueZips.size}...`);
            }
            this.saveCacheToStorage();
        } else {
            console.log('All required zip codes found in cache.');
        }

        // OPTIMIZATION 3: Backfill cached zips to sheet (Background process)
        if (zipsToBackfill.size > 0) {
            console.log(`Found ${zipsToBackfill.size} cached zips missing from sheet. Backfilling...`);
            // We don't await this loop to avoid blocking UI, or we process quickly?
            // Google Script might throttle. Let's send them ONE BY ONE.
            // For safety, we can just process them.
            let backfillCount = 0;
            for (const zip of zipsToBackfill) {
                const district = this.zipCache[zip];
                if (district) {
                    this.writeZipToFirebase(zip, district);
                    // Add to sheetZips so we don't try again this session
                    if (this.sheetZips) this.sheetZips.add(zip);
                    backfillCount++;
                }
            }
        }

        // Process each row using cached data
        for (const row of stateData) {
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) continue;
            zip = zip.replace(/\s/g, '');

            const districtName = this.zipCache[zip];
            // Normalize: try to match against our key list
            const districtKey = this.normalizeDistrictName(districtName, targets);

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
                    isYesCloud: isYesCloud // Flag for UI filtering
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
        return districtStats;
    }

    /**
     * Get districts sorted by total sales (for Kerala)
     * @param {Object} districtStats - District statistics object from loadData
     * @returns {Array} Array of {name, totalSales} objects sorted by sales descending
     */
    getDistrictsSortedBySales(districtStats) {
        if (!districtStats) return [];

        const districtArray = Object.keys(districtStats).map(key => ({
            name: districtStats[key].name,
            totalSales: districtStats[key].currentSales || 0,
            dealerCount: districtStats[key].dealerCount || 0
        }));

        // Sort by total sales descending (highest first)
        return districtArray.sort((a, b) => b.totalSales - a.totalSales);
    }

    /**
     * Normalize state name to handle variations (e.g. Tamilnadu -> Tamil Nadu)
     */
    normalizeStateName(rawStateName) {
        if (!rawStateName) return 'Kerala'; // Default to Kerala if missing
        let name = rawStateName.trim().replace(/\s+/g, ' ');

        // Common variations map
        const variations = {
            'tamilnadu': 'Tamil Nadu',
            'tamil nadu': 'Tamil Nadu',
            'telengana': 'Telangana',
            'telangana': 'Telangana',
            'chattisgarh': 'Chhattisgarh',
            'chhattisgarh': 'Chhattisgarh',
            'orissa': 'Odisha',
            'odisha': 'Odisha',
            'west bengal': 'West Bengal',
            'bengal': 'West Bengal',
            'jammu & kashmir': 'Jammu and Kashmir',
            'jammu and kashmir': 'Jammu and Kashmir',
            'andaman & nicobar': 'Andaman and Nicobar Islands',
            'andaman and nicobar': 'Andaman and Nicobar Islands',
            'andaman and nicobar islands': 'Andaman and Nicobar Islands',
            'maharasthra': 'Maharashtra',
            'maharastra': 'Maharashtra'
        };

        const lower = name.toLowerCase();
        if (variations[lower]) {
            return variations[lower];
        }

        // Check against valid list (case-insensitive)
        const validStates = this.getAllStateNames();
        const found = validStates.find(s => s.toLowerCase() === lower);
        if (found) return found;

        return name; // Return original if no match found
    }

    /**
     * Get list of all known state names
     */
    getAllStateNames() {
        return [
            'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar',
            'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli', 'Daman and Diu', 'Delhi',
            'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand',
            'Karnataka', 'Kerala', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
            'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan',
            'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'
        ];
    }

    /**
     * Get aggregated data for a specific state (other than Kerala which uses districts)
     * @param {string} stateId - State ID (e.g., 'IN-TN' for Tamil Nadu)
     * @returns {Promise<object>} Aggregated state data
     */
    async getStateData(stateId) {
        // Check if we have cached data for this state
        // FORCE REFRESH: Cache disabled to ensure new normalize logic is used
        /* if (this.stateDataCache[stateId]) {
            console.log(`Using cached data for ${stateId}`);
            return this.stateDataCache[stateId];
        } */

        console.log(`Getting state data for ${stateId}...`);

        // State ID to name mapping
        const stateNames = {
            'IN-AN': 'Andaman and Nicobar Islands', 'IN-AP': 'Andhra Pradesh', 'IN-AR': 'Arunachal Pradesh',
            'IN-AS': 'Assam', 'IN-BR': 'Bihar', 'IN-CH': 'Chandigarh', 'IN-CT': 'Chhattisgarh',
            'IN-DD': 'Daman and Diu', 'IN-DL': 'Delhi', 'IN-DN': 'Dadra and Nagar Haveli',
            'IN-GA': 'Goa', 'IN-GJ': 'Gujarat', 'IN-HP': 'Himachal Pradesh', 'IN-HR': 'Haryana',
            'IN-JH': 'Jharkhand', 'IN-JK': 'Jammu and Kashmir', 'IN-KA': 'Karnataka', 'IN-KL': 'Kerala',
            'IN-LD': 'Lakshadweep', 'IN-MH': 'Maharashtra', 'IN-ML': 'Meghalaya', 'IN-MN': 'Manipur',
            'IN-MP': 'Madhya Pradesh', 'IN-MZ': 'Mizoram', 'IN-NL': 'Nagaland', 'IN-OR': 'Odisha',
            'IN-PB': 'Punjab', 'IN-PY': 'Puducherry', 'IN-RJ': 'Rajasthan', 'IN-SK': 'Sikkim',
            'IN-TG': 'Telangana', 'IN-TN': 'Tamil Nadu', 'IN-TR': 'Tripura', 'IN-UP': 'Uttar Pradesh',
            'IN-UT': 'Uttarakhand', 'IN-WB': 'West Bengal'
        };

        const stateName = stateNames[stateId] || stateId;
        const rawData = await this.fetchSheetData();

        // Robust Filtering using Normalize
        const targetState = this.normalizeStateName(stateName);

        const stateData = rawData.filter(row => {
            const raw = row['billing_state'] || row['shipping_state'] || '';
            const normalizedRow = this.normalizeStateName(raw);
            const match = normalizedRow === targetState;
            // if (!match && raw.toLowerCase().includes('karnataka')) console.log(`[Filter Fail] Raw: "${raw}" -> Norm: "${normalizedRow}" vs Target: "${targetState}"`);
            return match;
        });



        // Fetch KPI Data for Target lookup
        const kpiData = await this.fetchKPIData();
        const normalizeKey = this.normalizeKey(stateName);
        const kpi = kpiData ? kpiData[normalizeKey] : null;



        // Aggregate data
        const aggregated = {
            name: stateName,
            population: kpi ? kpi.population : 'N/A',
            dealerCount: 0,
            currentSales: 0,
            monthlyTarget: kpi && kpi.target ? this.parseTargetValue(kpi.target) : 500000,
            dealers: []
        };

        // Process each row
        for (const row of stateData) {
            const customerName = row['customer_name'] || 'Unknown Dealer';
            const isYesCloud = customerName.toLowerCase().startsWith('yescloud');

            if (!isYesCloud) {
                aggregated.dealerCount += 1;
            }

            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;

            aggregated.currentSales += sales;

            aggregated.dealers.push({
                name: customerName,
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Unknown',
                isYesCloud: isYesCloud
            });
        }

        // Sort dealers by sales
        aggregated.dealers.sort((a, b) => b.sales - a.sales);

        // Calculate achievement
        if (aggregated.monthlyTarget > 0) {
            aggregated.achievement = ((aggregated.currentSales / aggregated.monthlyTarget) * 100).toFixed(1) + "%";
        } else {
            aggregated.achievement = "0.0%";
        }

        // Cache the result
        this.stateDataCache[stateId] = aggregated;
        console.log(`State data aggregated and cached for ${stateName}:`, aggregated);

        return aggregated;
    }
    /**
     * Get aggregated data for the entire country (Pan India)
     * @returns {Promise<object>} Aggregated country data
     */
    async getCountryData() {
        const rawData = await this.fetchSheetData();
        console.log(`Getting Pan India data... (${rawData.length} rows)`);

        const aggregated = {
            name: 'Pan India',
            population: '1.4B+',
            dealerCount: 0,
            currentSales: 0,
            monthlyTarget: 500000 * 30, // Rough estimate: 5L * 30 states/UTs (or sum of all targets)
            // Ideally we sum distinct targets, but the cached data has a fixed target per district/state.
            dealers: []
        };

        // Process each row
        for (const row of rawData) {
            const customerName = row['customer_name'] || 'Unknown Dealer';
            const isYesCloud = customerName.toLowerCase().startsWith('yescloud');

            if (!isYesCloud) {
                aggregated.dealerCount += 1;
            }

            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;
            aggregated.currentSales += sales;

            aggregated.dealers.push({
                name: customerName,
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Kerala',
                isYesCloud: isYesCloud
            });
        }

        // Sort dealers by sales (highest first)
        aggregated.dealers.sort((a, b) => b.sales - a.sales);

        // Calculate Total Target from KPI Data
        let totalTarget = 0;
        try {
            const kpiData = await this.fetchKPIData();
            if (kpiData) {
                // Sum targets of all states available in KPI data
                Object.values(kpiData).forEach(kpi => {
                    if (kpi.target) {
                        totalTarget += this.parseTargetValue(kpi.target);
                    }
                });
            }
        } catch (e) {
            console.warn('Failed to calc total target:', e);
        }

        // Fallback if no target data found (e.g. 10 Cr default)
        if (totalTarget === 0) totalTarget = 100000000;

        aggregated.monthlyTarget = totalTarget;

        if (aggregated.monthlyTarget > 0) {
            aggregated.achievement = ((aggregated.currentSales / aggregated.monthlyTarget) * 100).toFixed(1) + "%";
        } else {
            aggregated.achievement = "0.0%";
        }

        return aggregated;
    }

    /**
     * Aggregate dealer sales by state
     * @param {Array} dealers - List of dealer objects
     */
    aggregateByState(dealers) {
        if (!dealers || dealers.length === 0) return [];

        const stateMap = {};

        // 1. Initialize with ALL states having 0 sales
        const allStates = this.getAllStateNames();
        allStates.forEach(name => {
            stateMap[name] = { name: name, totalSales: 0, dealerCount: 0 };
        });

        // 2. Aggregate sales by state
        console.log(`Aggregating dealers: ${dealers.length} entries`);
        dealers.forEach(dealer => {
            let rawState = dealer.state || 'Unknown';
            let stateKey = this.normalizeStateName(rawState);

            if (!stateMap[stateKey]) {
                // console.warn(`Unmapped state: ${rawState} -> ${stateKey}`); // Optional noisier log
                stateMap[stateKey] = { name: stateKey, totalSales: 0, dealerCount: 0 };
            }
            stateMap[stateKey].totalSales += dealer.sales || 0;

            // Only increment count if not yescloud
            if (!dealer.isYesCloud && !dealer.name.toLowerCase().startsWith('yescloud')) {
                stateMap[stateKey].dealerCount += 1;
            }
        });

        // Convert to array and sort by totalSales
        const statesArray = Object.values(stateMap);
        statesArray.sort((a, b) => b.totalSales - a.totalSales);

        return statesArray;
    }

    // --- Firebase Storage Methods ---

    /**
     * Upload a CSV file to Firebase Storage
     * @param {File} file - The file object from input
     * @param {string} customName - User defined name for the report
     */
    async uploadCSV(file, customName) {
        try {
            const timestamp = Date.now();
            const safeName = customName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
            const fileName = `reports/${safeName}_${timestamp}.csv`;
            const storageRef = ref(storage, fileName);

            // Add metadata
            const metadata = {
                customMetadata: {
                    'reportName': customName,
                    'uploadedAt': new Date().toISOString()
                }
            };

            const snapshot = await uploadBytes(storageRef, file, metadata);
            console.log('Uploaded a blob or file!', snapshot);

            const url = await getDownloadURL(snapshot.ref);

            // Sync with Firestore
            const newItem = {
                id: Math.random().toString(36).substr(2, 9),
                name: customName,
                fullPath: snapshot.ref.fullPath,
                url: url,
                timeCreated: new Date().toISOString()
            };

            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            let currentItems = [];
            if (docSnap.exists()) {
                currentItems = docSnap.data().items || [];
            }

            // Prepend new item
            currentItems.unshift(newItem);

            await setDoc(docRef, { items: currentItems });
            console.log('Report list updated in Firestore.');

            return newItem; // Return full structure
        } catch (e) {
            console.error('Upload failed:', e);
            throw e;
        }
    }


    /**
     * Delete a report from Storage and Firestore
     */
    async deleteReport(report) {
        if (!report || !report.fullPath) return;

        try {
            // 1. Delete from Storage
            const fileRef = ref(storage, report.fullPath);
            await deleteObject(fileRef);
            console.log('Deleted from Storage:', report.fullPath);

            // 2. Delete from Firestore List
            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const updatedItems = data.items.filter(item => item.id !== report.id);
                await setDoc(docRef, { items: updatedItems });
                console.log('Deleted from Firestore list:', report.id);
            }
        } catch (e) {
            console.error('Delete failed:', e);
            throw e;
        }
    }

    /**
     * Rename a report in Firestore
     */
    async renameReport(report, newName) {
        if (!report || !newName) return;

        try {
            const docRef = doc(db, "settings", "reports");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                const items = data.items || [];

                const index = items.findIndex(item => item.id === report.id);
                if (index !== -1) {
                    items[index].name = newName;
                    await setDoc(docRef, { items: items });
                    console.log('Report renamed:', report.id, newName);
                }
            }
        } catch (e) {
            console.error('Rename failed:', e);
            throw e;
        }
    }

    /**
     * Get the latest upload timestamp directly from Storage
     */
    async getLastStorageUpdate() {
        const listRef = ref(storage, 'reports/');
        try {
            const res = await listAll(listRef);

            if (res.items.length === 0) return null;

            // Fetch metadata for all items to find the latest
            // Use Promise.all for parallel fetching
            const metaPromises = res.items.map(item => getMetadata(item));
            const metas = await Promise.all(metaPromises);

            // Sort descending by timeCreated
            metas.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

            return metas.length > 0 ? metas[0].timeCreated : null;
        } catch (e) {
            console.error('Failed to get last storage update:', e);
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
     * Backfills from Storage if Firestore is empty (Migration)
     */
    async listReports() {
        // 1. Try Firestore
        const docRef = doc(db, "settings", "reports");
        try {
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.items && Array.isArray(data.items)) {
                    console.log(`Loaded ${data.items.length} reports from Firestore.`);
                    return data.items;
                }
            }
        } catch (e) {
            console.warn('Failed to load reports from Firestore:', e);
        }

        // 2. Fallback: Migration from Storage
        console.log('Migrating reports from Storage to Firestore...');
        const listRef = ref(storage, 'reports/');
        try {
            const res = await listAll(listRef);
            const reports = [];

            for (const itemRef of res.items) {
                const meta = await getMetadata(itemRef);
                const url = await getDownloadURL(itemRef);
                reports.push({
                    id: Math.random().toString(36).substr(2, 9), // Simple ID
                    name: meta.customMetadata && meta.customMetadata.reportName ? meta.customMetadata.reportName : itemRef.name,
                    fullPath: itemRef.fullPath,
                    url: url,
                    timeCreated: meta.timeCreated
                });
            }

            // Sort by newest first
            reports.sort((a, b) => new Date(b.timeCreated) - new Date(a.timeCreated));

            // Save to Firestore
            await setDoc(docRef, { items: reports });
            console.log('Migration complete. Saved to Firestore.');

            return reports;
        } catch (e) {
            console.error('List failed:', e);
            return [];
        }
    }
}

// Expose to window
window.DataManager = DataManager;

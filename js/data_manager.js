/**
 * DataManager
 * Handles fetching real-time data from Google Sheets and resolving zip codes to districts.
 */
class DataManager {
    constructor() {
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1K6Aq1BVmqt7y8PfOecO8FteKO1ONtXEeTc6DIZUUnwA/gviz/tq?tqx=out:csv';
        // URL for the 'zip_codes' sheet CSV export
        this.zipSheetUrl = 'https://docs.google.com/spreadsheets/d/1K6Aq1BVmqt7y8PfOecO8FteKO1ONtXEeTc6DIZUUnwA/gviz/tq?tqx=out:csv&sheet=zip_codes';

        // PASTE YOUR WEB APP URL HERE
        this.zipWriteUrl = 'https://script.google.com/macros/s/AKfycbzUJRe5EGqoFV1AIT7XyjQafGkOOXaIYAeQIbRY0JT31g-_f4jYrltxiIbE_FSDF2Sw_A/exec';

        this.zipApiUrl = 'https://api.postalpincode.in/pincode/';

        // Load cache from localStorage or initialize empty
        this.zipCache = this.loadCacheFromStorage();
        this.processedData = {};

        // Cache for state-level aggregated data
        this.stateDataCache = {};
        this.rawDataCache = null; // Cache the raw sheet data
        this.rawDataTimestamp = null;

        // Initialize by loading zip sheet
        this.sheetZips = new Set(); // Track what is IN the sheet
        this.loadZipSheet();
    }

    /**
     * Pre-load zip codes from the Google Sheet
     */
    async loadZipSheet() {
        try {
            console.log('Fetching zip_codes sheet...');
            const response = await fetch(this.zipSheetUrl);
            const csvText = await response.text();
            // console.log('Raw CSV:', csvText.substring(0, 200)); // Debug raw

            const data = this.parseCSV(csvText);
            if (data.length > 0) {
                // console.log('First row of zip data:', data[0]);
            }

            let count = 0;
            data.forEach(row => {
                if (row.zip && row.district) {
                    // Clean zip
                    let zip = row.zip.toString().replace(/\s/g, '');
                    // Update cache if new or overwrite? Let's treat sheet as source of truth
                    this.zipCache[zip] = row.district;
                    this.sheetZips.add(zip); // Mark as present in sheet
                    count++;
                }
            });
            console.log(`Loaded ${count} zip codes from sheet into cache.`);
            // Save to storage to persist across reloads even if offline
            this.saveCacheToStorage();
        } catch (e) {
            console.warn('Failed to load zip_codes sheet:', e);
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
     * Fetches data from the Google Sheet (with caching)
     */
    async fetchSheetData() {
        // Use cached data if it's less than 5 minutes old
        const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
        const now = Date.now();

        if (this.rawDataCache && this.rawDataTimestamp && (now - this.rawDataTimestamp) < CACHE_DURATION) {
            console.log('Using cached sheet data');
            return this.rawDataCache;
        }

        try {
            const response = await fetch(this.sheetUrl);
            const csvText = await response.text();
            const data = this.parseCSV(csvText);

            // Cache the data
            this.rawDataCache = data;
            this.rawDataTimestamp = now;
            console.log('Fetched and cached fresh sheet data');

            return data;
        } catch (error) {
            console.error('Error fetching sheet data:', error);
            // Return cached data if available, even if stale
            return this.rawDataCache || [];
        }
    }

    /**
     * Parses CSV text into an array of objects
     */
    parseCSV(csvText) {
        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
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

                // Write back to Google Sheet if configured
                this.writeZipToSheet(zipCode, district);

                return district;
            }
        } catch (error) {
            console.warn(`Failed to resolve zip ${zipCode}:`, error);
        }
        return null;
    }

    /**
     * Writes a resolved zip code back to the Google Sheet via Web App
     */
    async writeZipToSheet(zip, district) {
        if (!this.zipWriteUrl) {
            console.warn('[Debug] Write URL not configured');
            return;
        }

        try {
            console.log(`[Debug] Sending POST to Apps Script: ${zip}, ${district}`);
            await fetch(this.zipWriteUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8',
                },
                body: JSON.stringify({ zip: zip, district: district })
            });
            console.log(`[Debug] Sent request to sheet for ${zip}`);
        } catch (e) {
            console.warn('[Debug] Failed to write zip to sheet:', e);
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
     */
    async loadData(stateName = 'Kerala', districtIds = []) {
        console.log(`Starting data load for ${stateName}...`);
        const rawData = await this.fetchSheetData();
        console.log(`Fetched ${rawData.length} rows from sheet.`);

        // Filter for specific state
        const stateLower = stateName.toLowerCase();
        const stateData = rawData.filter(row => {
            const bState = (row['billing_state'] || '').toLowerCase();
            const sState = (row['shipping_state'] || '').toLowerCase();
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

        // Initialize stats
        for (const district of targets) {
            // Capitalize first letter for display name if no specific mapping exists
            const displayName = district.charAt(0).toUpperCase() + district.slice(1).replace(/-/g, ' ');

            districtStats[district] = {
                name: displayName, // Fallback, normally needs a map but this is okay for now
                population: 'N/A',
                dealerCount: 0,
                currentSales: 0,
                monthlyTarget: 500000,
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
                    this.writeZipToSheet(zip, district);
                    // Add to sheetZips so we don't try again this session
                    if (this.sheetZips) this.sheetZips.add(zip);
                    backfillCount++;
                    // Tiny delay to avoid overwhelming browser/network if massive?
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
                districtStats[districtKey].dealerCount += 1;
                let sales = parseFloat(row['sales'] || 0);
                if (isNaN(sales)) sales = 0;
                districtStats[districtKey].currentSales += sales;
                districtStats[districtKey].dealers.push({
                    name: row['customer_name'] || 'Unknown Dealer',
                    sales: sales
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
            totalSales: districtStats[key].currentSales || 0
        }));

        // Sort by total sales descending (highest first)
        return districtArray.sort((a, b) => b.totalSales - a.totalSales);
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
        if (this.stateDataCache[stateId]) {
            console.log(`Using cached data for ${stateId}`);
            return this.stateDataCache[stateId];
        }

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

        // Filter for this state
        const stateData = rawData.filter(row => {
            const bState = (row['billing_state'] || '').toLowerCase();
            const sState = (row['shipping_state'] || '').toLowerCase();
            const searchName = stateName.toLowerCase();
            return bState.includes(searchName) || sState.includes(searchName);
        });

        console.log(`Found ${stateData.length} entries for ${stateName}`);

        // Aggregate data
        const aggregated = {
            name: stateName,
            population: 'N/A',
            dealerCount: 0,
            currentSales: 0,
            monthlyTarget: 500000, // Fixed 5 lakh target
            dealers: []
        };

        // Process each row
        for (const row of stateData) {
            aggregated.dealerCount += 1;

            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;

            aggregated.currentSales += sales;

            aggregated.dealers.push({
                name: row['customer_name'] || 'Unknown Dealer',
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Unknown'
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
            aggregated.dealerCount += 1;
            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;
            aggregated.currentSales += sales;

            aggregated.dealers.push({
                name: row['customer_name'] || 'Unknown Dealer',
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Unknown'
            });
        }

        // Dynamic Target Calculation?
        // If we assume every row represents a dealer, and every active district has a target...
        // For now, let's keep a static high target or leave it blank. 
        // Or calculate specific target based on active dealers?


        // Sort dealers by sales (highest first)
        aggregated.dealers.sort((a, b) => b.sales - a.sales);

        aggregated.monthlyTarget = 100000000; // 10 Cr placeholder or sum? 

        if (aggregated.monthlyTarget > 0) {
            aggregated.achievement = ((aggregated.currentSales / aggregated.monthlyTarget) * 100).toFixed(1) + "%";
        } else {
            aggregated.achievement = "0.0%";
        }

        return aggregated;
    }
}

// Expose to window
window.DataManager = DataManager;

/**
 * DataManager
 * Handles fetching real-time data from Google Sheets and resolving zip codes to districts.
 */
class DataManager {
    constructor() {
        this.sheetUrl = 'https://docs.google.com/spreadsheets/d/1K6Aq1BVmqt7y8PfOecO8FteKO1ONtXEeTc6DIZUUnwA/gviz/tq?tqx=out:csv';
        this.zipApiUrl = 'https://api.postalpincode.in/pincode/';

        // Load cache from localStorage or initialize empty
        this.zipCache = this.loadCacheFromStorage();
        this.processedData = {};

        // Cache for state-level aggregated data
        this.stateDataCache = {};
        this.rawDataCache = null; // Cache the raw sheet data
        this.rawDataTimestamp = null;
    }

    /**
     * Load zip code cache from localStorage
     */
    loadCacheFromStorage() {
        try {
            const cached = localStorage.getItem('zipCodeCache');
            if (cached) {
                console.log('Loaded zip code cache from localStorage');
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

        // Check cache first
        if (this.zipCache[zipCode]) {
            return this.zipCache[zipCode];
        }

        try {
            // Add a small delay to be nice to the API if we are making many requests
            // In a real bulk scenario, we'd want a proper queue. 
            // For now, we'll rely on the fact that we process sequentially or the browser limits concurrent requests.
            const response = await fetch(`${this.zipApiUrl}${zipCode}`);
            const data = await response.json();

            if (data && data[0].Status === "Success" && data[0].PostOffice && data[0].PostOffice.length > 0) {
                // Look for the district in the first PostOffice entry
                // The API returns "District" field.
                const district = data[0].PostOffice[0].District;

                // Normalize district name to match our keys (lowercase, no spaces if needed)
                // We'll return the raw API district name here and normalize later
                this.zipCache[zipCode] = district;
                return district;
            }
        } catch (error) {
            console.warn(`Failed to resolve zip ${zipCode}:`, error);
        }
        return null;
    }

    /**
     * Normalizes district names to match our internal keys
     */
    normalizeDistrictName(districtName) {
        if (!districtName) return null;
        const lower = districtName.toLowerCase().trim();

        // Map common variations to our keys
        const map = {
            'thiruvananthapuram': 'thiruvananthapuram',
            'trivandrum': 'thiruvananthapuram',
            'kollam': 'kollam',
            'pathanamthitta': 'pathanamthitta',
            'alappuzha': 'alappuzha',
            'alleppey': 'alappuzha',
            'kottayam': 'kottayam',
            'idukki': 'idukki',
            'ernakulam': 'ernakulam',
            'cochin': 'ernakulam',
            'kochi': 'ernakulam',
            'thrissur': 'thrissur',
            'trichur': 'thrissur',
            'palakkad': 'palakkad',
            'palghat': 'palakkad',
            'malappuram': 'malappuram',
            'kozhikode': 'kozhikode',
            'calicut': 'kozhikode',
            'wayanad': 'wayanad',
            'kannur': 'kannur',
            'cannanore': 'kannur',
            'kasaragod': 'kasaragod',
            'kasargod': 'kasaragod'
        };

        return map[lower] || null;
    }

    /**
     * Main function to load and process data
     */
    async loadData() {
        console.log("Starting data load...");
        const rawData = await this.fetchSheetData();
        console.log(`Fetched ${rawData.length} rows from sheet.`);

        // Filter for Kerala only (based on state) and valid zip
        // We look at billing_state or shipping_state
        const keralaData = rawData.filter(row => {
            const bState = (row['billing_state'] || '').toLowerCase();
            const sState = (row['shipping_state'] || '').toLowerCase();
            return bState.includes('kerala') || sState.includes('kerala');
        });

        console.log(`Filtered to ${keralaData.length} Kerala entries.`);

        const districtStats = {};

        // Initialize stats for all Kerala districts
        const districtList = [
            'kasaragod', 'kannur', 'wayanad', 'kozhikode', 'malappuram',
            'palakkad', 'thrissur', 'ernakulam', 'idukki', 'kottayam',
            'alappuzha', 'pathanamthitta', 'kollam', 'thiruvananthapuram'
        ];

        const districtDisplayNames = {
            'kasaragod': 'Kasaragod',
            'kannur': 'Kannur',
            'wayanad': 'Wayanad',
            'kozhikode': 'Kozhikode',
            'malappuram': 'Malappuram',
            'palakkad': 'Palakkad',
            'thrissur': 'Thrissur',
            'ernakulam': 'Ernakulam',
            'idukki': 'Idukki',
            'kottayam': 'Kottayam',
            'alappuzha': 'Alappuzha',
            'pathanamthitta': 'Pathanamthitta',
            'kollam': 'Kollam',
            'thiruvananthapuram': 'Thiruvananthapuram'
        };

        for (const district of districtList) {
            districtStats[district] = {
                name: districtDisplayNames[district],
                population: 'N/A',
                dealerCount: 0,
                currentSales: 0,
                monthlyTarget: 500000, // Fixed 5 lakh target
                dealers: []
            };
        }

        // OPTIMIZATION 1: Collect unique zip codes that need resolution
        const uniqueZips = new Set();
        for (const row of keralaData) {
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) continue;

            // Clean zip (remove spaces)
            zip = zip.replace(/\s/g, '');

            // Only add to set if not already in cache
            if (!this.zipCache[zip]) {
                uniqueZips.add(zip);
            }
        }

        // OPTIMIZATION 2: Resolve only unique uncached zip codes
        if (uniqueZips.size > 0) {
            console.log(`Resolving ${uniqueZips.size} unique uncached zip codes...`);
            let resolvedCount = 0;

            for (const zip of uniqueZips) {
                await this.getDistrictFromZip(zip);
                resolvedCount++;

                // Log progress every 10 zip codes
                if (resolvedCount % 10 === 0) {
                    console.log(`Resolved ${resolvedCount}/${uniqueZips.size} zip codes...`);
                }
            }

            // Save cache after resolving new zip codes
            this.saveCacheToStorage();
            console.log(`Resolved all ${uniqueZips.size} unique zip codes and saved to cache.`);
        } else {
            console.log('All zip codes found in cache - no API calls needed!');
        }

        // Process each row using cached data
        for (const row of keralaData) {
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (!zip) continue;

            // Clean zip (remove spaces)
            zip = zip.replace(/\s/g, '');

            // Use cached district name
            const districtName = this.zipCache[zip];
            const districtKey = this.normalizeDistrictName(districtName);

            if (districtKey && districtStats[districtKey]) {
                districtStats[districtKey].dealerCount += 1;

                // Parse sales
                let sales = parseFloat(row['sales'] || 0);
                if (isNaN(sales)) sales = 0;

                districtStats[districtKey].currentSales += sales;

                // Store dealer info
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
            'IN-AN': 'Andaman and Nicobar', 'IN-AP': 'Andhra Pradesh', 'IN-AR': 'Arunachal Pradesh',
            'IN-AS': 'Assam', 'IN-BR': 'Bihar', 'IN-CH': 'Chandigarh', 'IN-CT': 'Chhattisgarh',
            'IN-DD': 'Daman and Diu', 'IN-DL': 'Delhi', 'IN-DN': 'Dadra and Nagar Haveli',
            'IN-GA': 'Goa', 'IN-GJ': 'Gujarat', 'IN-HP': 'Himachal Pradesh', 'IN-HR': 'Haryana',
            'IN-JH': 'Jharkhand', 'IN-JK': 'Jammu and Kashmir', 'IN-KA': 'Karnataka', 'IN-KL': 'Kerala',
            'IN-LD': 'Lakshadweep', 'IN-MH': 'Maharashtra', 'IN-ML': 'Meghalaya', 'IN-MN': 'Manipur',
            'IN-MP': 'Madhya Pradesh', 'IN-MZ': 'Mizoram', 'IN-NL': 'Nagaland', 'IN-OR': 'Odisha',
            'IN-PB': 'Punjab', 'IN-PY': 'Puducherry', 'IN-RJ': 'Rajasthan', 'IN-SK': 'Sikkim',
            'IN-TG': 'Telangana', 'IN-TN': 'Tamil Nadu', 'IN-TR': 'Tripura', 'IN-UP': 'Uttar Pradesh'
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
                sales: sales
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
}

// Expose to window
window.DataManager = DataManager;

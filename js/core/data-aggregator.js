/**
 * @fileoverview Data aggregation logic for states, districts, and country
 * @module core/data-aggregator
 */

/**
 * Service class for handling all data aggregation operations
 */
export class DataAggregator {
    /**
     * Creates a new DataAggregator instance
     * @param {Object} firestoreService - Firestore service for fetching KPI data
     * @param {Function} normalizeKeyFn - Function to normalize keys for lookups
     * @param {Function} parseTargetValueFn - Function to parse target values
     * @param {Function} getLevenshteinDistanceFn - Function for fuzzy string matching
     */
    constructor(firestoreService, normalizeKeyFn, parseTargetValueFn, getLevenshteinDistanceFn) {
        this.firestoreService = firestoreService;
        this.normalizeKey = normalizeKeyFn;
        this.parseTargetValue = parseTargetValueFn;
        this.getLevenshteinDistance = getLevenshteinDistanceFn;
    }

    /**
     * Get list of all known state names
     * @returns {Array<string>} Array of canonical state names
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
     * Normalize state name to handle variations (e.g. Tamilnadu -> Tamil Nadu)
     * @param {string} rawStateName - Raw state name from data
     * @returns {string} Normalized canonical state name
     */
    normalizeStateName(rawStateName) {
        if (!rawStateName) return 'Unknown'; // Default to Unknown instead of Kerala to avoid pollution

        // Canonical List of Indian States and UTs
        const CANONICAL_STATES = [
            "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
            "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala",
            "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
            "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
            "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
            "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry", "Ladakh"
        ];

        // Helper to clean string: lowercase, replace & with and, remove non-alphanumeric
        const clean = (str) => str.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
        const target = clean(rawStateName);

        // 1. Exact Match on clean string
        for (const canonical of CANONICAL_STATES) {
            if (clean(canonical) === target) return canonical;
        }

        // 2. Fuzzy Match on clean string
        let bestMatch = null;
        let bestDist = Infinity;

        for (const canonical of CANONICAL_STATES) {
            const cleanCanonical = clean(canonical);
            const dist = this.getLevenshteinDistance(target, cleanCanonical);

            if (dist < bestDist) {
                bestDist = dist;
                bestMatch = canonical;
            }
        }

        // Threshold logic
        const threshold = target.length < 5 ? 1 : 3;

        if (bestMatch && bestDist <= threshold) {
            return bestMatch;
        }

        // Fallback: Return Title Case of original cleaned text or just original
        // Let's return original trimmed if no match, to avoid data loss
        return rawStateName.trim();
    }

    /**
     * Get districts sorted by total sales (for Kerala)
     * @param {Object} districtStats - District statistics object from loadData
     * @returns {Array} Array of {name, totalSales, dealerCount} objects sorted by sales descending
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
     * Aggregate dealer sales by state
     * @param {Array} dealers - List of dealer objects
     * @returns {Array} Array of state aggregations sorted by sales
     */
    aggregateByState(dealers) {
        return this.aggregateStatesWithKPIs(dealers, null);
    }

    /**
     * Aggregate dealers by state and include KPI data (Target, Achievement)
     * @param {Array} dealers - List of dealer objects
     * @param {Object} kpiData - KPI data map (optional)
     * @returns {Array} Array of state aggregations with sales, count, and achievement
     */
    aggregateStatesWithKPIs(dealers, kpiData) {
        if (!dealers || dealers.length === 0) return [];

        const stateMap = {};

        // 1. Initialize with ALL states
        const allStates = this.getAllStateNames();
        allStates.forEach(name => {
            stateMap[name] = {
                name: name,
                totalSales: 0,
                currentSales: 0,
                dealerCount: 0,
                monthlyTarget: 0,
                achievement: 0,
                population: 'N/A',
                gdp: 'N/A'
            };
        });

        // 2. Aggregate sales
        dealers.forEach(dealer => {
            let rawState = dealer.state || 'Unknown';
            let stateKey = this.normalizeStateName(rawState);

            if (!stateMap[stateKey]) {
                stateMap[stateKey] = {
                    name: stateKey,
                    totalSales: 0,
                    currentSales: 0,
                    dealerCount: 0,
                    monthlyTarget: 0,
                    achievement: 0
                };
            }

            const val = dealer.sales || 0;
            stateMap[stateKey].totalSales += val;
            stateMap[stateKey].currentSales += val; // Alias for tooltip consistency

            if (!dealer.isYesCloud && !dealer.name.toLowerCase().startsWith('yescloud')) {
                stateMap[stateKey].dealerCount += 1;
            }
        });

        // 3. Enrich with KPIs and Calculate Achievement
        Object.values(stateMap).forEach(state => {
            const key = this.normalizeKey(state.name);
            const kpi = kpiData ? kpiData[key] : null;

            if (kpi) {
                state.population = kpi.population || 'N/A';
                state.gdp = kpi.gdp || 'N/A';
                state.monthlyTarget = kpi.target ? this.parseTargetValue(kpi.target) : 500000;
            } else {
                state.monthlyTarget = 500000; // Default
            }

            // Calculate Achievement
            if (state.monthlyTarget > 0) {
                state.achievement = ((state.currentSales / state.monthlyTarget) * 100).toFixed(1); // Keep as number string
            } else {
                state.achievement = "0.0";
            }
        });

        // Convert to array and sort by totalSales
        const statesArray = Object.values(stateMap);
        statesArray.sort((a, b) => b.totalSales - a.totalSales);

        return statesArray;
    }

    /**
     * Get aggregated state data enriched with KPIs (GDP, Pop)
     * @param {Array} rawData - Raw dealer data
     * @returns {Promise<Array>} Array of state objects with KPI data
     */
    async getStatesWithKPIs(rawData) {
        // Fetch KPI data
        const kpiData = await this.firestoreService.fetchKPIData();

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
        if (rawData && Array.isArray(rawData)) {
            rawData.forEach(row => {
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
     * Get aggregated data for a specific state (other than Kerala which uses districts)
     * @param {string} stateId - State ID (e.g., 'IN-TN' for Tamil Nadu)
     * @param {Array} rawData - Raw dealer data
     * @param {Object} dealerOverrides - Dealer overrides map
     * @param {Object} zipCache - Zip code cache
     * @param {Object} stateDataCache - State data cache
     * @param {Function} resolveMissingDistrictsFn - Function to resolve missing districts
     * @param {Function} normalizeStateNameFn - Function from parent for consistency
     * @returns {Promise<Object>} Aggregated state data
     */
    async getStateData(stateId, rawData, dealerOverrides, zipCache, stateDataCache, resolveMissingDistrictsFn, normalizeStateNameFn) {
        console.log(`Getting state data for ${stateId}...`);

        // State ID to name mapping
        const stateNames = {
            'IN-AN': 'Andaman and Nicobar Islands', 'IN-AP': 'Andhra Pradesh', 'IN-AR': 'Arunachal Pradesh',
            'IN-AS': 'Assam', 'IN-BR': 'Bihar', 'IN-CH': 'Chandigarh', 'IN-CT': 'Chhattisgarh',
            'IN-DD': 'Daman and Diu', 'IN-DL': 'Delhi', 'IN-GA': 'Goa', 'IN-GJ': 'Gujarat', 'IN-HP': 'Himachal Pradesh', 'IN-HR': 'Haryana',
            'IN-JH': 'Jharkhand', 'IN-JK': 'Jammu and Kashmir', 'IN-KA': 'Karnataka', 'IN-KL': 'Kerala',
            'IN-LD': 'Lakshadweep', 'IN-MH': 'Maharashtra', 'IN-ML': 'Meghalaya', 'IN-MN': 'Manipur',
            'IN-MP': 'Madhya Pradesh', 'IN-MZ': 'Mizoram', 'IN-NL': 'Nagaland', 'IN-OR': 'Odisha',
            'IN-PB': 'Punjab', 'IN-PY': 'Puducherry', 'IN-RJ': 'Rajasthan', 'IN-SK': 'Sikkim',
            'IN-TG': 'Telangana', 'IN-TN': 'Tamil Nadu', 'IN-TR': 'Tripura', 'IN-UP': 'Uttar Pradesh',
            'IN-UT': 'Uttarakhand', 'IN-WB': 'West Bengal'
        };

        const stateName = stateNames[stateId] || stateId;

        // Ensure districts are resolved for this data
        await resolveMissingDistrictsFn(rawData);

        // APPLY DEALER OVERRIDES TO RAW DATA BEFORE FILTERING
        // This ensures dealers with overridden state/zip show up in correct state views
        for (const row of rawData) {
            const customerName = row['customer_name'];
            if (dealerOverrides && dealerOverrides[customerName]) {
                const ov = dealerOverrides[customerName];
                for (const [key, val] of Object.entries(ov)) {
                    if (val !== undefined) row[key] = val;
                }
            }
        }

        // Robust Filtering using Normalize (NOW AFTER OVERRIDES)
        const targetState = normalizeStateNameFn(stateName);

        const stateData = rawData.filter(row => {
            const raw = row['billing_state'] || row['shipping_state'] || '';
            const normalizedRow = normalizeStateNameFn(raw);
            const match = normalizedRow === targetState;
            return match;
        });

        // Fetch KPI Data for Target lookup
        const kpiData = await this.firestoreService.fetchKPIData();
        const normalizeKey = this.normalizeKey(stateName);
        const kpi = kpiData ? kpiData[normalizeKey] : null;

        // Aggregate data
        const aggregated = {
            name: stateName,
            population: kpi ? kpi.population : 'N/A',
            gdp: kpi ? kpi.gdp : 'N/A',
            dealerCount: 0,
            currentSales: 0,
            monthlyTarget: kpi && kpi.target ? this.parseTargetValue(kpi.target) : 500000,
            dealers: []
        };

        // Process each row
        for (const row of stateData) {
            // Note: Overrides already applied before filtering
            const customerName = row['customer_name'];
            const isYesCloud = customerName.toLowerCase().startsWith('yescloud');

            if (!isYesCloud) {
                aggregated.dealerCount += 1;
            }

            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;

            aggregated.currentSales += sales;

            // INJECT DISTRICT
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (zip) zip = zip.replace(/\s/g, '');
            row['district'] = zipCache[zip] || 'Unknown';

            aggregated.dealers.push({
                name: customerName,
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Unknown',
                billingZip: row['billing_zipcode'],
                shippingZip: row['shipping_zipcode'],
                isYesCloud: isYesCloud,
                rawData: row
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
        stateDataCache[stateId] = aggregated;
        console.log(`State data aggregated and cached for ${stateName}:`, aggregated);

        return aggregated;
    }

    /**
     * Get aggregated data for the entire country (Pan India)
     * @param {Array} rawData - Raw dealer data
     * @param {Object} dealerOverrides - Dealer overrides map
     * @param {Object} zipCache - Zip code cache
     * @param {Function} resolveMissingDistrictsFn - Function to resolve missing districts
     * @returns {Promise<Object>} Aggregated country data
     */
    async getCountryData(rawData, dealerOverrides, zipCache, resolveMissingDistrictsFn) {
        console.log(`Getting Pan India data... (${rawData.length} rows)`);

        // Ensure districts are resolved
        await resolveMissingDistrictsFn(rawData);

        // Fetch & Aggregate KPI Data
        const kpiData = await this.firestoreService.fetchKPIData();
        let totalPop = 0;
        let totalTarget = 0;
        let totalGDP = 0;

        if (kpiData) {
            // Check for explicit "India" entry first
            const indiaKey = this.normalizeKey('India');
            const indiaData = kpiData[indiaKey];

            if (indiaData) {
                console.log('Using explicit India KPI data:', indiaData);
                totalPop = indiaData.population || '1.4B+';  // Use raw value
                totalTarget = this.parseTargetValue(indiaData.target || indiaData.monthlyTarget);
                totalGDP = indiaData.gdp || 'N/A';  // Use raw value, don't parse
                console.log('[GDP Debug] Raw India GDP:', {
                    raw: indiaData.gdp,
                    stored: totalGDP
                });
            } else {
                // Fallback: Sum up all states if "India" entry is missing
                console.log('Explicit India data not found, aggregating states...');
                Object.values(kpiData).forEach(item => {
                    // Avoid double counting if there's a variation of India in there
                    const name = (item.name || '').toLowerCase();
                    if (name !== 'india' && name !== 'pan india') {
                        totalPop += this.parseTargetValue(item.population);
                        totalTarget += this.parseTargetValue(item.target || item.monthlyTarget);
                        totalGDP += this.parseTargetValue(item.gdp);
                    }
                });
            }
        }

        const aggregated = {
            name: 'Pan India',
            population: totalPop || '1.4B+',
            gdp: totalGDP || 'N/A',  // Keep as string
            dealerCount: 0,
            currentSales: 0,
            monthlyTarget: totalTarget > 0 ? totalTarget : (500000 * 30),
            dealers: []
        };

        console.log('[GDP Debug] Final aggregated object:', {
            gdp: aggregated.gdp,
            population: aggregated.population,
            target: aggregated.monthlyTarget
        });

        // Process each row
        for (const row of rawData) {
            // APPLY OVERRIDES HERE
            const customerName = row['customer_name'];
            if (dealerOverrides && dealerOverrides[customerName]) {
                const ov = dealerOverrides[customerName];
                for (const [key, val] of Object.entries(ov)) {
                    if (val !== undefined) row[key] = val;
                }
            }

            const isYesCloud = (customerName || '').toLowerCase().startsWith('yescloud');

            if (!isYesCloud) {
                aggregated.dealerCount += 1;
            }

            let sales = parseFloat(row['sales'] || 0);
            if (isNaN(sales)) sales = 0;
            aggregated.currentSales += sales;

            // INJECT DISTRICT
            let zip = row['billing_zipcode'] || row['shipping_zipcode'];
            if (zip) zip = zip.replace(/\s/g, '');
            row['district'] = zipCache[zip] || 'Unknown';

            aggregated.dealers.push({
                name: customerName,
                sales: sales,
                state: row['billing_state'] || row['shipping_state'] || 'Kerala',
                billingZip: row['billing_zipcode'],
                shippingZip: row['shipping_zipcode'],
                isYesCloud: isYesCloud,
                rawData: row
            });
        }

        // Sort dealers by sales (highest first)
        aggregated.dealers.sort((a, b) => b.sales - a.sales);

        if (aggregated.monthlyTarget > 0) {
            aggregated.achievement = ((aggregated.currentSales / aggregated.monthlyTarget) * 100).toFixed(1) + "%";
        } else {
            aggregated.achievement = "0.0%";
        }

        return aggregated;
    }
}

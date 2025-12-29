/**
 * @fileoverview Merges read-only report data with dealer overrides
 * @module services/data-merge-service
 */

/**
 * Service class for merging immutable report data with dealer overrides
 */
export class DataMergeService {
    /**
     * Creates a new DataMergeService instance
     * @param {Object} firestoreService - Firestore service instance
     */
    constructor(firestoreService) {
        this.firestoreService = firestoreService;
    }

    /**
     * Merge report data with overrides
     * Overrides take precedence over original data
     * @param {Array} reportData - Original CSV data (frozen/immutable)
     * @param {Object} overrides - Dealer overrides by customer_name
     * @param {Array<string>} deactivatedList - List of deactivated dealer names
     * @returns {Array} Merged data with override flags
     */
    mergeData(reportData, overrides, deactivatedList = []) {
        if (!reportData || !Array.isArray(reportData)) {
            console.warn('[DataMergeService] Invalid report data provided');
            return [];
        }

        if (!overrides) {
            overrides = {};
        }

        console.log(`[DataMergeService] Merging ${reportData.length} dealers with ${Object.keys(overrides).length} overrides`);

        // Filter out YesCloud dealers
        const filteredData = reportData
            .filter(dealer => {
                const customerName = dealer.customer_name || dealer['customer_name'];
                if (!customerName) return true; // Keep if no name (shouldn't happen but safe)
                const lowerName = customerName.toLowerCase();
                return !lowerName.startsWith('yescloud') && !lowerName.startsWith('retail cloud');
            });

        // Consolidate duplicates (summing sales)
        let consolidatedData = this._consolidateDealers(filteredData);

        // Filter out Deactivated Dealers (Exact Name Match)
        if (deactivatedList && deactivatedList.length > 0) {
            const deactivatedSet = new Set(deactivatedList); // Optimize lookup
            const beforeCount = consolidatedData.length;
            consolidatedData = consolidatedData.filter(dealer => {
                // Check exact name match against deactivated list
                const name = dealer.customer_name || dealer['customer_name'];
                return !deactivatedSet.has(name);
            });
            console.log(`[DataMergeService] Filtered out ${beforeCount - consolidatedData.length} deactivated dealers`);
        }

        return consolidatedData.map(dealer => {
            const customerName = dealer.customer_name || dealer['customer_name'];
            const override = overrides[customerName];

            if (override) {
                // Merge override fields with original data
                // Override fields take precedence
                return {
                    ...dealer,
                    ...override,
                    _hasOverride: true,
                    _originalData: Object.freeze({ ...dealer }) // Keep frozen copy of original
                };
            }

            // No override for this dealer
            return {
                ...dealer,
                _hasOverride: false
            };
        });
    }

    /**
     * Consolidate duplicate dealers by summing sales
     * @private
     * @param {Array} dealers - Filtered dealer list
     * @returns {Array} Consolidated dealer list
     */
    _consolidateDealers(dealers) {
        const map = new Map();

        for (const dealer of dealers) {
            const rawName = dealer.customer_name || dealer['customer_name'];
            if (!rawName) continue; // Skip bad data

            // Strict Normalize: lower case, remove ALL non-alphanumeric characters
            // This merges "Dealer Name." and "Dealer Name" and "Dealer-Name"
            const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (!map.has(key)) {
                // Initialize with ALL fields from first occurrence
                // Ensure sales is a number
                const initialSales = parseFloat(dealer.sales || 0);
                map.set(key, {
                    ...dealer,
                    sales: isNaN(initialSales) ? 0 : initialSales,
                    total_sales: isNaN(initialSales) ? 0 : initialSales,
                    // Store original name case for display or use current one
                    customer_name: rawName
                });
            } else {
                const existing = map.get(key);
                const currentSales = parseFloat(dealer.sales || 0);

                // Sum sales
                const safeSales = isNaN(currentSales) ? 0 : currentSales;
                existing.sales += safeSales;
                existing.total_sales = (existing.total_sales || 0) + safeSales;

                // Merge address info if missing in existing entry but present in current
                if (!existing.billing_zipcode && dealer.billing_zipcode) existing.billing_zipcode = dealer.billing_zipcode;
                if (!existing.shipping_zipcode && dealer.shipping_zipcode) existing.shipping_zipcode = dealer.shipping_zipcode;
                if (!existing.billing_city && dealer.billing_city) existing.billing_city = dealer.billing_city;
                if (!existing.shipping_city && dealer.shipping_city) existing.shipping_city = dealer.shipping_city;
                if (!existing.billing_state && dealer.billing_state) existing.billing_state = dealer.billing_state;
                if (!existing.shipping_state && dealer.shipping_state) existing.shipping_state = dealer.shipping_state;

                // Merge categories (union)
                if (dealer.categories && Array.isArray(dealer.categories)) {
                    const existingCats = existing.categories || [];
                    const newCats = dealer.categories.filter(c => !existingCats.includes(c));
                    if (newCats.length > 0) {
                        existing.categories = [...existingCats, ...newCats];
                    }
                }
            }
        }

        return Array.from(map.values());
    }

    /**
     * Get original data for a dealer (before overrides)
     * @param {Object} mergedDealer - Merged dealer object
     * @returns {Object} Original dealer data
     */
    getOriginalData(mergedDealer) {
        if (mergedDealer._hasOverride && mergedDealer._originalData) {
            return mergedDealer._originalData;
        }
        // Return copy without internal flags
        const { _hasOverride, _originalData, ...original } = mergedDealer;
        return original;
    }

    /**
     * Get fields that have been overridden for a dealer
     * @param {Object} mergedDealer - Merged dealer object
     * @returns {Array<string>} List of overridden field names
     */
    getOverriddenFields(mergedDealer) {
        if (!mergedDealer._hasOverride || !mergedDealer._originalData) {
            return [];
        }

        const overriddenFields = [];
        const original = mergedDealer._originalData;

        for (const key in mergedDealer) {
            // Skip internal fields
            if (key.startsWith('_')) continue;

            // Check if value differs from original
            if (original[key] !== mergedDealer[key]) {
                overriddenFields.push(key);
            }
        }

        return overriddenFields;
    }
}

/**
 * @fileoverview Unified data layer for dashboard and dealer pages
 * @module core/data-layer
 */
import { DataStore } from './data-store.js';

/**
 * High-level API for accessing data across the application
 * Provides a single source of truth with intelligent caching
 */
export class DataLayer {
    /**
     * Creates a new DataLayer instance
     * @param {Object} firestoreService - Firestore service instance
     * @param {Object} dataAggregator - Data aggregator instance
     */
    constructor(firestoreService, dataAggregator) {
        this.store = new DataStore(firestoreService);
        this.aggregator = dataAggregator;
        this.firestoreService = firestoreService;
        this.currentReportId = null;
    }

    /**
     * Set active report
     * @param {string} reportId - Report ID to set as active (null for aggregated)
     */
    setActiveReport(reportId) {
        this.currentReportId = reportId;
        console.log(`[DataLayer] Active report set to: ${reportId || 'aggregated'}`);
    }

    /**
     * Get data for dashboard (uses cache)
     * @param {string} state - State ID (null for Pan India)
     * @param {boolean} forceRefresh - Force refresh from Firestore
     * @returns {Promise<Object>} Aggregated dashboard data
     */
    async getDashboardData(state = null, forceRefresh = false) {
        // Get merged dealers from cache
        const dealers = await this.store.getMergedDealers(
            this.currentReportId,
            forceRefresh
        );

        // Get additional data needed for aggregation
        const [zipCache, kpiData] = await Promise.all([
            this.store.getZipCache(),
            this.store.getKPIData()
        ]);

        // Convert merged dealers to raw format for aggregator
        const rawData = dealers.map(d => {
            const { _hasOverride, _originalData, ...rawDealer } = d;
            return rawDealer;
        });

        if (state) {
            // State-specific data
            return this.aggregator.getStateData(
                state,
                rawData,
                this.store.cache.dealerOverrides || {},
                zipCache,
                {},
                async () => { }, // No need to resolve districts, already done
                (name) => this.aggregator.normalizeStateName(name)
            );
        }

        // Pan India data
        return this.aggregator.getCountryData(
            rawData,
            this.store.cache.dealerOverrides || {},
            zipCache,
            async () => { } // No need to resolve districts, already done
        );
    }

    /**
     * Get data for dealer management page (same cache as dashboard)
     * @param {boolean} forceRefresh - Force refresh from Firestore
     * @returns {Promise<Array>} Merged dealer data
     */
    async getDealerManagementData(forceRefresh = false) {
        return this.store.getMergedDealers(
            this.currentReportId,
            forceRefresh
        );
    }

    /**
     * Update dealer (updates override only, never touches reports_data)
     * @param {string} customerName - Dealer customer name
     * @param {Object} updates - Fields to update
     * @returns {Promise<void>}
     */
    async updateDealer(customerName, updates) {
        console.log(`[DataLayer] Updating dealer: ${customerName}`, updates);
        return this.store.updateDealerOverride(customerName, updates);
    }

    /**
     * Revert dealer to original CSV data
     * @param {string} customerName - Dealer customer name
     * @returns {Promise<Array>} Updated merged dealer list
     */
    async revertDealer(customerName) {
        console.log(`[DataLayer] Reverting dealer: ${customerName}`);
        return this.store.revertDealerOverride(
            customerName,
            this.currentReportId
        );
    }

    /**
     * Subscribe to dealer changes (for reactive UI updates)
     * @param {Function} callback - Callback function to call when dealers change
     * @returns {Function} Unsubscribe function
     */
    onDealersChange(callback) {
        return this.store.subscribe('dealers', callback);
    }

    /**
     * Get KPI data
     * @param {boolean} forceRefresh - Force refresh from Firestore
     * @returns {Promise<Object>} KPI data
     */
    async getKPIData(forceRefresh = false) {
        return this.store.getKPIData(forceRefresh);
    }

    /**
     * Get zip code cache
     * @param {boolean} forceRefresh - Force refresh from Firestore
     * @returns {Promise<Object>} Zip code cache
     */
    async getZipCache(forceRefresh = false) {
        return this.store.getZipCache(forceRefresh);
    }

    /**
     * Get general settings
     * @param {boolean} forceRefresh - Force refresh from Firestore
     * @returns {Promise<Object>} General settings
     */
    async getGeneralSettings(forceRefresh = false) {
        return this.store.getGeneralSettings(forceRefresh);
    }

    /**
     * Clear all caches (useful for logout or data refresh)
     */
    clearAllCaches() {
        this.store.clearAllCaches();
    }

    /**
     * Get original data for a dealer (before overrides)
     * @param {string} customerName - Dealer customer name
     * @returns {Object|null} Original dealer data
     */
    async getOriginalDealerData(customerName) {
        const dealers = await this.store.getMergedDealers(this.currentReportId);
        const dealer = dealers.find(d =>
            (d.customer_name || d['customer_name']) === customerName
        );

        if (!dealer) return null;

        return this.store.dataMergeService.getOriginalData(dealer);
    }

    /**
     * Get fields that have been overridden for a dealer
     * @param {string} customerName - Dealer customer name
     * @returns {Promise<Array<string>>} List of overridden field names
     */
    async getOverriddenFields(customerName) {
        const dealers = await this.store.getMergedDealers(this.currentReportId);
        const dealer = dealers.find(d =>
            (d.customer_name || d['customer_name']) === customerName
        );

        if (!dealer) return [];

        return this.store.dataMergeService.getOverriddenFields(dealer);
    }
    /**
     * Deactivate dealers (Soft delete)
     * @param {Array<string>} dealerNames - List of dealer names to deactivate
     */
    async deactivateDealers(dealerNames) {
        if (!dealerNames || dealerNames.length === 0) return;
        console.log(`[DataLayer] Deactivating ${dealerNames.length} dealers...`);

        // 1. Get current list
        const currentList = await this.store.getDeactivatedDealers();

        // 2. Merge and Deduplicate
        const newSet = new Set([...currentList, ...dealerNames]);
        const newList = Array.from(newSet);

        // 3. Save to Firestore
        await this.store.firestoreService.updateDeactivatedDealers(newList);

        // 4. Update Cache Immediately
        this.store.cache.deactivatedDealers = newList;

        // 5. Invalidate Merged Cache (Crucial: to reflect removal in lists)
        this.store.invalidateCache('mergedDealers');

        console.log('[DataLayer] Deactivation complete. Caches invalidated.');
    }

    /**
     * Reactivate dealers (Restore)
     * @param {Array<string>} dealerNames - List of dealer names to reactivate
     */
    async reactivateDealers(dealerNames) {
        if (!dealerNames || dealerNames.length === 0) return;
        console.log(`[DataLayer] Reactivating ${dealerNames.length} dealers...`);

        // 1. Get current list
        const currentList = await this.store.getDeactivatedDealers();

        // 2. Filter out names to reactivate
        const toRemove = new Set(dealerNames);
        const newList = currentList.filter(name => !toRemove.has(name));

        // 3. Save to Firestore
        await this.store.firestoreService.updateDeactivatedDealers(newList);

        // 4. Update Cache Immediately
        this.store.cache.deactivatedDealers = newList;

        // 5. Invalidate Merged Cache
        this.store.invalidateCache('mergedDealers');

        console.log('[DataLayer] Reactivation complete. Caches invalidated.');
    }
}

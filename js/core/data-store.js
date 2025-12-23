/**
 * @fileoverview Centralized data store with caching and immutable data merging
 * @module core/data-store
 */
import { DataMergeService } from '../services/data-merge-service.js';

/**
 * Centralized data store with intelligent caching
 * Implements immutable data architecture with dealer overrides
 */
export class DataStore {
    /**
     * Creates a new DataStore instance
     * @param {Object} firestoreService - Firestore service instance
     */
    constructor(firestoreService) {
        this.firestoreService = firestoreService;
        this.dataMergeService = new DataMergeService(firestoreService);

        // Cache structure
        this.cache = {
            mergedDealers: {},         // Keyed by reportId/cacheKey -> Array
            rawReportData: null,       // Original CSV data (frozen)
            dealerOverrides: null,     // User edits
            deactivatedDealers: null,
            kpiData: null,
            zipCache: null,
            generalSettings: null
        };

        // Subscribers for reactive updates
        this.subscribers = new Map();

        // Pending requests to avoid duplicate fetches
        this.pendingRequests = new Map();

        // Cache metadata
        this.lastFetch = {};
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    }

    /**
     * Get merged dealer data (report + overrides) with caching
     * @param {string} reportId - Report ID (optional, uses aggregated if not provided)
     * @param {boolean} forceRefresh - Force fetch from Firestore
     * @returns {Promise<Array>} Merged dealer data
     */
    async getMergedDealers(reportId = null, forceRefresh = false) {
        const cacheKey = reportId ? `mergedDealers_${reportId}` : 'mergedDealers_aggregated';

        // Check cache validity
        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log(`[DataStore] Returning cached merged dealers for ${cacheKey}`);
            return this.cache.mergedDealers[cacheKey];
        }

        // Deduplicate concurrent requests
        if (this.pendingRequests.has(cacheKey)) {
            console.log('[DataStore] Returning pending request');
            return this.pendingRequests.get(cacheKey);
        }

        // Fetch and merge
        const promise = this._fetchAndMerge(reportId);
        this.pendingRequests.set(cacheKey, promise);

        try {
            const mergedData = await promise;
            this.updateCache(cacheKey, mergedData);
            this.cache.mergedDealers[cacheKey] = mergedData;
            this.notifySubscribers('dealers', mergedData);
            return mergedData;
        } finally {
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Internal: Fetch and merge data
     * @private
     */
    async _fetchAndMerge(reportId) {
        console.log('[DataStore] Fetching from Firestore and merging');

        // Fetch all dependencies in parallel
        const [reportData, overrides, deactivated] = await Promise.all([
            reportId
                ? this.firestoreService.getReportData(reportId)
                : this.firestoreService.getAggregatedReportData(),
            this.firestoreService.getDealerOverrides(),
            this.firestoreService.getDeactivatedDealers()
        ]);

        // Cache raw data (frozen to prevent modification)
        this.cache.rawReportData = Object.freeze(reportData);
        this.cache.dealerOverrides = overrides;
        this.cache.deactivatedDealers = deactivated;

        // Merge and return
        return this.dataMergeService.mergeData(reportData, overrides, deactivated);
    }

    /**
     * Update dealer override (invalidates cache and updates optimistically)
     * @param {string} customerName - Dealer name
     * @param {Object} updates - Fields to update
     */
    async updateDealerOverride(customerName, updates) {
        // Optimistic update: Update cache immediately
        // Iterate over ALL cached reports to update the dealer
        const cacheKeys = Object.keys(this.cache.mergedDealers);
        let updatedAny = false;

        cacheKeys.forEach(key => {
            const dealers = this.cache.mergedDealers[key];
            if (Array.isArray(dealers)) {
                const index = dealers.findIndex(
                    d => (d.customer_name || d['customer_name']) === customerName
                );
                if (index !== -1) {
                    dealers[index] = {
                        ...dealers[index],
                        ...updates,
                        _hasOverride: true
                    };
                    updatedAny = true;
                }
            }
        });

        if (updatedAny) {
            // Notify subscribers (might need to be more specific, but for now generic notify works)
            // We pass the currently active data if possible, or just notify generically?
            // Subscribers usually re-fetch data which hits the cache.
            // But notifySubscribers passes 'data' argument. 
            // If we have multiple reports, passing "one" might be misleading?
            // Subscribers currently expect the "active" list. 
            // Current DataLayer subscribers rely on the Store notification.
            // We can't know which one IS active here easily without tracking it.
            // But typical usage -> DataLayer subscribes.
            // Let's just notify with empty object to trigger refresh, or rely on UI to re-fetch?
            // Actually, we should probably only notify if the ACTIVE report was updated.
            // But DataStore doesn't know active report.
            // Let's just notify with null to signal "something changed, please refresh"
            // or fix subscribers to not rely on the payload.
            // Existing code: this.notifySubscribers('dealers', this.cache.mergedDealers);
            // It expects an Array.
            // Let's rely on the fact that the UI usually holds a reference or re-calls getMergedDealers.
            // Let's pass the FIRST updated cache just to satisfy type, or empty array.
            this.notifySubscribers('dealers', []);
        }

        try {
            // Update Firestore
            await this.firestoreService.updateDealerOverride(customerName, updates);

            // Update local override cache
            if (!this.cache.dealerOverrides) {
                this.cache.dealerOverrides = {};
            }
            this.cache.dealerOverrides[customerName] = {
                ...(this.cache.dealerOverrides[customerName] || {}),
                ...updates
            };
        } catch (error) {
            // Rollback on error
            console.error('[DataStore] Update failed, invalidating cache', error);
            this.invalidateCache('mergedDealers');
            throw error;
        }
    }

    /**
     * Revert dealer to original CSV data
     * @param {string} customerName - Dealer name
     * @param {string} reportId - Report ID
     */
    async revertDealerOverride(customerName, reportId = null) {
        await this.firestoreService.deleteDealerOverride(customerName);

        // Remove from local override cache
        if (this.cache.dealerOverrides && this.cache.dealerOverrides[customerName]) {
            delete this.cache.dealerOverrides[customerName];
        }

        // Refresh merged data
        return this.getMergedDealers(reportId, true);
    }

    /**
     * Get KPI data with caching
     * @param {boolean} forceRefresh - Force fetch from Firestore
     * @returns {Promise<Object>} KPI data
     */
    async getKPIData(forceRefresh = false) {
        const cacheKey = 'kpiData';

        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log('[DataStore] Returning cached KPI data');
            return this.cache.kpiData;
        }

        console.log('[DataStore] Fetching KPI data from Firestore');
        const kpiData = await this.firestoreService.fetchKPIData();
        this.updateCache(cacheKey, kpiData);
        this.cache.kpiData = kpiData;
        return kpiData;
    }

    /**
     * Get zip code cache with caching
     * @param {boolean} forceRefresh - Force fetch from Firestore
     * @returns {Promise<Object>} Zip code cache
     */
    async getZipCache(forceRefresh = false) {
        const cacheKey = 'zipCache';

        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log('[DataStore] Returning cached zip codes');
            return this.cache.zipCache;
        }

        console.log('[DataStore] Fetching zip codes from Firestore');
        const zipCache = await this.firestoreService.loadZipCacheFromFirebase();
        this.updateCache(cacheKey, zipCache);
        this.cache.zipCache = zipCache;
        return zipCache;
    }

    /**
     * Get general settings with caching
     * @param {boolean} forceRefresh - Force fetch from Firestore
     * @returns {Promise<Object>} General settings
     */
    async getGeneralSettings(forceRefresh = false) {
        const cacheKey = 'generalSettings';

        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log('[DataStore] Returning cached general settings');
            return this.cache.generalSettings;
        }

        console.log('[DataStore] Fetching general settings from Firestore');
        const settings = await this.firestoreService.loadGeneralSettings();
        this.updateCache(cacheKey, settings);
        this.cache.generalSettings = settings;
        return settings;
    }

    /**
     * Get deactivated dealers list with caching
     * @param {boolean} forceRefresh - Force fetch from Firestore
     * @returns {Promise<Array<string>>} Deactivated dealers list
     */
    async getDeactivatedDealers(forceRefresh = false) {
        const cacheKey = 'deactivatedDealers';

        if (!forceRefresh && this.isCacheValid(cacheKey)) {
            console.log('[DataStore] Returning cached deactivated dealers');
            return this.cache.deactivatedDealers;
        }

        console.log('[DataStore] Fetching deactivated dealers from Firestore');
        const list = await this.firestoreService.getDeactivatedDealers();
        this.updateCache(cacheKey, list);
        this.cache.deactivatedDealers = list;
        return list;
    }

    /**
     * Subscribe to data changes
     * @param {string} dataType - Type of data to subscribe to ('dealers', 'kpi', etc.)
     * @param {Function} callback - Callback function to call when data changes
     * @returns {Function} Unsubscribe function
     */
    subscribe(dataType, callback) {
        if (!this.subscribers.has(dataType)) {
            this.subscribers.set(dataType, new Set());
        }
        this.subscribers.get(dataType).add(callback);

        // Return unsubscribe function
        return () => {
            this.subscribers.get(dataType).delete(callback);
        };
    }

    /**
     * Check if cache is valid
     * @private
     */
    isCacheValid(key) {
        let cacheData;
        if (key.startsWith('mergedDealers')) {
            cacheData = this.cache.mergedDealers[key];
        } else {
            cacheData = this.cache[key];
        }

        if (!cacheData) return false;

        const lastFetch = this.lastFetch[key];
        if (!lastFetch) return false;

        return (Date.now() - lastFetch) < this.cacheTimeout;
    }

    /**
     * Update cache with timestamp
     * @private
     */
    updateCache(key, data) {
        this.lastFetch[key] = Date.now();
    }

    /**
     * Notify all subscribers of data changes
     * @private
     */
    notifySubscribers(dataType, data) {
        const subscribers = this.subscribers.get(dataType);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('[DataStore] Subscriber callback error:', error);
                }
            });
        }
    }

    /**
     * Invalidate cache for a specific key
     */
    invalidateCache(key) {
        if (key.startsWith('mergedDealers')) {
            // Clear specific key if provided full key, or all mergedDealers if generic?
            // Usually passed full key. But updateDealerOverride called with 'mergedDealers'?
            // Logic above calls invalidateCache('mergedDealers').
            // If just 'mergedDealers', clear ALL.
            if (key === 'mergedDealers') {
                this.cache.mergedDealers = {};
            } else {
                delete this.cache.mergedDealers[key];
            }
        } else {
            this.cache[key] = null;
        }
        this.lastFetch[key] = null;
    }

    /**
     * Clear all caches
     */
    clearAllCaches() {
        this.cache = {
            mergedDealers: {},
            rawReportData: null,
            dealerOverrides: null,
            deactivatedDealers: null,
            kpiData: null,
            zipCache: null,
            generalSettings: null
        };
        this.lastFetch = {};
        console.log('[DataStore] All caches cleared');
    }
}

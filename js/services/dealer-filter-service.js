/**
 * Service for managing dealer filtering logic
 * Encapsulates all filter state and application logic for dealer management
 */
export class DealerFilterService {
    constructor() {
        this.filters = {
            search: '',
            kam: 'all',
            stage: 'all',
            state: 'all',
            district: 'all'
        };
    }

    /**
     * Set a specific filter value
     * @param {string} type - Filter type (search, kam, stage, state, district)
     * @param {string} value - Filter value
     */
    setFilter(type, value) {
        this.filters[type] = value;
    }

    /**
     * Get a specific filter value
     * @param {string} type - Filter type
     * @returns {string} Current filter value
     */
    getFilter(type) {
        return this.filters[type];
    }

    /**
     * Apply all active filters to dealer array
     * @param {Array} dealers - Array of dealer objects
     * @returns {Array} Filtered dealer array
     */
    applyFilters(dealers) {
        return dealers.filter(dealer => {
            // Search
            if (this.filters.search && !dealer.searchString.includes(this.filters.search)) {
                return false;
            }

            // Stage
            if (this.filters.stage !== 'all' && dealer.dealer_stage !== this.filters.stage) {
                return false;
            }

            // KAM
            if (this.filters.kam !== 'all' && dealer.key_account_manager !== this.filters.kam) {
                return false;
            }

            // District
            if (this.filters.district !== 'all' && dealer.district !== this.filters.district) {
                return false;
            }

            // State
            if (this.filters.state !== 'all' && dealer.state !== this.filters.state) {
                return false;
            }

            return true;
        });
    }

    /**
     * Reset all filters to default values
     */
    reset() {
        this.filters = {
            search: '',
            kam: 'all',
            stage: 'all',
            state: 'all',
            district: 'all'
        };
    }
}

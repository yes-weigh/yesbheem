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
            state: [],
            district: 'all',
            categories: []
        };
    }

    /**
     * Set a specific filter value
     * @param {string} type - Filter type (search, kam, stage, state, district)
     * @param {string|Array} value - Filter value
     */
    setFilter(type, value) {
        this.filters[type] = value;
    }

    /**
     * Get a specific filter value
     * @param {string} type - Filter type
     * @returns {string|Array} Current filter value
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
            if (this.filters.stage !== 'all') {
                if (this.filters.stage === 'not_assigned') {
                    // Filter for empty/undefined stages
                    if (dealer.dealer_stage) return false;
                } else if (dealer.dealer_stage !== this.filters.stage) {
                    return false;
                }
            }

            // KAM
            if (this.filters.kam !== 'all') {
                if (this.filters.kam === 'not_assigned') {
                    if (dealer.key_account_manager) return false;
                } else if (dealer.key_account_manager !== this.filters.kam) {
                    return false;
                }
            }

            // District
            if (this.filters.district !== 'all' && dealer.district !== this.filters.district) {
                return false;
            }

            // State (Multi-select)
            if (this.filters.state && this.filters.state.length > 0) {
                // If dealer has no state but filter is active, exclude
                if (!dealer.state) {
                    return false;
                }
                // Check if dealer's state is in the selected states
                if (!this.filters.state.includes(dealer.state)) {
                    return false;
                }
            }

            // Categories
            if (this.filters.categories && this.filters.categories.length > 0) {
                // If dealer has no categories but refinement is active, exclude
                if (!dealer.categories || !Array.isArray(dealer.categories) || dealer.categories.length === 0) {
                    return false;
                }

                // Check for intersection (OR logic)
                const hasMatch = dealer.categories.some(cat => this.filters.categories.includes(cat));
                if (!hasMatch) return false;
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
            state: [],
            district: 'all',
            categories: []
        };
    }
}

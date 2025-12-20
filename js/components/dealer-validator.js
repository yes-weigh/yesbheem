/**
 * @fileoverview Dealer validation and normalization logic
 * @module components/dealer-validator
 */

/**
 * Handles validation and normalization for dealer data
 * @class DealerValidator
 * @example
 * const validator = new DealerValidator();
 * const result = validator.validateDealerData(dealerData);
 */
export class DealerValidator {
    constructor() {
        /**
         * Canonical list of Indian states and UTs
         * @type {string[]}
         */
        this.CANONICAL_STATES = [
            "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
            "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala",
            "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
            "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
            "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
            "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry", "Ladakh"
        ];
    }

    /**
     * Validates dealer data before save
     * @param {Object} data - Dealer data to validate
     * @returns {Object} {valid: boolean, errors: string[]}
     * @example
     * const result = validator.validateDealerData({
     *   customer_name: 'ABC Dealers',
     *   billing_zipcode: '682001'
     * });
     */
    validateDealerData(data) {
        const errors = [];

        // Validate dealer name
        if (!data.customer_name || data.customer_name.trim() === '') {
            errors.push('Dealer name is required');
        }

        // Validate zip codes
        if (data.billing_zipcode && !this.validateZipCode(data.billing_zipcode)) {
            errors.push('Invalid billing zip code format');
        }

        if (data.shipping_zipcode && !this.validateZipCode(data.shipping_zipcode)) {
            errors.push('Invalid shipping zip code format');
        }

        // Validate contact phone
        if (data.contact_phone && !this.validatePhone(data.contact_phone)) {
            errors.push('Invalid phone number format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates contact information
     * @param {string} name - Contact name
     * @param {string} phone - Contact phone
     * @returns {Object} {valid: boolean, errors: string[]}
     * @example
     * const result = validator.validateContact('John Doe', '9876543210');
     */
    validateContact(name, phone) {
        const errors = [];

        if (name && name.trim().length < 2) {
            errors.push('Contact name must be at least 2 characters');
        }

        if (phone && !this.validatePhone(phone)) {
            errors.push('Invalid phone number format');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates zip code format
     * @param {string} zip - Zip code to validate
     * @returns {boolean} True if valid
     * @example
     * validator.validateZipCode('682001'); // true
     * validator.validateZipCode('12345'); // false (not Indian format)
     */
    validateZipCode(zip) {
        if (!zip) return true; // Optional field
        // Indian zip codes are 6 digits
        return /^\d{6}$/.test(zip.trim());
    }

    /**
     * Validates phone number format
     * @param {string} phone - Phone number to validate
     * @returns {boolean} True if valid
     * @example
     * validator.validatePhone('9876543210'); // true
     * validator.validatePhone('+919876543210'); // true
     */
    validatePhone(phone) {
        if (!phone) return true; // Optional field
        const cleaned = phone.replace(/[\s\-\(\)]/g, '');
        // Indian mobile: 10 digits starting with 6-9, or with +91 prefix
        return /^(\+91)?[6-9]\d{9}$/.test(cleaned);
    }

    /**
     * Normalizes state name to canonical form
     * Uses fuzzy matching with Levenshtein distance to handle typos
     * @param {string} state - State name to normalize
     * @returns {string} Normalized state name
     * @example
     * validator.normalizeState('Tamilnadu'); // 'Tamil Nadu'
     * validator.normalizeState('Jammu & Kashmir'); // 'Jammu and Kashmir'
     */
    normalizeState(state) {
        if (!state) return '';
        let s = state.trim();

        // Normalize helper: lowercase, remove spaces, replace & with 'and'
        const clean = (str) => str.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
        const target = clean(s);

        let bestMatch = null;
        let bestDist = Infinity;

        for (const canonical of this.CANONICAL_STATES) {
            const cleanCanonical = clean(canonical);

            // 1. Exact Match on Cleaned String (Handles "Tamil Nadu" vs "Tamilnadu", "Jammu &Kashmir" vs "Jammu and Kashmir")
            if (target === cleanCanonical) {
                return canonical;
            }

            // 2. Fuzzy Matching on Cleaned String
            const dist = this.getLevenshteinDistance(target, cleanCanonical);
            if (dist < bestDist) {
                bestDist = dist;
                bestMatch = canonical;
            }
        }

        // Threshold: allow small edits
        // Since we stripped spaces, "Telengana" (9) -> "Telangana" (9) is 1 edit
        const threshold = target.length < 5 ? 1 : 3;

        if (bestMatch && bestDist <= threshold) {
            return bestMatch;
        }

        // Fallback: Title Case the original
        return s.toLowerCase().replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
    }

    /**
     * Calculates Levenshtein distance between two strings
     * Used for fuzzy matching of state names
     * @param {string} a - First string
     * @param {string} b - Second string
     * @returns {number} Edit distance
     * @private
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
}

/**
 * Location Utilities
 * Centralized utilities for normalizing state and district names across India
 * @module utils/location-utils
 */

import StringUtils from './string-utils.js';

/**
 * List of all Indian States and Union Territories (Canonical)
 * Used for validation and normalization across the application
 * @type {string[]}
 */
export const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat",
    "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala",
    "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha",
    "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh",
    "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Lakshadweep", "Puducherry", "Ladakh"
];

/**
 * LocationUtils
 * Static utility class for location-related operations
 */
class LocationUtils {
    /**
     * Normalize state name to handle variations (e.g., Tamilnadu → Tamil Nadu)
     * Uses exact matching first, then fuzzy matching with Levenshtein distance
     * 
     * @param {string} rawStateName - Raw state name from data source
     * @returns {string} Normalized canonical state name, or original if no match
     * 
     * @example
     * LocationUtils.normalizeStateName('Tamilnadu');
     * // Returns: 'Tamil Nadu'
     * 
     * @example
     * LocationUtils.normalizeStateName('Maharshtra'); // typo
     * // Returns: 'Maharashtra' (fuzzy matched)
     * 
     * @example
     * LocationUtils.normalizeStateName('Kerala');
     * // Returns: 'Kerala' (exact match)
     */
    static normalizeStateName(rawStateName) {
        if (!rawStateName) return 'Unknown'; // Default to Unknown instead of Kerala to avoid pollution

        // Canonical List of Indian States and UTs
        const CANONICAL_STATES = INDIAN_STATES;

        // Helper to clean string: lowercase, replace & with 'and', remove non-alphanumeric
        const clean = (str) => str.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]/g, '');
        const target = clean(rawStateName);

        // 1. Exact Match on clean string
        for (const canonical of CANONICAL_STATES) {
            if (clean(canonical) === target) return canonical;
        }

        // 2. Fuzzy Match on clean string using Levenshtein distance
        let bestMatch = null;
        let bestDist = Infinity;

        for (const canonical of CANONICAL_STATES) {
            const cleanCanonical = clean(canonical);
            const dist = StringUtils.getLevenshteinDistance(target, cleanCanonical);

            if (dist < bestDist) {
                bestDist = dist;
                bestMatch = canonical;
            }
        }

        // Threshold logic: shorter strings need stricter matching
        const threshold = target.length < 5 ? 1 : 3;

        if (bestMatch && bestDist <= threshold) {
            return bestMatch;
        }

        // Fallback: Return original trimmed if no match, to avoid data loss
        return rawStateName.trim();
    }

    /**
     * Normalize district names to match internal keys
     * Handles common variations and alternative names (e.g., Trivandrum → Thiruvananthapuram)
     * 
     * @param {string} districtName - Raw district name
     * @param {string[]} validList - Array of valid district identifiers to match against
     * @returns {string|null} Normalized district key or null if no match
     * 
     * @example
     * LocationUtils.normalizeDistrictName('Trivandrum', ['thiruvananthapuram', 'kollam']);
     * // Returns: 'thiruvananthapuram'
     * 
     * @example
     * LocationUtils.normalizeDistrictName('Calicut', ['kozhikode', 'kannur']);
     * // Returns: 'kozhikode'
     * 
     * @example
     * LocationUtils.normalizeDistrictName('Ernakulam', ['ernakulam', 'kottayam']);
     * // Returns: 'ernakulam'
     */
    static normalizeDistrictName(districtName, validList = []) {
        if (!districtName) return null;

        const lower = districtName.toLowerCase().trim();
        const cleanId = lower.replace(/\s+/g, '-');

        // Check against valid list first
        if (validList.includes(cleanId)) return cleanId;
        if (validList.includes(lower)) return lower;

        // Fallback for complex matches (Kerala legacy mappings)
        // Maps common alternative names to canonical district names
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
}

// Export as default for ES6 module import
export default LocationUtils;

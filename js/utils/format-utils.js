/**
 * Format Utilities
 * Formatting utilities for currency and numbers (Indian Number System)
 * @module utils/format-utils
 */

/**
 * FormatUtils
 * Static utility class for formatting operations
 */
class FormatUtils {
    /**
     * Format a number to a fixed decimal string
     * 
     * @param {number|string} num - Number to format
     * @returns {string} Formatted number with 1 decimal place
     * 
     * @example
     * FormatUtils.formatNumber(123.456);
     * // Returns: '123.5'
     * 
     * @example
     * FormatUtils.formatNumber('789');
     * // Returns: '789.0'
     */
    static formatNumber(num) {
        if (!num) return '0';
        return parseFloat(num).toFixed(1);
    }

    /**
     * Format currency value using Indian Number System
     * Converts large numbers to Trillion (T), Billion (B), Crore (Cr), Lakh (L), Thousand (k)
     * 
     * @param {number|string} val - Currency value to format
     * @returns {string} Formatted currency string
     * 
     * @example
     * FormatUtils.formatCurrency(1000000);
     * // Returns: '10.00 L'
     * 
     * @example
     * FormatUtils.formatCurrency(50000000);
     * // Returns: '5.00 Cr'
     * 
     * @example
     * FormatUtils.formatCurrency(1500000000000);
     * // Returns: '1.50 T'
     * 
     * @example
     * FormatUtils.formatCurrency(5500);
     * // Returns: '5.5 k'
     */
    static formatCurrency(val) {
        if (!val) return '0';
        let num = parseFloat(val);
        if (isNaN(num)) return val;

        // Indian Number System + T/B
        if (num >= 1000000000000) return (num / 1000000000000).toFixed(2) + ' T';
        if (num >= 1000000000) return (num / 1000000000).toFixed(2) + ' B';
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        else if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
        else if (num >= 1000) return (num / 1000).toFixed(1) + ' k';
        return num.toFixed(0);
    }

    /**
     * Parse unit string back to raw number
     * Handles Indian Number System units: T (Trillion), B (Billion), Cr (Crore), L (Lakh), K (Thousand)
     * 
     * @param {string|number} val - Unit string to parse (e.g., "75 L", "5 Cr")
     * @returns {number} Raw numeric value
     * 
     * @example
     * FormatUtils.parseUnitString('75 L');
     * // Returns: 7500000
     * 
     * @example
     * FormatUtils.parseUnitString('5.5 Cr');
     * // Returns: 55000000
     * 
     * @example
     * FormatUtils.parseUnitString('1.2 T');
     * // Returns: 1200000000000
     * 
     * @example
     * FormatUtils.parseUnitString('10 K');
     * // Returns: 10000
     * 
     * @example
     * FormatUtils.parseUnitString(1000000);
     * // Returns: 1000000 (already a number)
     */
    static parseUnitString(val) {
        if (!val) return 0;
        if (typeof val === 'number') return val;

        const str = val.toString().trim().toUpperCase();
        // Regex to separate Number and Unit
        const match = str.match(/^([\d\.]+)\s*([A-Z]*)/);

        if (!match) return 0;
        const num = parseFloat(match[1]);
        const unit = match[2];

        if (isNaN(num)) return 0;

        let multiplier = 1;
        if (unit.includes('T')) multiplier = 1000000000000; // Trillion
        else if (unit.includes('B')) multiplier = 1000000000; // Billion
        else if (unit.includes('CR')) multiplier = 10000000; // Crore
        else if (unit.includes('L')) multiplier = 100000; // Lakh
        else if (unit.includes('K')) multiplier = 1000; // Thousand

        return num * multiplier;
    }

    /**
     * Format a phone number to E.164 standard (e.g., +919876543210)
     * Handles common Indian formats: 10 digit, 0+10 digit, +91+10 digit
     * 
     * @param {string} phone - Phone number to format
     * @returns {string|null} Formatted phone number or null if invalid
     */
    static formatPhoneNumber(phone) {
        if (!phone) return null;

        // Remove all non-digit characters
        let cleaned = phone.toString().replace(/\D/g, '');

        // Handle common cases

        // Case 1: 10 digits (Standard Mobile) -> Add 91
        if (cleaned.length === 10) {
            return '+91' + cleaned;
        }

        // Case 2: 11 digits starting with 0 (Landline/Old Mobile style) -> Remove 0, Add 91
        if (cleaned.length === 11 && cleaned.startsWith('0')) {
            return '+91' + cleaned.substring(1);
        }

        // Case 3: 12 digits starting with 91 (Already has country code) -> Add +
        if (cleaned.length === 12 && cleaned.startsWith('91')) {
            return '+' + cleaned;
        }

        // Case 4: Already valid E.164 without + (unlikely given regex, but for safety)
        // If it matches country code 91 and length is correct, ensure +

        // Fallback/Validation
        // If it doesn't match expected lengths, return null (invalid)
        // We could support other country codes here if needed, but focusing on IN for now.

        return null;
    }
}

// Export as default for ES6 module import
export default FormatUtils;
// Updated: FormatPhoneNumber added

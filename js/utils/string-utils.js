/**
 * StringUtils
 * Utility class for string operations including distance calculations and normalization
 */
class StringUtils {
    /**
     * Calculate Levenshtein Distance between two strings
     * 
     * The Levenshtein distance is a string metric for measuring the difference between
     * two sequences. It represents the minimum number of single-character edits (insertions,
     * deletions, or substitutions) required to change one word into the other.
     * 
     * @param {string} a - First string to compare
     * @param {string} b - Second string to compare
     * @returns {number} The Levenshtein distance between the two strings
     * 
     * @example
     * StringUtils.getLevenshteinDistance('kitten', 'sitting');
     * // Returns: 3
     * // Explanation: kitten → sitten (substitution of 's' for 'k')
     * //              sitten → sittin (substitution of 'i' for 'e')
     * //              sittin → sitting (insertion of 'g' at the end)
     * 
     * @example
     * StringUtils.getLevenshteinDistance('saturday', 'sunday');
     * // Returns: 3
     * 
     * @example
     * StringUtils.getLevenshteinDistance('hello', 'hello');
     * // Returns: 0
     */
    static getLevenshteinDistance(a, b) {
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

    /**
     * Normalize a string by converting to lowercase and removing special characters
     * 
     * This method is useful for comparing strings in a case-insensitive manner
     * and ignoring punctuation, spaces, and other non-alphanumeric characters.
     * 
     * @param {string} str - The string to normalize
     * @returns {string} Normalized string (lowercase, alphanumeric only)
     * 
     * @example
     * StringUtils.normalizeString('Hello, World!');
     * // Returns: 'helloworld'
     * 
     * @example
     * StringUtils.normalizeString('ACCURATE TRADE LINKS');
     * // Returns: 'accuratetradelinks'
     * 
     * @example
     * StringUtils.normalizeString('  Test-123  ');
     * // Returns: 'test123'
     */
    static normalizeString(str) {
        if (!str) return '';
        return str.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    }
}

// Export as default for ES6 module import
export default StringUtils;

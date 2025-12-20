/**
 * Data Parser Utilities
 * Handles parsing of various data formats (target values, currency, etc.)
 */

/**
 * Parse target value string (e.g. "75 L", "5 Cr", "10 K", "3.5 T", "2.8 B") into number
 * @param {string|number} val - The target value
 * @returns {number} The numeric value
 */
export function parseTargetValue(val) {
    if (typeof val === 'number') return val;
    if (!val || val === 'N/A' || val === '-') return 0;

    const str = val.toString().trim().toUpperCase();

    let multiplier = 1;
    let numPart = str;

    // Multipliers
    if (str.includes('T')) {
        // Trillion
        multiplier = 1000000000000;
        numPart = str.replace('T', '');
    } else if (str.includes('B') || str.includes('BN')) {
        // Billion
        multiplier = 1000000000;
        numPart = str.replace('B', '').replace('N', ''); // Handle BN
    } else if (str.includes('CR')) {
        // Crore
        multiplier = 10000000;
        numPart = str.replace('CR', '');
    } else if (str.includes('L') || str.includes('LAC')) {
        // Lakh
        multiplier = 100000;
        numPart = str.replace('LAC', '').replace('L', ''); // Handle LAC
    } else if (str.includes('K')) {
        // Thousand
        multiplier = 1000;
        numPart = str.replace('K', '');
    }

    // Remove Currency Symbols & non-numeric chars (except decimal)
    const num = parseFloat(numPart.replace(/[^0-9.]/g, ''));
    const result = isNaN(num) ? 0 : num * multiplier;

    // console.log(`[ParseTarget] In: "${val}" -> Str: "${str}" -> Num: ${num} * ${multiplier} = ${result}`);

    return result;
}

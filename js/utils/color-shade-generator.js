/**
 * @fileoverview Color shade generation utility for map colorization
 * @module utils/color-shade-generator
 */

/**
 * Creates color shades by blending with black (no transparency)
 * Converts hex to RGB, adjusts lightness, returns opaque hex color
 * High intensity = full saturated color, Low intensity = darker (blended with black)
 * 
 * @param {string} hexColor - Base hex color (e.g., '#3b82f6')
 * @param {number} intensity - Intensity from 0 to 1 (0 = darkest, 1 = full color)
 * @returns {string} Shaded hex color
 * 
 * @example
 * // Create a 50% intensity shade of blue
 * const shade = getColorShade('#3b82f6', 0.5);
 * // Returns: '#1d4179' (darker blue)
 * 
 * @example
 * // Create full intensity (original color)
 * const shade = getColorShade('#3b82f6', 1.0);
 * // Returns: '#3b82f6' (original color)
 */
export function getColorShade(hexColor, intensity) {
    // intensity is 0-1, where 0 is darkest (low sales), 1 is full color (high sales)
    // Convert hex to RGB
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);

    // Create shade by blending with black for low values
    // Use a range from 30% to 100% of base color intensity
    const minIntensity = 0.3;
    const actualIntensity = minIntensity + (intensity * (1 - minIntensity));

    // Blend with black (0, 0, 0) - darker for low values, full color for high values
    const newR = Math.round(r * actualIntensity);
    const newG = Math.round(g * actualIntensity);
    const newB = Math.round(b * actualIntensity);

    return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB).toString(16).slice(1)}`;
}

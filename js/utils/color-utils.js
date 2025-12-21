/**
 * ColorUtils - Standardized color palettes for map visualization
 */
export const ColorScales = {
    // Traffic Light Scale for Achievement (Red -> Green)
    achievement: (value, target) => {
        // 1. No Target Check
        if (!target || target <= 0) return '#475569'; // Neutral Slate-600

        const pct = parseFloat(value);
        if (isNaN(pct)) return '#475569';

        // 2. Performance Thresholds
        if (pct >= 100) return '#10B981';  // Emerald-500 (Exceeded)
        if (pct >= 80) return '#3B82F6';   // Blue-500 (Good)
        if (pct >= 50) return '#F59E0B';   // Amber-500 (Average)
        if (pct >= 0) return '#EF4444';    // Red-500 (Below)

        return '#475569';
    },

    // Purple Scale for Population (Light -> Dark)
    // Based on India demographics (High: >10Cr, Med: >5Cr, Low: <1Cr)
    population: (value) => {
        const v = parseFloat(value);
        if (isNaN(v)) return '#475569';

        // Thresholds for India States 
        // UP is ~24Cr, Maharashtra ~12Cr. Small states <1Cr.
        if (v > 100000000) return '#581c87'; // Purple-900 (High Density)
        if (v > 50000000) return '#7e22ce'; // Purple-700
        if (v > 20000000) return '#a855f7'; // Purple-500
        if (v > 5000000) return '#c084fc'; // Purple-400
        return '#e9d5ff';                    // Purple-200 (Low Density)
    },

    // Cyan/Teal Scale for GDP
    // MH is high, others lower.
    gdp: (value) => {
        // Value might be passed as raw number (if parsed) or we need normalization
        // Assuming value is USD or similar numeric metric
        const v = parseFloat(value);
        if (isNaN(v)) return '#475569';

        // Placeholder relative scale
        // Needs real calibration but a gradient works for visual heatmap
        // Using a generalized "High to Low" teal scale
        // Ideally we normalize against max value in the set, but hardcoded tiers are safer for now
        if (v > 300000000000) return '#134e4a'; // Teal-900
        if (v > 150000000000) return '#0f766e'; // Teal-700
        if (v > 50000000000) return '#14b8a6'; // Teal-500
        return '#99f6e4';                       // Teal-200
    },

    // Blue Scale for Dealer Count
    dealer_count: (count) => {
        const c = parseInt(count) || 0;
        if (c > 100) return '#1e3a8a'; // Blue-900
        if (c > 50) return '#1d4ed8';  // Blue-700
        if (c > 20) return '#3bf6ff';  // Cyan-Bright (Highlight) - wait, sticking to Blue/Indigo per image
        if (c > 20) return '#3b82f6';  // Blue-500
        if (c > 5) return '#93c5fd';   // Blue-300
        return '#1e293b';              // Slate-800 (Very low/Inactive - Neutral) OR light blue?
        // Image shows dark map with bright highlights. 
    }
};

export const LegendConfigs = {
    dealer_count: {
        title: 'Active Dealers',
        items: [
            { color: '#1e3a8a', label: '> 100' },
            { color: '#1d4ed8', label: '50 - 100' },
            { color: '#3b82f6', label: '20 - 50' },
            { color: '#93c5fd', label: '5 - 20' }
        ]
    },
    achievement: {
        title: 'Achievement',
        items: [
            { color: '#10B981', label: '> 100%' },
            { color: '#3B82F6', label: '80 - 100%' },
            { color: '#F59E0B', label: '50 - 80%' },
            { color: '#EF4444', label: '< 50%' },
            { color: '#475569', label: 'No Target' }
        ]
    },
    population: {
        title: 'Population',
        items: [
            { color: '#581c87', label: '> 10 Cr' },
            { color: '#7e22ce', label: '5 Cr - 10 Cr' },
            { color: '#a855f7', label: '2 Cr - 5 Cr' },
            { color: '#e9d5ff', label: '< 2 Cr' }
        ]
    },
    gdp: {
        title: 'GDP Contribution',
        items: [
            { color: '#134e4a', label: 'Very High' },
            { color: '#0f766e', label: 'High' },
            { color: '#14b8a6', label: 'Medium' },
            { color: '#99f6e4', label: 'Low' }
        ]
    }
};

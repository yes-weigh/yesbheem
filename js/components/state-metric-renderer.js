/**
 * @fileoverview Renders state metric list component (GDP/Population)
 * @module components/state-metric-renderer
 */

/**
 * Renders a generic list of states sorted by a metric (GDP or Population)
 * @param {Array<Object>} states - Array of state objects with {name, gdp, population, sales}
 * @param {string} metricKey - Key to display ('gdp' or 'population')
 * @param {string} title - Header title for the list
 * @returns {string} HTML string for state metric list
 * @example
 * const html = renderStateMetricList(states, 'gdp', 'States by GDP');
 * container.innerHTML = html;
 */
export function renderStateMetricList(states, metricKey, title) {
    if (!states || states.length === 0) return '';

    // Helper to parse value (handles "3.5 Cr", "1000", etc)
    const parseVal = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        let str = val.replace(/,/g, '');
        // Simple Parsing assuming value is the main number content
        let num = parseFloat(str.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    };

    // Calculate Totals and Max
    let totalVal = 0;
    let maxVal = 0;

    states.forEach(s => {
        const v = parseVal(s[metricKey]);
        totalVal += v;
        if (v > maxVal) maxVal = v;
    });

    let html = `<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${title}</h3>`;
    html += '<div class="district-sales-list">';

    states.forEach((state, i) => {
        const val = state[metricKey] || 'N/A';
        const numVal = parseVal(val);

        // Percentage of Total
        const percentTotal = totalVal > 0 ? (numVal / totalVal) * 100 : 0;
        const percentText = percentTotal.toFixed(1) + '%';

        // Bar relative to Max
        const barWidth = maxVal > 0 ? (numVal / maxVal) * 100 : 0;

        html += `
            <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${state.name}')" style="cursor: pointer;">
                <div class="district-rank">${i + 1}</div>
                <div class="district-info">
                    <div class="district-row">
                        <span class="district-name" title="${state.name}">${state.name}</span>
                        <span class="district-percentage" style="color: #3b82f6;">${percentText}</span>
                        <span class="district-sales" style="color: var(--text-main);">${val}</span>
                    </div>
                    <div class="contribution-bar-bg">
                        <div class="contribution-bar-fill" style="width:${barWidth}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    return html;
}

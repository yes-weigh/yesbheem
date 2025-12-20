/**
 * @fileoverview Renders district sales list component
 * @module components/district-list-renderer
 */

/**
 * Renders a list of districts sorted by total sales with percentages and dealer counts
 * @param {Array<Object>} districts - Array of district objects with {name, currentSales, totalSales, dealerCount}
 * @param {Function} formatNumber - Function to format numbers (e.g., "1.5 Cr")
 * @returns {string} HTML string for district sales list
 * @example
 * const html = renderDistrictSalesList(districts, UIRenderer.formatNumber);
 * container.innerHTML = html;
 */
export function renderDistrictSalesList(districts, formatNumber) {
    if (!districts || districts.length === 0) return '';

    // Helper to get sales value
    const getSales = (d) => d.currentSales || d.totalSales || 0;

    // Calculate total sales and max for percentage bars (like dealer list)
    const totalSales = districts.reduce((sum, d) => sum + getSales(d), 0);
    // Assuming sorted desc, but safer to calc max
    let maxSales = 0;
    districts.forEach(d => {
        const s = getSales(d);
        if (s > maxSales) maxSales = s;
    });

    let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Sales</h3>';
    html += '<div class="district-sales-list">';

    districts.forEach((district, i) => {
        const val = getSales(district);
        const percentage = totalSales > 0 ? ((val / totalSales) * 100) : 0;
        const percentageText = percentage.toFixed(1);
        // Bar width based on max sales (same as dealer list)
        const barWidth = maxSales > 0 ? (val / maxSales) * 100 : 0;

        html += `
            <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${district.name}')" style="cursor: pointer;">
                <div class="district-rank">${i + 1}</div>
                <div class="district-info">
                    <div class="district-row" style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap;">
                        <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                            <span class="district-name" style="overflow: hidden; text-overflow: ellipsis;" title="${district.name}">${district.name}</span>
                            <span class="district-count" style="font-size: 0.75em; color: var(--text-muted); margin-left: 5px; flex-shrink: 0;" title="Dealer Count">(${district.dealerCount || 0})</span>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 10px;">
                            <span class="district-percentage" style="min-width: 45px; text-align: right;">${percentageText}%</span>
                            <span class="district-sales" style="min-width: 70px; text-align: right;">₹${formatNumber(val)}</span>
                        </div>
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

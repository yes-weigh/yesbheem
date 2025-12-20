/**
 * @fileoverview Renders dealer list component with sales information
 * @module components/dealer-list-renderer
 */

/**
 * Renders a list of dealers with sales information and contribution bars
 * @param {Array<Object>} dealers - Array of dealer objects with {name, sales, isYesCloud}
 * @param {Function} formatNumber - Function to format numbers (e.g., "1.5 Cr")
 * @returns {string} HTML string for dealer list
 * @example
 * const html = renderDealerList(dealers, UIRenderer.formatNumber);
 * container.innerHTML = html;
 */
export function renderDealerList(dealers, formatNumber) {
    if (!dealers || dealers.length === 0) return '';

    const maxSales = dealers[0].sales;
    let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Top Dealers</h3>';
    html += '<div class="dealer-list">';

    dealers.forEach((d, i) => {
        // Filter out yescloud dealers
        if (d.isYesCloud) return;

        const percent = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
        html += `
            <div class="dealer-item-compact" onclick="window.viewController && window.viewController.handleListClick('${d.name}')" style="cursor: pointer;">
                <div class="dealer-rank">${i + 1}</div>
                <div class="dealer-info">
                    <div class="dealer-row">
                        <span class="dealer-name" title="${d.name}">${d.name}</span>
                        <span class="dealer-sales">₹${formatNumber(d.sales)}</span>
                    </div>
                    <div class="contribution-bar-bg">
                        <div class="contribution-bar-fill" style="width:${percent}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    return html;
}

/**
 * @fileoverview Renders dealer count list component
 * @module components/dealer-count-renderer
 */

/**
 * Renders a list of states/districts sorted by dealer count
 * @param {Array<Object>} states - Array of state/district objects with {name, dealerCount}
 * @param {string} [title='States by Dealer Count'] - Optional title override
 * @returns {string} HTML string for dealer count list
 * @example
 * const html = renderDealerCountList(states, 'Top States by Dealers');
 * container.innerHTML = html;
 */
export function renderDealerCountList(states, title = 'States by Dealer Count') {
    if (!states || states.length === 0) return '';

    // Calculate max for percentage bars
    const maxCount = states[0]?.dealerCount || 0;
    const totalDealers = states.reduce((sum, s) => sum + (s.dealerCount || 0), 0);

    let html = `<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${title}</h3>`;
    html += '<div class="district-sales-list">';

    states.forEach((state, i) => {
        const count = state.dealerCount || 0;
        // Bar width based on max count
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;
        const percentTotal = totalDealers > 0 ? (count / totalDealers) * 100 : 0;

        html += `
            <div class="district-item-compact" onclick="window.viewController && window.viewController.handleListClick('${state.name}')" style="cursor: pointer;">
                <div class="district-rank">${i + 1}</div>
                <div class="district-info">
                    <div class="district-row" style="display: flex; justify-content: space-between; align-items: center; white-space: nowrap;">
                         <div style="display: flex; align-items: center; min-width: 0; flex: 1;">
                            <span class="district-name" style="overflow: hidden; text-overflow: ellipsis;" title="${state.name}">${state.name}</span>
                        </div>
                        <div style="display: flex; align-items: center; flex-shrink: 0; gap: 10px;">
                            <span class="district-percentage" style="min-width: 45px; text-align: right; color: var(--text-muted);">${percentTotal.toFixed(1)}%</span>
                            <span class="district-sales" style="min-width: 40px; text-align: right; color: var(--text-main); font-weight: 600;">${count}</span>
                        </div>
                    </div>
                    <div class="contribution-bar-bg">
                        <div class="contribution-bar-fill" style="width:${barWidth}%; background-color: #ed8936;"></div>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    return html;
}

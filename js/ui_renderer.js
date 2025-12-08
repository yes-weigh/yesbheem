/**
 * UIRenderer
 * Centralizes the HTML generation for UI components like Stats Cards and Dealer Lists.
 * Ensures usage of standard CSS classes and consistent formatting.
 */
class UIRenderer {

    /**
     * Render the Stats Grid HTML
     * @param {Object} data - Aggregated data object containing achievement, currentSales, dealerCount, monthlyTarget
     * @returns {string} HTML string
     */
    static renderStats(data) {
        return `
            <div class="stat-card">
                <span class="stat-label">Achievement</span>
                <div class="stat-value" style="color:${this.getColor(data.achievement)}">${data.achievement || '0%'}</div>
            </div>
            <div class="stat-card">
                <span class="stat-label">Current Sales</span>
                <div class="stat-value">₹${this.formatNumber(data.currentSales || 0)}</div>
            </div>
            <div class="stat-card">
                <span class="stat-label">Dealer Count</span>
                <div class="stat-value">${data.dealerCount || 0}</div>
            </div>
             <div class="stat-card">
                <span class="stat-label">Monthly Target</span>
                <div class="stat-value">₹${this.formatNumber(data.monthlyTarget || 0)}</div>
            </div>
        `;
    }

    /**
     * Render the Dealer List HTML
     * @param {Array} dealers - Array of dealer objects {name, sales}
     * @returns {string} HTML string
     */
    static renderDealerList(dealers) {
        if (!dealers || dealers.length === 0) return '';

        const maxSales = dealers[0].sales;
        let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Top Dealers</h3>';
        html += '<div class="dealer-list">';

        dealers.forEach((d, i) => {
            const percent = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
            html += `
                <div class="dealer-item-compact">
                    <div class="dealer-rank">${i + 1}</div>
                    <div class="dealer-info">
                        <div class="dealer-row">
                            <span class="dealer-name" title="${d.name}">${d.name}</span>
                            <span class="dealer-sales">₹${this.formatNumber(d.sales)}</span>
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

    /**
     * Render the District Sales List HTML (sorted by total sales)
     * @param {Array} districts - Array of district objects {name, totalSales}
     * @returns {string} HTML string
     */
    static renderDistrictSalesList(districts) {
        if (!districts || districts.length === 0) return '';

        let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Districts by Sales</h3>';
        html += '<div class="district-sales-list">';

        districts.forEach((district, i) => {
            html += `
                <div class="district-sales-item">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-details">
                        <div class="district-name">${district.name}</div>
                        <div class="district-sales">₹${this.formatNumber(district.totalSales)}</div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    // Utilities
    static formatNumber(num) {
        if (num >= 10000000) return (num / 10000000).toFixed(2) + ' Cr';
        if (num >= 100000) return (num / 100000).toFixed(2) + ' L';
        if (num >= 1000) return (num / 1000).toFixed(2) + ' K';
        return num.toFixed(2);
    }

    static getColor(achievement) {
        const p = parseFloat(achievement);
        if (p >= 100) return '#10b981';
        if (p >= 70) return '#f59e0b';
        return '#ef4444';
    }
}

window.UIRenderer = UIRenderer;

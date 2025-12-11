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

        // Calculate total sales and max for percentage bars (like dealer list)
        const totalSales = districts.reduce((sum, d) => sum + d.totalSales, 0);
        const maxSales = districts[0]?.totalSales || 0;

        let html = '<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">Sales</h3>';
        html += '<div class="district-sales-list">';

        districts.forEach((district, i) => {
            const percentage = totalSales > 0 ? ((district.totalSales / totalSales) * 100) : 0;
            const percentageText = percentage.toFixed(1);
            // Bar width based on max sales (same as dealer list)
            const barWidth = maxSales > 0 ? (district.totalSales / maxSales) * 100 : 0;

            html += `
                <div class="district-item-compact">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-info">
                        <div class="district-row">
                            <span class="district-name" title="${district.name}">${district.name}</span>
                            <span class="district-percentage">${percentageText}%</span>
                            <span class="district-sales">₹${this.formatNumber(district.totalSales)}</span>
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

    /**
     * Render a generic list of states sorted by a metric (GDP/Population)
     * @param {Array} states - Array of objects {name, gdp, population}
     * @param {string} metricKey - Key to display ('gdp' or 'population')
     * @param {string} title - Header title
     */
    static renderStateMetricList(states, metricKey, title) {
        if (!states || states.length === 0) return '';

        // Helper to parse value (handles "3.5 Cr", "1000", etc)
        const parseVal = (val) => {
            if (!val) return 0;
            if (typeof val === 'number') return val;
            let str = val.replace(/,/g, '');
            let mult = 1;
            if (str.toLowerCase().includes('cr')) mult = 10000000; // stored as unit? or just scale?
            // Actually, if data is "3000" and header says (Cr), treat as 3000.
            // If data says "30 Cr", parse it.
            let num = parseFloat(str.replace(/[^0-9.]/g, ''));
            return isNaN(num) ? 0 : num; // We only need relative scale for bars
        };

        const maxVal = states.reduce((max, s) => Math.max(max, parseVal(s[metricKey])), 0);

        let html = `<h3 style="margin:0.25rem 0; color:var(--text-muted); font-size:0.7rem; text-transform:uppercase; letter-spacing:0.05em; font-weight:600;">${title}</h3>`;
        html += '<div class="district-sales-list">';

        states.forEach((state, i) => {
            const val = state[metricKey] || 'N/A';
            const numVal = parseVal(val);
            const barWidth = maxVal > 0 ? (numVal / maxVal) * 100 : 0;

            html += `
                <div class="district-item-compact">
                    <div class="district-rank">${i + 1}</div>
                    <div class="district-info">
                        <div class="district-row">
                            <span class="district-name" title="${state.name}">${state.name}</span>
                            <span class="district-sales" style="color: var(--text-main);">${val}</span>
                        </div>
                        <div class="contribution-bar-bg">
                            <div class="contribution-bar-fill" style="width:${barWidth}%; background-color: var(--primary-color);"></div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        return html;
    }

    /**
     * Render view toggle for switching between Dealers and Districts
     * @param {string} activeView - 'dealers' or 'districts'
     * @returns {string} HTML string
     */
    static renderViewToggle(activeView = 'dealers') {
        return `
            <div class="view-toggle">
                <button class="toggle-btn ${activeView === 'dealers' ? 'active' : ''}" data-view="dealers">
                    Dealers
                </button>
                <button class="toggle-btn ${activeView === 'districts' ? 'active' : ''}" data-view="districts">
                    Districts
                </button>
            </div>
        `;
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

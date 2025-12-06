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
        let html = '<h3 style="margin:1.5rem 0 1rem 0; color:var(--text-muted); font-size:0.9rem; text-transform:uppercase; letter-spacing:0.05em;">Dealer Performance</h3>';

        dealers.forEach((d, i) => {
            const percent = maxSales > 0 ? (d.sales / maxSales) * 100 : 0;
            html += `
                <div class="dealer-item" style="position:relative; overflow:hidden; margin-bottom:0.75rem; padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; display:flex; gap:1rem; align-items:center;">
                    <!-- Contribution Bar -->
                    <div style="position:absolute; bottom:0; left:0; height:3px; background:var(--primary); width:${percent}%; opacity:0.7; transition:width 0.5s;"></div>
                    
                    <div class="dealer-rank" style="background:var(--primary); width:24px; height:24px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:bold;">${i + 1}</div>
                    
                    <div style="flex:1; position:relative; z-index:1;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div class="dealer-name" style="font-weight:500; color:white;">${d.name}</div>
                            <div class="dealer-sales" style="font-size:0.85rem; color:var(--text-muted)">₹${this.formatNumber(d.sales)}</div>
                        </div>
                        <div style="font-size:0.7rem; color:rgba(255,255,255,0.3); margin-top:2px;">Contribution: ${percent.toFixed(1)}% of Top</div>
                    </div>
                </div>
            `;
        });

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

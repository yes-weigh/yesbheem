import FormatUtils from '../utils/format-utils.js';

class DashboardController {
    constructor() {
        this.lastReceivedStats = null;
        this.initialized = false;
        this.init();
        this.setupEventListeners();
    }

    async init() {
        // Show skeleton initially
        const skeleton = document.getElementById('dashboard-skeleton');
        const stats = document.getElementById('dashboard-stats');

        if (skeleton) skeleton.style.display = ''; // Use CSS default (grid)
        if (stats) stats.style.display = 'none';

        this.initialized = true;
        console.log('Dashboard Controller initialized, waiting for stats from iframe...');
    }

    normalizeName(name) {
        if (!name) return '';
        return name.toLowerCase().trim().replace(/[^a-z0-9]/g, '');
    }

    animateValue(element, start, end, duration) {
        if (!element) return;
        const range = end - start;
        const startTime = Date.now();

        const timer = setInterval(() => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const current = start + (range * progress);

            element.textContent = Math.floor(current);

            if (progress === 1) clearInterval(timer);
        }, 16);
    }

    renderStats(data) {
        if (!data) return;
        this.lastReceivedStats = data;

        const container = document.getElementById('dashboard-stats');
        const skeleton = document.getElementById('dashboard-skeleton');

        if (!container) return;

        // Hide skeleton and show stats
        if (skeleton) skeleton.style.display = 'none';
        container.style.display = ''; // Restore to grid from CSS

        // Merge Data Logic
        const entityName = data.name;
        let key = this.normalizeName(entityName);
        if (key === 'panindia') key = 'india';

        let tableInfo = window.dashboardDataCache ? window.dashboardDataCache[key] : null;

        // Population
        let displayPop = 'N/A';
        if (tableInfo && tableInfo.pop) {
            displayPop = tableInfo.pop;
        } else if (data.population && data.population !== 'N/A') {
            displayPop = data.population;
        } else if (data.name === 'India' || data.name === 'Pan India') {
            displayPop = '144 Cr';
        }

        // GDP
        let displayGDP = 'N/A';
        if (tableInfo && tableInfo.gdp) {
            displayGDP = tableInfo.gdp;
        } else if (data.gdp && data.gdp !== 'N/A') {
            displayGDP = data.gdp;
        }

        // Target
        let displayTargetStr = tableInfo && tableInfo.target ?
            tableInfo.target : FormatUtils.formatCurrency(data.monthlyTarget);

        // Achievement
        let displayAchievement = '0%';
        let targetRaw = FormatUtils.parseUnitString(displayTargetStr);
        let currentSalesRaw = parseFloat(data.currentSales) || 0;

        if (targetRaw > 0) {
            let ach = (currentSalesRaw / targetRaw) * 100;
            displayAchievement = ach.toFixed(1) + '%';
        } else {
            displayAchievement = parseFloat(data.achievement || 0).toFixed(1) + '%';
        }

        // Update dashboard title
        const titleElement = document.getElementById('dashboard-region-title');
        if (titleElement) {
            let displayName = data.name || 'India';
            if (displayName === 'Pan India') {
                displayName = 'India';
            }
            titleElement.textContent = displayName;
        }

        // Clamp achievement for progress bar
        let achValue = 0;
        let displayAchievementNum = 0;
        if (targetRaw > 0) {
            achValue = (currentSalesRaw / targetRaw) * 100;
            displayAchievementNum = achValue;
        } else {
            achValue = parseFloat(data.achievement || 0);
            displayAchievementNum = achValue;
        }
        const progressWidth = Math.min(Math.max(displayAchievementNum, 0), 100) + '%';
        const isTrendUp = displayAchievementNum >= 100;

        container.innerHTML = `
            <!-- Population -->
            <div class="kpi-card card-blue">
                <div class="kpi-header">
                    <span class="kpi-icon">📊</span>
                    <span class="kpi-label">Population</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value">${displayPop}</span>
                </div>
                <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: 65%"></div>
                </div>
            </div>

            <!-- GDP -->
            <div class="kpi-card card-teal">
                <div class="kpi-header">
                    <span class="kpi-icon">💰</span>
                    <span class="kpi-label">GDP</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value">${displayGDP}</span>
                </div>
                <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: 45%"></div>
                </div>
            </div>

            <!-- Dealers -->
            <div class="kpi-card card-orange">
                <div class="kpi-header">
                    <span class="kpi-icon">🏪</span>
                    <span class="kpi-label">Active Dealers</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value counters" data-target="${data.dealerCount}">0</span>
                </div>
                 <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: 70%"></div>
                </div>
            </div>

            <!-- Target -->
            <div class="kpi-card card-red">
                <div class="kpi-header">
                    <span class="kpi-icon">🎯</span>
                    <span class="kpi-label">Target</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value">${displayTargetStr}</span>
                </div>
                <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: 100%"></div>
                </div>
            </div>

            <!-- Sales -->
            <div class="kpi-card card-cyan">
                <div class="kpi-header">
                    <span class="kpi-icon">₹</span>
                    <span class="kpi-label">Total Sales</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value">₹${FormatUtils.formatCurrency(data.currentSales)}</span>
                </div>
                 <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: ${progressWidth}"></div>
                </div>
            </div>

            <!-- Achievement -->
            <div class="kpi-card card-purple">
                 <div class="kpi-header">
                    <span class="kpi-icon">🏆</span>
                    <span class="kpi-label">Achievement</span>
                </div>
                <div class="kpi-content">
                    <span class="kpi-value">${displayAchievement}</span>
                     <span class="kpi-trend ${isTrendUp ? 'trend-up' : 'trend-down'}">
                        <svg class="trend-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
                        <span>${isTrendUp ? 'On Track' : 'Off Track'}</span>
                    </span>
                </div>
                <div class="kpi-progress">
                    <div class="kpi-progress-bar" style="width: ${progressWidth}"></div>
                </div>
            </div>
        `;

        // Trigger Animations
        const counters = container.querySelectorAll('.counters');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-target'), 10);
            if (!isNaN(target)) {
                this.animateValue(counter, 0, target, 1000);
            }
        });
    }

    setupEventListeners() {
        window.addEventListener('message', (event) => {
            if (event.data.type === 'STATS_UPDATE') {
                this.renderStats(event.data.data);
            }
        });
    }
}

// Initialize on load
new DashboardController();

export default DashboardController;

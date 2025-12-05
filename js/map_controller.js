// Map Controller for India → State Navigation
(function () {
    'use strict';

    // Get DOM elements
    const states = document.querySelectorAll('.state');
    const infoPanel = document.getElementById('info-panel');
    const stateName = document.getElementById('state-name');
    const stateDescription = document.getElementById('state-description');
    const tooltip = document.getElementById('tooltip');

    // State information
    const stateInfo = {
        'IN-KL': {
            name: 'Kerala',
            description: 'Kerala has detailed district-level insights available. Click to explore all 14 districts with sales data, dealer information, and performance metrics.',
            url: 'kerala.html',
            available: true
        }
    };

    // Tooltip positioning
    function showTooltip(e, text) {
        tooltip.textContent = text;
        tooltip.classList.add('show');
        updateTooltipPosition(e);
    }

    function hideTooltip() {
        tooltip.classList.remove('show');
    }

    function updateTooltipPosition(e) {
        const x = e.clientX;
        const y = e.clientY;
        tooltip.style.left = (x + 15) + 'px';
        tooltip.style.top = (y + 15) + 'px';
    }

    // Add event listeners to each state
    states.forEach(state => {
        const stateId = state.id;
        const stateName = state.getAttribute('title') || state.dataset.name || stateId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

        // Hover - show tooltip
        state.addEventListener('mouseenter', function (e) {
            showTooltip(e, stateName);
        });

        state.addEventListener('mouseleave', function () {
            hideTooltip();
        });

        state.addEventListener('mousemove', function (e) {
            updateTooltipPosition(e);
        });

        // Click - navigate or show info
        state.addEventListener('click', function () {
            const info = stateInfo[stateId];

            if (info && info.available) {
                // Navigate to state page
                window.location.href = info.url;
            } else {
                // Show "coming soon" message
                if (infoPanel) {
                    stateName.textContent = stateName;
                    stateDescription.innerHTML = `
                        <p>Detailed insights for ${stateName} are coming soon.</p>
                        <p class="coming-soon">Currently, only Kerala has district-level data available. Click on Kerala to explore!</p>
                    `;
                    infoPanel.classList.add('active');
                }
            }
        });
    });

    // Click anywhere to close info panel
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.state') && !e.target.closest('.info-panel')) {
            if (infoPanel) {
                infoPanel.classList.remove('active');
            }
        }
    });

    // Highlight Kerala on load
    console.log('India Map loaded. Kerala is ready for exploration!');
})();

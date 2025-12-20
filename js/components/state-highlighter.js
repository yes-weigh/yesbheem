/**
 * @fileoverview State highlighting logic for map interactions
 * @module components/state-highlighter
 */

/**
 * Handles highlighting of states and districts on the map
 * @class StateHighlighter
 * @example
 * const highlighter = new StateHighlighter();
 * highlighter.highlight(mapContainer, 'KL');
 */
export class StateHighlighter {
    /**
     * Highlights a specific state on the map
     * @param {HTMLElement} container - Map container element
     * @param {string|null} stateId - State ID to highlight (null to clear all)
     * @returns {void}
     * @example
     * highlighter.highlight(mapContainer, 'KL'); // Highlights Kerala
     * highlighter.highlight(mapContainer, null); // Clears all highlights
     */
    highlight(container, stateId) {
        if (!container) return;

        // Remove existing highlights
        const allPaths = container.querySelectorAll('path');
        allPaths.forEach(p => p.classList.remove('highlighted'));

        // Add highlight to clicked state
        // Try exact match or IN- prefix
        if (stateId) {
            let target = document.getElementById(stateId) || document.getElementById(`IN-${stateId}`);
            if (target) {
                target.classList.add('highlighted');
            }
        }
    }

    /**
     * Clears all highlights from the map
     * @param {HTMLElement} container - Map container element
     * @returns {void}
     * @example
     * highlighter.clearHighlights(mapContainer);
     */
    clearHighlights(container) {
        this.highlight(container, null);
    }

    /**
     * Checks if a state is currently highlighted
     * @param {HTMLElement} container - Map container element
     * @param {string} stateId - State ID to check
     * @returns {boolean} True if the state is highlighted
     * @example
     * const isHighlighted = highlighter.isHighlighted(mapContainer, 'KL');
     */
    isHighlighted(container, stateId) {
        if (!container || !stateId) return false;

        const target = document.getElementById(stateId) || document.getElementById(`IN-${stateId}`);
        return target ? target.classList.contains('highlighted') : false;
    }
}

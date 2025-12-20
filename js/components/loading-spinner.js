/**
 * @fileoverview Renders loading spinner component
 * @module components/loading-spinner
 */

/**
 * Renders a loading spinner with an optional message
 * @param {string} [message='Loading...'] - Text to display below spinner
 * @returns {string} HTML string for loading spinner
 * @example
 * const html = renderLoading('Fetching data...');
 * container.innerHTML = html;
 */
export function renderLoading(message = 'Loading...') {
    return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem; color: var(--text-muted);">
            <div class="spinner" style="width: 24px; height: 24px; border: 3px solid rgba(255,255,255,0.1); border-top-color: var(--accent-color); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1rem;"></div>
            <div style="font-size: 0.9rem;">${message}</div>
        </div>
        <style>
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        </style>
    `;
}

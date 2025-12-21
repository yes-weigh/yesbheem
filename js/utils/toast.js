/**
 * Toast Notification Utility
 * Replaces native browser alerts with modern, non-blocking toast messages.
 */
export class Toast {
    /**
     * Show a toast notification
     * @param {string} message - Text or HTML message to display
     * @param {string} type - 'success', 'error', 'warning', 'info'
     * @param {number} duration - Time in ms before auto-dismiss (default: 3000)
     */
    static show(message, type = 'info', duration = 3000) {
        let container = document.getElementById('toast-container');
        if (!container) {
            console.warn('Toast container not found. Creating one...');
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || 'ℹ'}</div>
            <div class="toast-content">
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(toast);

        // Auto remove
        if (duration > 0) {
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.style.animation = 'toast-slide-out 0.3s forwards';
                    setTimeout(() => toast.remove(), 300);
                }
            }, duration);
        }
    }

    static success(msg, duration = 3000) { this.show(msg, 'success', duration); }
    static error(msg, duration = 4000) { this.show(msg, 'error', duration); }
    static warning(msg, duration = 4000) { this.show(msg, 'warning', duration); }
    static info(msg, duration = 3000) { this.show(msg, 'info', duration); }
}

export default Toast;

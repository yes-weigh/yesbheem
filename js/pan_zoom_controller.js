/**
 * PanZoomController
 * Handles panning and zooming of map elements using CSS transforms.
 * Supports mouse drag, touch drag, and scroll wheel zoom.
 */
class PanZoomController {
    constructor(containerSelector, elementSelector) {
        this.container = document.querySelector(containerSelector);
        this.element = document.querySelector(elementSelector);

        if (!this.container || !this.element) {
            console.warn('PanZoomController: Container or Element not found');
            return;
        }

        this.state = {
            scale: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0
        };

        this.init();
    }

    init() {
        // Prevent default browser zooming
        this.container.style.overflow = 'hidden';
        this.element.style.transformOrigin = '0 0';
        this.element.style.transition = 'transform 0.1s ease-out';

        // Mouse Events
        this.container.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.container.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.container.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.container.addEventListener('mouseleave', this.handleMouseUp.bind(this));
        this.container.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });

        // Touch Events (Basic Support)
        this.container.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
        this.container.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
        this.container.addEventListener('touchend', this.handleMouseUp.bind(this));
    }

    setTransform() {
        this.element.style.transform = `translate(${this.state.pointX}px, ${this.state.pointY}px) scale(${this.state.scale})`;
    }

    handleMouseDown(e) {
        e.preventDefault();
        this.state.startX = e.clientX - this.state.pointX;
        this.state.startY = e.clientY - this.state.pointY;
        this.state.panning = true;
        this.container.style.cursor = 'grabbing';
    }

    handleMouseMove(e) {
        if (!this.state.panning) return;
        e.preventDefault();
        this.state.pointX = e.clientX - this.state.startX;
        this.state.pointY = e.clientY - this.state.startY;
        this.setTransform();
    }

    handleMouseUp() {
        this.state.panning = false;
        this.container.style.cursor = 'grab';
    }

    handleWheel(e) {
        e.preventDefault();
        const xs = (e.clientX - this.container.getBoundingClientRect().left - this.state.pointX) / this.state.scale;
        const ys = (e.clientY - this.container.getBoundingClientRect().top - this.state.pointY) / this.state.scale;

        const delta = -Math.sign(e.deltaY);
        // Sensitivity: 1.1x zoom
        let scale = delta > 0 ? this.state.scale * 1.1 : this.state.scale / 1.1;

        // Limits
        scale = Math.min(Math.max(0.5, scale), 5); // 0.5x to 5x zoom

        this.state.pointX = e.clientX - this.container.getBoundingClientRect().left - xs * scale;
        this.state.pointY = e.clientY - this.container.getBoundingClientRect().top - ys * scale;
        this.state.scale = scale;

        this.setTransform();
    }

    handleTouchStart(e) {
        // Single finger touch for panning
        if (e.touches.length === 1) {
            e.preventDefault(); // Prevent scroll
            const touch = e.touches[0];
            this.state.startX = touch.clientX - this.state.pointX;
            this.state.startY = touch.clientY - this.state.pointY;
            this.state.panning = true;
        }
    }

    handleTouchMove(e) {
        if (e.touches.length === 1 && this.state.panning) {
            e.preventDefault();
            const touch = e.touches[0];
            this.state.pointX = touch.clientX - this.state.startX;
            this.state.pointY = touch.clientY - this.state.startY;
            this.setTransform();
        }
    }

    zoomIn() {
        const center = this.getCenter();
        this.zoomTo(center.x, center.y, 1.2);
    }

    zoomOut() {
        const center = this.getCenter();
        this.zoomTo(center.x, center.y, 1 / 1.2);
    }

    reset() {
        this.state.scale = 1;
        this.state.pointX = 0;
        this.state.pointY = 0;
        this.setTransform();
    }

    getCenter() {
        const rect = this.container.getBoundingClientRect();
        return {
            x: rect.width / 2,
            y: rect.height / 2
        };
    }

    zoomTo(x, y, factor) {
        const xs = (x - this.state.pointX) / this.state.scale;
        const ys = (y - this.state.pointY) / this.state.scale;

        let scale = this.state.scale * factor;
        scale = Math.min(Math.max(0.5, scale), 5);

        this.state.pointX = x - xs * scale;
        this.state.pointY = y - ys * scale;
        this.state.scale = scale;
        this.setTransform();
    }
}

// Make globally available
window.PanZoomController = PanZoomController;

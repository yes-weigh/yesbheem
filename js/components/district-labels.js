/**
 * @fileoverview District label creation and positioning for map visualization
 * @module components/district-labels
 */

/**
 * Handles creation and positioning of district labels on the map
 * @class DistrictLabels
 * @example
 * const labels = new DistrictLabels();
 * labels.createLabels(districts, mapContainer);
 */
export class DistrictLabels {
    /**
     * Creates labels for all districts
     * @param {NodeList} districts - District elements
     * @param {HTMLElement} container - Map container element
     * @returns {void}
     * @example
     * const districts = document.querySelectorAll('.district');
     * labels.createLabels(districts, mapContainer);
     */
    createLabels(districts, container) {
        // Clean up existing labels first
        this.clearLabels(container);

        districts.forEach(district => {
            const districtName = district.getAttribute('title') || district.id;

            try {
                // Get bounding box for positioning
                const bbox = district.getBBox();
                if (bbox && bbox.width > 0) {
                    const label = this.createLabel(district, bbox, districtName);
                    if (label && district.parentNode) {
                        district.parentNode.appendChild(label);
                    }
                }
            } catch (e) {
                console.warn('Could not add label for district:', districtName, e);
            }
        });
    }

    /**
     * Creates a single district label
     * @param {SVGElement} district - District SVG element
     * @param {DOMRect} bbox - Bounding box of the district
     * @param {string} districtName - Name of the district
     * @returns {SVGTextElement} Created text element
     * @private
     */
    createLabel(district, bbox, districtName) {
        let cx = bbox.x + bbox.width / 2;
        let cy = bbox.y + bbox.height / 2;

        // Create Text Element
        const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

        // Format name: capitalize words, replace hyphens with spaces
        let labelText = districtName.replace(/-/g, ' ');
        labelText = labelText.split(' ').map(word => {
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        }).join(' ');

        // Adjust position for specific districts
        const adjusted = this.adjustPosition(labelText, cx, cy);
        cx = adjusted.cx;
        cy = adjusted.cy;

        text.textContent = labelText;
        text.setAttribute('x', cx);
        text.setAttribute('y', cy);
        text.setAttribute('class', 'district-label'); // Mark for cleanup
        text.setAttribute('text-anchor', 'middle'); // Center horizontally
        text.setAttribute('dominant-baseline', 'middle'); // Center vertically
        text.style.pointerEvents = 'none'; // Click-through to path
        text.style.fill = 'rgba(255, 255, 255, 0.95)'; // White text, high contrast
        text.style.fontSize = '40px';
        text.style.fontWeight = '400';
        text.style.fontFamily = 'Inter, sans-serif';
        text.style.textShadow = '0px 1px 3px rgba(0,0,0,0.9)'; // Stronger shadow

        // Apply rotation for specific districts or based on shape
        const rotation = this.getRotation(labelText, bbox, cx, cy);
        if (rotation) {
            text.setAttribute('transform', rotation);
        }

        // Adjust font size for long names
        if (labelText.toLowerCase().trim() === 'thiruvananthapuram') {
            text.style.fontSize = '24px';
        }

        return text;
    }

    /**
     * Adjusts label position for specific districts
     * @param {string} name - District name (lowercase)
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @returns {Object} Adjusted coordinates {cx, cy}
     * @private
     */
    adjustPosition(name, cx, cy) {
        const lowerName = name.toLowerCase().trim();

        if (lowerName === 'alappuzha') {
            cy += 70; // Shift Down to wider area
            cx -= 30;
        } else if (lowerName === 'thrissur') {
            cx -= 80; // Shift Left for better centering
        } else if (lowerName === 'palakkad') {
            cy -= 50; // Shift Up
        }

        return { cx, cy };
    }

    /**
     * Gets rotation transform for label based on district shape
     * @param {string} name - District name (lowercase)
     * @param {DOMRect} bbox - Bounding box
     * @param {number} cx - Center X coordinate
     * @param {number} cy - Center Y coordinate
     * @returns {string|null} Transform attribute value or null
     * @private
     */
    getRotation(name, bbox, cx, cy) {
        const lowerName = name.toLowerCase().trim();

        if (lowerName === 'malappuram') {
            return `rotate(-45, ${cx}, ${cy})`;
        } else if (lowerName === 'thiruvananthapuram') {
            return `rotate(45, ${cx}, ${cy})`;
        } else if (lowerName === 'alappuzha') {
            return `rotate(60, ${cx}, ${cy})`;
        } else if (bbox.height > bbox.width * 1.2) {
            // Tall districts get vertical text
            return `rotate(-90, ${cx}, ${cy})`;
        }

        return null;
    }

    /**
     * Removes all district labels from the container
     * @param {HTMLElement} container - Map container element
     * @returns {void}
     * @example
     * labels.clearLabels(mapContainer);
     */
    clearLabels(container) {
        if (!container) return;
        const existingLabels = container.querySelectorAll('.district-label');
        existingLabels.forEach(l => l.remove());
    }
}

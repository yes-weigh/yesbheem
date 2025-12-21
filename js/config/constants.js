/**
 * Application Constants
 * Centralized configuration for all hardcoded values used across the application
 * @module config/constants
 */

// ============================================================================
// UI CONSTANTS
// ============================================================================

/**
 * Table UI Configuration
 * Constants related to table layout and display
 */
export const TABLE_UI = {
    /**
     * Width of the first column (Sl.No column) in pixels
     * Used across all tables to maintain consistent serial number column width
     */
    FIRST_COLUMN_WIDTH: 45,

    /**
     * Minimum width for resizable columns in pixels
     * Prevents columns from being resized too small
     */
    MIN_COLUMN_WIDTH: 50,

    /**
     * Minimum column width sanity check in pixels
     * Used for validating stored column widths from localStorage
     */
    MIN_COLUMN_WIDTH_VALIDATION: 30,

    /**
     * Column resize hit area in pixels
     * Distance from right edge of header where resize is enabled
     */
    RESIZE_HIT_AREA: 10,

    /**
     * Minimum width for district percentage display in pixels
     */
    DISTRICT_PERCENTAGE_MIN_WIDTH: 45
};

/**
 * Pagination Configuration
 * Settings for paginated views
 */
export const PAGINATION = {
    /**
     * Default number of items per page for dealer management
     */
    DEFAULT_ITEMS_PER_PAGE: 100,

    /**
     * Fallback pagination size (used in some legacy contexts)
     */
    LEGACY_PAGE_SIZE: 20
};

/**
 * Layout and Spacing
 * Generic UI spacing and positioning values
 */
export const LAYOUT = {
    /**
     * Standard top position for hover labels in pixels
     */
    HOVER_LABEL_TOP: 20,

    /**
     * Standard left position for hover labels in pixels
     */
    HOVER_LABEL_LEFT: 20,

    /**
     * Standard padding for content areas in pixels
     */
    CONTENT_PADDING: 20,

    /**
     * Height of divider elements in pixels
     */
    DIVIDER_HEIGHT: 20,

    /**
     * Margin for dividers in pixels
     */
    DIVIDER_MARGIN: 10
};

/**
 * SVG Icon Dimensions
 * Standard sizes for inline SVG icons
 */
export const ICON_SIZES = {
    /**
     * Small icon size (e.g., inline edit icons)
     */
    SMALL: 12,

    /**
     * Medium icon size (e.g., checkmarks, action buttons)
     */
    MEDIUM: 14,

    /**
     * Regular icon size (e.g., navigation icons)
     */
    REGULAR: 16,

    /**
     * Large icon size (e.g., prominent UI elements)
     */
    LARGE: 20
};

/**
 * Z-Index Layers
 * Standardized z-index values to maintain proper layering
 */
export const Z_INDEX = {
    /**
     * Modal overlays and dropdowns
     */
    MODAL: 2000
};

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * Debounce and Delay Settings
 * Timeout values for various UI interactions and API calls
 */
export const TIMING = {
    /**
     * Standard debounce delay in milliseconds
     * Used for input fields and search filtering
     */
    DEBOUNCE_DEFAULT: 300,

    /**
     * Debounce delay for auto-save operations in milliseconds
     * Used when auto-saving KPI data or settings
     */
    DEBOUNCE_AUTOSAVE: 2000,

    /**
     * Delay for status message auto-clear in milliseconds
     * How long success/error messages remain visible
     */
    STATUS_CLEAR_DELAY: 2000,

    /**
     * Extended status clear delay in milliseconds
     * Used for important notifications
     */
    STATUS_CLEAR_DELAY_LONG: 3000,

    /**
     * Polling interval for DataManager availability check in milliseconds
     */
    POLL_INTERVAL: 100,

    /**
     * Retry delay for async operations in milliseconds
     */
    RETRY_DELAY: 200,

    /**
     * API rate limiting delay in milliseconds
     * Small delay between consecutive API requests
     */
    API_RATE_LIMIT_DELAY: 200,

    /**
     * Maximum wait time for DataManager initialization in attempts
     */
    MAX_WAIT_ATTEMPTS: 50
};

/**
 * Animation Durations
 * CSS transition and animation timing values
 */
export const ANIMATION = {
    /**
     * Fade out duration for status messages in milliseconds
     */
    FADE_OUT_DURATION: 2000,

    /**
     * Slide panel transition duration in CSS format
     */
    SLIDE_TRANSITION: '0.3s cubic-bezier(0.4, 0, 0.2, 1)'
};

// ============================================================================
// DATA VALIDATION CONSTANTS
// ============================================================================

/**
 * Known Invalid Zip Codes
 * Set of zip codes that should be filtered out or marked as invalid
 */
export const INVALID_ZIP_CODES = new Set([
    '686028',
    '382487',
    '403407',
    '5000074',
    '505206',
    '68002',
    '570024'
]);

/**
 * Geographic Data
 * Lists of states and districts for validation and dropdowns
 */
export const GEOGRAPHY = {
    /**
     * List of all Indian states and union territories
     */
    STATES: [
        "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar",
        "Chandigarh", "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa",
        "Gujarat", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka",
        "Kerala", "Ladakh", "Lakshadweep", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
        "Mizoram", "Nagaland", "Odisha", "Puducherry", "Punjab", "Rajasthan", "Sikkim",
        "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
    ],

    /**
     * List of Kerala districts
     */
    KERALA_DISTRICTS: [
        "Alappuzha", "Ernakulam", "Idukki", "Kannur", "Kasaragod", "Kollam", "Kottayam",
        "Kozhikode", "Malappuram", "Palakkad", "Pathanamthitta", "Thiruvananthapuram",
        "Thrissur", "Wayanad"
    ]
};

// ============================================================================
// SVG VIEWBOX CONSTANTS
// ============================================================================

/**
 * Standard ViewBox for SVG Icons
 * Common viewBox attribute value for 24x24 icon system
 */
export const SVG = {
    /**
     * Standard 24x24 viewBox for icons
     */
    VIEWBOX_24: "0 0 24 24",

    /**
     * SVG namespace URL
     */
    NAMESPACE: "http://www.w3.org/2000/svg"
};

// ============================================================================
// ROTATION ANGLES
// ============================================================================

/**
 * Rotation Angles
 * Standard rotation values for labels and elements
 */
export const ROTATION = {
    /**
     * Standard clockwise rotation in degrees
     */
    CLOCKWISE: 45,

    /**
     * Standard counter-clockwise rotation in degrees
     */
    COUNTER_CLOCKWISE: -45
};

// ============================================================================
// COLOR VALUES
// ============================================================================

/**
 * Status Colors
 * Color codes for different status types
 */
export const COLORS = {
    /**
     * Success/positive status color (green)
     */
    SUCCESS: '#22c55e',

    /**
     * Error/negative status color (red)
     */
    ERROR: '#ef4444',

    /**
     * Warning status color (orange)
     */
    WARNING: '#f59e0b'
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get pixel value with 'px' suffix
 * @param {number} value - Numeric pixel value
 * @returns {string} Value with 'px' suffix
 * @example
 * toPx(45) // returns "45px"
 */
export function toPx(value) {
    return `${value}px`;
}

/**
 * Get milliseconds value with 'ms' suffix
 * @param {number} value - Numeric millisecond value
 * @returns {string} Value with 'ms' suffix
 * @example
 * toMs(300) // returns "300ms"
 */
export function toMs(value) {
    return `${value}ms`;
}

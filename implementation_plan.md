# Template UI Redesign Plan

## Goal
Rework the Template Editor UI to present a premium, distinct, and highly usable interface.
**Key Requirement**: Make small buttons (New Message, Add Button, Delete Icons) BIGGER and clearer.

## Proposed Changes

### 1. Typography & Spacing
- Increase base font size for better readability.
- Add more vertical spacing between form sections.
- Use a modern font stack (Inter/system-ui) with better weight distribution.

### 2. Sidebar (Template List)
- **New Message Button**: Convert to a large, full-width "Call to Action" button at the top.
- **Template Items**: Style as distinct "cards" with hover effects, larger padding, and clear active states.
- **Scrollbar**: Custom, slim scrollbar that blends in.

### 3. Editor Area
- **Inputs**: Increase height (`min-height: 48px`), add subtle borders/glow on focus.
- **Type Selector**: Convert small tabs into larger "Segmented Control" style pills with icons.
- **Media Section**: Redesign the upload/URL toggle to be more prominent.
- **Interactive Buttons Section**:
    - **Add Button**: Change the small text button to a large, dashed-border "Drop Zone" style button that says "+ Add Interactive Button".
    - **Button Cards**: Style each added button (Reply, URL, Call) as a contained card with a clear header and a large "Remove" button.

### 4. Footer Actions
- Increase size of "Save Template" and "Send Message" buttons.
- Ensure they are always visible or stick to the bottom if content is long (already fixed scroll, but sticky footer is nice).

### 5. Color Palette
- Refine the Dark Mode theme.
- Use a more vibrant accent color (e.g., a brighter Blue/Violet gradient).
- Ensure contrast is sufficient for text.

## Files to Modify
- `d:\kerala\pages\template.html` (CSS & HTML Structure)
- `d:\kerala\js\template_manager.js` (Dynamic HTML generation for attributes/classes)

## Verification
- Check all buttons are easily clickable.
- Verify "Add Button" flow is intuitive and large.
- Check responsiveness.

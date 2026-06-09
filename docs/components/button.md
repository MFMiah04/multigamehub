# Button Component

## Overview
The button component provides consistent, reusable button styling across all pages using BEM naming conventions.

## Location
- **CSS**: `styles/components/button.css`
- **Used in**: All HTML files (15+ locations)

## Usage

### Basic Button (Primary)
```html
<button class="button">Submit</button>
```

### Secondary Button
```html
<button class="button button--secondary">Cancel</button>
```

### Danger Button (Destructive Actions)
```html
<button class="button button--danger">Delete</button>
```

### Room Code Button (Pill-shaped)
```html
<button class="button button--room-code" id="roomCodeDisplay">ABCDE</button>
```

### Side-by-Side Buttons (Flex)
```html
<div style="display: flex; gap: 10px;">
  <button class="button button--secondary button--flex">Cancel</button>
  <button class="button button--flex">Submit</button>
</div>
```

### Requested State (Fakin' It Specific)
```html
<button class="button button--requested">Vote Requested</button>
```

### Disabled Button
```html
<button class="button" disabled>Not Ready</button>
```

## Variants

### `.button` (Base)
- **Purpose**: Primary action button
- **Color**: Primary (`#667eea`)
- **Width**: 100% (full width)
- **Use case**: Main submit/action buttons

### `.button--secondary`
- **Purpose**: Secondary actions
- **Color**: Secondary (`#764ba2`)
- **Use case**: Cancel, alternative actions

### `.button--danger`
- **Purpose**: Destructive actions
- **Color**: Danger/Error (`#e74c3c`)
- **Use case**: Delete, kick, remove actions

### `.button--requested`
- **Purpose**: Special Fakin' It game state
- **Color**: Warning (`#ffc107`)
- **Use case**: Vote request indicator in Fakin' It

### `.button--room-code`
- **Purpose**: Display copyable room code
- **Style**: Inline-block, pill-shaped, auto width
- **Use case**: Lobby room code display

### `.button--flex`
- **Purpose**: Side-by-side button layouts
- **Behavior**: Removes `width: 100%`, adds `flex: 1`
- **Use case**: Multiple buttons in a flex container

## States

All buttons support these states automatically:

### Default
Base appearance with primary color and full width

### Hover (`:hover`)
- Darker background color
- Elevated shadow (`var(--shadow-xl)`)
- Slight upward movement (`translateY(-1px)`)

### Active (`:active`)
- Scales down (`scale(0.97)`)
- Reduced shadow
- Returns to baseline position

### Disabled (`:disabled`)
- Gray background (`var(--color-gray-disabled)`)
- Cursor: not-allowed
- No hover effects
- No shadow

## CSS Variables Used

The button component uses these CSS variables from `variables.css`:

**Colors:**
- `--color-primary`, `--color-primary-hover`
- `--color-secondary`, `--color-secondary-hover`
- `--color-danger`, `--color-warning`
- `--color-white`, `--color-gray-700`, `--color-gray-disabled`

**Spacing:**
- `--space-lg` (padding)
- `--space-md` (margin-bottom)
- `--space-sm-plus`, `--space-lg-plus` (room-code padding)

**Other:**
- `--radius-md` (border radius)
- `--radius-round` (room-code pill shape)
- `--shadow-md`, `--shadow-xl`, `--shadow-xs`, `--shadow-lg`
- `--transition-base`, `--transition-fast`
- `--font-weight-semibold`
- `--font-size-sm`, `--font-size-xs` (room-code)

## Examples

### Home Page Buttons
```html
<div style="display: flex; gap: 10px;">
  <button id="hostBtn" class="button button--flex">Host Lobby</button>
  <button id="joinBtn" class="button button--secondary button--flex">Join Lobby</button>
</div>
```

### Lobby Buttons
```html
<!-- Room code display -->
<button class="button button--room-code" id="roomCodeDisplay">ABCDE</button>

<!-- Action buttons -->
<div style="display: flex; gap: 10px;">
  <button id="leaveBtn" class="button button--secondary button--flex">Leave Lobby</button>
  <button id="startBtn" class="button button--flex">Start Game</button>
</div>
```

### Modal Buttons (Kick Confirmation)
```html
<div style="display: flex; gap: 10px;">
  <button id="cancelBtn" class="button button--secondary button--flex">Cancel</button>
  <button id="confirmBtn" class="button button--danger button--flex">Kick</button>
</div>
```

### Game Buttons
```html
<!-- Submit answer -->
<button id="submitBtn" class="button">Submit Answer</button>

<!-- Host controls -->
<button id="forceNextBtn" class="button button--secondary" style="display: none;">
  Force Results (Host)
</button>
```

## Implementation Notes

### CSS-Only Component
This is a **CSS-only component** with no JavaScript file. Buttons are simple HTML elements with event listeners attached in page scripts.

### Conditional Display
Use `style="display: none;"` for conditional visibility (JS-controlled). This is acceptable as it's dynamic, not styling.

### Combining Modifiers
You can combine multiple modifiers:
```html
<button class="button button--secondary button--flex">Cancel</button>
```

### Mobile Responsive
The room-code variant has mobile-specific styles:
- Smaller font size (`--font-size-xs`)
- Tighter letter spacing (1.5px)

## Migration from Old Classes

| Old | New |
|-----|-----|
| `<button>` | `<button class="button">` |
| `<button class="secondary">` | `<button class="button button--secondary">` |
| `<button class="requested">` | `<button class="button button--requested">` |
| `<button class="room-code">` | `<button class="button button--room-code">` |
| `style="flex: 1"` | `class="button--flex"` |
| `style="background: #e74c3c"` | `class="button--danger"` |

## Code Reduction

Phase 5 refactoring removed:
- **80 lines** from style.css (button styles)
- **20+ inline styles** across 15 HTML files
- Centralized all button styling in one component file

## Future Enhancements

Potential button variants for future needs:
- `.button--large` / `.button--small` (size variants)
- `.button--outline` (outline style)
- `.button--icon` (icon-only buttons)
- `.button--loading` (loading state)

## Related Components
- Timer component: `src/components/Timer.js`
- Input Field component: `styles/components/input-field.css`
- Question Display component: `styles/components/question-display.css`

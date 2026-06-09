# Player Card Component

## Overview
The player card component provides consistent, reusable card styling for voting phases and results across all games using BEM naming conventions.

## Location
- **CSS**: `styles/components/player-card.css`
- **Used in**: Fakin' It, Imposter, Spyfall voting/results, Herd Mentality reveal

## Usage

### Basic Player Card (Voting)
```html
<div class="player-card">
  <h3 class="player-card__name">Alice</h3>
</div>
```

### Player Card with Answer (Fakin' It)
```html
<div class="player-card">
  <h3 class="player-card__name">Bob</h3>
  <p class="player-card__answer">My favorite color is blue</p>
</div>
```

### Selected Card
```html
<div class="player-card player-card--selected">
  <h3 class="player-card__name">Charlie</h3>
</div>
```

### Disabled Card (Current Player)
```html
<div class="player-card player-card--disabled">
  <p class="player-card__name">You</p>
</div>
```

### Draggable Card (Herd Mentality)
```html
<div class="player-card player-card--draggable" draggable="true">
  <div class="player-card__name">Diana</div>
</div>
```

### Result Card with Role
```html
<div class="player-card player-card--faker">
  <h3 class="player-card__name">Eve</h3>
  <div class="player-card__votes">3 votes</div>
</div>
```

## Modifiers

### `.player-card--selected`
- **Purpose**: Show selected state in voting
- **Style**: Gradient background (primary to secondary), white text
- **Use case**: When player is voted for

### `.player-card--disabled`
- **Purpose**: Disable interaction for current player
- **Style**: 50% opacity, no hover effects
- **Use case**: "You" card in voting

### `.player-card--draggable`
- **Purpose**: Draggable cards for host regrouping
- **Style**: Grab cursor
- **Use case**: Herd Mentality reveal phase

### `.player-card--dragging`
- **Purpose**: Visual feedback during drag
- **Style**: 50% opacity, rotated
- **Use case**: While dragging card

### `.player-card--faker` / `--imposter` / `--spy`
- **Purpose**: Identify role in results
- **Style**: Red background, left border
- **Use case**: Results display

## Elements

### `.player-card__name`
- Player name display
- Inherits color from parent state

### `.player-card__answer`
- Answer text (Fakin' It only)
- Italic, smaller font

### `.player-card__votes`
- Vote count display
- Primary color, semibold

### `.player-card__points`
- Points indicator
- Green for positive, gray for zero

### `.player-card__badge`
- Role badges (host, overseer)
- Small pill-shaped labels

## States

All cards support these states:

### Default
- White background
- Border with standard color
- Pointer cursor

### Hover (`:hover`)
- Border changes to primary color
- Translates up (`translateY(-2px)`)
- Enhanced shadow

### Active (`:active`)
- Scales down (`scale(0.98)`)
- Reduced shadow

### Selected (`.player-card--selected`)
- Gradient background
- White text
- Slightly scaled up

### Disabled (`.player-card--disabled`)
- Reduced opacity (50%)
- No hover effects
- Not-allowed cursor

## CSS Variables Used

**Colors:**
- `--color-white`, `--color-primary`, `--color-secondary`
- `--color-gray-300`, `--color-gray-400`, `--color-gray-500`, `--color-gray-700`, `--color-gray-800`
- `--color-danger`, `--color-danger-light`
- `--color-success`, `--color-warning`, `--color-info`

**Spacing:**
- `--space-xs`, `--space-sm`, `--space-lg`, `--space-lg-plus`

**Other:**
- `--radius-md`, `--radius-sm`
- `--shadow-sm`, `--shadow-md`, `--shadow-xs`
- `--transition-base`
- `--font-size-xs`, `--font-size-sm`, `--font-size-sm-plus`, `--font-size-base`
- `--font-weight-semibold`

## Implementation Notes

### CSS-Only Component
This is a **CSS-only component** with no JavaScript file. Cards are created dynamically in each game's JavaScript with game-specific logic.

### Game-Specific Logic
- **Fakin' It**: Multi-select, name+answer
- **Imposter**: Multi-select, name only
- **Spyfall**: Multi-select (up to N spies), name only
- **Herd Mentality**: Draggable, name+answer

### Mobile Responsive
Cards have larger padding and spacing on mobile devices.

## Migration from Old Classes

| Old | New |
|-----|-----|
| `.answer-card` | `.player-card` |
| `.player-card.selected` | `.player-card.player-card--selected` |
| `.player-card.disabled` | `.player-card.player-card--disabled` |
| `.answer-card .player-name` | `.player-card__name` |
| `.answer-card p` (answer) | `.player-card__answer` |

## Code Reduction

Phase 6 refactoring removed:
- **32 lines** from style.css (answer-card styles)
- **75 lines** from shared-voting-styles.css (player/answer card styles)
- **60 lines** from herd-mentality/reveal.html (inline styles)
- Consolidated all card styling in one component file (165 lines)

## Related Components
- Timer component: `src/components/Timer.js`
- Button component: `styles/components/button.css`
- Input Field component: `styles/components/input-field.css`

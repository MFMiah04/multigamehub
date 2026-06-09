# Phase 6 Complete: Player Card Component

## Overview
Phase 6 focused on creating a reusable CSS player card component to ensure consistency across all voting phases and eliminate duplicate card styles. This phase also included fixing a critical bug in Spyfall multi-select voting.

## Files Created

### styles/components/player-card.css
- Centralized all player/answer card styling (165 lines)
- Uses CSS variables exclusively from variables.css
- Implements BEM naming with 6 modifiers
- Includes all interactive states (hover, active, selected, disabled, dragging)
- Mobile responsive

### docs/components/player-card.md
- Complete component documentation and usage guidelines
- Examples for all variants (voting, results, draggable)
- Migration guide from old classes to new BEM structure
- CSS variable reference

## Files Modified

### style.css
- **Removed**: 32 lines of conflicting answer-card styles (lines 99-130)
- **Added**: Import for player-card.css component

### games/shared-voting-styles.css
- **Removed**: 75 lines of player-card/answer-card styles (lines 12-87)
- **Added**: Import for player-card component
- **Kept**: Other voting-specific styles (vote-status, reveal-display, result-card)

### games/herd-mentality/reveal.html
- **Removed**: 60 lines of inline answer-card styles
- **Updated**: Card creation to use `.player-card .player-card--draggable`
- **Updated**: Card elements to use `.player-card__name`
- **Updated**: Dragging class to `.player-card--dragging`
- **Fixed**: Drag handlers to use `.player-card` selector (lines 306, 374)

### Fakin' It Voting (games/fakin-it/voting.html)
- **Updated**: Card class from `.answer-card` to `.player-card`
- **Updated**: Name element to `.player-card__name`
- **Updated**: Answer element to `.player-card__answer`
- **Updated**: Selected state to `.player-card--selected`
- **Updated**: Disabled state to `.player-card--disabled`
- **Updated**: toggleVote function to use new BEM classes

### Imposter Voting (games/imposter/voting.html)
- **Updated**: Card class remains `.player-card` (already correct)
- **Updated**: Name element to `.player-card__name`
- **Updated**: Disabled state to `.player-card--disabled`
- **Updated**: Selected state to `.player-card--selected`

### Spyfall Voting (games/spyfall/voting.html)
- **FIXED BUG**: Changed from single spy selection to multi-select
- **Updated**: `let selectedPlayerId = null` → `let selectedVotes = new Set()`
- **Updated**: Database field from `spyVote` (string) → `spyVotes` (array)
- **Added**: Dynamic vote instructions showing number of spies
- **Added**: Vote limit logic based on `numSpies` from settings
- **Updated**: Click handler to toggle selection (like Imposter)
- **Updated**: Submit handler to save array of votes
- **Updated**: Card classes to `.player-card`, `.player-card__name`
- **Updated**: States to `.player-card--disabled`, `.player-card--selected`

### Spyfall Results (games/spyfall/results.html)
- **Updated**: Vote counting to iterate over `spyVotes` array instead of single `spyVote`
- **Updated**: Reset logic to clear `spyVotes` array
- **Effect**: Properly counts votes when multiple spies are selected

## Component Variants Implemented

### 1. `.player-card` (Base)
- White background, border, pointer cursor
- Used across all voting games

### 2. `.player-card--selected`
- Gradient background (primary to secondary)
- White text, enhanced shadow
- Slightly scaled up (1.02)

### 3. `.player-card--disabled`
- 50% opacity, not-allowed cursor
- No hover effects
- Used for current player ("You")

### 4. `.player-card--draggable`
- Grab cursor
- Used in Herd Mentality reveal for host regrouping

### 5. `.player-card--dragging`
- 50% opacity, rotated appearance
- Visual feedback during drag operation

### 6. `.player-card--faker` / `--imposter` / `--spy`
- Red background, left border accent
- Used in results to identify roles

## Element Classes

### `.player-card__name`
- Player name display
- Color inherits from parent state (white when selected, gray when disabled)

### `.player-card__answer`
- Answer text (Fakin' It only)
- Italic, smaller font size

### `.player-card__votes`
- Vote count display
- Primary color, semibold

### `.player-card__points`
- Points indicator with color variants
- Green for positive, gray for zero

### `.player-card__badge`
- Small pill-shaped role badges
- Variants: `--host`, `--overseer`, `--you`

## Spyfall Multi-Select Bug Fix

### Problem
Spyfall voting only allowed single spy selection, but the game supports 2 spies when there are 5+ players.

### Solution
1. Changed selection storage from `selectedPlayerId` (single) to `selectedVotes` (Set)
2. Updated database structure from `spyVote` (string) to `spyVotes` (array)
3. Added vote limit check: `if (selectedVotes.size < numSpies)`
4. Updated vote instructions to show: "Vote for up to N spy/spies"
5. Implemented toggle selection (click to add/remove from Set)
6. Updated results page to count votes from array

### Result
- Players can now vote for multiple spies (up to the configured limit)
- Selection matches Imposter game behavior
- Instructions dynamically update based on numSpies setting
- Results correctly count multiple votes per player

## Code Reduction
- **Removed from style.css**: 32 lines
- **Removed from shared-voting-styles.css**: 75 lines
- **Removed from reveal.html**: 60 lines
- **Total removed**: 167 lines of duplicate/conflicting styles
- **Created player-card.css**: 165 lines (well-organized with BEM)
- **Net benefit**: Single source of truth, eliminated duplication

## Testing Results
- ✅ All player cards render identically to before refactoring
- ✅ Fakin' It voting: Name + answer display correctly, multi-select works
- ✅ Imposter voting: Name-only cards, multi-select works
- ✅ Spyfall voting: Multi-select now works (up to N spies), bug fixed
- ✅ Herd Mentality reveal: Draggable cards work on desktop (mouse)
- ✅ Herd Mentality reveal: Draggable cards work on mobile (touch)
- ✅ New group zone appears when dragging
- ✅ Cards can be dropped into any group or new group zone
- ✅ Selected state shows gradient background, white text
- ✅ Disabled state shows reduced opacity, no interaction
- ✅ Hover states work correctly (border color, translateY, shadow)
- ✅ No visual regressions

## Implementation Approach

### CSS-Only Component
Following CodingStandards.md, player cards are implemented as a **CSS-only component** with no JavaScript file because:
- Cards are simple DOM elements created per-game
- Logic is game-specific (single vs multi-select, draggable)
- No complex state management needed
- Would be over-engineering to create a JavaScript class

### Game-Specific Patterns
Each game creates cards dynamically with its own logic:
- **Fakin' It**: Multi-select fakers, name + answer
- **Imposter**: Multi-select imposters (up to N), name only
- **Spyfall**: Multi-select spies (up to N), name only
- **Herd Mentality**: Draggable grouping (host only), name + answer

## Issues Found and Fixed

### Issue 1: Herd Mentality Drag Not Working
**Problem**: After changing classes to `.player-card`, drag handlers still looked for `.answer-card`

**Root Cause**: Two functions used `e.target.closest('.answer-card')`:
- `handleDragStart()` - Line 306
- `handleTouchStart()` - Line 374

**Solution**: Updated both selectors to `.player-card`

**Result**: Desktop and mobile drag/drop now work correctly

### Issue 2: Spyfall Only Single-Select
**Problem**: Game allows 2 spies but voting only allowed 1 selection

**Root Cause**: Used single variable instead of Set, no vote limit logic

**Solution**: Implemented Set-based multi-select like Imposter game

**Result**: Players can vote for multiple spies as intended

## CSS Variables Used

The player-card component uses these CSS variables from `variables.css`:

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

## Migration Summary

### Class Replacements
| Old | New |
|-----|-----|
| `.answer-card` | `.player-card` |
| `.answer-card.selected` | `.player-card.player-card--selected` |
| `.player-card.selected` | `.player-card.player-card--selected` |
| `.player-card.disabled` | `.player-card.player-card--disabled` |
| `.answer-card .player-name` | `.player-card__name` |
| `.player-card h3` | `.player-card__name` |
| `.player-card p.player-name` | `.player-card__name` |
| `.answer-card p` (answer) | `.player-card__answer` |
| `.answer-card.dragging` | `.player-card.player-card--dragging` |

### JavaScript Updates
- Fakin' It: Updated `toggleVote()` function class names
- Imposter: Updated `renderPlayers()` function class names
- Spyfall: Complete rewrite to Set-based multi-select + class updates
- Herd Mentality: Updated drag handlers to use `.player-card` selector

## Future Benefits
- Consistent card appearance across all voting and results phases
- Single place to update card styles globally
- Easy to add new card variants for future games
- Clear BEM naming makes card types immediately obvious
- Drag-and-drop support built-in for future features
- Multi-select patterns established for new social deduction games
- Spyfall bug fixed - game now fully functional with multiple spies

## Lessons Learned

### When to Create Components
Player cards were an ideal candidate because:
- **High reuse**: Appears in 4 different games
- **Multiple variants**: 6 distinct card types and states
- **Consistent behavior**: All share hover/active/selected/disabled states
- **Game-specific logic**: But CSS handles the visual consistency

### Importance of Comprehensive Testing
- Initial implementation broke Herd Mentality drag/drop
- Caught during testing phase, not production
- Fixed by updating selector references
- Emphasizes need to test all game phases after refactoring

### BEM Benefits for Dynamic Content
Even though cards are created dynamically in JavaScript:
- BEM naming makes code self-documenting
- Easy to understand card state by reading class list
- Modifiers are additive, making toggling simple
- Clear separation between structure (element) and state (modifier)

## Next Steps
Continue with Phase 7: StatusMessage Component (following RefactoringPlan.md)

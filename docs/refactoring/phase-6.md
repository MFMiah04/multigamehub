# Phase 6: Player Card Component Analysis

## Overview
This document analyzes player/answer cards used across voting phases in Fakin' It, Imposter, Spyfall, and answer grouping in Herd Mentality reveal. These cards display player names and allow voting/selection interactions.

## Current Card Locations

### games/shared-voting-styles.css (Lines 12-87)
Shared styles for player-card and answer-card across all voting games:
- **Base styles**: White background, 12px padding, 8px radius, 2px border
- **States**: hover (border change, translateY), active (scale), selected (gradient background)
- **Disabled state**: Opacity 0.5, no hover effects (for "You" player)

### style.css (Lines 99-130)
**answer-card** styles for general use:
- Similar structure but different sizing (16px padding vs 12px)
- Used in style.css but voting games use shared-voting-styles.css version

### Dedicated Styles in Games

#### Fakin' It (voting.html)
- Uses `.answer-card` from shared-voting-styles.css
- Displays: Player name + answer text
- Selection: Single or multiple faker selection

#### Imposter (voting.html)
- Uses `.player-card` from shared-voting-styles.css
- Displays: Player name only
- Selection: Multiple imposter selection (up to N imposters)

#### Spyfall (voting.html)
- Uses `.player-card` from shared-voting-styles.css
- Displays: Player name only
- **BUG**: Currently single spy selection only
- **Should be**: Multi-select (up to N spies, where N is set in game settings - can be 2 when 5+ players)

#### Herd Mentality (reveal.html)
- Custom `.answer-card` styles (lines 70-78 in reveal.html)
- Displays: Player name in draggable cards
- Selection: Drag-and-drop grouping (host only)

## Card Variants Found

### 1. **Answer Cards** (Fakin' It Voting)
- **Structure**: Name + answer text
- **Class**: `.answer-card`
- **States**: default, hover, active, selected
- **Selectable**: Yes (by voters, excluding overseer)
- **File**: games/fakin-it/voting.html

### 2. **Player Cards** (Imposter Voting)
- **Structure**: Name only
- **Class**: `.player-card`
- **States**: default, hover, active, selected, disabled (self)
- **Selectable**: Yes (multi-select up to N)
- **File**: games/imposter/voting.html

### 3. **Player Cards** (Spyfall Voting)
- **Structure**: Name only
- **Class**: `.player-card`
- **States**: default, hover, active, selected, disabled (self)
- **Selectable**: **BUG - Currently single select only**
- **Should be**: Multi-select up to N spies (where N = numSpies from settings, can be 2 when 5+ players)
- **File**: games/spyfall/voting.html

### 4. **Answer Cards** (Herd Mentality Reveal)
- **Structure**: Name only (draggable)
- **Class**: `.answer-card`
- **States**: default, dragging
- **Selectable**: No (draggable for regrouping)
- **File**: games/herd-mentality/reveal.html

## Current CSS Structure

### Shared Voting Styles (games/shared-voting-styles.css)
```css
.player-card,
.answer-card {
  background: white;
  padding: 12px;
  border-radius: 8px;
  margin: 5px 0;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 2px solid #ddd;
  box-shadow: 0 2px 4px rgba(0,0,0,0.08);
}

.player-card:hover,
.answer-card:hover {
  border-color: #667eea;
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.12);
}

.player-card.selected,
.answer-card.selected {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  transform: scale(1.02);
}

.player-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

### Style.css Version (NOT used in voting)
```css
.answer-card {
  background: var(--color-gray-100);
  padding: var(--space-xl-plus);
  border-radius: var(--radius-lg);
  margin-bottom: var(--space-lg);
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-slow);
}

.answer-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}
```

## Card Creation Patterns

### Fakin' It Voting (JavaScript)
```javascript
answersContainer.innerHTML = '';
nonOverseerIds.forEach(pid => {
  const card = document.createElement('div');
  card.className = 'answer-card';
  card.dataset.playerId = pid;

  const nameEl = document.createElement('h3');
  nameEl.textContent = player.name + (pid === playerId ? ' (You)' : '');

  const answerEl = document.createElement('p');
  answerEl.textContent = player.answer || 'No answer';

  card.appendChild(nameEl);
  card.appendChild(answerEl);

  if (!isOverseer && pid !== playerId && !hasVoted) {
    card.addEventListener('click', () => toggleVote(pid));
  }

  answersContainer.appendChild(card);
});
```

### Imposter Voting (JavaScript)
```javascript
playerCards.innerHTML = '';
playerIds.forEach(pid => {
  const card = document.createElement('div');
  card.className = 'player-card';

  if (pid === playerId) {
    card.classList.add('me');
    card.classList.add('disabled');
  }

  if (selectedVotes.has(pid)) {
    card.classList.add('selected');
  }

  const nameEl = document.createElement('p');
  nameEl.className = 'player-name';
  nameEl.textContent = player.name + (pid === playerId ? ' (You)' : '');

  card.appendChild(nameEl);

  if (pid !== playerId) {
    card.addEventListener('click', () => toggleVote(pid));
  }

  playerCards.appendChild(card);
});
```

### Spyfall Voting (JavaScript)
**BUG**: Currently uses single-select logic, but should use multi-select like Imposter

```javascript
// CURRENT (BUGGY) - Single selection
let selectedPlayerId = null;
card.addEventListener('click', () => {
  // Clear previous selection
  document.querySelectorAll('.player-card').forEach(c => c.classList.remove('selected'));
  // Select this player
  card.classList.add('selected');
  selectedPlayerId = pid;
  submitVoteBtn.disabled = false;
});

// SHOULD BE - Multi-selection (up to N spies)
let selectedVotes = new Set();
const numSpies = data.settings?.spyfall?.numSpies || 1;
card.addEventListener('click', () => {
  if (selectedVotes.has(pid)) {
    selectedVotes.delete(pid);
    card.classList.remove('selected');
  } else if (selectedVotes.size < numSpies) {
    selectedVotes.add(pid);
    card.classList.add('selected');
  }
  submitVoteBtn.disabled = selectedVotes.size === 0;
});
```

### Herd Mentality Reveal (JavaScript)
```javascript
// Custom draggable cards for host regrouping
const card = document.createElement('div');
card.className = 'answer-card';
card.draggable = true;
card.dataset.playerId = pid;

const nameEl = document.createElement('div');
nameEl.className = 'player-name';
nameEl.textContent = player.name;

card.appendChild(nameEl);
```

## Duplication Analysis

### CSS Duplication
1. **shared-voting-styles.css** has player-card/answer-card styles (lines 12-87)
2. **style.css** has answer-card styles (lines 99-130) with different values
3. **herd-mentality/reveal.html** has inline answer-card styles (lines 70-78)

**Issue**: Two different `.answer-card` definitions with conflicting styles

### JavaScript Duplication
All 4 games create cards dynamically with similar patterns:
1. Create div element
2. Set className
3. Create name element
4. Optionally create answer/role element
5. Add click/drag listeners
6. Append to container

**Similar lines**: ~15-20 lines per game × 4 games = 60-80 lines of similar code

## Inconsistencies Found

### Styling Conflicts
- **shared-voting-styles.css**: White background, 12px padding
- **style.css**: Gray-100 background, 16px padding
- **herd-mentality/reveal.html**: White background, 15px padding, custom border

### Class Name Confusion
- `.player-card` used for name-only cards (Imposter, Spyfall)
- `.answer-card` used for name+answer cards (Fakin' It)
- `.answer-card` also used for name-only draggable cards (Herd Mentality)

### Hard-coded Values
shared-voting-styles.css uses hard-coded values instead of CSS variables:
- Colors: `#667eea`, `#764ba2`, `#ddd`, `white`, `#666`
- Spacing: `12px`, `5px`, `8px`, `2px`
- Should use: `var(--color-primary)`, `var(--space-lg)`, etc.

## Current States Support

All cards support these states:

### Default
- White/light gray background
- Border with standard color
- Normal cursor

### Hover (`:hover`)
- Border color changes to primary
- Translates up slightly (`translateY(-2px)`)
- Enhanced shadow

### Active (`:active`)
- Scales down (`scale(0.98)`)
- Reduced shadow

### Selected (`.selected`)
- Gradient background (primary to secondary)
- White text
- Enhanced shadow
- Slightly scaled up (`scale(1.02)`)

### Disabled (`.disabled`)
- Reduced opacity (0.5)
- `cursor: not-allowed`
- No hover effects
- Used for current player ("You")

## Recommendations

### Option 1: Minimal Approach - Move to Component File
**Action**: Move shared-voting-styles.css to styles/components/, update to use CSS variables

**Pros**:
- Quick implementation
- Maintains existing structure
- Works with current JavaScript

**Cons**:
- Doesn't address duplication in style.css
- Doesn't fix hard-coded values
- Doesn't standardize card creation logic
- Still requires manual card HTML creation in each game

### Option 2: Full Refactor with BEM (RECOMMENDED)
**Action**: Create comprehensive player-card component with BEM naming

**Pros**:
- Single source of truth for all card styles
- Uses CSS variables exclusively
- Clear BEM naming (`.player-card`, `.player-card--selectable`, `.player-card--selected`)
- Eliminates duplication in style.css and reveal.html
- Consistent across all games
- Future-proof for new games

**Cons**:
- More work upfront
- Still requires JavaScript for dynamic creation (but that's appropriate)

**Implementation**:
1. Create `styles/components/player-card.css` with BEM naming
2. Remove conflicting `.answer-card` from style.css (lines 99-130)
3. Update shared-voting-styles.css → merge into player-card.css
4. Update herd-mentality/reveal.html inline styles
5. Convert all hard-coded values to CSS variables
6. Update 4 game files to use new classes

### Option 3: JavaScript Component Class (NOT RECOMMENDED)
**Action**: Create PlayerCard JavaScript class similar to Timer

**Why NOT**:
- Cards are simple DOM elements created per-game
- Logic is game-specific (single vs multi-select, draggable, etc.)
- No complex state management needed
- Would be over-engineering per CodingStandards.md
- CSS-only component is more appropriate

## Proposed Implementation Plan

### Following Option 2 (Full Refactor with BEM):

#### Step 1: Create Player Card Component CSS
Create `styles/components/player-card.css` with:
- Base `.player-card` class (replaces both player-card and answer-card)
- Modifier classes:
  - `.player-card--selectable` (votable cards)
  - `.player-card--selected` (selected state)
  - `.player-card--disabled` (current player)
  - `.player-card--draggable` (Herd Mentality drag cards)
  - `.player-card--faker` (Fakin' It faker reveal)
  - `.player-card--imposter` (Imposter reveal)
  - `.player-card--spy` (Spyfall reveal)
- Element classes:
  - `.player-card__name` (player name)
  - `.player-card__answer` (answer text in Fakin' It)
  - `.player-card__votes` (vote count display)
- All states (hover, active, selected, disabled, dragging)
- Uses CSS variables exclusively

#### Step 2: Update style.css
- Remove lines 99-130 (conflicting answer-card styles)
- Add import for player-card component

#### Step 3: Update shared-voting-styles.css
- Remove player-card/answer-card styles (lines 12-87)
- Keep other voting-specific styles (vote-status, reveal-display, result-card, etc.)
- Add import for player-card component

#### Step 4: Update herd-mentality/reveal.html
- Remove inline answer-card styles (lines 70-130)
- Use player-card component classes instead

#### Step 5: Fix Spyfall Multi-Select Bug
**BUG**: Spyfall voting currently only allows single spy selection, but the game can have 2 spies when there are 5+ players.

**Fix in games/spyfall/voting.html**:

1. Change from single selection to multi-selection (similar to Imposter):
   - Replace `let selectedPlayerId = null;` with `let selectedVotes = new Set();`
   - Replace `playerData.spyVote` with `playerData.spyVotes` (array)
   - Add vote limit logic based on `data.settings?.spyfall?.numSpies`

2. Update vote instructions:
   ```javascript
   const numSpies = data.settings?.spyfall?.numSpies || 1;
   voteInstructions.innerHTML = `Vote for up to <strong>${numSpies}</strong> <strong>spy/spies</strong>`;
   ```

3. Update click handler to toggle selection (like Imposter):
   ```javascript
   card.addEventListener('click', () => {
     if (selectedVotes.has(pid)) {
       selectedVotes.delete(pid);
       card.classList.remove('selected');
     } else {
       if (selectedVotes.size < numSpies) {
         selectedVotes.add(pid);
         card.classList.add('selected');
       }
     }
     submitVoteBtn.disabled = selectedVotes.size === 0;
   });
   ```

4. Update submit vote logic:
   ```javascript
   submitVoteBtn.addEventListener('click', async () => {
     const updates = {};
     updates[`rooms/${roomCode}/players/${playerId}/spyVotes`] = Array.from(selectedVotes);
     await update(dbRef(db), updates);
   });
   ```

5. Update Firebase database structure:
   - Change from `players/{id}/spyVote` (string) to `players/{id}/spyVotes` (array)
   - Update results.html to read from spyVotes array instead of spyVote string

#### Step 6: Update Game JavaScript for BEM
Update 4 game files to use new BEM classes:
- games/fakin-it/voting.html - Use `.player-card`, `.player-card__name`, `.player-card__answer`
- games/imposter/voting.html - Use `.player-card`, `.player-card__name`
- games/spyfall/voting.html - Use `.player-card`, `.player-card__name` (after multi-select fix)
- games/herd-mentality/reveal.html - Use `.player-card`, `.player-card--draggable`

#### Step 7: Create Documentation
Create `docs/components/player-card.md` with usage examples

## Known Issues After Refactoring

### Issue: Herd Mentality Drag and Drop Not Working

**Problem**: After changing CSS classes from `.answer-card` to `.player-card`, the drag and drop handlers in `games/herd-mentality/reveal.html` are still looking for the old class name.

**Symptoms**:
- Cards cannot be dragged
- New group zone doesn't appear when holding a card
- Desktop (mouse) and mobile (touch) drag both broken

**Root Cause**:
JavaScript handlers use `e.target.closest('.answer-card')` to find the dragged card element, but cards now have class `.player-card`.

**Affected Functions** (lines 304-440):
1. `handleDragStart()` - Line 306: `draggedCard = e.target.closest('.answer-card');`
2. `handleTouchStart()` - Line 374: `draggedCard = e.target.closest('.answer-card');`

**Solution**:
Replace all instances of `.answer-card` selector in drag handlers with `.player-card`:

```javascript
// Line 306 - Desktop drag start
function handleDragStart(e) {
  // OLD: draggedCard = e.target.closest('.answer-card');
  draggedCard = e.target.closest('.player-card');
  if (!draggedCard) return;
  draggedCard.classList.add('player-card--dragging');
  if (isHost) {
    newGroupZone.style.display = 'flex';
  }
}

// Line 374 - Mobile touch start
function handleTouchStart(e) {
  // OLD: draggedCard = e.target.closest('.answer-card');
  draggedCard = e.target.closest('.player-card');
  if (!draggedCard) return;
  draggedCard.classList.add('player-card--dragging');
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  if (isHost) {
    newGroupZone.style.display = 'flex';
  }
}
```

**Expected Behavior After Fix**:
- Host can click/touch and drag any card
- While dragging, new group zone appears at bottom
- Card can be dropped into:
  - Any existing answer group (changes grouping)
  - New group zone (creates solo group)
- Touch gestures work on mobile devices
- Visual feedback shows dragging state (50% opacity, rotated)

**Files to Fix**:
- `games/herd-mentality/reveal.html` - Lines 306 and 374

## Usage Patterns After Refactor

### Voting Card (Fakin' It)
```html
<div class="player-card player-card--selectable">
  <h3 class="player-card__name">Alice</h3>
  <p class="player-card__answer">My favorite color is blue</p>
</div>

<div class="player-card player-card--selected">
  <h3 class="player-card__name">Bob (Selected)</h3>
  <p class="player-card__answer">Red is best</p>
</div>
```

### Voting Card (Imposter/Spyfall)
```html
<div class="player-card player-card--selectable">
  <p class="player-card__name">Charlie</p>
</div>

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

### Result Card (with vote count)
```html
<div class="player-card player-card--faker">
  <div class="player-card__name">Eve (Faker)</div>
  <div class="player-card__votes">3 votes</div>
</div>
```

## Code Reduction Estimate
- **Remove from style.css**: 32 lines (answer-card styles)
- **Remove from shared-voting-styles.css**: 75 lines (player/answer card styles)
- **Remove from reveal.html**: 60 lines (inline styles)
- **Create player-card.css**: ~150 lines (comprehensive, organized with BEM)
- **Net benefit**: Consolidated styles, CSS variables, single source of truth

## Future Benefits
- Consistent card appearance across all games
- Single place to update card styles
- Easy to add new card variants for future games
- Clear naming makes card types obvious
- Drag-and-drop support built-in for future features
- Scalable for new social deduction games

## Notes on JavaScript
Unlike Timer (which needed a reusable JS class), player cards are simple DOM elements created dynamically per game. Each game has unique:
- Selection logic (single vs multi-select)
- Data structure (name only vs name+answer)
- Interaction patterns (click vs drag)

Therefore, **CSS-only component is most appropriate**. JavaScript card creation remains game-specific, which follows CodingStandards.md principle of "don't over-engineer."

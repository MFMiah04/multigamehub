# Phase 7: Status Message Component Analysis

## Overview
This document analyzes status messages across all games to identify patterns and opportunities for creating a reusable status message component. Status messages inform players about game progress ("X/Y players submitted/voted") and system states ("Waiting for players...").

## Current Status Message Locations

### style.css (Lines 127-154)
Three status-related classes:
1. **`.status-message`** (lines 127-136)
   - Background: primary-light
   - Color: primary
   - Padding: large
   - Use: General status messages

2. **`.submission-status`** (lines 148-154)
   - Simpler styling
   - Center aligned, primary color
   - Use: "X/Y players submitted" counters

3. **`.error`** (lines 138-146)
   - Background: danger-light
   - Color: gray-800
   - Use: Error messages

### games/shared-voting-styles.css (Lines 13-19)
**`.vote-status`** (voting-specific)
- Center aligned
- Primary color (#667eea hardcoded!)
- Font weight: 600
- Use: "X/Y players voted" counters

## Status Message Types Found

### 1. Submission Status (Answer/Question Phase)
**Pattern**: "X/Y players submitted"
- **Herd Mentality game.html** (line 31):
  ```html
  <div class="submission-status" id="submissionStatus"></div>
  ```
  JavaScript (line 184):
  ```javascript
  submissionStatus.textContent = `${submittedPlayers.length}/${inGamePlayers.length} players submitted`;
  ```

- **Fakin' It answer.html** (line 33):
  ```html
  <div class="submission-status" id="submissionStatus"></div>
  ```
  JavaScript (line 177):
  ```javascript
  submissionStatus.textContent = `${submittedCount}/${totalPlayers} players submitted`;
  ```

### 2. Vote Status (Voting Phase)
**Pattern**: "X/Y players voted"
- **Fakin' It voting.html** (line 34):
  ```html
  <div class="vote-status" id="votingStatus">0/0 players voted</div>
  ```

- **Imposter voting.html** (line 23):
  ```html
  <div class="vote-status" id="voteStatus">0/0 players voted</div>
  ```

- **Spyfall voting.html** (line 23):
  ```html
  <div class="vote-status" id="voteStatus">0/0 players voted</div>
  ```

### 3. Waiting Status (Special Roles)
**Pattern**: "Waiting for..."
- **Fakin' It voting.html** (line 24):
  ```html
  <div class="status-message" id="overseerWaiting" style="display: none;">
    Waiting for players to vote...
  </div>
  ```

- **Fakin' It answer.html** (line 24):
  ```html
  <div class="status-message" id="overseerWaiting" style="display: none;">
    Waiting for players to answer...
  </div>
  ```

### 4. Error Messages
**Pattern**: Error feedback
- Used across all games for validation errors
- Class: `.error`
- Usually: `style="display: none;"` initially

## Current CSS Structure

### style.css
```css
.status-message {
  text-align: center;
  padding: var(--space-lg);
  background: var(--color-primary-light);
  border-radius: var(--radius-md);
  margin: var(--space-lg) 0;
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm-plus-plus);
}

.submission-status {
  text-align: center;
  margin: var(--space-lg) 0;
  font-size: 16px;
  color: var(--color-primary);
  font-weight: var(--font-weight-semibold);
}

.error {
  color: var(--color-gray-800);
  text-align: center;
  padding: var(--space-md-plus);
  background: var(--color-danger-light);
  border-radius: var(--radius-md);
  margin: var(--space-md) 0;
  font-size: var(--font-size-sm-plus);
}
```

### shared-voting-styles.css
```css
.vote-status {
  text-align: center;
  margin: 10px 0;
  font-size: 0.9rem;
  color: #667eea;
  font-weight: 600;
}
```

## Inconsistencies Found

### 1. Duplication Between Classes
- `.submission-status` and `.vote-status` are nearly identical
- Both show "X/Y players [action]" pattern
- Different files, slight style differences

### 2. Hard-coded Values in shared-voting-styles.css
- Color: `#667eea` should be `var(--color-primary)`
- Margin: `10px` should use spacing variables
- Font-size: `0.9rem` inconsistent with `16px` in submission-status

### 3. Class Naming Inconsistency
- `.submission-status` vs `.vote-status` (different suffixes)
- `.status-message` vs `.submission-status` (different structures)

### 4. Inline Display Control
Many status messages use `style="display: none;"` for initial hidden state
- Conditional visibility should ideally use a modifier class

## Usage Patterns

### Submission Counter Pattern
```javascript
// Herd Mentality
const submittedPlayers = Object.values(players).filter(p => p.inGame && p.answer);
submissionStatus.textContent = `${submittedPlayers.length}/${inGamePlayers.length} players submitted`;

// Fakin' It Answer
const submittedCount = nonOverseerIds.filter(pid => players[pid].answer).length;
submissionStatus.textContent = `${submittedCount}/${totalPlayers} players submitted`;
```

### Vote Counter Pattern
```javascript
// Fakin' It Voting
const votedCount = playerIds.filter(pid => {
  const p = players[pid];
  return p.fakerVotes && p.fakerVotes.length > 0;
}).length;
votingStatus.textContent = `${votedCount}/${playerIds.length} players voted`;

// Imposter Voting
const votedCount = playerIds.filter(pid =>
  allPlayers[pid].imposterVotes && allPlayers[pid].imposterVotes.length > 0
).length;
voteStatus.textContent = `${votedCount}/${totalPlayers} players voted`;
```

## Recommendations

### Option 1: Minimal Approach
Move status CSS to component file, update to use CSS variables consistently

**Pros**:
- Quick implementation
- Maintains existing structure

**Cons**:
- Doesn't address duplication between submission-status and vote-status
- Doesn't standardize naming
- Still requires manual text updates in JavaScript

### Option 2: Unified Status Component with BEM (RECOMMENDED)
Create single status message component with variants

**Why?**
- **High reuse**: Appears in 7+ locations across 5 games
- **Clear patterns**: Only 3-4 distinct types (counter, waiting, error, info)
- **Easy to unify**: submission-status and vote-status are identical in purpose
- **Consistent styling**: Single source of truth

**Implementation**:
1. Create `styles/components/status-message.css` with BEM naming
2. Move all status classes from style.css and shared-voting-styles.css
3. Use modifiers for variants:
   - `.status-message` - Base (info/waiting messages)
   - `.status-message--counter` - Progress counters (X/Y pattern)
   - `.status-message--error` - Error messages
   - `.status-message--success` - Success messages (future)
   - `.status-message--hidden` - Hidden state (instead of inline style)
4. Convert all hard-coded values to CSS variables

### Option 3: JavaScript Helper Function
Create a helper function to generate status messages

**Why NOT**:
- Status messages are simple text updates
- No complex logic needed
- Would be over-engineering per CodingStandards.md
- CSS-only component is more appropriate

## Proposed Implementation Plan

### Following Option 2 (Unified Status Component with BEM):

#### Step 1: Create Status Message Component CSS
Create `styles/components/status-message.css` with:
- Base `.status-message` class
- Modifier classes:
  - `.status-message--counter` (progress counters)
  - `.status-message--error` (errors)
  - `.status-message--success` (future use)
  - `.status-message--info` (informational, same as base)
  - `.status-message--hidden` (hidden state)
- Uses CSS variables exclusively
- Mobile responsive

#### Step 2: Update style.css
- Remove lines 127-154 (status-message, submission-status, error)
- Add import for status-message component
- Keep .error as alias to .status-message--error for backward compatibility (optional)

#### Step 3: Update shared-voting-styles.css
- Remove vote-status styles (lines 13-19)
- Vote-status will use .status-message--counter from component

#### Step 4: Update HTML Files
Update all game files to use new BEM classes:
- Replace `.submission-status` → `.status-message .status-message--counter`
- Replace `.vote-status` → `.status-message .status-message--counter`
- Replace `.status-message` (waiting) → `.status-message` (no change, but now from component)
- Replace `.error` → `.status-message .status-message--error`
- Replace `style="display: none;"` → `.status-message--hidden` (optional)

#### Files to Update:
1. **games/herd-mentality/game.html** - submission-status
2. **games/fakin-it/answer.html** - submission-status, status-message (overseer)
3. **games/fakin-it/voting.html** - vote-status, status-message (overseer)
4. **games/imposter/voting.html** - vote-status
5. **games/spyfall/voting.html** - vote-status
6. **All game files with error messages** - error class (optional migration)

#### Step 5: Create Documentation
Create `docs/components/status-message.md` with usage examples

## Usage Patterns After Refactor

### Progress Counter
```html
<!-- Submission counter -->
<div class="status-message status-message--counter" id="submissionStatus">
  0/0 players submitted
</div>

<!-- Vote counter -->
<div class="status-message status-message--counter" id="voteStatus">
  0/0 players voted
</div>
```

### Waiting/Info Message
```html
<div class="status-message status-message--hidden" id="overseerWaiting">
  Waiting for players to vote...
</div>
```

### Error Message
```html
<div class="status-message status-message--error status-message--hidden" id="errorMessage">
  Please enter a valid answer
</div>
```

### Success Message (Future)
```html
<div class="status-message status-message--success">
  Game started successfully!
</div>
```

## JavaScript Update Pattern

No changes needed to JavaScript logic, only class names:

```javascript
// BEFORE
submissionStatus.textContent = `${count}/${total} players submitted`;

// AFTER - Same!
submissionStatus.textContent = `${count}/${total} players submitted`;

// For hiding/showing
// BEFORE
errorMessage.style.display = 'none';
errorMessage.style.display = 'block';

// AFTER (optional)
errorMessage.classList.add('status-message--hidden');
errorMessage.classList.remove('status-message--hidden');
```

## Code Reduction Estimate
- **Remove from style.css**: ~28 lines (3 classes)
- **Remove from shared-voting-styles.css**: 7 lines (vote-status)
- **Create status-message.css**: ~80 lines (organized with BEM)
- **Net benefit**: Unified status messaging, eliminated duplication

## CSS Variables to Use

**Colors:**
- `--color-primary`, `--color-primary-light`
- `--color-success`, `--color-success-light`
- `--color-danger`, `--color-danger-light`
- `--color-gray-800`

**Spacing:**
- `--space-md`, `--space-md-plus`, `--space-lg`

**Other:**
- `--radius-md`
- `--font-size-sm-plus`, `--font-size-sm-plus-plus`
- `--font-weight-semibold`

## Future Benefits
- Consistent status message appearance across all games
- Single place to update status styles
- Easy to add new message types (warning, success, etc.)
- Clear naming makes message purpose obvious
- Eliminates duplication between submission-status and vote-status
- All status messages use CSS variables (no hard-coded values)

## Notes on Implementation

### CSS-Only Component
Following CodingStandards.md, status messages are a **CSS-only component**:
- Messages are simple text display
- No complex interaction or state management
- JavaScript only updates text content
- Display toggling can use classes instead of inline styles

### Backward Compatibility
Consider keeping `.error` as an alias for transition period:
```css
.error {
  /* Alias for backward compatibility */
}
```

Or use `@extend` if using a preprocessor (though plain CSS is preferred).

### Display Toggle Approach
Two options for hiding/showing:
1. **Class-based** (`.status-message--hidden`): Better for component consistency
2. **Inline style** (`display: none`): Simpler, less refactoring

Recommend: Keep inline styles for now (less breaking changes), add `.status-message--hidden` for future use.

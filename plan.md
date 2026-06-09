# Imposter Game Bug Fixes

## Issues Identified

### Issue 1: Variable Name Conflict (Line 125 & 143)
**Problem**:
- Line 125: `const timer = document.getElementById('timer');` (DOM element)
- Line 143: `let timer = null;` (Timer instance)
- Same variable name used for two different things

**Impact**:
- Line 125 assigns the DOM element to `timer`
- Line 143 tries to declare `timer` again (error/confusion)
- Line 234-242 tries to create Timer instance but variable is already the DOM element
- Timer never initializes properly → shows "Loading..."

**Fix**:
Rename the DOM element variable to `timerDiv` or remove it entirely (not needed since we pass the element directly to Timer constructor).

### Issue 2: Turn Order Not Displaying
**Cause**:
Turn order code looks correct. This is likely a cascading failure from Issue 1 - JavaScript execution may stop at the variable conflict or timer error.

### Issue 3: Word Card Not Clickable
**Cause**:
Also likely a cascading failure. The click handler is attached before `loadGame()` runs, so it should work unless JavaScript execution is broken by Issue 1.

## Root Cause
**Primary issue**: Variable name conflict between DOM element (`const timer`) and Timer instance (`let timer`).

## Solution

### Fix 1: Remove Unused DOM Element Reference
**File**: `games/imposter/game.html`
**Line 125**: Delete `const timer = document.getElementById('timer');`

**Reason**:
- This variable is never used in the code
- We pass the element directly to Timer constructor on line 235
- Removing it eliminates the conflict

## Testing Steps

1. Start Imposter game
2. Verify timer shows mm:ss format and counts down
3. Verify turn order list shows player names
4. Verify clicking word card toggles between "Click to see word" and the actual word/role
5. Verify timer warning at 60s (red color)
6. Verify host can start voting

## Code Change

```javascript
// REMOVE this line (125):
const timer = document.getElementById('timer');

// KEEP these lines (143, 234-242):
let timer = null;
// ... later ...
timer = new Timer({
  element: document.getElementById('timer'),  // Pass element directly
  duration: remaining,
  warningAt: 60,
  onComplete: () => {
    if (isHost) transitionToVoting();
  }
});
timer.start();
```

## Why This Happened
When refactoring timers, we:
1. Added `import { Timer }`
2. Changed `let timerInterval` to `let timer`
3. But forgot to remove the old `const timer = document.getElementById('timer')` line

The old code had:
- `const timer = document.getElementById('timer')` (DOM element)
- `let timerInterval = null` (interval ID)

New code should have:
- `let timer = null` (Timer instance)
- No separate DOM element variable needed

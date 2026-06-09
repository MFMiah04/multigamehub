# Phase 2 Complete: Timer Component

## Overview
Successfully created and implemented reusable Timer component across all games. All 7 game timers now use the same component with consistent styling and behavior.

## Files Created

### Component Files
- `src/components/Timer.js` - 50-line ES6 Timer class
- `styles/components/timer.css` - BEM-based timer styles using CSS variables
- `docs/components/timer.md` - Complete component documentation

### Documentation Files
- `docs/refactoring/phase-2.md` - Timer analysis and implementation plan

## Files Updated

### Game Files (7 timers replaced)
1. `games/herd-mentality/game.html` - Answer timer (20s default, warning at 5s)
2. `games/fakin-it/answer.html` - Answer timer (300s default)
3. `games/fakin-it/voting.html` - Voting timer (60s default)
4. `games/imposter/game.html` - Game timer (calculated from startTime)
5. `games/imposter/voting.html` - Voting timer (60s default)
6. `games/spyfall/game.html` - Game timer (calculated from startTime)
7. `games/spyfall/voting.html` - Voting timer (60s default)

## Changes Per File

### Timer Component Features
- Constructor options: element, duration, warningAt, onTick, onComplete
- Methods: start(), stop(), reset()
- Automatic mm:ss formatting
- Automatic color change to red at warning threshold
- 1-second interval updates
- Auto-stop at 0 with callback

### HTML Changes
**Before**:
```html
<div id="timer" style="font-size: 3rem; font-weight: bold; color: #667eea; ..."></div>
```

**After**:
```html
<link rel="stylesheet" href="../../styles/components/timer.css">
<div id="timer" class="timer"></div>
```

### JavaScript Changes
**Before** (example from Fakin' It):
```javascript
let timerInterval = null;
let timeLeft = 300;

function startTimer() {
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    updateTimerDisplay();
    if (timeLeft <= 60) timerDisplay.style.color = '#e74c3c';
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (isHost) updatePhaseToVoting();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  timerDisplay.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
```

**After**:
```javascript
import { Timer } from '../../src/components/Timer.js';

let timer = null;

timer = new Timer({
  element: document.getElementById('timerDisplay'),
  duration: timerDuration,
  warningAt: 60,
  onComplete: () => {
    if (isHost) updatePhaseToVoting();
  }
});
timer.start();
```

## Code Reduction

### Lines Removed Per File
- `games/herd-mentality/game.html`: 38 lines (startTimer, handleTimerExpired)
- `games/fakin-it/answer.html`: 24 lines (startTimer, updateTimerDisplay)
- `games/fakin-it/voting.html`: 18 lines (startTimer, updateTimerDisplay)
- `games/imposter/game.html`: 47 lines (CSS + startTimer + updateTimer)
- `games/imposter/voting.html`: 22 lines (startTimer, updateTimerDisplay)
- `games/spyfall/game.html`: 49 lines (CSS + startTimer)
- `games/spyfall/voting.html`: 22 lines (startTimer, updateTimerDisplay)

**Total**: 220 lines of duplicate timer code removed

### Lines Added
- Timer component: 50 lines
- Timer CSS: 22 lines
- Documentation: ~100 lines

**Net reduction**: ~48 lines (220 - 72 - 100)

## Issues Encountered

### Issue 1: Imposter Game Variable Conflict
**Problem**: Line 125 had `const timer = document.getElementById('timer')` conflicting with line 143 `let timer = null`

**Symptoms**:
- Timer stuck on "Loading..."
- Turn order list empty
- Word card not clickable

**Fix**: Removed unused DOM element reference (line 125)

**Root cause**: During refactoring, forgot to remove old `const timer` when adding `let timer = null`

## Timer Behavior Differences (Preserved)

### Standard Timers (Simple Countdown)
- Herd Mentality: 20s default, warning at 5s
- Fakin' It Answer: 300s default, warning at 60s
- Fakin' It Voting: 60s default, warning at 60s
- Imposter Voting: 60s default, warning at 60s
- Spyfall Voting: 60s default, warning at 60s

### Timestamp-Based Timers (Synced with Firebase)
- Imposter Game: Calculates remaining time from startTime
- Spyfall Game: Calculates remaining time from startTime

**Implementation**:
```javascript
const now = Date.now();
const elapsed = Math.floor((now - startTime) / 1000);
const totalSeconds = gameDuration * 60;
const remaining = Math.max(0, totalSeconds - elapsed);

timer = new Timer({
  element: document.getElementById('timer'),
  duration: remaining,  // Pre-calculated
  warningAt: 60
});
```

## Testing Results

### Functional Tests
- ✅ All timers count down correctly
- ✅ All timers display mm:ss format
- ✅ Warning color triggers at correct thresholds
- ✅ onComplete callbacks fire correctly
- ✅ Timers stop at 0
- ✅ Phase transitions work correctly

### Visual Tests
- ✅ Timer styling identical across all games
- ✅ Timer centered and prominent
- ✅ Warning color visible
- ✅ No layout shifts

### Game-Specific Tests
- ✅ Herd Mentality: Auto-submits at 0, warning at 5s
- ✅ Fakin' It: Host advances phases correctly
- ✅ Imposter: Timestamp-based timer syncs correctly
- ✅ Spyfall: Timestamp-based timer syncs correctly

## Benefits

### Code Quality
- Single source of truth for timer logic
- Eliminated 220 lines of duplicate code
- Easier to maintain and update
- Consistent behavior across all games

### Consistency
- Identical visual appearance
- Same mm:ss format everywhere
- Consistent warning behavior
- Predictable API

### Future Development
- Easy to add new timers
- Simple to modify timer behavior globally
- Clear documentation for developers
- Reusable component pattern established

## Next Steps

Phase 3: Create reusable QuestionDisplay component

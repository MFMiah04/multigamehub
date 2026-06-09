# Phase 2: Timer Component Analysis

## Timer Locations

### Fakin' It
1. **answer.html** (line 14) - Answer round timer
2. **voting.html** (line 15) - Voting round timer

### Imposter
1. **game.html** (line 109) - Main game timer
2. **voting.html** (line 14) - Voting round timer

### Spyfall
1. **game.html** (line 140) - Main game timer
2. **voting.html** (line 14) - Voting round timer

### Herd Mentality
1. **game.html** (line 14) - Answer round timer

## Current Timer Logic

### Fakin' It Answer (answer.html:185-202)
- Initial time: `data.settings?.fakinIt?.answerTimer || 300` (5 minutes default)
- Format: mm:ss
- Warning: Red at 60s
- Auto-advance: Host transitions to voting when timer hits 0
- Updates: Every 1 second

### Fakin' It Voting (voting.html:247-264)
- Initial time: Hardcoded `60` seconds
- Format: mm:ss
- Warning: Red at 60s (always red since starts at 60)
- Auto-advance: Overseer transitions to results when timer hits 0
- Updates: Every 1 second

### Imposter Game (game.html:257-283)
- Initial time: `data.settings?.imposter?.gameDuration || 5` minutes, calculated from startTime
- Format: mm:ss
- Warning: Red + pulse animation at 60s
- Auto-advance: Host transitions to voting when timer hits 0
- Updates: Every 1 second
- **Difference**: Calculates remaining time from startTime, not countdown

### Imposter Voting (voting.html:177-198)
- Initial time: Hardcoded `60` seconds
- Format: mm:ss
- Warning: Red at 60s (always red)
- Auto-advance: Host transitions to results when timer hits 0
- Updates: Every 1 second

### Spyfall Game (game.html:296-324)
- Initial time: `settings.timer * 60 * 1000` milliseconds, calculated from gameStartTime
- Format: mm:ss
- Warning: Red + pulse animation at 60s
- Auto-advance: None (just stops interval)
- Updates: Every 1 second
- **Difference**: Uses milliseconds, calculates from gameStartTime

### Spyfall Voting (voting.html:150-171)
- Initial time: Hardcoded `60` seconds
- Format: mm:ss
- Warning: Red at 60s (always red)
- Auto-advance: Host transitions to results when timer hits 0
- Updates: Every 1 second

### Herd Mentality Game (game.html:128-146)
- Initial time: `data.settings?.herdMentality?.timer || 20` seconds
- Format: Seconds only (not mm:ss) ⚠️
- Warning: Red + pulse at 5s
- Auto-advance: Auto-submits answer when timer hits 0
- Updates: Every 1 second
- **Difference**: Shows seconds only, pulse animation at 5s instead of 60s

## Styling Differences

### Inline Styles (All Files)
```css
font-size: 3rem;
font-weight: bold;
color: #667eea;
text-align: center;
margin: 20px 0;
padding: 20px;
background: #f9f9f9;
border-radius: 10px;
```

### Warning Color
- Most: Red (#e74c3c) at 60s
- Herd Mentality: Red at 5s

### Animations
- Imposter game.html: `pulse` animation (lines 22-27)
- Spyfall game.html: `pulse` animation (lines 68-70)
- Herd Mentality: Pulse via inline style.animation

## Common Patterns

1. **Display element**: `<div id="timer">` or `<div id="timerDisplay">`
2. **Update function**: `updateTimerDisplay()` or `updateTimer()`
3. **Interval**: `setInterval(() => { timeLeft--; update(); }, 1000)`
4. **Format**: mm:ss with padStart(2, '0')
5. **Warning threshold**: 60 seconds (except Herd Mentality at 5s)
6. **Auto-advance**: Different callbacks per game/phase

## Proposed Timer Component API

```javascript
// ES6 Module: components/Timer.js
class Timer {
  constructor(options) {
    this.element = options.element;           // DOM element
    this.duration = options.duration;         // seconds
    this.format = options.format || 'mm:ss';  // 'mm:ss' or 'ss'
    this.warningAt = options.warningAt || 60; // seconds
    this.onTick = options.onTick || null;     // callback(timeLeft)
    this.onExpire = options.onExpire || null; // callback()
    this.onWarning = options.onWarning || null; // callback()
  }

  start() { /* Start countdown */ }
  stop() { /* Clear interval */ }
  reset(duration) { /* Reset to new duration */ }
  getTimeLeft() { /* Return seconds remaining */ }
}

// Usage Example
import { Timer } from '../../components/Timer.js';

const timer = new Timer({
  element: document.getElementById('timer'),
  duration: 300,
  format: 'mm:ss',
  warningAt: 60,
  onTick: (timeLeft) => console.log(timeLeft),
  onExpire: () => transitionToNextPhase(),
  onWarning: () => playWarningSound()
});

timer.start();
```

## Files That Will Need Changes

### Component Files (Create)
- `components/Timer.js` - Main Timer class

### Game Files (Update)
- `games/fakin-it/answer.html` - Replace lines 185-202
- `games/fakin-it/voting.html` - Replace lines 247-264
- `games/imposter/game.html` - Replace lines 257-283, remove CSS lines 9-28
- `games/imposter/voting.html` - Replace lines 177-198
- `games/spyfall/game.html` - Replace lines 296-324, remove CSS lines 52-71
- `games/spyfall/voting.html` - Replace lines 150-171
- `games/herd-mentality/game.html` - Replace lines 128-146

### HTML Timer Display (All Files)
- Replace inline styles with class: `<div id="timer" class="timer"></div>`

## Testing Checklist

### Functional Tests
- [ ] Timer counts down correctly in all games
- [ ] Timer displays mm:ss format correctly
- [ ] Timer displays ss format for Herd Mentality
- [ ] Warning color triggers at correct threshold
- [ ] Pulse animation shows at warning threshold
- [ ] onExpire callback fires when timer hits 0
- [ ] onTick callback fires every second
- [ ] Timer can be stopped mid-countdown
- [ ] Multiple timers can run on same page (if needed)

### Visual Tests
- [ ] Timer styling matches existing design
- [ ] Timer is centered and prominent
- [ ] Warning color is visible and attention-grabbing
- [ ] Timer doesn't shift layout when changing
- [ ] Mobile responsive (text size appropriate)

### Game-Specific Tests
- [ ] Fakin' It answer: Auto-advances to voting at 0
- [ ] Fakin' It voting: Overseer advances to results at 0
- [ ] Imposter game: Host advances to voting at 0
- [ ] Imposter voting: Host advances to results at 0
- [ ] Spyfall game: Timer stops at 0 (no auto-advance)
- [ ] Spyfall voting: Host advances to results at 0
- [ ] Herd Mentality: Auto-submits answer at 0, warning at 5s

### Edge Cases
- [ ] Timer works when page loaded mid-countdown
- [ ] Timer syncs with Firebase timestamps
- [ ] Late joiners don't see broken timers
- [ ] Browser tab inactive/active doesn't break timer
- [ ] Multiple rapid page loads don't create multiple intervals

# Timer Component

## Purpose
Reusable countdown timer with automatic warning color at threshold. Used across all games for answer rounds and voting rounds.

## When to Use
- Game phases with time limits
- Voting rounds
- Answer submission rounds
- Any countdown scenario

## Usage

```javascript
import { Timer } from '../../src/components/Timer.js';

const timer = new Timer({
  element: document.getElementById('timer'),
  duration: 300,
  warningAt: 60,
  onTick: (timeLeft) => {
    console.log(`Time remaining: ${timeLeft}s`);
  },
  onComplete: () => {
    console.log('Timer expired');
    transitionToNextPhase();
  }
});

timer.start();
```

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `element` | HTMLElement | Required | DOM element to display timer |
| `duration` | Number | Required | Duration in seconds |
| `warningAt` | Number | `60` | Seconds threshold for warning color |
| `onTick` | Function | `null` | Callback fired every second with timeLeft |
| `onComplete` | Function | `null` | Callback fired when timer reaches 0 |

## Methods

| Method | Parameters | Description |
|--------|------------|-------------|
| `start()` | None | Start the countdown |
| `stop()` | None | Stop the countdown and clear interval |
| `reset(duration)` | duration (optional) | Reset timer to original or new duration |

## CSS Classes

| Class | Description |
|-------|-------------|
| `.timer` | Base timer styling |
| `.timer--warning` | Warning state with red color and pulse animation |

## HTML Structure

```html
<link rel="stylesheet" href="../../styles/components/timer.css">

<div id="timer" class="timer">5:00</div>
```

## Real Example: Herd Mentality

```javascript
import { Timer } from '../../src/components/Timer.js';

async function initGame() {
  const roomRef = getRoomRef(roomCode);
  const snapshot = await get(roomRef);
  const data = snapshot.val();

  const timerDuration = data.settings?.herdMentality?.timer || 20;

  const timer = new Timer({
    element: document.getElementById('timer'),
    duration: timerDuration,
    warningAt: 5,
    onComplete: async () => {
      const answer = answerInput.value.trim() || '[No Answer]';
      const updates = {};
      updates[`rooms/${roomCode}/players/${playerId}/answer`] = answer;
      await update(dbRef(db), updates);
    }
  });

  timer.start();
}
```

## Notes

- Timer automatically changes to red at warning threshold
- Timer format is mm:ss (e.g., "5:00", "0:45")
- Timer stops automatically at 0
- Multiple timers can coexist on same page
- CSS uses variables from styles/variables.css

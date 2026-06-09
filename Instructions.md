# Refactoring Instructions - Prompts for Claude

This file contains the exact prompts to use with Claude to implement the RefactoringPlan.md in order. Copy and paste these prompts one at a time, testing between each phase.

---

## Phase 1: Setup & Documentation Structure

### Prompt 1.1: Create Documentation Folders
```
Following RefactoringPlan.md Phase 1, create the docs folder structure:
- docs/components/
- docs/refactoring/
- docs/

Create placeholder .md files for:
- docs/components/timer.md
- docs/components/question-display.md
- docs/components/input-fields.md
- docs/components/buttons.md
- docs/components/player-cards.md
- docs/components/status-messages.md
- docs/components/modals.md
- docs/game-development.md
- docs/css-guide.md

Follow CodingStandards.md.
```

### Prompt 1.2: Create CSS Guide
```
Following RefactoringPlan.md Phase 1, create docs/css-guide.md.

Analyze all existing CSS files in:
- style.css
- games/fakin-it/style.css
- games/imposter/style.css
- games/spyfall/style.css
- games/herd-mentality/style.css

Document:
1. All colors used (extract hex values)
2. All spacing values used
3. All font sizes used
4. All border radius values
5. All shadow values
6. BEM naming convention to use

Include examples of proper BEM class naming.

Follow CodingStandards.md.
```

### Prompt 1.3: Create CSS Variables File
```
Following RefactoringPlan.md Phase 1 and using the information from docs/css-guide.md, create styles/variables.css.

Define CSS custom properties for:
- Colors (primary, secondary, success, danger, warning, pink, grays)
- Spacing scale (xs, sm, md, lg, xl, 2xl)
- Font sizes (xs, sm, base, lg, xl, 2xl, 3xl)
- Font family
- Border radius (sm, md, lg, xl)
- Shadows (sm, md, lg, xl)
- Transitions (fast, base, slow)
- Z-index scale

Use meaningful variable names with -- prefix.

Follow CodingStandards.md.
```

### Prompt 1.4: Update Existing CSS Files
```
Following RefactoringPlan.md Phase 1, update all existing CSS files to use CSS variables from styles/variables.css.

Files to update:
- style.css
- games/fakin-it/style.css
- games/imposter/style.css
- games/spyfall/style.css
- games/herd-mentality/style.css

Replace hardcoded colors, spacing, fonts with var(--variable-name).

Import styles/variables.css at the top of each file.

Do NOT change functionality, only replace values with variables.

Follow CodingStandards.md.
```

### Prompt 1.5: Test Phase 1
```
I've tested all games visually. Everything looks identical to before. Phase 1 is complete.

Create docs/refactoring/phase-1-complete.md documenting:
- What was done
- Files changed
- Variables created
- Any issues encountered

Follow CodingStandards.md.
```

---

## Phase 2: Timer Component

### Prompt 2.1: Plan Timer Component
```
Following RefactoringPlan.md Phase 2, create docs/refactoring/phase-2.md.

Analyze all existing timers in:
- games/herd-mentality/question.html
- games/fakin-it/answer.html
- games/fakin-it/voting.html
- games/imposter/voting.html
- games/imposter/game.html
- games/spyfall/voting.html
- games/spyfall/game.html

Document:
1. Where each timer is used
2. Current timer logic (how each works)
3. Styling differences
4. Common patterns
5. Proposed Timer component API
6. Files that will need changes
7. Testing checklist

Follow CodingStandards.md.
```

### Prompt 2.2: Create Timer Component
```
Following the plan in docs/refactoring/phase-2.md, create src/components/Timer.js.

Requirements:
- Simple ES6 class
- Constructor accepts options object
- Renders mm:ss format by default
- Changes color at warning threshold (60 seconds)
- Supports callbacks: onTick, onComplete
- Methods: start(), stop(), reset()
- Keep code simple, ~50 lines max

Follow CodingStandards.md.
```

### Prompt 2.3: Create Timer CSS
```
Following RefactoringPlan.md Phase 2, create styles/components/timer.css.

Use BEM naming (.timer, .timer--warning).
Use CSS variables only (no hardcoded values).
Make timer look identical to current timers in games.

Follow CodingStandards.md.
```

### Prompt 2.4: Document Timer Component
```
Following RefactoringPlan.md Phase 2, update docs/components/timer.md.

Include:
- Purpose and when to use
- Usage example code
- All options table
- CSS classes available
- Real example from Herd Mentality

Follow the component documentation template in RefactoringPlan.md.
```

### Prompt 2.5: Replace Timer in Herd Mentality
```
Following RefactoringPlan.md Phase 2, replace the timer in games/herd-mentality/question.html with the Timer component.

Import Timer component, use it, remove old timer code.

Test thoroughly before confirming.

Follow CodingStandards.md.
```

### Prompt 2.6: Replace Timer in Fakin' It
```
Following RefactoringPlan.md Phase 2, replace timers in:
- games/fakin-it/answer.html
- games/fakin-it/voting.html

Use the Timer component, remove old timer code.

Follow CodingStandards.md.
```

### Prompt 2.7: Replace Timer in Imposter
```
Following RefactoringPlan.md Phase 2, replace timers in:
- games/imposter/voting.html
- games/imposter/game.html

Use the Timer component, remove old timer code.

Follow CodingStandards.md.
```

### Prompt 2.8: Replace Timer in Spyfall
```
Following RefactoringPlan.md Phase 2, replace timers in:
- games/spyfall/voting.html
- games/spyfall/game.html

Use the Timer component, remove old timer code.

Follow CodingStandards.md.
```

### Prompt 2.9: Test Phase 2
```
I've tested all game timers. They all work identically and look identical. Phase 2 is complete.

Create docs/refactoring/phase-2-complete.md documenting what was done.

Follow CodingStandards.md.
```

---

## Phase 3: Question Display Component

### Prompt 3.1: Plan Question Display Component
```
Following RefactoringPlan.md Phase 3, create docs/refactoring/phase-3.md.

Analyze existing question displays in all games.
Document current state, proposed solution, files to change, testing checklist.

Follow CodingStandards.md.
```

### Prompt 3.2: Create QuestionDisplay Component
```
Following the plan in docs/refactoring/phase-3.md, create src/components/QuestionDisplay.js.

Simple ES6 class, renders question with title, ~30 lines max.

Follow CodingStandards.md.
```

### Prompt 3.3: Create QuestionDisplay CSS
```
Following RefactoringPlan.md Phase 3, create styles/components/question-display.css.

Use BEM naming, CSS variables only.

Follow CodingStandards.md.
```

### Prompt 3.4: Document QuestionDisplay Component
```
Following RefactoringPlan.md Phase 3, update docs/components/question-display.md.

Follow the component documentation template.
```

### Prompt 3.5: Replace Question Displays
```
Following RefactoringPlan.md Phase 3, replace question displays in all games with QuestionDisplay component.

One game at a time, test each.

Follow CodingStandards.md.
```

### Prompt 3.6: Test Phase 3
```
I've tested all question displays. Phase 3 is complete.

Create docs/refactoring/phase-3-complete.md.

Follow CodingStandards.md.
```

---

## Phase 4: Input Fields Component

### Prompt 4.1: Plan InputField Component
```
Following RefactoringPlan.md Phase 4, create docs/refactoring/phase-4.md.

Analyze existing inputs/textareas in all games.

Follow CodingStandards.md.
```

### Prompt 4.2: Create InputField Component
```
Following the plan in docs/refactoring/phase-4.md, create src/components/InputField.js.

Supports both text input and textarea, ~40 lines max.

Follow CodingStandards.md.
```

### Prompt 4.3: Create InputField CSS
```
Following RefactoringPlan.md Phase 4, create styles/components/input.css.

Use BEM naming, CSS variables only.

Follow CodingStandards.md.
```

### Prompt 4.4: Document InputField Component
```
Following RefactoringPlan.md Phase 4, update docs/components/input-fields.md.

Follow the component documentation template.
```

### Prompt 4.5: Replace Input Fields
```
Following RefactoringPlan.md Phase 4, replace input fields in all games with InputField component.

One game at a time, test each.

Follow CodingStandards.md.
```

### Prompt 4.6: Test Phase 4
```
I've tested all input fields. Phase 4 is complete.

Create docs/refactoring/phase-4-complete.md.

Follow CodingStandards.md.
```

---

## Phase 5: Button Component

### Prompt 5.1: Plan Button Component
```
Following RefactoringPlan.md Phase 5, create docs/refactoring/phase-5.md.

Analyze existing buttons in all games (primary, secondary, danger, disabled, full-width).

Follow CodingStandards.md.
```

### Prompt 5.2: Create Button Component
```
Following the plan in docs/refactoring/phase-5.md, create src/components/Button.js.

Supports variants (primary, secondary, danger), disabled state, ~35 lines max.

Follow CodingStandards.md.
```

### Prompt 5.3: Create Button CSS
```
Following RefactoringPlan.md Phase 5, create styles/components/button.css.

Use BEM naming (.button, .button--primary, .button--secondary, .button--danger, .button--full, .button:disabled).
Use CSS variables only.

Follow CodingStandards.md.
```

### Prompt 5.4: Document Button Component
```
Following RefactoringPlan.md Phase 5, update docs/components/buttons.md.

Follow the component documentation template.
```

### Prompt 5.5: Replace Buttons
```
Following RefactoringPlan.md Phase 5, replace buttons in all games with Button component.

One game at a time, test each.

Follow CodingStandards.md.
```

### Prompt 5.6: Test Phase 5
```
I've tested all buttons. Phase 5 is complete.

Create docs/refactoring/phase-5-complete.md.

Follow CodingStandards.md.
```

---

## Phase 6: Player Card Component

### Prompt 6.1: Plan PlayerCard Component
```
Following RefactoringPlan.md Phase 6, create docs/refactoring/phase-6.md.

Analyze existing player cards in voting phases (Fakin' It, Imposter, Spyfall) and Herd Mentality reveal.

Follow CodingStandards.md.
```

### Prompt 6.2: Create PlayerCard Component
```
Following the plan in docs/refactoring/phase-6.md, create src/components/PlayerCard.js.

Supports selection, badges, points display, ~50 lines max.

Follow CodingStandards.md.
```

### Prompt 6.3: Create PlayerCard CSS
```
Following RefactoringPlan.md Phase 6, create styles/components/player-card.css.

Use BEM naming, CSS variables only.

Follow CodingStandards.md.
```

### Prompt 6.4: Document PlayerCard Component
```
Following RefactoringPlan.md Phase 6, update docs/components/player-cards.md.

Follow the component documentation template.
```

### Prompt 6.5: Replace Player Cards
```
Following RefactoringPlan.md Phase 6, replace player cards in all voting phases with PlayerCard component.

One game at a time, test each.

Follow CodingStandards.md.
```

### Prompt 6.6: Test Phase 6
```
I've tested all player cards. Phase 6 is complete.

Create docs/refactoring/phase-6-complete.md.

Follow CodingStandards.md.
```

---

## Phase 7: Status Messages Component

### Prompt 7.1: Plan StatusMessage Component
```
Following RefactoringPlan.md Phase 7, create docs/refactoring/phase-7.md.

Analyze existing status messages ("X/Y players submitted/voted").

Follow CodingStandards.md.
```

### Prompt 7.2: Create StatusMessage Component
```
Following the plan in docs/refactoring/phase-7.md, create src/components/StatusMessage.js.

Simple counter display, ~25 lines max.

Follow CodingStandards.md.
```

### Prompt 7.3: Create StatusMessage CSS
```
Following RefactoringPlan.md Phase 7, create styles/components/status-message.css.

Use BEM naming, CSS variables only.

Follow CodingStandards.md.
```

### Prompt 7.4: Document StatusMessage Component
```
Following RefactoringPlan.md Phase 7, update docs/components/status-messages.md.

Follow the component documentation template.
```

### Prompt 7.5: Replace Status Messages
```
Following RefactoringPlan.md Phase 7, replace status messages in all games with StatusMessage component.

Follow CodingStandards.md.
```

### Prompt 7.6: Test Phase 7
```
I've tested all status messages. Phase 7 is complete.

Create docs/refactoring/phase-7-complete.md.

Follow CodingStandards.md.
```

---

## Phase 8: Modal Component

### Prompt 8.1: Plan Modal Component
```
Following RefactoringPlan.md Phase 8, create docs/refactoring/phase-8.md.

Analyze existing modals (kick player, force next confirmations).

Follow CodingStandards.md.
```

### Prompt 8.2: Create Modal Component
```
Following the plan in docs/refactoring/phase-8.md, create src/components/Modal.js.

Supports title, message, confirm/cancel buttons, ~40 lines max.

Follow CodingStandards.md.
```

### Prompt 8.3: Create Modal CSS
```
Following RefactoringPlan.md Phase 8, create styles/components/modal.css.

Use BEM naming, CSS variables only.
Modal overlay with 50% opacity background.

Follow CodingStandards.md.
```

### Prompt 8.4: Document Modal Component
```
Following RefactoringPlan.md Phase 8, update docs/components/modals.md.

Follow the component documentation template.
```

### Prompt 8.5: Replace Modals
```
Following RefactoringPlan.md Phase 8, replace all confirmation dialogs with Modal component.

Replace alert() and confirm() calls with Modal.

Follow CodingStandards.md.
```

### Prompt 8.6: Test Phase 8
```
I've tested all modals. Phase 8 is complete.

Create docs/refactoring/phase-8-complete.md.

Follow CodingStandards.md.
```

---

## Phase 9: Game Development Guide

### Prompt 9.1: Create Game Development Guide
```
Following RefactoringPlan.md Phase 9, create docs/game-development.md.

This is a comprehensive guide for adding new games using the components created in Phases 2-8.

Include:
1. Overview of the component system
2. Step-by-step guide for creating a new game
3. Folder structure to follow
4. Naming conventions
5. How to use each component (Timer, QuestionDisplay, InputField, Button, PlayerCard, StatusMessage, Modal)
6. Example game implementation
7. Testing checklist

Follow CodingStandards.md.
```

### Prompt 9.2: Test Phase 9
```
I've reviewed the game development guide. Phase 9 is complete.

Create docs/refactoring/phase-9-complete.md.

Follow CodingStandards.md.
```

---

## Phase 10: Cleanup & Final Documentation

### Prompt 10.1: Remove Redundant Code
```
Following RefactoringPlan.md Phase 10, analyze all game files and identify redundant code that can be removed.

Look for:
- Duplicate CSS that's now in component CSS files
- Old timer implementations that were replaced
- Commented-out code
- Unused functions
- Duplicate styling

Create a list of what to remove in docs/refactoring/phase-10-cleanup-plan.md.

Follow CodingStandards.md.
```

### Prompt 10.2: Execute Cleanup
```
Following the plan in docs/refactoring/phase-10-cleanup-plan.md, remove all redundant code.

One file at a time, test after each removal.

Follow CodingStandards.md.
```

### Prompt 10.3: Create Refactoring Summary
```
Following RefactoringPlan.md Phase 10, create docs/refactoring-summary.md.

Document:
1. What was refactored (all phases)
2. Components created (list all 7)
3. Estimated lines of code reduced
4. Benefits achieved
5. Before/after comparison
6. Lessons learned

Follow CodingStandards.md.
```

### Prompt 10.4: Update README
```
Following RefactoringPlan.md Phase 10, update README.md.

Add sections for:
1. Component System overview
2. Link to docs/ folder
3. Link to game-development.md for adding new games
4. Development guidelines

Follow CodingStandards.md.
```

### Prompt 10.5: Final Test
```
I've tested all games thoroughly. Everything works correctly. Phase 10 is complete.

Create docs/refactoring/phase-10-complete.md.

Refactoring is complete!

Follow CodingStandards.md.
```

---

## Notes

- **Copy ONE prompt at a time**
- **Test after each prompt** before moving to the next
- **If something breaks**, ask Claude to fix it before continuing
- **Skip prompts** if not applicable (e.g., if a game doesn't have a specific feature)
- **Add your own prompts** if you need Claude to do something specific

## Testing Between Phases

After each phase completion prompt, manually test:
1. Load each game
2. Play through each phase
3. Check all styling looks correct
4. Verify no JavaScript errors in console
5. Test on mobile if possible

Only proceed to next phase when current phase is fully working.

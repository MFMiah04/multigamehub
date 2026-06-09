# MultigameHub Refactoring Plan

## Goal

Simplify code, create reusable components, maintain identical CSS styling across components, and reduce file length/redundancy. No complex build systems or extensive installations.

## Principles (from CodingStandards.md)

✅ **Simplicity** - Fewer lines, no over-engineering
✅ **Reusability** - Extract common patterns into shared components
✅ **Maintainability** - Easy to understand, self-documenting code
✅ **No Redundancy** - DRY principle, single source of truth
✅ **Minimal Changes** - Incremental improvements, test between phases

---

## Phase-Based Approach

Each phase:
1. **Plan** - Document what to refactor in `docs/refactoring/phase-N.md`
2. **Implement** - Make changes incrementally
3. **Test** - Verify everything works
4. **Document** - Update reference docs in `docs/`
5. **Commit** - Before moving to next phase

---

## Reusable Components to Create

### Core Components (Priority Order)

1. **Timer Component** - Consistent countdown timer across all games
2. **Question Display** - Header section showing game questions
3. **Input Fields** - Text inputs and textareas with consistent styling
4. **Buttons** - Standard button components (primary, secondary, danger)
5. **Player Cards** - Voting/selection cards with player info
6. **Status Messages** - "X/Y players submitted" counters
7. **Modal Dialogs** - Confirmation popups

### Styling Requirements

- **Identical CSS** - All timer components look/behave the same
- **CSS Variables** - Use CSS custom properties for colors, spacing, fonts
- **BEM Naming** - Consistent class naming convention
- **No Inline Styles** - Move all styling to CSS files

---

## Phase 1: Setup & Documentation Structure

**Goal:** Create documentation structure and CSS foundation

### Tasks

1. **Create docs directory structure**
   ```
   docs/
     components/          # Component usage documentation
       timer.md
       question-display.md
       input-fields.md
       buttons.md
       player-cards.md
       status-messages.md
       modals.md
     refactoring/         # Phase-by-phase plans
       phase-1.md
       phase-2.md
       ...
     game-development.md  # Guide for adding new games
     css-guide.md         # CSS standards and variables
   ```

2. **Create `docs/css-guide.md`**
   - Document CSS variable naming
   - List all color values (primary, secondary, success, danger, etc.)
   - Define spacing scale (small, medium, large)
   - Document BEM naming conventions
   - Include examples

3. **Create `styles/variables.css`**
   - Extract all colors from existing CSS
   - Define spacing variables
   - Define font sizes
   - Define border radius values
   - Define shadow values

4. **Update existing CSS files**
   - Replace hardcoded colors with CSS variables
   - No functionality changes, just variable substitution

**Deliverable:** Documentation structure + CSS variables file

**Test:** All games look identical to before, just using variables now

---

## Phase 2: Timer Component

**Goal:** Create reusable timer component used across all games

### Planning (in `docs/refactoring/phase-2.md`)

1. **Analyze existing timers**
   - List all places timers are used
   - Note differences in styling/behavior
   - Identify common patterns

2. **Design component API**
   ```javascript
   // Timer component interface
   new Timer({
     container: '#timer',
     duration: 60,      // seconds
     format: 'mm:ss',   // or 'seconds'
     warningAt: 60,     // when to show warning color
     onTick: (time) => {},
     onComplete: () => {},
     autoStart: true
   });
   ```

### Implementation

1. **Create `src/components/Timer.js`**
   - Simple class-based component
   - Renders mm:ss format
   - Changes color at warning threshold
   - Calls callbacks

2. **Create `styles/components/timer.css`**
   - Standard timer styling
   - Warning state styling
   - Use CSS variables only

3. **Update `docs/components/timer.md`**
   - How to use Timer component
   - All configuration options
   - Code examples
   - CSS classes available

4. **Replace timers one game at a time**
   - Start with Herd Mentality (simplest)
   - Test thoroughly
   - Then Fakin' It
   - Then Imposter
   - Then Spyfall

**Deliverable:** Timer component + documentation + all games using it

**Test:** All game timers work identically, look identical

---

## Phase 3: Question Display Component

**Goal:** Standardize question display across games

### Planning (in `docs/refactoring/phase-3.md`)

1. **Analyze existing question displays**
   - Herd Mentality question section
   - Fakin' It question sections
   - Note styling differences

2. **Design component**
   ```javascript
   new QuestionDisplay({
     container: '#question',
     title: 'Your Question:',
     question: 'What is...',
     subtitle: 'Optional subtitle'
   });
   ```

### Implementation

1. **Create `src/components/QuestionDisplay.js`**
2. **Create `styles/components/question-display.css`**
3. **Update `docs/components/question-display.md`**
4. **Replace in all games**

**Deliverable:** QuestionDisplay component used everywhere

**Test:** All question displays look/behave identically

---

## Phase 4: Input Fields Component

**Goal:** Standardize text inputs and textareas

### Planning (in `docs/refactoring/phase-4.md`)

1. **Analyze existing inputs**
   - Text inputs
   - Textareas
   - Disabled states
   - Error states

2. **Design component**
   ```javascript
   new InputField({
     container: '#answer',
     type: 'textarea',  // or 'text'
     label: 'Your Answer',
     placeholder: 'Type here...',
     disabled: false,
     value: '',
     onChange: (val) => {}
   });
   ```

### Implementation

1. **Create `src/components/InputField.js`**
2. **Create `styles/components/input.css`**
3. **Update `docs/components/input-fields.md`**
4. **Replace in all games**

**Deliverable:** InputField component used everywhere

---

## Phase 5: Button Component

**Goal:** Standardize all buttons

### Planning (in `docs/refactoring/phase-5.md`)

1. **Analyze existing buttons**
   - Primary buttons
   - Secondary buttons
   - Danger buttons
   - Disabled states
   - Full-width buttons

2. **Design component**
   ```javascript
   new Button({
     container: '#submit-btn',
     text: 'Submit Answer',
     variant: 'primary',  // primary, secondary, danger
     fullWidth: false,
     disabled: false,
     onClick: () => {}
   });
   ```

### Implementation

1. **Create `src/components/Button.js`**
2. **Create `styles/components/button.css`**
3. **Update `docs/components/buttons.md`**
4. **Replace in all games**

**Deliverable:** Button component used everywhere

---

## Phase 6: Player Card Component

**Goal:** Standardize voting/player selection cards

### Planning (in `docs/refactoring/phase-6.md`)

1. **Analyze existing player cards**
   - Voting cards in Fakin' It, Imposter, Spyfall
   - Answer cards in Herd Mentality reveal
   - Note common patterns

2. **Design component**
   ```javascript
   new PlayerCard({
     container: '#cards',
     playerId: 'abc123',
     playerName: 'Alice',
     content: 'Answer text or role',
     points: 1,  // or null
     badges: ['Pink Cow'],  // optional badges
     selectable: true,
     selected: false,
     onSelect: (playerId) => {}
   });
   ```

### Implementation

1. **Create `src/components/PlayerCard.js`**
2. **Create `styles/components/player-card.css`**
3. **Update `docs/components/player-cards.md`**
4. **Replace in voting phases**

**Deliverable:** PlayerCard component for all voting

---

## Phase 7: Status Messages Component

**Goal:** Standardize submission status messages

### Planning (in `docs/refactoring/phase-7.md`)

1. **Analyze status displays**
   - "X/Y players submitted" messages
   - Different phrasings

2. **Design component**
   ```javascript
   new StatusMessage({
     container: '#status',
     current: 3,
     total: 5,
     text: 'players voted'  // or 'players submitted'
   });
   ```

### Implementation

1. **Create `src/components/StatusMessage.js`**
2. **Create `styles/components/status-message.css`**
3. **Update `docs/components/status-messages.md`**
4. **Replace in all games**

**Deliverable:** StatusMessage component everywhere

---

## Phase 8: Modal Component

**Goal:** Standardize confirmation modals

### Planning (in `docs/refactoring/phase-8.md`)

1. **Analyze existing modals**
   - Kick player confirmation
   - Force next confirmations
   - Any other popups

2. **Design component**
   ```javascript
   new Modal({
     title: 'Confirm Action',
     message: 'Are you sure?',
     confirmText: 'Yes',
     cancelText: 'No',
     onConfirm: () => {},
     onCancel: () => {}
   });
   ```

### Implementation

1. **Create `src/components/Modal.js`**
2. **Create `styles/components/modal.css`**
3. **Update `docs/components/modals.md`**
4. **Replace all confirmation dialogs**

**Deliverable:** Modal component for all confirmations

---

## Phase 9: Game Development Guide

**Goal:** Document how to build new games with components

### Tasks

1. **Create `docs/game-development.md`**
   - Step-by-step guide for adding a new game
   - Which components to use
   - Folder structure
   - Naming conventions
   - Code examples

2. **Include component quick reference**
   - Timer: How to add a timer
   - QuestionDisplay: How to show questions
   - InputField: How to get player input
   - Button: How to add buttons
   - PlayerCard: How to create voting interface
   - StatusMessage: How to show progress
   - Modal: How to confirm actions

**Deliverable:** Complete guide for future game development

---

## Phase 10: Cleanup & Final Documentation

**Goal:** Remove redundant code, finalize docs

### Tasks

1. **Remove old duplicated code**
   - Delete unused CSS
   - Remove commented-out code
   - Consolidate similar functions

2. **Create `docs/refactoring-summary.md`**
   - What was refactored
   - Lines of code reduced
   - Components created
   - Benefits achieved

3. **Update `README.md`**
   - Link to docs folder
   - Component overview
   - Development setup

**Deliverable:** Clean codebase + complete documentation

---

## Documentation Templates

### Component Documentation Template

Each `docs/components/*.md` file should include:

```markdown
# [Component Name]

## Purpose
What this component does and when to use it.

## Usage

\`\`\`javascript
// Code example
new ComponentName({
  // options
});
\`\`\`

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option1 | string | 'value' | What it does |

## CSS Classes

List of CSS classes applied and when.

## Examples

Real examples from existing games.
```

### Phase Documentation Template

Each `docs/refactoring/phase-N.md` file should include:

```markdown
# Phase N: [Title]

## Goal
What we're trying to achieve.

## Current State
What exists now and what's wrong with it.

## Proposed Solution
What we'll build and how it works.

## Files to Change
- file1.js - what changes
- file2.css - what changes

## Testing Checklist
- [ ] Test case 1
- [ ] Test case 2

## Rollback Plan
How to undo if something breaks.
```

---

## Testing Strategy

After each phase:

1. **Visual Test** - Load each game, verify it looks identical
2. **Functional Test** - Play through each game phase
3. **Browser Test** - Check Chrome, Firefox, Safari
4. **Mobile Test** - Check on phone/tablet
5. **Document Issues** - Note any bugs found

---

## No Installation Required

This plan requires **NO** npm packages, build tools, or complex setup:
- ✅ Plain JavaScript ES6 modules (already working)
- ✅ Plain CSS (already working)
- ✅ Firebase SDK (already included)
- ❌ No Vite, Webpack, or bundlers
- ❌ No TypeScript compilation
- ❌ No package.json changes

---

## Success Criteria

By the end of refactoring:

1. **Code Reduced** - 50%+ less duplicated code
2. **Components Created** - 7 reusable components
3. **Documentation Complete** - Full docs for all components
4. **Identical Styling** - All timers, buttons, etc. look the same
5. **Easy Maintenance** - Change CSS variable once, affects all games
6. **Future-Proof** - New games use components, not copy-paste

---

## Next Steps

1. Review this plan
2. Create `docs/` folder structure
3. Start Phase 1: CSS variables
4. Work through phases incrementally
5. Test after each phase
6. Update docs as you go

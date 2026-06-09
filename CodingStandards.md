# Coding Standards

## Core Principles

### 1. Simplicity First
- **Favor fewer lines over more** - If code can be written in 5 lines instead of 20, use 5 lines
- **No over-engineering** - Use the simplest solution that works
- **Avoid unnecessary abstractions** - Don't create layers of complexity unless absolutely required
- **Direct approach** - Prefer straightforward implementations over "clever" code

### 2. Code Reusability
- **Reuse existing components** - Check for existing components/functions before creating new ones
- **Share common patterns** - If multiple files use similar logic, extract to shared utility
- **Consistent styling** - Use existing CSS classes and shared stylesheets (e.g., `shared-voting-styles.css`)
- **Component-based thinking** - Extract reusable UI elements into components when they appear in multiple places

### 3. Maintainability
- **Easy to understand** - Code should be readable without extensive comments
- **Consistent naming** - Use clear, descriptive variable and function names
- **Keep functions focused** - Each function should do one thing well
- **Avoid deep nesting** - Prefer early returns and guard clauses

### 4. Stick to Requirements
- **Do what's asked, nothing more** - Implement exactly what the user requested
- **No extra features** - Don't add functionality that wasn't requested
- **No unsolicited documentation** - Only create docs when explicitly asked
- **Ask before assuming** - If requirements are unclear, ask questions before coding

### 5. No Redundancy
- **DRY (Don't Repeat Yourself)** - Extract repeated code into functions
- **Remove dead code** - Delete unused variables, functions, and imports
- **Single source of truth** - Store data in one place, reference it from others
- **Avoid duplicate logic** - If the same calculation appears twice, extract it

## Technical Standards

### File Organization
- **Minimal file edits** - Only edit files that need changes
- **Read before editing** - Always use Read tool before Edit tool
- **Prefer editing over creating** - Modify existing files rather than creating new ones
- **Keep related code together** - Group similar functionality in the same file/folder

### HTML/JavaScript
- **Inline styles for simple cases** - Use inline styles for one-off styling needs
- **Event listeners over inline handlers** - Use `addEventListener()` instead of `onclick=""`
- **Template literals for HTML** - Use backticks and `${}` for dynamic HTML generation
- **Minimal DOM manipulation** - Update only what's necessary

### Data Management
- **Firebase as single source** - Use Firebase Realtime Database for state
- **Avoid local state duplication** - Don't cache Firebase data unnecessarily
- **Use Firebase listeners** - React to data changes with `listenToRoom()`
- **Batch updates** - Combine multiple Firebase writes into single `update()` call

### Settings & Configuration
- **Dropdown for discrete options** - Use `<select>` for predefined choices (not sliders)
- **Store in standard units** - Save timers in seconds, display in minutes
- **Initialize with defaults** - Always provide sensible default values
- **Host-only changes** - Settings should only be editable by host

### UI Patterns
- **Modal confirmations for destructive actions** - Use overlay modals for kick/delete
- **Consistent button styling** - Reuse existing button classes (`.secondary`, etc.)
- **Status displays** - Show "X/Y players submitted" counters
- **Disable during operations** - Disable buttons while async operations run

### Game Implementation
- **Simple HTML files** - Games use standalone HTML files with embedded scripts
- **No complex architecture migration** - Don't refactor working games to new patterns
- **Minimal changes for features** - Add ~30 lines for new features, not hundreds
- **Reuse voting patterns** - Copy vote resubmission logic between games

## Workflow Standards

### Before Coding
1. **Understand the full request** - Read the entire task before starting
2. **Check existing code** - Search for similar implementations
3. **Ask clarifying questions** - If anything is unclear, ask first
4. **Plan minimal changes** - Identify the smallest set of edits needed

### While Coding
1. **Make targeted edits** - Change only what's necessary
2. **Test logic mentally** - Walk through code paths before saving
3. **Keep consistent style** - Match existing code formatting
4. **Preserve working code** - Don't refactor unrelated code

### After Coding
1. **Verify completeness** - Ensure all requested features are implemented
2. **Check for redundancy** - Remove any duplicate code introduced
3. **Clean up** - Remove console.logs, commented code, unused variables
4. **Brief confirmation** - Confirm completion without lengthy explanations

## Common Patterns

### Vote/Answer Resubmission
```javascript
// Submit button -> Change button pattern
submitBtn.addEventListener('click', async () => {
  await update(dbRef(db), { [`rooms/${roomCode}/players/${playerId}/vote`]: selectedId });
  submitBtn.style.display = 'none';
  changeBtn.style.display = 'block';
});

changeBtn.addEventListener('click', async () => {
  await update(dbRef(db), { [`rooms/${roomCode}/players/${playerId}/vote`]: null });
  changeBtn.style.display = 'none';
  submitBtn.style.display = 'block';
});
```

### Timer Display (No Emoji)
```javascript
function startTimer() {
  timerDisplay.textContent = timeLeft; // Just the number
  timerInterval = setInterval(() => {
    timeLeft--;
    timerDisplay.textContent = timeLeft;
    if (timeLeft <= 10) timerDisplay.style.color = 'red';
    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      if (isHost) moveToNextPhase();
    }
  }, 1000);
}
```

### Settings Dropdown
```javascript
// Generate dropdown with minutes (stored as seconds)
const currentMins = Math.floor((settings?.timer || 60) / 60);
return `
  <select onchange="updateTimer(this.value)">
    ${[1,2,3,4,5].map(m =>
      `<option value="${m}" ${m === currentMins ? 'selected' : ''}>${m} minutes</option>`
    ).join('')}
  </select>
`;

// Update handler converts to seconds
updateTimer(minutes) {
  update(dbRef(db), { [`rooms/${roomCode}/settings/game/timer`]: minutes * 60 });
}
```

### Confirmation Modal
```javascript
// Modal with 50% opacity background
<div id="modal" style="display: none; position: fixed; top: 0; left: 0;
     width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5);
     align-items: center; justify-content: center;">
  <div style="background: white; padding: 30px; border-radius: 15px;">
    <h3>Confirm Action?</h3>
    <div style="display: flex; gap: 10px;">
      <button id="cancel">Cancel</button>
      <button id="confirm">Confirm</button>
    </div>
  </div>
</div>
```

## What to Avoid

### L Don't Do This
- Create new markdown files without being asked
- Add emojis to UI elements unless requested
- Migrate games to new architecture when simple edits work
- Write lengthy explanations in code comments
- Create abstractions for one-off uses
- Refactor working code "just because"
- Add console.logs that stay in production
- Create wrapper functions for single-use cases

###  Do This Instead
- Edit existing markdown files
- Clean, emoji-free UI (unless specified)
- Add ~30 lines to existing HTML files
- Write self-documenting code with clear names
- Inline simple logic
- Leave working code alone
- Remove debug logs before completion
- Use native APIs directly

## Questions to Ask Before Coding

1. **Does this component/function already exist?**
2. **What's the simplest way to implement this?**
3. **Can I edit an existing file instead of creating new ones?**
4. **Am I adding anything beyond what was requested?**
5. **Will this be easy for someone else to understand?**
6. **Is there duplicate code I can consolidate?**

## Suggestions for Improvement

### Consider These Optimizations
1. **Shared game utilities** - Extract common game logic (timers, vote counting) into `games/shared-utils.js`
2. **Consistent error handling** - Create standard error display pattern across all games
3. **TypeScript migration** - Add type safety to catch bugs earlier (long-term improvement)
4. **Centralized Firebase operations** - Consolidate all Firebase calls into typed repository pattern
5. **Component library** - Build reusable UI components (modals, dropdowns, timers) for consistency
6. **Unit tests** - Add tests for critical game logic (scoring, role assignment, vote counting)
7. **Linting rules** - Add ESLint config to enforce coding standards automatically
8. **Performance monitoring** - Track Firebase read/write counts to optimize costs
9. **Accessibility** - Add ARIA labels and keyboard navigation support
10. **Progressive enhancement** - Ensure basic functionality works without JavaScript

### Potential Refactors (Only When Needed)
- Consolidate all timer logic into single reusable timer component
- Extract modal logic into shared modal manager
- Create game state machine for phase transitions
- Build settings panel component for lobby
- Standardize player list rendering across games

**Note:** These are suggestions only. Don't implement without explicit request.

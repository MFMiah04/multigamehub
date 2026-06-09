# Phase 3: QuestionDisplay Component Analysis

## Current State

### Files Using Question Display

1. **games/fakin-it/answer.html** (line 17-20)
2. **games/fakin-it/voting.html** (line 18-21)
3. **games/herd-mentality/game.html** (line 18-21)

### Current HTML Structure

```html
<div class="question-display" id="questionDisplay">
  <h3>Your Question:</h3>
  <p id="questionText">Loading...</p>
</div>
```

**Variations**:
- Fakin' It Answer: `<h3>Your Question:</h3>` with `id="questionDisplay"`
- Fakin' It Voting: `<h3>Question:</h3>` with no id on wrapper
- Herd Mentality: `<h3>Question:</h3>` with no id on wrapper

### Current CSS (style.css:295-312)

```css
.question-display {
  background: var(--color-primary-light);
  padding: var(--space-lg);
  border-radius: var(--radius-md);
  margin: var(--space-lg) 0;
  text-align: center;
}

.question-display h3 {
  color: var(--color-primary);
  margin-bottom: var(--space-md);
  font-size: var(--font-size-base);
}

.question-display p {
  font-size: var(--font-size-base-plus);
  color: var(--color-gray-700);
}
```

### Current JavaScript Pattern

#### Fakin' It Answer (answer.html:126-135)
```javascript
const questionText = document.getElementById('questionText');
const questionDisplay = document.getElementById('questionDisplay');

// Get appropriate question
const questions = data.gameData?.fakinIt?.questions;
if (myRole === 'faker') {
  questionText.textContent = questions.faker;
} else if (myRole === 'innocent') {
  questionText.textContent = questions.real;
}
```

#### Fakin' It Voting (voting.html:110)
```javascript
const realQuestion = document.getElementById('realQuestion');
realQuestion.textContent = questions.real;
```

#### Herd Mentality (game.html:98-112)
```javascript
const questionText = document.getElementById('questionText');

// Get or set question
if (data.gameData?.herdMentality?.currentQuestion) {
  currentQuestion = data.gameData.herdMentality.currentQuestion;
  questionText.textContent = currentQuestion;
} else if (isHost) {
  // Host picks random question
  const usedQuestions = data.gameData?.herdMentality?.usedQuestions || [];
  currentQuestion = getRandomQuestion(usedQuestions);
  // Update Firebase...
  questionText.textContent = currentQuestion;
}
```

## Analysis

### Common Patterns
1. All use `.question-display` class
2. All have `<h3>` title and `<p>` for question text
3. All display questions from Firebase data
4. All center-aligned with light blue background
5. All show "Loading..." initially

### Differences
1. **Title text varies**: "Your Question:" vs "Question:"
2. **ID names vary**: `questionText` vs `realQuestion`
3. **Wrapper ID**: Only Fakin' It Answer has `id="questionDisplay"` on wrapper
4. **Logic complexity**: Simple text assignment vs conditional logic

### Is Component Needed?

**Arguments FOR**:
- ✅ Consistent styling across games
- ✅ Same HTML structure (3 uses)
- ✅ Centralized updates

**Arguments AGAINST**:
- ❌ Only 3 uses (Timer had 7)
- ❌ Very simple structure (2 elements)
- ❌ Logic varies significantly between games
- ❌ Already uses shared CSS class
- ❌ No duplicate JavaScript code to eliminate

## Recommendation

**DO NOT create QuestionDisplay component.**

### Reasoning

1. **Too Simple**: The HTML structure is only 4 lines and doesn't justify a component
2. **Already Consistent**: CSS is already shared in style.css
3. **Low Duplication**: No significant JavaScript duplication to eliminate
4. **Different Logic**: Each game has unique question-fetching logic
5. **Over-Engineering**: Creating a component would add complexity without benefit

### Alternative Approach

**Keep current implementation with minor improvements**:

1. **Move CSS to component file** for organization (optional)
2. **Standardize HTML** across files
3. **Standardize ID names** (use `questionText` everywhere)

## Proposed Improvements (Minimal)

### Option 1: Do Nothing
Keep current state - it's already consistent and maintainable.

### Option 2: Standardize HTML Only

**Standardize to**:
```html
<div class="question-display">
  <h3>Question</h3>
  <p id="questionText">Loading...</p>
</div>
```

**Changes**:
- Fakin' It Answer: Remove wrapper ID, change title to "Question"
- Fakin' It Voting: Rename `realQuestion` to `questionText`
- Herd Mentality: Already correct

**Benefits**:
- Consistent title
- Consistent ID naming
- No functional changes
- No component overhead

### Option 3: Move CSS to Component File

**Create**: `styles/components/question-display.css`
**Remove**: Lines 295-312 from style.css

**Benefits**:
- Better organization
- Component-focused structure
- No functional changes

## Recommendation: Option 2 + Option 3

1. Standardize HTML across 3 files
2. Move CSS to component file
3. Update documentation
4. Skip JavaScript component creation

## Files to Change

### If Implementing Standardization

1. **games/fakin-it/answer.html**
   - Remove `id="questionDisplay"` from wrapper
   - Change `<h3>Your Question:</h3>` to `<h3>Question</h3>`

2. **games/fakin-it/voting.html**
   - Change `id="realQuestion"` to `id="questionText"`
   - Update JavaScript variable name

3. **styles/components/question-display.css** (create)
   - Move CSS from style.css

4. **style.css**
   - Remove lines 295-312

5. **docs/components/question-display.md**
   - Document HTML structure and CSS usage

## Testing Checklist

### Visual Tests
- [ ] Question displays with light blue background
- [ ] Title shows "Question" in primary color
- [ ] Question text shows in dark gray
- [ ] Layout is centered
- [ ] Spacing matches existing design
- [ ] Mobile responsive

### Functional Tests
- [ ] Fakin' It Answer: Shows correct question per role (faker vs innocent)
- [ ] Fakin' It Voting: Shows real question
- [ ] Herd Mentality: Shows current question

## Conclusion

QuestionDisplay is **too simple** for a JavaScript component. The current shared CSS approach is sufficient. At most, we should:
1. Standardize HTML structure
2. Move CSS to dedicated file
3. Update documentation

This follows CodingStandards.md principle: **Don't over-engineer simple things.**

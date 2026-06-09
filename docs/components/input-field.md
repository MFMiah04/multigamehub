# Input Field Component

## Purpose
Reusable CSS styling for text inputs, textareas, and form fields. Provides consistent form styling across all games.

## When to Use
- Text answer inputs (Herd Mentality, Fakin' It)
- Question/prompt inputs (Fakin' It overseer)
- Any game requiring text input from players
- Future games: trivia answers, word games, guessing games

## Usage

```html
<link rel="stylesheet" href="../../styles/components/input-field.css">

<div class="input-group">
  <label for="answerInput">Your Answer</label>
  <textarea id="answerInput" placeholder="Type your answer here..."></textarea>
</div>
```

## HTML Structure

### Basic Textarea
```html
<div class="input-group">
  <label for="inputId">Label Text</label>
  <textarea id="inputId" placeholder="Placeholder text..."></textarea>
</div>
```

### Text Input
```html
<div class="input-group">
  <label for="inputId">Label Text</label>
  <input type="text" id="inputId" placeholder="Placeholder text...">
</div>
```

### Select Dropdown
```html
<div class="input-group">
  <label for="selectId">Label Text</label>
  <select id="selectId">
    <option value="1">Option 1</option>
    <option value="2">Option 2</option>
  </select>
</div>
```

## CSS Classes

| Class | Description |
|-------|-------------|
| `.input-group` | Wrapper for label + input, provides spacing |

## Styling Features

- **Consistent Border**: 2px solid border with gray color
- **Focus State**: Blue border and shadow when focused
- **Responsive**: Full width, adapts to container
- **Accessible**: Proper label association
- **Textarea**: Minimum 100px height, vertically resizable
- **Smooth Transitions**: 0.2s ease transitions on focus

## Real Examples

### Herd Mentality Answer
```html
<div class="input-group">
  <label for="answerInput">Your Answer</label>
  <textarea id="answerInput" placeholder="Type your answer here..."></textarea>
</div>
```

### Fakin' It Answer
```html
<div class="input-group" id="answerGroup">
  <label for="answerInput">Your Answer</label>
  <textarea id="answerInput" placeholder="Type your answer here..."></textarea>
</div>
```

### Fakin' It Question Setup (Multiple Inputs)
```html
<div class="input-group">
  <label for="realQuestion">Real Question (for innocent players)</label>
  <textarea id="realQuestion" placeholder="e.g., What's your favorite movie?"></textarea>
</div>

<div class="input-group">
  <label for="fakerQuestion">Faker Question (for the faker)</label>
  <textarea id="fakerQuestion" placeholder="e.g., What's your favorite TV show?"></textarea>
</div>
```

## JavaScript Integration

### Basic Pattern
```javascript
const answerInput = document.getElementById('answerInput');

// Get value
const answer = answerInput.value.trim();

// Validate
if (!answer) {
  showError('Please enter an answer');
  return;
}

// Disable after submit
answerInput.disabled = true;

// Pre-fill existing value
if (player.answer) {
  answerInput.value = player.answer;
}
```

### Common Operations
```javascript
// Clear input
answerInput.value = '';

// Enable/disable
answerInput.disabled = true;
answerInput.disabled = false;

// Focus
answerInput.focus();

// Listen for changes
answerInput.addEventListener('input', () => {
  console.log(answerInput.value);
});
```

## Future Game Examples

### Trivia Game
```html
<div class="input-group">
  <label for="triviaAnswer">Your Answer</label>
  <input type="text" id="triviaAnswer" placeholder="Type your answer...">
</div>
```

### Codenames (Spymaster Clue)
```html
<div class="input-group">
  <label for="clueWord">Clue Word</label>
  <input type="text" id="clueWord" placeholder="One word clue...">
</div>
```

### Pictionary (Guess)
```html
<div class="input-group">
  <label for="guess">Your Guess</label>
  <input type="text" id="guess" placeholder="What is being drawn?">
</div>
```

### Story Building Game
```html
<div class="input-group">
  <label for="storyPart">Add to the story</label>
  <textarea id="storyPart" placeholder="Continue the story..."></textarea>
</div>
```

## Notes

- Component provides CSS only, no JavaScript
- Each game implements its own input logic
- Use `textarea` for multi-line text, `input` for single-line
- Always include a `<label>` for accessibility
- `for` attribute on label must match `id` on input
- Placeholder text provides context to users
- CSS uses variables from styles/variables.css

## Browser Compatibility

- ✅ Modern browsers (Chrome, Firefox, Safari, Edge)
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)
- ✅ Supports keyboard navigation
- ✅ Screen reader compatible with proper labels

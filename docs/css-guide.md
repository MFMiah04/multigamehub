# CSS Guide

## Overview

This guide documents all CSS values used across MultigameHub and establishes standards for future development.

---

## Colors

### Primary Colors

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Primary | `#667eea` | Main brand color, buttons, links, primary UI |
| Primary Hover | `#5568d3` | Button hover states |
| Primary Light | `#e8eaf6` | Backgrounds, selected states |
| Primary Dark | `#4a5fd9` | Borders on focus |
| Secondary | `#764ba2` | Secondary buttons, accents |
| Secondary Hover | `#643a8a` | Secondary button hover |

### Status Colors

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Success | `#28a745` | Success states, majority indicators |
| Success Light | `#d4edda` | Success backgrounds |
| Warning | `#ffc107` | Warning states, host indicators |
| Warning Light | `#fff3cd` | Warning backgrounds |
| Danger/Error | `#e74c3c` | Error states, timer warnings |
| Danger Light | `#ffcdd2` | Error backgrounds |
| Info | `#17a2b8` | Info states, overseer indicator |
| Info Light | `#d1ecf1` | Info backgrounds |

### Special Colors

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| Pink | `#ff69b4` | Pink cow indicator |
| Pink Light | `#fff0f5` | Pink cow backgrounds |

### Neutral Colors

| Color Name | Hex Value | Usage |
|------------|-----------|-------|
| White | `#ffffff` | Backgrounds, text on dark |
| Gray 100 | `#f9f9f9` | Light backgrounds |
| Gray 200 | `#f0f0f0` | Hover states |
| Gray 300 | `#ddd` | Borders |
| Gray 400 | `#999` | Muted text |
| Gray 500 | `#666` | Secondary text |
| Gray 600 | `#555` | Labels |
| Gray 700 | `#333` | Primary text |
| Gray 800 | `#c62828` | Dark red (error text) |
| Gray Disabled | `#ccc` | Disabled button background |

---

## Spacing Scale

### Padding & Margin Values

| Size | Value | Usage |
|------|-------|-------|
| XS | `4px` | Vote count padding, small gaps |
| SM | `5px` | Label margins |
| SM+ | `6px` | Player item gaps, border radius |
| MD | `8px` | Answer card margins, standard gaps |
| MD+ | `10px` | Player item padding, input padding |
| LG | `12px` | Container padding, section margins |
| LG+ | `14px` | Room code padding |
| XL | `15px` | Body padding, heading margins |
| XL+ | `16px` | Answer card padding |
| 2XL | `20px` | Container padding, timer margins |
| 2XL+ | `25px` | Container padding (large) |

---

## Typography

### Font Family

**Primary Font Stack:**
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
```

### Font Sizes

| Size | Value | Usage |
|------|-------|-------|
| XS | `0.8rem` | Room code mobile |
| SM | `0.85rem` | Labels, small text |
| SM+ | `0.9rem` | Error messages, player items |
| SM++ | `0.95rem` | Status messages |
| Base | `1rem` | Question display headings |
| Base+ | `1.05rem` | Question display text |
| LG | `1.1rem` | H2 mobile |
| LG+ | `1.2rem` | Settings panel H2 |
| XL | `1.3rem` | H1 mobile |
| XL+ | `1.5rem` | H1, H2 desktop |
| 2XL | `3rem` | Timer display |

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Normal | `400` | Body text |
| Semibold | `600` | Labels, buttons, headings, status |

---

## Border Radius

| Size | Value | Usage |
|------|-------|-------|
| SM | `6px` | Input fields, voters list |
| MD | `8px` | Buttons, player items, most cards |
| LG | `10px` | Answer cards, timer display |
| XL | `15px` | Main container |
| Round | `20px` | Room code, vote count pills |

---

## Shadows

| Type | Value | Usage |
|------|-------|-------|
| XS | `0 1px 2px rgba(0, 0, 0, 0.1)` | Button active state |
| SM | `0 1px 3px rgba(0, 0, 0, 0.05)` | Input fields |
| SM+ | `0 1px 3px rgba(0, 0, 0, 0.08)` | Player items, settings panel |
| MD | `0 2px 4px rgba(0, 0, 0, 0.1)` | Buttons default |
| MD+ | `0 2px 6px rgba(0, 0, 0, 0.12)` | Player item hover |
| LG | `0 2px 8px rgba(0, 0, 0, 0.15)` | Room code |
| XL | `0 4px 8px rgba(0, 0, 0, 0.15)` | Button hover |
| 2XL | `0 8px 32px rgba(0, 0, 0, 0.12)` | Main container |
| Focus | `0 2px 6px rgba(102, 126, 234, 0.2)` | Input focus (primary color) |

---

## Transitions

| Type | Value | Usage |
|------|-------|-------|
| Fast | `0.1s` | Room code active |
| Base | `0.2s ease` | Buttons, inputs, most transitions |
| Slow | `0.3s` | Answer cards |

---

## Z-Index Scale

| Layer | Value | Usage |
|-------|-------|-------|
| Base | `1` | Default stacking |
| Dropdown | `100` | Dropdowns (reserved for future) |
| Modal | `1000` | Modal overlays |
| Tooltip | `2000` | Tooltips (reserved for future) |

---

## BEM Naming Convention

### Block Element Modifier (BEM) Structure

```
.block {}
.block__element {}
.block--modifier {}
.block__element--modifier {}
```

### Examples

**Button Component:**
```css
.button {}                    /* Block */
.button--primary {}          /* Modifier: primary variant */
.button--secondary {}        /* Modifier: secondary variant */
.button--danger {}           /* Modifier: danger variant */
.button--full {}             /* Modifier: full width */
.button:disabled {}          /* State */
```

**Player Card Component:**
```css
.player-card {}              /* Block */
.player-card__name {}        /* Element: player name */
.player-card__answer {}      /* Element: answer text */
.player-card__points {}      /* Element: points display */
.player-card--selected {}   /* Modifier: selected state */
.player-card--pink-cow {}   /* Modifier: has pink cow */
.player-card__points--positive {} /* Element + Modifier */
.player-card__points--zero {}     /* Element + Modifier */
```

**Timer Component:**
```css
.timer {}                    /* Block */
.timer--warning {}          /* Modifier: warning state (< 60s) */
```

**Modal Component:**
```css
.modal {}                    /* Block */
.modal__overlay {}          /* Element: background overlay */
.modal__content {}          /* Element: content container */
.modal__header {}           /* Element: header */
.modal__body {}             /* Element: body */
.modal__footer {}           /* Element: footer */
.modal__button {}           /* Element: button */
.modal__button--confirm {}  /* Element + Modifier */
.modal__button--cancel {}   /* Element + Modifier */
```

**Input Field Component:**
```css
.input {}                    /* Block */
.input--textarea {}         /* Modifier: textarea variant */
.input--text {}             /* Modifier: text variant */
.input:focus {}             /* State */
.input:disabled {}          /* State */
```

### Naming Rules

1. **Use lowercase and hyphens** - `.player-card`, not `.playerCard` or `.player_card`
2. **Block names are nouns** - `.button`, `.timer`, `.modal`
3. **Element names describe what they are** - `__name`, `__points`, `__header`
4. **Modifier names describe state or variant** - `--selected`, `--primary`, `--warning`
5. **Don't nest blocks within blocks** - Each component is independent
6. **Use state pseudo-classes when appropriate** - `:hover`, `:focus`, `:disabled`

### Anti-Patterns to Avoid

❌ **Don't use generic classes**
```css
.big {}
.red {}
.center {}
```

✅ **Use descriptive, semantic classes**
```css
.button--large {}
.text--danger {}
.layout--centered {}
```

❌ **Don't nest BEM elements**
```css
.card__header__title {}  /* Bad: double nesting */
```

✅ **Flatten structure**
```css
.card__header {}
.card__title {}          /* Good: flat */
```

---

## CSS Variable Naming

When creating CSS variables in `styles/variables.css`, use this naming convention:

```css
--color-[name]           /* Colors */
--space-[size]           /* Spacing */
--font-size-[size]       /* Font sizes */
--font-weight-[weight]   /* Font weights */
--radius-[size]          /* Border radius */
--shadow-[size]          /* Box shadows */
--transition-[speed]     /* Transitions */
--z-[layer]             /* Z-index */
```

### Examples

```css
:root {
  /* Colors */
  --color-primary: #667eea;
  --color-primary-hover: #5568d3;
  --color-primary-light: #e8eaf6;
  --color-success: #28a745;
  --color-danger: #e74c3c;
  --color-gray-100: #f9f9f9;
  --color-gray-700: #333;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 12px;
  --space-lg: 16px;
  --space-xl: 24px;

  /* Typography */
  --font-size-sm: 0.875rem;
  --font-size-base: 1rem;
  --font-size-lg: 1.125rem;
  --font-weight-normal: 400;
  --font-weight-semibold: 600;

  /* Border Radius */
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 10px;

  /* Shadows */
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 2px 4px rgba(0, 0, 0, 0.1);

  /* Transitions */
  --transition-fast: 0.1s;
  --transition-base: 0.2s ease;
}
```

---

## Usage Guidelines

### Importing Styles

All components should import variables:

```css
@import url('../../../styles/variables.css');

.component {
  color: var(--color-primary);
  padding: var(--space-md);
  border-radius: var(--radius-md);
}
```

### No Inline Styles

❌ **Avoid:**
```html
<div style="color: #667eea; padding: 12px;">
```

✅ **Prefer:**
```html
<div class="status-message">
```

```css
.status-message {
  color: var(--color-primary);
  padding: var(--space-md);
}
```

### Component-Specific Files

Each component gets its own CSS file:
- `styles/components/timer.css`
- `styles/components/button.css`
- `styles/components/modal.css`

---

## Mobile Responsiveness

### Breakpoints

| Name | Size | Usage |
|------|------|-------|
| Mobile | `< 400px` | Single column |
| Medium Mobile | `400px - 768px` | 2 columns |
| Tablet/Desktop | `> 768px` | Full layout |

### Media Query Examples

```css
/* Mobile first approach */
.element {
  /* Mobile styles */
}

@media (min-width: 400px) {
  .element {
    /* Medium mobile */
  }
}

@media (min-width: 768px) {
  .element {
    /* Desktop */
  }
}
```

---

## Summary

- **Consistency** - Use CSS variables, not hardcoded values
- **BEM** - Use Block Element Modifier naming
- **Mobile First** - Design for mobile, enhance for desktop
- **Component Files** - One CSS file per component
- **No Inline Styles** - All styling in CSS files

This guide ensures all components have identical, maintainable styling across the entire application.

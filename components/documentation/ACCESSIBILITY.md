# Accessibility Guidelines for Documentation

This document outlines the accessibility features implemented in the documentation system and provides guidelines for content authors.

## Implemented Accessibility Features

### Keyboard Navigation

All interactive elements support keyboard navigation:

- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate links and buttons
- **Escape**: Close search dialog
- **Arrow Keys**: Navigate search results and navigation items
- **Cmd/Ctrl + K**: Open search dialog

### Skip to Content

A "Skip to Content" link is available for keyboard users to bypass navigation and jump directly to the main content. This link is visually hidden until focused.

### ARIA Labels and Semantic HTML

All components use proper ARIA labels and semantic HTML:

- Navigation uses `<nav>` with `aria-label`
- Main content uses `<main>` with `id="main-content"`
- Headings follow proper hierarchy (h1 → h2 → h3)
- Interactive elements have descriptive `aria-label` attributes
- Code blocks use `<figure>` and `<figcaption>` for semantic structure
- Callouts use appropriate ARIA roles (`note`, `alert`, `status`)

### Screen Reader Support

- All icons have `aria-hidden="true"` to prevent redundant announcements
- Buttons include screen reader-only text with `.sr-only` class
- Loading states use `aria-live="polite"` for status updates
- Search results use `role="listbox"` and `role="option"`

## Guidelines for Content Authors

### Images

Always provide descriptive alt text for images:

```mdx
![Description of the image](/path/to/image.png)
```

For decorative images, use empty alt text:

```mdx
![](/path/to/decorative-image.png)
```

### Headings

Maintain proper heading hierarchy:

```mdx
# Page Title (h1)

## Section (h2)

### Subsection (h3)

#### Detail (h4)
```

Never skip heading levels (e.g., don't jump from h2 to h4).

### Links

Use descriptive link text that makes sense out of context:

**Good:**
```mdx
Read our [API authentication guide](/docs/api-reference/authentication)
```

**Bad:**
```mdx
Click [here](/docs/api-reference/authentication) for authentication
```

### Code Blocks

Provide language hints for syntax highlighting:

```mdx
\`\`\`typescript
const example = "This helps screen readers announce the language";
\`\`\`
```

### Tables

Use proper table headers:

```mdx
| Header 1 | Header 2 |
|----------|----------|
| Data 1   | Data 2   |
```

### Lists

Use semantic lists for related items:

```mdx
- Item 1
- Item 2
- Item 3
```

Or ordered lists when sequence matters:

```mdx
1. First step
2. Second step
3. Third step
```

## Testing Accessibility

### Keyboard Testing

1. Navigate through the page using only the keyboard
2. Ensure all interactive elements are reachable
3. Verify focus indicators are visible
4. Test that Enter/Space activates elements

### Screen Reader Testing

Test with popular screen readers:
- **macOS**: VoiceOver (Cmd + F5)
- **Windows**: NVDA or JAWS
- **Linux**: Orca

### Automated Testing

Run accessibility audits:
- Chrome DevTools Lighthouse
- axe DevTools browser extension
- WAVE browser extension

## WCAG Compliance

This documentation system aims to meet WCAG 2.1 Level AA standards:

- ✅ Perceivable: Content is presented in ways users can perceive
- ✅ Operable: UI components are operable via keyboard
- ✅ Understandable: Information and UI are understandable
- ✅ Robust: Content works with assistive technologies

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)
- [A11y Project](https://www.a11yproject.com/)
- [WebAIM](https://webaim.org/)

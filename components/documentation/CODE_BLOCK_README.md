# CodeBlock Component

A syntax-highlighted code block component with copy-to-clipboard functionality, built with Shiki for beautiful syntax highlighting.

## Features

- ✅ Syntax highlighting for multiple languages (TypeScript, Python, Bash, JSON, YAML, and more)
- ✅ Copy-to-clipboard functionality with visual feedback
- ✅ Optional filename display
- ✅ Optional line numbers
- ✅ Hover-activated copy button
- ✅ Fallback for clipboard API failures
- ✅ Light/Dark theme support
- ✅ Responsive design

## Usage

### Basic Example

```tsx
import { CodeBlock } from "@/components/documentation"

export function MyDocPage() {
  return (
    <CodeBlock
      code={`function greet(name: string) {
  return \`Hello, \${name}!\`;
}`}
      language="typescript"
    />
  )
}
```

### With Filename

```tsx
<CodeBlock
  code={`def calculate_sum(a, b):
    return a + b`}
  language="python"
  filename="calculator.py"
/>
```

### With Line Numbers

```tsx
<CodeBlock
  code={`#!/bin/bash
npm install
npm run build
npm start`}
  language="bash"
  filename="deploy.sh"
  showLineNumbers={true}
/>
```

## Props

### CodeBlock

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | `string` | Yes | - | The code content to display |
| `language` | `string` | Yes | - | Programming language for syntax highlighting |
| `filename` | `string` | No | - | Optional filename to display above the code block |
| `showLineNumbers` | `boolean` | No | `false` | Whether to show line numbers |
| `highlightLines` | `number[]` | No | `[]` | Array of line numbers to highlight (future feature) |

### CopyButton

The `CopyButton` component is used internally by `CodeBlock` but can also be used standalone:

```tsx
import { CopyButton } from "@/components/documentation"

<CopyButton 
  code="const x = 10;" 
  onCopy={() => console.log("Code copied!")}
/>
```

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `code` | `string` | Yes | - | The code content to copy |
| `onCopy` | `() => void` | No | - | Callback function called after successful copy |

## Supported Languages

The component supports all languages supported by Shiki, including:

- TypeScript/JavaScript
- Python
- Bash/Shell
- JSON
- YAML
- HTML/CSS
- SQL
- Go
- Rust
- And many more...

## Themes

The component automatically adapts to your site's theme:
- **Light mode**: Uses `github-light` theme
- **Dark mode**: Uses `github-dark` theme

## Error Handling

The component includes robust error handling:

1. **Syntax Highlighting Failures**: Falls back to plain text display
2. **Clipboard API Failures**: Uses fallback method with `document.execCommand`
3. **Missing Elements**: Gracefully handles missing DOM elements

## Accessibility

- Proper ARIA labels for copy button
- Keyboard accessible
- Screen reader friendly
- High contrast support

## Requirements Satisfied

- **Requirement 3.1**: Syntax-highlighted code blocks ✅
- **Requirement 3.2**: Multiple programming language support ✅
- **Requirement 3.3**: Copy button on hover ✅
- **Requirement 3.4**: Copy to clipboard with confirmation ✅
- **Requirement 3.5**: Proper formatting and line numbers ✅

## Examples

See `code-block-example.tsx` for comprehensive usage examples.

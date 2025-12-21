# Content Area and Custom MDX Components

This document explains how to use the ContentArea component and custom MDX components in the SmartAPIForge documentation system.

## Overview

The content area system provides:

1. **ContentArea Component** - Main container for documentation content with proper typography
2. **Custom MDX Components** - Enhanced components for rich documentation (Callout, Tabs, Card)
3. **MDX Configuration** - Configured with remark and rehype plugins for GitHub Flavored Markdown and syntax highlighting

## ContentArea Component

The `ContentArea` component wraps documentation content and provides:

- Responsive width with optimal reading line length
- Professional typography using Tailwind's prose classes
- Proper spacing and hierarchy for headings, paragraphs, lists, etc.
- Dark mode support
- Syntax-highlighted code blocks

### Usage

```tsx
import { ContentArea } from '@/components/documentation'

export default function DocPage() {
  return (
    <ContentArea>
      {/* Your MDX content here */}
    </ContentArea>
  )
}
```

## Custom MDX Components

### Callout Component

Highlight important information with styled callout boxes.

**Types:** `info`, `warning`, `error`, `success`

**Usage in MDX:**

```mdx
<Callout type="info" title="Information">
  This is an informational callout.
</Callout>

<Callout type="warning" title="Warning">
  This is a warning callout.
</Callout>

<Callout type="error" title="Error">
  This is an error callout.
</Callout>

<Callout type="success" title="Success">
  This is a success callout.
</Callout>
```

### Tabs Component

Display multiple options or code examples in tabs.

**Usage in MDX:**

```mdx
<Tabs defaultValue="typescript">
  <TabsList>
    <TabsTrigger value="typescript">TypeScript</TabsTrigger>
    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
    <TabsTrigger value="python">Python</TabsTrigger>
  </TabsList>
  
  <TabsContent value="typescript">
    ```typescript
    const greeting: string = "Hello, World!";
    ```
  </TabsContent>
  
  <TabsContent value="javascript">
    ```javascript
    const greeting = "Hello, World!";
    ```
  </TabsContent>
  
  <TabsContent value="python">
    ```python
    greeting = "Hello, World!"
    ```
  </TabsContent>
</Tabs>
```

### Card Component

Create visually distinct sections for features or links.

**Usage in MDX:**

```mdx
<!-- Single Card -->
<Card
  title="Getting Started"
  description="Learn the basics of SmartAPIForge"
  href="/docs/getting-started"
/>

<!-- Card Grid -->
<CardGrid cols={2}>
  <Card
    title="API Reference"
    description="Explore our comprehensive API documentation"
    href="/docs/api-reference"
  />
  <Card
    title="Guides"
    description="Step-by-step tutorials and guides"
    href="/docs/guides"
  />
</CardGrid>
```

**Props:**
- `title` - Card title
- `description` - Card description
- `href` - Optional link (makes card clickable)
- `icon` - Optional icon component
- `children` - Optional custom content

**CardGrid Props:**
- `cols` - Number of columns (2, 3, or 4)
- `children` - Card components

## MDX Configuration

The system is configured with the following plugins:

### Remark Plugins
- **remark-gfm** - GitHub Flavored Markdown support (tables, task lists, strikethrough, etc.)

### Rehype Plugins
- **rehype-slug** - Automatically adds IDs to headings for anchor links
- **rehype-autolink-headings** - Wraps headings in anchor links
- **rehype-pretty-code** - Syntax highlighting with Shiki (supports light/dark themes)

## Syntax Highlighting

Code blocks are automatically syntax highlighted using Shiki with:

- **Light theme:** github-light
- **Dark theme:** github-dark
- **Supported languages:** TypeScript, JavaScript, Python, Bash, JSON, YAML, and more

### Usage in MDX:

````mdx
```typescript
function greet(name: string): string {
  return `Hello, ${name}!`;
}
```
````

## Typography Styles

The ContentArea component applies the following typography styles:

- **Headings:** Proper hierarchy with scroll margin for anchor links
- **Paragraphs:** Optimal line height and spacing
- **Links:** Primary color with hover underline
- **Lists:** Proper indentation and spacing
- **Code:** Inline code with background and monospace font
- **Blockquotes:** Left border with italic text
- **Tables:** Bordered with proper cell padding
- **Images:** Rounded corners with border

## Creating Documentation Pages

1. Create an MDX file in `content/docs/[category]/[page].mdx`
2. Add frontmatter with metadata:

```mdx
---
title: Page Title
description: Page description
category: getting-started
order: 1
tags: [tag1, tag2]
lastUpdated: 2024-12-11
---

# Your Content Here
```

3. Use custom components as needed
4. The page will automatically be rendered with proper styling

## Best Practices

1. **Use Callouts Sparingly** - Only for important information
2. **Tabs for Alternatives** - Use tabs when showing multiple ways to do something
3. **Cards for Navigation** - Use cards to link to related documentation
4. **Consistent Heading Hierarchy** - Use h1 for title, h2 for sections, h3 for subsections
5. **Code Examples** - Always include working code examples
6. **Descriptive Links** - Use descriptive link text, not "click here"

## Example Page

See `content/docs/getting-started/quick-start.mdx` for a complete example using all custom components.

## Requirements Satisfied

This implementation satisfies the following requirements:

- **3.1, 3.2** - MDX configuration with syntax highlighting
- **6.1, 6.2** - Proper typography and visual design
- **6.5** - Interactive elements with visual feedback

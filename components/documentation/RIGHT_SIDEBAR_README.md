# Right Sidebar Table of Contents Implementation

This document describes the implementation of the right sidebar table of contents with scroll spy functionality for the v0-inspired documentation system.

## Overview

The right sidebar displays a table of contents that:
- Shows h2-h4 headings from the current page
- Highlights the active section based on scroll position
- Provides smooth scroll navigation when clicking TOC links
- Uses Intersection Observer API for efficient scroll tracking

## Components Implemented

### 1. Heading Extraction Utilities (`lib/docs/heading-utils.ts`)

Functions for extracting headings from MDX content:

- **`extractHeadingsForTOC(content: string)`**: Extracts h2-h4 headings from raw MDX content
- **`extractHeadingsFromHTML(html: string)`**: Extracts headings from rendered HTML
- **`buildNestedHeadings(headings: Heading[])`**: Creates nested heading structure
- **`filterHeadingsByLevel(headings: Heading[], levels: number[])`**: Filters headings by level

All functions generate unique IDs for headings automatically.

### 2. Scroll Spy Hook (`hooks/use-scroll-spy.ts`)

Custom React hooks for tracking scroll position:

- **`useScrollSpy(headingIds: string[], options?: UseScrollSpyOptions)`**: Main hook that returns the currently active heading ID
- **`useScrollSpyFallback(headingIds: string[], offset?: number)`**: Fallback using scroll events
- **`useVisibleHeadings(headingIds: string[])`**: Returns all currently visible heading IDs

The scroll spy uses Intersection Observer API for efficient performance.

### 3. RightSidebar Component (`components/documentation/right-sidebar.tsx`)

The main component that displays the table of contents:

- Displays headings with nested indentation based on level
- Highlights active section using scroll spy
- Smooth scrolls to section on click
- Responsive (hidden on screens < 1280px)
- Accessible with proper ARIA labels

## Usage

### Basic Usage

```tsx
import { RightSidebar } from "@/components/documentation"
import { extractHeadingsForTOC } from "@/lib/docs/heading-utils"

// Extract headings from MDX content
const mdxContent = `
## Introduction
### Getting Started
## Features
`

const headings = extractHeadingsForTOC(mdxContent)

// Render the sidebar
<RightSidebar headings={headings} />
```

### With Documentation Layout

```tsx
import { DocumentationLayout, RightSidebar, LeftSidebar } from "@/components/documentation"

<DocumentationLayout
  leftSidebar={<LeftSidebar sections={navSections} />}
  rightSidebar={<RightSidebar headings={headings} />}
>
  {/* Your content here */}
</DocumentationLayout>
```

### Manual Heading Definition

```tsx
const headings = [
  { id: "intro", text: "Introduction", level: 2 },
  { id: "setup", text: "Setup", level: 3 },
  { id: "config", text: "Configuration", level: 4 },
]

<RightSidebar headings={headings} />
```

## Features

### Automatic ID Generation

Headings are automatically assigned unique IDs based on their text:
- "Getting Started" → `getting-started`
- "API Reference" → `api-reference`
- Duplicate headings get numbered suffixes: `intro`, `intro-1`, `intro-2`

### Scroll Spy Behavior

The scroll spy:
- Highlights the topmost visible heading
- Updates as you scroll through the page
- Accounts for fixed headers (80px offset)
- Uses Intersection Observer for performance

### Smooth Scrolling

Clicking a TOC link:
- Smoothly scrolls to the target section
- Updates the URL hash
- Accounts for fixed header offset
- Provides visual feedback

### Responsive Design

- Hidden on screens < 1280px (xl breakpoint)
- Sticky positioning at top of viewport
- Scrollable when content exceeds viewport height

## Accessibility

- Proper ARIA labels (`aria-label`, `aria-current`)
- Semantic HTML (`<nav>`, `<aside>`)
- Keyboard navigation support
- Focus visible states

## Requirements Satisfied

This implementation satisfies the following requirements from the spec:

- **Requirement 2.1**: Updates right sidebar to highlight current section based on scroll
- **Requirement 2.2**: Marks section as active when heading becomes visible
- **Requirement 2.3**: Highlights topmost visible heading when multiple are visible
- **Requirement 2.4**: Smoothly scrolls to section when TOC link is clicked
- **Requirement 2.5**: Updates active section without layout shift

## Examples

See `components/documentation/usage-example.tsx` for comprehensive examples including:
- Complete documentation page setup
- Standalone RightSidebar usage
- Heading extraction from MDX
- Custom scroll spy implementation

## Testing

The implementation includes:
- TypeScript type safety
- No compilation errors
- Proper error handling for missing elements
- Fallback for browsers without Intersection Observer

## Future Enhancements

Potential improvements:
- Collapsible nested sections
- Progress indicator showing reading position
- Estimated reading time per section
- Print-friendly version

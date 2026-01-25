# Documentation Content

This directory contains all MDX documentation files for SmartAPIForge.

## Directory Structure

```
content/docs/
├── getting-started/     # Getting started guides
│   ├── introduction.mdx
│   ├── installation.mdx
│   ├── quick-start.mdx
│   └── prerequisites.mdx
├── features/            # Feature documentation
│   ├── ai-generation.mdx
│   ├── sandbox-execution.mdx
│   ├── github-integration.mdx
│   └── deployment.mdx
├── api-reference/       # API documentation
│   ├── overview.mdx
│   ├── endpoints.mdx
│   └── authentication.mdx
├── guides/              # How-to guides
│   ├── first-api.mdx
│   └── advanced-usage.mdx
├── deployment/          # Deployment guides
│   ├── vercel.mdx
│   └── docker.mdx
└── troubleshooting/     # Troubleshooting guides
    ├── common-issues.mdx
    └── faq.mdx
```

## MDX File Format

Each MDX file should include frontmatter with metadata:

```mdx
---
title: Page Title
description: Brief description of the page
category: getting-started
order: 1
tags: [tag1, tag2]
lastUpdated: 2024-12-11
---

# Page Title

Your content here...
```

## Frontmatter Fields

- **title**: The page title (required)
- **description**: Brief description for SEO and search (required)
- **category**: One of: getting-started, features, api-reference, guides, deployment, troubleshooting (required)
- **order**: Numeric order within the category (optional)
- **tags**: Array of tags for search and categorization (optional)
- **lastUpdated**: Date of last update in YYYY-MM-DD format (optional)

## Writing Guidelines

1. Use clear, concise language
2. Include code examples where appropriate
3. Use proper heading hierarchy (h1 → h2 → h3)
4. Add links to related documentation
5. Include troubleshooting tips when relevant

## Code Blocks

Use fenced code blocks with language specification:

\`\`\`typescript
const example = "Hello, World!";
\`\`\`

## Components

You can use React components in MDX files. Custom components will be defined in the documentation system.

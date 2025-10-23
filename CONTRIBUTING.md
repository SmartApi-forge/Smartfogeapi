# Contributing to SmartAPIForge

First off, thank you for considering contributing to SmartAPIForge! It's people like you that make SmartAPIForge such a great tool.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Commit Messages](#commit-messages)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)

---

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

### Our Standards

- ✅ Using welcoming and inclusive language
- ✅ Being respectful of differing viewpoints
- ✅ Gracefully accepting constructive criticism
- ✅ Focusing on what is best for the community
- ❌ Trolling, insulting/derogatory comments
- ❌ Public or private harassment
- ❌ Publishing others' private information

---

## Getting Started

### Prerequisites

- Node.js >= 18.17.0
- pnpm >= 8.0.0
- Git
- A Supabase account (free tier)
- An OpenAI API key
- An E2B account

### Fork & Clone

```bash
# Fork the repository on GitHub
gh repo fork Shashank4507/smart-forge-api

# Clone your fork
git clone https://github.com/YOUR_USERNAME/smart-forge-api.git
cd smart-forge-api

# Add upstream remote
git remote add upstream https://github.com/Shashank4507/smart-forge-api.git
```

### Setup Development Environment

```bash
# Install dependencies
pnpm install

# Copy environment variables
cp env.example .env.local

# Configure your .env.local with your API keys

# Start development servers
pnpm dev          # Next.js (http://localhost:3000)
pnpm dev:inngest  # Inngest (http://localhost:8288)
```

---

## Development Process

### Branching Strategy

We use a simplified Git Flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring

### Creating a Feature Branch

```bash
# Update your local main
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/my-awesome-feature
```

### Making Changes

1. **Write Code**
   - Follow our [coding standards](#coding-standards)
   - Add tests for new functionality
   - Update documentation as needed

2. **Test Locally**
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add awesome feature"
   ```
   See [commit message guidelines](#commit-messages)

---

## Pull Request Process

### Before Submitting

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No console errors/warnings
- [ ] Branch is up-to-date with main

### Submitting PR

1. **Push to Your Fork**
   ```bash
   git push origin feature/my-awesome-feature
   ```

2. **Create Pull Request**
   - Go to GitHub and create a PR from your fork
   - Use the PR template
   - Link related issues
   - Add screenshots/videos if UI changes

3. **PR Title Format**
   ```
   <type>(<scope>): <description>
   
   Examples:
   feat(api): add new endpoint for project deletion
   fix(ui): resolve navbar overflow on mobile
   docs(readme): update installation instructions
   ```

4. **PR Description Template**
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Breaking change
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Screenshots (if applicable)
   
   ## Related Issues
   Closes #123
   ```

### Review Process

- Maintainers will review within 48 hours
- Address feedback in new commits
- Once approved, squash and merge

---

## Coding Standards

### TypeScript

```typescript
// ✅ Good
interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

const createProject = async (data: ProjectInput): Promise<Project> => {
  // Implementation
};

// ❌ Bad
const createProject = async (data: any) => {
  // Implementation
};
```

### React Components

```typescript
// ✅ Good - Functional component with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button onClick={onClick} className={cn(baseStyles, variantStyles[variant])}>
      {label}
    </button>
  );
};

// ❌ Bad - No types, inline styles
export const Button = ({ label, onClick }) => {
  return <button style={{ color: 'blue' }}>{label}</button>;
};
```

### File Naming

- **Components**: PascalCase (`MyComponent.tsx`)
- **Utilities**: camelCase (`apiHelpers.ts`)
- **Types**: PascalCase (`UserTypes.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_CONSTANTS.ts`)

### Import Order

```typescript
// 1. React & Next.js
import React from 'react';
import { useRouter } from 'next/router';

// 2. External libraries
import { z } from 'zod';
import { trpc } from '@/utils/trpc';

// 3. Internal modules
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 4. Types
import type { Project } from '@/types/project';

// 5. Styles
import styles from './Component.module.css';
```

### Code Style

- **Indentation**: 2 spaces
- **Quotes**: Single quotes for TypeScript, double for JSX
- **Semicolons**: Required
- **Max line length**: 100 characters
- **Trailing commas**: Required

---

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Types

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation only
- `style` - Code style (formatting, missing semicolons)
- `refactor` - Code refactoring
- `test` - Adding/updating tests
- `chore` - Maintenance tasks
- `perf` - Performance improvements
- `ci` - CI/CD changes

### Examples

```bash
# Feature
feat(api): add endpoint for batch project deletion

# Bug fix
fix(ui): resolve navbar z-index issue on mobile

# Documentation
docs(readme): update installation steps

# Breaking change
feat(auth)!: migrate to Supabase Auth v2

BREAKING CHANGE: Auth API has changed, users need to re-authenticate
```

---

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button Component', () => {
  it('should render with correct label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button label="Click" onClick={handleClick} />);
    
    fireEvent.click(screen.getByText('Click'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

### Coverage Requirements

- **Unit Tests**: > 80% coverage
- **Critical Paths**: 100% coverage
- **Edge Cases**: Must be tested

### Running Tests

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage report
pnpm test:coverage

# Specific file
pnpm test Button.test.tsx
```

---

## Documentation

### Code Comments

```typescript
/**
 * Generates a complete API from natural language prompt
 * 
 * @param prompt - Natural language description of the API
 * @param options - Additional generation options
 * @returns Generated API project with spec and code
 * @throws {ValidationError} If prompt is invalid
 * @throws {GenerationError} If API generation fails
 * 
 * @example
 * ```typescript
 * const api = await generateAPI('Create a todo API', {
 *   framework: 'fastapi',
 *   includeTests: true
 * });
 * ```
 */
async function generateAPI(
  prompt: string,
  options?: GenerationOptions
): Promise<GeneratedAPI> {
  // Implementation
}
```

### README Updates

When adding new features:

1. Update feature list in README.md
2. Add usage examples
3. Update configuration section if needed
4. Add to troubleshooting if complex

### API Documentation

Use JSDoc for all exported functions and components:

```typescript
/**
 * @component
 * @description Displays a project card with status and actions
 * 
 * @param {Object} props - Component props
 * @param {Project} props.project - Project data to display
 * @param {Function} props.onDelete - Callback when delete is clicked
 * 
 * @returns {JSX.Element} Rendered project card
 */
export const ProjectCard: React.FC<ProjectCardProps> = ({ 
  project, 
  onDelete 
}) => {
  // Implementation
};
```

---

## Questions?

- 💬 Join our [Discord](https://discord.gg/smartapiforge)
- 📧 Email: dev@smartapiforge.dev
- 🐛 Open an [issue](https://github.com/Shashank4507/smart-forge-api/issues)

---

## Recognition

Contributors will be:

- ✨ Added to CONTRIBUTORS.md
- 🎉 Mentioned in release notes
- 🏆 Featured on our website (major contributions)

Thank you for making SmartAPIForge better! 🚀

# Daytona Template Setup Guide

This guide explains how to create and configure the pre-built Daytona template environment for the Full Project Scaffolding feature.

## Overview

Instead of running `npm create-next-app` and `npm install` for each new project (which takes 5-10 minutes), we use a pre-built Docker image that already has all dependencies installed. This reduces project creation time to 2-5 seconds.

## Prerequisites

- Docker installed locally
- Docker Hub account (or GitHub Container Registry)
- Node.js 18+ and pnpm installed locally (for local testing)

## Option 1: Build and Push Docker Image (Recommended)

### Step 1: Build the Docker Image

```bash
# From the project root
docker build -f docker/nextjs-template.Dockerfile -t yourusername/smartapiforge-nextjs-template:latest .
```

### Step 2: Push to Docker Hub

```bash
# Login to Docker Hub
docker login

# Push the image
docker push yourusername/smartapiforge-nextjs-template:latest
```

### Step 3: Configure Environment Variable

Add the Docker image name to your `.env.local` file:

```env
DAYTONA_TEMPLATE_ID=yourusername/smartapiforge-nextjs-template:latest
```

## Option 2: Use GitHub Container Registry

### Step 1: Build and Tag for GHCR

```bash
docker build -f docker/nextjs-template.Dockerfile -t ghcr.io/yourusername/smartapiforge-nextjs-template:latest .
```

### Step 2: Push to GHCR

```bash
# Login to GHCR (use a GitHub Personal Access Token)
echo $GITHUB_TOKEN | docker login ghcr.io -u yourusername --password-stdin

# Push the image
docker push ghcr.io/yourusername/smartapiforge-nextjs-template:latest
```

### Step 3: Configure Environment Variable

```env
DAYTONA_TEMPLATE_ID=ghcr.io/yourusername/smartapiforge-nextjs-template:latest
```

## Option 3: Local Development (No Template)

If you don't want to set up a template, the system will fall back to `node:22-bookworm` and install dependencies on-demand. This is slower but works without any setup:

```env
# Leave empty or don't set - will use node:22-bookworm
DAYTONA_TEMPLATE_ID=
```

## Manual Template Creation (Alternative)

If you prefer to create the template manually instead of using Docker:

### Step 1: Create a New Next.js Project

```bash
# Create a new Next.js project with TypeScript and Tailwind
npx create-next-app@latest nextjs-template --typescript --tailwind --eslint --app --src-dir=false

cd nextjs-template
```

### Step 2: Initialize shadcn/ui

```bash
# Initialize shadcn/ui with default configuration
npx shadcn@latest init

# When prompted, select:
# - Style: Default
# - Base color: Slate
# - CSS variables: Yes
```

### Step 3: Install All shadcn/ui Components

```bash
# Install all shadcn/ui components at once
npx shadcn@latest add --all
```

### Step 4: Install Pre-bundled Packages

Install all the packages that will be pre-available in the template:

```bash
# UI Libraries
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Animation Libraries
pnpm add framer-motion gsap lottie-react

# Data/State Management
pnpm add @tanstack/react-query zustand zod react-hook-form @hookform/resolvers

# Utility Libraries
pnpm add date-fns axios lodash-es
```

## Pre-installed Packages Reference

The template includes the following packages pre-installed:

### Core Packages
- `next` - Next.js framework
- `react` / `react-dom` - React library
- `typescript` - TypeScript support
- `tailwindcss` / `postcss` / `autoprefixer` - Tailwind CSS

### UI Libraries (shadcn/ui + Radix)
- `@radix-ui/react-*` - All Radix UI primitives
- `class-variance-authority` - Component variants
- `clsx` - Conditional class names
- `tailwind-merge` - Tailwind class merging
- `lucide-react` - Icon library

### Animation Libraries
- `framer-motion` - React animation library
- `gsap` - GreenSock Animation Platform
- `lottie-react` - Lottie animations

### Data/State Management
- `@tanstack/react-query` - Data fetching and caching
- `zustand` - State management
- `zod` - Schema validation
- `react-hook-form` - Form handling
- `@hookform/resolvers` - Form validation resolvers

### Utility Libraries
- `date-fns` - Date utilities
- `axios` - HTTP client
- `lodash-es` - Utility functions

## Template File Structure

After creation, the template should have this structure:

```
nextjs-template/
├── app/
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Default home page
│   ├── globals.css         # Tailwind + shadcn styles
│   └── favicon.ico
├── components/
│   └── ui/                 # shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── form.tsx
│       ├── input.tsx
│       └── ... (all shadcn components)
├── lib/
│   └── utils.ts            # cn() utility for Tailwind
├── public/
├── node_modules/           # PRE-INSTALLED (key optimization)
├── package.json            # With all pre-installed deps
├── tailwind.config.ts
├── tsconfig.json
├── next.config.mjs
└── components.json         # shadcn configuration
```

## Updating the Template

When you need to add new packages to the template:

1. Clone the existing template
2. Install the new packages with `pnpm add`
3. Create a new template version
4. Update `DAYTONA_TEMPLATE_ID` in your environment

```bash
# Clone existing template
daytona clone <existing-template-id>

# Add new packages
pnpm add <new-package>

# Create new template version
daytona create environment nextjs-template-v2

# Update .env.local with new template ID
```

## Troubleshooting

### Template Not Found Error

If you see "Template not found" errors:
1. Verify `DAYTONA_TEMPLATE_ID` is set correctly in `.env.local`
2. Check that the template exists in your Daytona account
3. Ensure your `DAYTONA_API_KEY` has access to the template

### Slow Template Cloning

If template cloning takes longer than 5 seconds:
1. Check your network connection to Daytona
2. Verify the template region matches `DAYTONA_TARGET`
3. Consider creating a template in a closer region

### Missing Packages in Template

If a package is missing from the template:
1. The system will automatically install it via `pnpm add`
2. Consider adding frequently-used packages to the template
3. Update the template following the "Updating the Template" section

## Related Configuration

- `src/config/template.ts` - Template package configuration
- `src/services/template-service.ts` - Template cloning service
- `src/services/dependency-detector.ts` - Dependency detection from prompts

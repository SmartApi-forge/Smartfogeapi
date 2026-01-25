#!/bin/bash

# =============================================================================
# Daytona Template Setup Script
# =============================================================================
# This script creates a pre-built Next.js template with all dependencies
# pre-installed for fast project scaffolding in SmartAPIForge.
#
# Usage:
#   chmod +x scripts/setup-daytona-template.sh
#   ./scripts/setup-daytona-template.sh
#
# After running this script:
#   1. Push to Daytona: daytona create environment nextjs-template
#   2. Copy the template ID to your .env.local as DAYTONA_TEMPLATE_ID
# =============================================================================

set -e  # Exit on error

TEMPLATE_DIR="nextjs-template"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "=============================================="
echo "  Daytona Template Setup for SmartAPIForge"
echo "=============================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

if ! command -v pnpm &> /dev/null; then
    echo "⚠️  pnpm not found. Installing pnpm..."
    npm install -g pnpm
fi

echo "✅ Prerequisites OK"
echo ""

# Create template directory (outside current project)
TEMPLATE_PATH="$PROJECT_ROOT/../$TEMPLATE_DIR"

if [ -d "$TEMPLATE_PATH" ]; then
    echo "⚠️  Template directory already exists at $TEMPLATE_PATH"
    read -p "Do you want to delete it and start fresh? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$TEMPLATE_PATH"
    else
        echo "Exiting. Please remove the directory manually or choose a different location."
        exit 1
    fi
fi

echo "📁 Creating template at: $TEMPLATE_PATH"
echo ""

# Step 1: Create Next.js project
echo "Step 1/5: Creating Next.js project..."
cd "$PROJECT_ROOT/.."
npx create-next-app@latest "$TEMPLATE_DIR" \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --src-dir=false \
    --import-alias="@/*" \
    --use-pnpm \
    --no-git

cd "$TEMPLATE_PATH"
echo "✅ Next.js project created"
echo ""

# Step 2: Initialize shadcn/ui
echo "Step 2/5: Initializing shadcn/ui..."
# Create components.json for shadcn
cat > components.json << 'EOF'
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
EOF

# Create lib/utils.ts for shadcn
mkdir -p lib
cat > lib/utils.ts << 'EOF'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
EOF

echo "✅ shadcn/ui initialized"
echo ""

# Step 3: Install all shadcn components
echo "Step 3/5: Installing shadcn/ui components..."
npx shadcn@latest add --all --yes
echo "✅ shadcn/ui components installed"
echo ""

# Step 4: Install pre-bundled packages
echo "Step 4/5: Installing pre-bundled packages..."

# UI Libraries
echo "  Installing UI libraries..."
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Animation Libraries
echo "  Installing animation libraries..."
pnpm add framer-motion gsap lottie-react

# Data/State Management
echo "  Installing data/state libraries..."
pnpm add @tanstack/react-query zustand zod react-hook-form @hookform/resolvers

# Utility Libraries
echo "  Installing utility libraries..."
pnpm add date-fns axios lodash-es

# Types for lodash
pnpm add -D @types/lodash-es

echo "✅ All packages installed"
echo ""

# Step 5: Update globals.css with shadcn styles
echo "Step 5/5: Configuring styles..."
cat > app/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
    --chart-1: 12 76% 61%;
    --chart-2: 173 58% 39%;
    --chart-3: 197 37% 24%;
    --chart-4: 43 74% 66%;
    --chart-5: 27 87% 67%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
    --chart-1: 220 70% 50%;
    --chart-2: 160 60% 45%;
    --chart-3: 30 80% 55%;
    --chart-4: 280 65% 60%;
    --chart-5: 340 75% 55%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
EOF

echo "✅ Styles configured"
echo ""

# Create a simple placeholder page
cat > app/page.tsx << 'EOF'
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold">SmartAPIForge Template</h1>
      <p className="mt-4 text-muted-foreground">
        This is a pre-built template with all dependencies installed.
      </p>
    </main>
  );
}
EOF

# Summary
echo "=============================================="
echo "  ✅ Template Setup Complete!"
echo "=============================================="
echo ""
echo "Template created at: $TEMPLATE_PATH"
echo ""
echo "Installed packages:"
echo "  UI: shadcn/ui, lucide-react, class-variance-authority, clsx, tailwind-merge"
echo "  Animation: framer-motion, gsap, lottie-react"
echo "  Data/State: @tanstack/react-query, zustand, zod, react-hook-form"
echo "  Utilities: date-fns, axios, lodash-es"
echo ""
echo "Next steps:"
echo "  1. cd $TEMPLATE_PATH"
echo "  2. daytona create environment nextjs-template"
echo "  3. Copy the template ID to your .env.local:"
echo "     DAYTONA_TEMPLATE_ID=<template-id>"
echo ""
echo "=============================================="

# =============================================================================
# Daytona Template Setup Script (PowerShell)
# =============================================================================
# This script creates a pre-built Next.js template with all dependencies
# pre-installed for fast project scaffolding in SmartAPIForge.
#
# Usage:
#   .\scripts\setup-daytona-template.ps1
#
# After running this script:
#   1. Push to Daytona: daytona create environment nextjs-template
#   2. Copy the template ID to your .env.local as DAYTONA_TEMPLATE_ID
# =============================================================================

$ErrorActionPreference = "Stop"

$TEMPLATE_DIR = "nextjs-template"
$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_ROOT = Split-Path -Parent $SCRIPT_DIR

Write-Host "=============================================="
Write-Host "  Daytona Template Setup for SmartAPIForge"
Write-Host "=============================================="
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..."

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host "X Node.js is not installed. Please install Node.js 18+ first." -ForegroundColor Red
    exit 1
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host "Warning: pnpm not found. Installing pnpm..." -ForegroundColor Yellow
    npm install -g pnpm
}

Write-Host "OK Prerequisites OK" -ForegroundColor Green
Write-Host ""

# Create template directory (outside current project)
$TEMPLATE_PATH = Join-Path (Split-Path -Parent $PROJECT_ROOT) $TEMPLATE_DIR

if (Test-Path $TEMPLATE_PATH) {
    Write-Host "Warning: Template directory already exists at $TEMPLATE_PATH" -ForegroundColor Yellow
    $response = Read-Host "Do you want to delete it and start fresh? (y/N)"
    if ($response -eq 'y' -or $response -eq 'Y') {
        Remove-Item -Recurse -Force $TEMPLATE_PATH
    } else {
        Write-Host "Exiting. Please remove the directory manually or choose a different location."
        exit 1
    }
}

Write-Host "Creating template at: $TEMPLATE_PATH"
Write-Host ""

# Step 1: Create Next.js project
Write-Host "Step 1/5: Creating Next.js project..."
Set-Location (Split-Path -Parent $PROJECT_ROOT)
npx create-next-app@latest $TEMPLATE_DIR `
    --typescript `
    --tailwind `
    --eslint `
    --app `
    --src-dir=false `
    --import-alias="@/*" `
    --use-pnpm `
    --no-git

Set-Location $TEMPLATE_PATH
Write-Host "OK Next.js project created" -ForegroundColor Green
Write-Host ""

# Step 2: Initialize shadcn/ui
Write-Host "Step 2/5: Initializing shadcn/ui..."

# Create components.json for shadcn
$componentsJson = @'
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
'@
$componentsJson | Out-File -FilePath "components.json" -Encoding utf8

# Create lib/utils.ts for shadcn
New-Item -ItemType Directory -Force -Path "lib" | Out-Null
$utilsTs = @'
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
'@
$utilsTs | Out-File -FilePath "lib/utils.ts" -Encoding utf8

Write-Host "OK shadcn/ui initialized" -ForegroundColor Green
Write-Host ""

# Step 3: Install all shadcn components
Write-Host "Step 3/5: Installing shadcn/ui components..."
npx shadcn@latest add --all --yes
Write-Host "OK shadcn/ui components installed" -ForegroundColor Green
Write-Host ""

# Step 4: Install pre-bundled packages
Write-Host "Step 4/5: Installing pre-bundled packages..."

# UI Libraries
Write-Host "  Installing UI libraries..."
pnpm add class-variance-authority clsx tailwind-merge lucide-react

# Animation Libraries
Write-Host "  Installing animation libraries..."
pnpm add framer-motion gsap lottie-react

# Data/State Management
Write-Host "  Installing data/state libraries..."
pnpm add @tanstack/react-query zustand zod react-hook-form @hookform/resolvers

# Utility Libraries
Write-Host "  Installing utility libraries..."
pnpm add date-fns axios lodash-es

# Types for lodash
pnpm add -D @types/lodash-es

Write-Host "OK All packages installed" -ForegroundColor Green
Write-Host ""

# Step 5: Update globals.css with shadcn styles
Write-Host "Step 5/5: Configuring styles..."
$globalsCss = @'
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
'@
$globalsCss | Out-File -FilePath "app/globals.css" -Encoding utf8

Write-Host "OK Styles configured" -ForegroundColor Green
Write-Host ""

# Create a simple placeholder page
$pageTsx = @'
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
'@
$pageTsx | Out-File -FilePath "app/page.tsx" -Encoding utf8

# Summary
Write-Host "=============================================="
Write-Host "  OK Template Setup Complete!" -ForegroundColor Green
Write-Host "=============================================="
Write-Host ""
Write-Host "Template created at: $TEMPLATE_PATH"
Write-Host ""
Write-Host "Installed packages:"
Write-Host "  UI: shadcn/ui, lucide-react, class-variance-authority, clsx, tailwind-merge"
Write-Host "  Animation: framer-motion, gsap, lottie-react"
Write-Host "  Data/State: @tanstack/react-query, zustand, zod, react-hook-form"
Write-Host "  Utilities: date-fns, axios, lodash-es"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. cd $TEMPLATE_PATH"
Write-Host "  2. daytona create environment nextjs-template"
Write-Host "  3. Copy the template ID to your .env.local:"
Write-Host "     DAYTONA_TEMPLATE_ID=<template-id>"
Write-Host ""
Write-Host "=============================================="

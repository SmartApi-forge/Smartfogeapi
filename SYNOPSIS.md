# SmartAPIForge — Project Synopsis

## Overview

**SmartAPIForge** is an AI-powered platform that transforms plain-language prompts into production-ready REST APIs in under 60 seconds. Unlike UI-first generators, SmartAPIForge is **API-first**, emphasizing OpenAPI compliance, automated testing, and secure sandbox execution.

The platform enables developers to describe their API requirements in natural language and receive a fully functional, deployed API with documentation—eliminating the tedious boilerplate work of setting up endpoints, validation, and infrastructure.

---

## Core Value Proposition

> *"Describe your API in plain English → Get a live, documented, tested REST API in under a minute."*

- **Input**: Natural language prompt describing API requirements
- **Output**: OpenAPI 3.1 spec, scaffolded code (FastAPI/Express), auto-generated tests, Swagger docs, and a live deployed URL

---

## Technology Stack

| Layer | Technology | Description |
|-------|------------|-------------|
| **Frontend** | Next.js 15, React 19, Tailwind CSS 4 | Modern React framework with App Router, Server Components, and utility-first styling |
| **UI Components** | shadcn/ui, Radix UI, Lucide Icons | Accessible, customizable component library built on Radix primitives |
| **Authentication** | Supabase Auth (Email Magic-Link) | Passwordless authentication with JWT tokens and session management |
| **Database** | Supabase Postgres (with RLS) | Managed PostgreSQL with Row-Level Security for multi-tenant data isolation |
| **API Layer** | tRPC + Zod | End-to-end type-safe API calls with runtime validation |
| **Background Jobs** | Inngest | Event-driven workflow orchestration with automatic retries and step functions |
| **AI Inference** | OpenAI GPT-4o | Advanced language model for code generation, decision-making, and context understanding |
| **Code Sandbox** | Daytona Cloud Workspaces | Secure, isolated cloud development environments with 4 vCPU, 8GB RAM per workspace |
| **Deployment** | Vercel (Platforms API) | Serverless deployment with instant preview URLs and production hosting |
| **Version Control** | GitHub Integration (Octokit) | Repository cloning, syncing, and commit management |
| **State Management** | React Query + Zustand | Server state caching and client-side state management |
| **Code Editor** | Monaco Editor | VS Code-powered in-browser code editing experience |

---

## Key Features

### 1. Two-Agent AI Architecture
SmartAPIForge uses a sophisticated two-agent system:
- **Decision Agent**: Analyzes user intent, classifies requests, and creates execution plans
- **Coding Agent**: Generates, modifies, or refactors code based on the decision agent's plan

This separation ensures better context understanding and more accurate code generation.

### 2. Smart Context Management
The platform intelligently manages context by:
- Analyzing project structure and detecting frameworks (Next.js, React, Vue, etc.)
- Identifying relevant files based on user prompts using semantic search
- Extracting import patterns and coding conventions from existing code
- Building optimized prompts that include only necessary context

### 3. Real-Time Streaming
- **SSE (Server-Sent Events)** for live progress updates
- Chunk-by-chunk code streaming with typing animation
- Step-by-step workflow visibility (Planning → Generating → Validating → Deploying)

### 4. GitHub Integration
- Clone and analyze existing repositories
- Detect project framework and package manager automatically
- Modify existing codebases without breaking changes
- Sync changes back to GitHub

### 5. Daytona Cloud Sandboxes
Each project runs in an isolated Daytona workspace featuring:
- **4 vCPU, 8GB RAM, 10GB storage** per workspace
- Node.js 22 with full tooling support
- Public preview URLs for live testing
- Auto-stop after 30 minutes of inactivity (cost optimization)
- File system access, terminal execution, and process management

### 6. One-Click Vercel Deployment
- Automatic project creation on Vercel
- File upload and build triggering
- Real-time deployment status streaming
- Production and preview environment support

### 7. Version Management
- Automatic versioning of all code changes
- Rollback capability to any previous version
- Diff viewing between versions

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Layer                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Dashboard   │  │  Monaco      │  │  Live        │          │
│  │  (React 19)  │  │  Editor      │  │  Preview     │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
└─────────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Application Layer                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │           Next.js 15 App Router (RSC + tRPC)             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Services Layer                              │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ Two-Agent      │  │ Smart Context  │  │ Version        │    │
│  │ Orchestrator   │  │ Builder        │  │ Manager        │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐    │
│  │ GitHub Repo    │  │ Streaming      │  │ Code           │    │
│  │ Service        │  │ Service        │  │ Validator      │    │
│  └────────────────┘  └────────────────┘  └────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Infrastructure Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Supabase    │  │  Inngest     │  │  OpenAI      │          │
│  │  (DB+Auth)   │  │  (Jobs)      │  │  (GPT-4o)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │  Daytona     │  │  Vercel      │                             │
│  │  (Sandbox)   │  │  (Deploy)    │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Generation Workflow

The API generation process follows these steps:

### Step 1: Request Analysis
- User submits a natural language prompt
- **Decision Agent** analyzes intent and classifies the request type:
  - `create_mode`: New file/component creation
  - `modify_mode`: Editing existing files
  - `link_mode`: Creating and linking new components
  - `question_mode`: Answering questions about code

### Step 2: Context Building
- **Smart Context Builder** gathers relevant project information:
  - Scans project structure and identifies framework
  - Uses semantic search to find related files
  - Extracts coding patterns and conventions
  - Builds an optimized prompt with necessary context

### Step 3: Code Generation
- **Coding Agent** generates code using GPT-4o with streaming
- Code is validated for:
  - Missing imports (auto-fixed)
  - Syntax errors
  - Duplicate file detection (reconciled automatically)

### Step 4: Sandbox Execution
- Code is written to a **Daytona workspace**
- Dependencies are installed
- Preview server is started
- Tests are executed (if applicable)

### Step 5: Deployment (Optional)
- Files are uploaded to **Vercel**
- Build process is triggered
- Live URL is returned to user

---

## Project Structure

```
SmartAPIForge/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # REST API endpoints (deploy, sandbox, etc.)
│   ├── ask/               # Main generation interface
│   ├── projects/          # Project management pages
│   └── layout.tsx         # Root layout with providers
├── components/             # React UI components (112 components)
│   ├── ui/                # shadcn/ui base components
│   └── *.tsx              # Feature-specific components
├── hooks/                  # Custom React hooks
├── lib/                    # Utility libraries
│   ├── daytona-client.ts  # Daytona SDK wrapper
│   └── vercel-client.ts   # Vercel API client
├── src/
│   ├── inngest/           # Background job definitions
│   ├── modules/           # Feature modules (auth, messages, etc.)
│   ├── prompts/           # AI prompt templates
│   ├── services/          # Business logic services
│   │   ├── two-agent-orchestrator.ts
│   │   ├── decision-agent.ts
│   │   ├── smart-context-builder.ts
│   │   ├── code-validator.ts
│   │   └── streaming-service.ts
│   └── trpc/              # tRPC routers and procedures
├── supabase/               # Database migrations (21 migration files)
├── docs/                   # Documentation
└── public/                 # Static assets
```

---

## Database Schema (Key Tables)

| Table | Purpose |
|-------|---------|
| `users` | User accounts and profiles |
| `projects` | API projects with metadata |
| `versions` | Code version history |
| `messages` | Chat/prompt history |
| `jobs` | Background job tracking |
| `user_integrations` | GitHub/Vercel OAuth tokens |
| `github_repos` | Linked GitHub repositories |

All tables use **Row-Level Security (RLS)** to ensure users can only access their own data.

---
## Security Features

- **Row-Level Security (RLS)** on all Supabase tables
- **JWT-based authentication** with Supabase Auth
- **Isolated sandboxes** — each user's code runs in separate Daytona workspaces
- **Input validation** with Zod on all API endpoints
- **OAuth token encryption** for GitHub/Vercel integrations

---

## Performance Characteristics

| Metric | Typical Value |
|--------|---------------|
| Prompt → First code chunk | ~2-3 seconds |
| Full generation (simple API) | ~15-30 seconds |
| Sandbox creation | ~5-10 seconds |
| Vercel deployment | ~30-60 seconds |
| Database query latency | <50ms |

---


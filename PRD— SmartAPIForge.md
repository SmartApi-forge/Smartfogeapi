# Product Requirements Document (PRD) — SmartAPIForge

*(Supabase Auth, Supabase-first data plane — 27 Aug 2025)*

***

## 1 · Detailed Project Overview

### 1.1 Product Vision

SmartAPIForge turns a plain-language prompt into a production-ready REST API—specification, code, tests, docs, and live URL—in under a minute. Unlike UI-first generators (e.g., v0.dev) it is **API-first**, emphasising OpenAPI compliance, automated testing, and secure sandbox execution.

### 1.2 Primary Goals

1. Convert requirements → OpenAPI 3.1 contract in ≤ 10 s.
2. Scaffold FastAPI / Express code inside isolated micro-VMs.
3. Auto-generate unit + integration tests; run them in background jobs.
4. One-click deploy to Vercel (serverless) with live Swagger docs.
5. Operate entirely on free / freemium tiers to remove cost barriers.

### 1.3 Business Objectives

| KPI | Year-1 Target | Rationale |
| :-- | :-- | :-- |
| Monthly active projects | **5 000** | Supabase free tier supports 50 000 users. |
| APIs generated per day | **800** | Within Inngest free-tier event limits. |
| P95 prompt → live URL | **≤ 60 s** | Matches best-in-class agentic builders. |
| 7-day onboarding churn | **≤ 20%** | Indicates clear early value. |

### 1.4 Success Metrics

1. Generation success ≥ 95% (tests pass, spec valid).
2. 0 confirmed sandbox escapes.
3. OpenAPI validation error rate ≤ 3%.

***

## 2 · Technical Specifications

### 2.1 Core Architecture (Supabase-First Fast Path)

| Layer | Primary Choice | Why It’s Fast | Secondary / Fallback |
| :-- | :-- | :-- | :-- |
| Front-end | Next.js 15 + React 19 + Tailwind 4 | RSC/SSR, instant UI prototyping | — |
| **Auth** | **Supabase Auth (Email Magic-Link)** | Same Postgres origin, setup in seconds, <150 ms edge latency | Add OAuth providers via Supabase Social Logins |
| Database + Realtime | **Supabase Postgres** | Instant REST, GraphQL \& realtime channels | Prisma ORM on Neon |
| API Layer | tRPC + Zod | End-to-end type safety, ≈0 ms serialisation | Custom REST |
| Background Jobs | Inngest | Event → job < 100 ms, automatic retries | BullMQ |
| AI Inference | Ollama (Llama 3 / Mistral 7B) | Local, sub-6 s inference | Hugging Face API |
| Code Sandbox | E2B Firecracker micro-VM | Cold start < 3 s, full FS + terminal | Northflank micro-VM |
| Deployment | Vercel Hobby | Build → URL < 30 s | Fly.io Machines |
| Observability | Prometheus / Grafana / Loki | Open-source, real-time | Uptime Kuma |

**Database Strategy**

- Use Supabase for all MVP tables; instant REST endpoints + realtime.
- When `advanced=true` flag is present in prompt, agent also writes `schema.prisma`; an E2B step runs `prisma migrate dev` against the same Supabase Postgres (or Neon) for advanced relational logic.


### 2.2 Module Breakdown

| Layer | Main Responsibility | Library / Service |
| :-- | :-- | :-- |
| Prompt Processor | Parse intent, select template | LangChain + Zod |
| Spec Generator | Emit OpenAPI 3.1 YAML | openapi-ts, swagger-parser |
| Code Scaffolder | Create FastAPI / Express repo | Cookiecutter-fastapi, Hygen |
| Sandbox Runner | Install deps, lint, test, dockerise | **E2B SDK** |
| Job Orchestrator | Multi-step workflow, retries | **Inngest** |
| Deployment Adapter | Push container, return URLs | Vercel CLI |
| Auth Service | Email magic-link issue + JWT verify | **Supabase Auth JS SDK** |
| Monitoring | Metrics + dashboards | Prometheus + Grafana |

### 2.3 Security \& Compliance

- Firecracker micro-VM isolation with seccomp.
- Supabase Auth JWT keys rotated quarterly.
- ESLint + Prettier + Dependabot scaffolded by default.
- Row-Level-Security (RLS) on all Supabase tables.
- SOC-2-ready enterprise runtime via CodeSandbox.


### 2.4 Performance Targets

- Prompt → Live API **P95 ≤ 60 s**
- Sandbox cold start ≤ 3 s, warm ≤ 1 s
- LLM inference ≤ 6 s (Mistral-7B Q4_K_M)
- Supabase query latency ≤ 30 ms (edge)
- Inngest job trigger ≤ 100 ms

***

## 3 · User Stories

*(unchanged – see original table)*

***

## 4 · Fallback Options

| Failure Scenario | Primary Behaviour | Fallback Mechanism | User Impact |
| :-- | :-- | :-- | :-- |
| Supabase quota exhausted | Read-only mode | Switch runtime to Prisma + Neon | Brief write freeze; user prompted to upgrade |
| LLM timeout | Local Ollama | Hugging Face API | Slight latency increase |
| Sandbox boot error | E2B micro-VM | Northflank micro-VM | Job delayed |


***

## 5 · Assumptions \& Dependencies

1. Supabase (DB + Auth) free tier meets < 30 ms edge latency.
2. Local LLM inference sufficient for majority of workloads.
3. Prisma client loaded only when `advanced=true`.

***

## Appendix A — Local Dev Quick-Start

```bash
# 1 Supabase dev stack
supabase start  # launches Postgres + Auth locally

# 2 Run Ollama LLM
ollama run mistral:7b

# 3 Next.js + tRPC
pnpm dev          # http://localhost:3000

# 4 Inngest worker
pnpm dev:inngest  # local dashboard on :8288
```

Sample email-magic-link sign-in:

```ts
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

await supabase.auth.signInWithOtp({ email: 'alice@example.com' })
```


***

## Appendix B — Generation Workflow (Simplified)

1. **POST /generate** → store prompt in `jobs`; emit `GENERATE_API`.
2. **Inngest workflow**
a. LLM ⇒ spec + starter code.
b. Supabase SQL executes schema.
c. *(advanced)* write `schema.prisma`, run migrate in E2B.
d. Tests pass ⇒ Vercel deploy.
3. Store URLs in `projects`; WebSocket `/ws/jobs/:id` streams progress.

***



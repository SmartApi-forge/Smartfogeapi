# Product Requirements Document (PRD) — SmartAPIForge

# Product Requirements Document (PRD) — SmartAPIForge

Before development begins, this document establishes a single source of truth for all stakeholders. It outlines the product vision, architecture, key features, technical choices, user flows, fallback strategies, and known constraints.

## 1. Detailed Project Overview

### 1.1 Product Vision

SmartAPIForge enables developers to generate, test, and deploy production-ready REST APIs from natural-language prompts. Unlike full-stack site builders that focus on UI generation (e.g., v0.dev, Loveable.dev), SmartAPIForge is **API-first**, prioritising specification compliance, automated testing, and secure code execution[1](about:blank#fn1)[2](about:blank#fn2).

### 1.2 Primary Goals

- Convert high-level requirements into OpenAPI 3.1 contracts in seconds.
- Scaffold backend code (FastAPI or Express) inside an isolated sandbox, pre-configured for linting, CI, and containerisation[3](about:blank#fn3)[4](about:blank#fn4).
- Auto-generate unit, integration, and contract tests with a background job system so users never wait in the UI[5](about:blank#fn5)[6](about:blank#fn6).
- Provide live preview endpoints, Swagger UI docs, and one-click deployment to a free-tier host (Vercel or Fly.io)[7](about:blank#fn7)[8](about:blank#fn8).
- Keep 100% of the stack free or freemium to ensure zero barrier to entry for students, freelancers, and early-stage startups[9](about:blank#fn9)[10](about:blank#fn10).

### 1.3 Business Objectives

| KPI | Year-1 Target | Rationale |
| --- | --- | --- |
| Monthly Active Projects | 5 000 | Supabase free tier supports up to 50 000 users[11](about:blank#fn11). |
| CI-generated APIs / day | 800 | Based on Inngest free tier limits[12](about:blank#fn12). |
| Median API generation time | < 40 s | Matches Antonio’s benchmark for agentic builders[13](about:blank#fn13). |
| On-boarding churn (7 day) | < 20% | High early retention indicates clear value. |

### 1.4 Success Metrics

1. **Generation Success Rate** ≥ 95% (no syntax or test failures).
2. **Sandbox Security Escapes** = 0 confirmed incidents.
3. **OpenAPI Validation Errors** ≤ 3% across all generated specs.

## 2. Technical Specifications

### 2.1 Core Architecture

- **Frontend:** Next.js 15 + React 19 + TypeScript.
- **Auth:** Clerk free tier; optional Supabase Auth fallback[14](about:blank#fn14).
- **Backend Jobs:** Event-driven orchestrator (Inngest) triggers multi-step functions for code generation, testing, and deployment[15](about:blank#fn15)[16](about:blank#fn16).
- **Code Execution:** E2B microVM sandboxes spun up on-demand (< 1 s P95)[17](about:blank#fn17)[18](about:blank#fn18)[19](about:blank#fn19).
- **Database:** Supabase Postgres (500 MB free), with Row Level Security templates.
- **AI Models:** Local inference via Ollama running Llama 3 8B and Mistral 7B; optional self-hosted LocalAI or vLLM for GPU clusters[20](about:blank#fn20)[21](about:blank#fn21)[22](about:blank#fn22).
- **Observability:** Prometheus + Grafana stack for metrics; Loki for logs[23](about:blank#fn23)[24](about:blank#fn24).
- **Docs & Try-It:** Swagger UI or Redocly generated from the spec[25](about:blank#fn25).
- **Deployment Targets:**
    - Primary: Vercel serverless (100 GB bandwidth free).
    - Secondary: Fly.io or Railway for containerised APIs[26](about:blank#fn26)[27](about:blank#fn27).

![SmartAPIForge system architecture overview](https://user-gen-media-assets.s3.amazonaws.com/gpt4o_images/1687a7d2-eafd-4abb-ad15-4eec9acae417.png)

SmartAPIForge system architecture overview

SmartAPIForge system architecture overview

### 2.2 Module Breakdown

| Layer | Responsibilities | Main Libraries | Secondary Options |
| --- | --- | --- | --- |
| **Prompt Processor** | Parse user intent, select templates, invoke LLM | LangChain, Zod validation | PromptLayer |
| **Spec Generator** | Emit OpenAPI YAML, ensure schema completeness | OpenAPI-TS, swagger-parser | Stoplight Spectral |
| **Code Scaffolder** | Create FastAPI/Express files, add tests | Cookiecutter-fastapi, Hygen | Yeoman |
| **Sandbox Runner** | Install dependencies, run tests, package Docker image | E2B SDK | Northflank microVMs[28](about:blank#fn28) |
| **Job Orchestrator** | Step execution, retries, failure hooks | Inngest Functions | BullMQ for Node workers[29](about:blank#fn29) |
| **Deployment Adapter** | Push image, configure env vars, expose URL | Vercel CLI, Docker API | Fly.io Machines |
| **Monitoring** | Collect metrics, show dashboards | Grafana, Prometheus | Uptime Kuma self-hosted |

### 2.3 Security & Compliance

- Container isolation via microVM (Firecracker) + seccomp policy[30](about:blank#fn30)[31](about:blank#fn31).
- All generated projects include ESLint, Prettier, and Dependabot.
- Rate limiting middleware (API Gateway) to prevent abuse[32](about:blank#fn32).
- Optional SOC 2-ready CodeSandbox runtime for enterprise workspaces[33](about:blank#fn33).

### 2.4 Performance Targets

- Sandbox cold start < 3 s, warm start < 1 s[34](about:blank#fn34)[35](about:blank#fn35).
- LLM response < 6 s on local Mistral-7B CPU quantised model[36](about:blank#fn36).
- End-to-end generation (spec → deployed URL) P95 < 60 s.

## 3. User Stories

| ID | Persona | “As a…” | “I want…” | “So that…” | Acceptance Criteria |
| --- | --- | --- | --- | --- | --- |
| US-01 | Solo Developer | import a CSV prompt and instantly receive an OpenAPI contract | I avoid writing boilerplate[37](about:blank#fn37) | Contract passes swagger-parser with zero errors |  |
| US-02 | Backend Lead | schedule nightly regeneration tests | ensure yesterday’s API still compiles and deploys | Failed tests trigger Slack alert via webhook |  |
| US-03 | QA Engineer | download the Postman collection | run regression suites in CI | Collection auto-updates on every revision tag |  |
| US-04 | DevOps | set custom Docker base image | satisfy on-prem security guidelines | Image digest validated; build succeeds locally |  |
| US-05 | Product Manager | view generation progress bar | know when documentation is ready for stakeholders | Progress updates every 5 s via Server-Sent Events |  |
| US-06 | Educator | switch to fully offline mode | teach in low-bandwidth classrooms | All AI calls route to local Ollama; no external HTTP |  |
| US-07 | Enterprise Admin | audit sandbox logs for escapes | maintain compliance | Logs retained 30 days; search filter by container ID |  |
| US-08 | API Consumer | read interactive docs | understand auth flow quickly | “Try It” executes against staging URL with valid JWT |  |

*(User personas derived from Postman and Pega persona guidance[38](about:blank#fn38)[39](about:blank#fn39)).*

## 4. Fallback Options

| Failure Scenario | Primary Behaviour | Fallback Mechanism | User Impact |
| --- | --- | --- | --- |
| LLM inference timeout | Ollama local model | Switch to cloud-based Hugging Face Inference API (free tier) with same prompt[40](about:blank#fn40) | Slightly higher latency |
| Sandbox boot error | E2B microVM | Retry on CodeSandbox VM or Northflank microVM[41](about:blank#fn41)[42](about:blank#fn42) | Seamless; job takes longer |
| Deployment API rate-limited | Vercel | Push to Fly.io (container) and return alternative preview URL[43](about:blank#fn43)[44](about:blank#fn44) | User sees different host but same functionality |
| OpenAPI validation fails | Auto-fix attempt via Spectral | Mark build “Needs Review”, attach diff patch, do not deploy | User edits and re-runs |
| Background job exceeds 60 s | Inngest auto-retry with exponential backoff[45](about:blank#fn45) | Persist message in DLQ (Redis) and notify Slack | Generation delayed but not lost |
| DB quota exhausted | Supabase | Temporarily redirect metadata storage to Neon free tier | No data loss, but performance may degrade |

## 5. Assumptions and Dependencies

### 5.1 Key Assumptions

1. All core services remain within free-tier quotas under projected Year-1 usage[46](about:blank#fn46)[47](about:blank#fn47).
2. Users accept local model performance trade-offs on CPU hardware[48](about:blank#fn48).
3. Supabase SLA is sufficient for prototype-to-MVP phases; critical enterprise users may self-host Postgres.
4. Most target developers understand Git workflows and can manage PRs generated by SmartAPIForge bots.

### 5.2 External Dependencies

| Category | Dependency | Risk | Mitigation |
| --- | --- | --- | --- |
| AI Inference | Llama 3 / Mistral weights | New licensing changes | Maintain fallback to Apache-2 models (DeepSeek-R1)[49](about:blank#fn49)[50](about:blank#fn50) |
| Sandbox Infra | E2B cloud credits | Credit exhaustion | Allow self-hosted microVM runner, document setup[51](about:blank#fn51) |
| Job Orchestration | Inngest free tier (100k events/mo) | Sudden pricing change | Abstract jobs behind adapter; support BullMQ[52](about:blank#fn52) |
| Hosting | Vercel policy updates | Ban on long-running routes | Provide Docker image deploy script for Fly.io |
| Documentation UI | Redocly OSS | Deprecation | Switch to Swagger-UI or DapperDox[53](about:blank#fn53)[54](about:blank#fn54) |
| Free Database | Supabase quota | Throttling | Automatically migrate to paid tier or Neon |

### 5.3 Technical Debt Charter

- Review dependency updates monthly; flag any security CVEs > 7.0 CVSS[55](about:blank#fn55).
- Group LLM-prompt templates in version-controlled registry to avoid drift[56](about:blank#fn56).
- Maintain idempotent migrations for all scaffolds; break changes only on major versions.

**End of PRD.** This document should be versioned in the `/docs` folder of the monorepo and updated ahead of each sprint planning session.

⁂

---

1. https://www.chatprd.ai/templates[↩︎](about:blank#fnref1)
2. https://zencoder.ai/blog/top-7-ai-code-generation-platforms[↩︎](about:blank#fnref2)
3. https://swagger.io/blog/code-first-vs-design-first-api/[↩︎](about:blank#fnref3)
4. https://developers.google.com/code-sandboxing/sandbox2/getting-started/sandbox-policy[↩︎](about:blank#fnref4)
5. https://apidog.com/blog/free-api-documentation-tools/[↩︎](about:blank#fnref5)
6. https://www.aha.io/roadmapping/guide/requirements-management/what-is-a-good-product-requirements-document-template[↩︎](about:blank#fnref6)
7. https://codesubmit.io/blog/ai-code-tools/[↩︎](about:blank#fnref7)
8. https://www.postman.com/api-first/[↩︎](about:blank#fnref8)
9. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref9)
10. https://www.postman.com/api-first/[↩︎](about:blank#fnref10)
11. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref11)
12. https://apidog.com/blog/free-api-documentation-tools/[↩︎](about:blank#fnref12)
13. https://apidog.com/blog/free-api-documentation-tools/[↩︎](about:blank#fnref13)
14. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref14)
15. https://apidog.com/blog/free-api-documentation-tools/[↩︎](about:blank#fnref15)
16. https://www.postman.com/api-documentation-tool/[↩︎](about:blank#fnref16)
17. https://developers.google.com/code-sandboxing/sandbox2/getting-started/sandbox-policy[↩︎](about:blank#fnref17)
18. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref18)
19. https://cloud.google.com/use-cases/ai-code-generation[↩︎](about:blank#fnref19)
20. https://apisyouwonthate.com/blog/a-developers-guide-to-api-design-first/[↩︎](about:blank#fnref20)
21. https://developers.google.com/code-sandboxing[↩︎](about:blank#fnref21)
22. https://www.reddit.com/r/node/comments/17mm2fk/pretty_open_source_api_documentation_generators/[↩︎](about:blank#fnref22)
23. https://www.smartsheet.com/content/free-product-requirements-document-template[↩︎](about:blank#fnref23)
24. https://www.pluralsight.com/resources/blog/software-development/generative-ai-code-generation-tools[↩︎](about:blank#fnref24)
25. https://blog.stoplight.io/api-first-vs-api-design-first-a-comprehensive-guide[↩︎](about:blank#fnref25)
26. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref26)
27. https://www.postman.com/api-first/[↩︎](about:blank#fnref27)
28. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref28)
29. https://codesandbox.io/blog/codesandbox-is-now-soc-2-compliant[↩︎](about:blank#fnref29)
30. https://daily.dev/blog/10-best-api-documentation-tools-2024[↩︎](about:blank#fnref30)
31. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref31)
32. https://storiesonboard.com/blog/generate-user-stories[↩︎](about:blank#fnref32)
33. https://www.linkedin.com/pulse/event-driven-background-jobs-system-design-guide-firoz-khan-xc0jc[↩︎](about:blank#fnref33)
34. https://developers.google.com/code-sandboxing/sandbox2/getting-started/sandbox-policy[↩︎](about:blank#fnref34)
35. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref35)
36. https://apisyouwonthate.com/blog/a-developers-guide-to-api-design-first/[↩︎](about:blank#fnref36)
37. https://www.together.ai/blog/code-sandbox[↩︎](about:blank#fnref37)
38. https://apitoolkit.io/blog/usercentric-api-documentation/[↩︎](about:blank#fnref38)
39. https://www.linkedin.com/pulse/how-map-user-stories-development-workflow-software-tool-yussuf[↩︎](about:blank#fnref39)
40. https://apisyouwonthate.com/blog/a-developers-guide-to-api-design-first/[↩︎](about:blank#fnref40)
41. https://developers.google.com/code-sandboxing/sandbox2/getting-started/sandbox-policy[↩︎](about:blank#fnref41)
42. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref42)
43. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref43)
44. https://www.postman.com/api-first/[↩︎](about:blank#fnref44)
45. https://apidog.com/blog/free-api-documentation-tools/[↩︎](about:blank#fnref45)
46. https://github.com/Automata-Labs-team/code-sandbox-mcp[↩︎](about:blank#fnref46)
47. https://www.postman.com/api-first/[↩︎](about:blank#fnref47)
48. https://apisyouwonthate.com/blog/a-developers-guide-to-api-design-first/[↩︎](about:blank#fnref48)
49. https://apisyouwonthate.com/blog/a-developers-guide-to-api-design-first/[↩︎](about:blank#fnref49)
50. https://www.reddit.com/r/node/comments/17mm2fk/pretty_open_source_api_documentation_generators/[↩︎](about:blank#fnref50)
51. https://www.perforce.com/blog/alm/how-write-product-requirements-document-prd[↩︎](about:blank#fnref51)
52. https://codesandbox.io/blog/codesandbox-is-now-soc-2-compliant[↩︎](about:blank#fnref52)
53. https://www.xamun.ai/custom-software-design-ai-agents/agentic-software-user-story-generator[↩︎](about:blank#fnref53)
54. https://blog.stoplight.io/api-first-vs-api-design-first-a-comprehensive-guide[↩︎](about:blank#fnref54)
55. https://dev.to/rajrathod/background-jobs-473j[↩︎](about:blank#fnref55)
56. https://northflank.com/blog/how-to-spin-up-a-secure-code-sandbox-and-microvm-in-seconds-with-northflank-firecracker-gvisor-kata-clh[↩︎](about:blank#fnref56)
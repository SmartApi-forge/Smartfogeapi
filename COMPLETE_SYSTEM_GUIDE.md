# 🚀 Complete SmartAPIForge AI System Guide

## **Your ACTUAL Use Case: API Generation & Integration Platform**

Users come to your platform to:
1. **Generate complete backend APIs** from scratch
2. **Integrate external APIs** (Stripe, SendGrid, OpenAI, etc.)
3. **Test APIs in real-time** with sandbox environments
4. **Fix bugs automatically** before deployment
5. **Clone GitHub projects** and modify them
6. **Create .env files** with credentials
7. **Deploy APIs** to production

**The two-agent system I built handles ALL of these scenarios**, not just UI linking!

---

## 🎯 **ALL Modes Supported** (Not Just Auth!)

### **1. API Generation Mode** 🔥
**User Request**: "Create a REST API for user management with PostgreSQL"

**Decision Agent Output**:
```json
{
  "intent": "GENERATE_API",
  "mode": "api_generation_mode",
  "tasks": [
    "1. CREATE: Complete API structure with routes, controllers, services",
    "2. CREATE: Database schema and migrations",
    "3. CREATE: Authentication middleware with JWT",
    "4. CREATE: Input validation with Zod",
    "5. CREATE: .env.example with all required variables",
    "6. CREATE: .env with generated secrets",
    "7. CREATE: Test suite for all endpoints",
    "8. CREATE: README with API documentation"
  ]
}
```

**Coding Agent Generates**:
- ✅ `src/routes/` - All API routes
- ✅ `src/controllers/` - Request handlers
- ✅ `src/services/` - Business logic
- ✅ `src/middleware/` - Auth, validation, error handling
- ✅ `src/models/` - Database models
- ✅ `.env.example` - Template with placeholders
- ✅ `.env` - Generated with secure secrets
- ✅ `tests/` - Complete test suite
- ✅ `README.md` - Full documentation

---

### **2. API Integration Mode** 🔌
**User Request**: "Add Stripe payments to my Express API"

**Decision Agent Output**:
```json
{
  "intent": "INTEGRATE_API",
  "mode": "api_integration_mode",
  "tasks": [
    "1. INSTALL: stripe npm package",
    "2. CREATE: src/services/stripe.service.ts with payment methods",
    "3. CREATE: src/routes/webhooks.routes.ts for Stripe events",
    "4. MODIFY: .env with STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET",
    "5. CREATE: tests/services/stripe.test.ts with mocks",
    "6. UPDATE: README with Stripe setup instructions"
  ]
}
```

**Coding Agent Generates**:
- ✅ Stripe service with checkout, subscriptions, webhooks
- ✅ Webhook handlers for all events
- ✅ Environment variables added to .env
- ✅ Mock tests for offline development
- ✅ Updated documentation

---

### **3. Bug Detection & Auto-Fix Mode** 🐛
**User Request**: "Check my code for bugs and fix them"

**Decision Agent Output**:
```json
{
  "intent": "BUG_DETECTION",
  "mode": "bug_detection_mode",
  "tasks": [
    "1. SCAN: TypeScript type errors",
    "2. SCAN: Security vulnerabilities (SQL injection, XSS, exposed secrets)",
    "3. SCAN: Memory leaks (event listeners, timers)",
    "4. SCAN: Performance issues (unnecessary re-renders)",
    "5. AUTO-FIX: Safe issues (type errors, linting)",
    "6. SUGGEST: Complex issues (logic bugs)"
  ]
}
```

**Coding Agent Detects & Fixes**:
- ✅ Type errors → Adds proper types
- ✅ SQL injection → Parameterized queries
- ✅ Exposed API keys → Moves to .env
- ✅ Memory leaks → Adds cleanup
- ✅ Missing error handling → Adds try/catch
- ✅ Performance issues → Adds useMemo/useCallback

---

### **4. Testing Mode** ✅
**User Request**: "Write tests for my user API"

**Decision Agent Output**:
```json
{
  "intent": "TESTING",
  "mode": "testing_mode",
  "tasks": [
    "1. CREATE: Integration tests for all endpoints",
    "2. CREATE: Unit tests for services and controllers",
    "3. CREATE: Test mocks for database and external APIs",
    "4. CREATE: jest.config.js with coverage requirements",
    "5. CREATE: tests/setup.ts for test environment",
    "6. VERIFY: 80%+ code coverage"
  ]
}
```

**Coding Agent Generates**:
- ✅ Integration tests for API endpoints
- ✅ Unit tests for business logic
- ✅ Mock data and factories
- ✅ Jest configuration
- ✅ Test setup and teardown
- ✅ Coverage reports

---

### **5. Environment Configuration Mode** ⚙️
**User Request**: "Create .env file with database and Stripe credentials"

**Decision Agent Output**:
```json
{
  "intent": "ENV_CONFIG",
  "mode": "environment_config_mode",
  "tasks": [
    "1. CREATE: .env.example with all required variables",
    "2. CREATE: .env with generated secrets",
    "3. GENERATE: Strong JWT secret (32+ chars)",
    "4. ADD: Database URL with PostgreSQL connection",
    "5. ADD: Stripe API keys placeholders",
    "6. ADD: Environment validation in src/config/env.ts",
    "7. UPDATE: .gitignore to exclude .env"
  ]
}
```

**Coding Agent Generates**:
```env
# .env.example
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
JWT_SECRET=your_jwt_secret_here
STRIPE_SECRET_KEY=sk_test_xxx
PORT=3000

# .env (actual values)
DATABASE_URL=postgresql://postgres:securepass123@localhost:5432/myapp
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6 # Generated
STRIPE_SECRET_KEY=sk_test_YOUR_ACTUAL_KEY
PORT=3000
```

---

### **6. Clone & Modify Mode** (GitHub Projects) 📦
**User Request**: "Clone https://github.com/user/api-repo and add rate limiting"

**Decision Agent Output**:
```json
{
  "intent": "MODIFY",
  "mode": "modify_mode",
  "isGitHubProject": true,
  "tasks": [
    "1. ANALYZE: Existing middleware structure",
    "2. CREATE: src/middleware/rate-limit.middleware.ts",
    "3. MODIFY: src/index.ts to apply rate limiting globally",
    "4. MODIFY: package.json to add express-rate-limit",
    "5. DO NOT: Create new files with duplicate names"
  ],
  "criticalReminders": [
    "🚨 CLONED PROJECT - ONLY modify existing files unless explicitly requested"
  ]
}
```

**Coding Agent Generates**:
- ✅ Rate limiting middleware
- ✅ Modifies main entry point
- ✅ Updates package.json
- ❌ Does NOT create duplicate files

---

### **7. Real-Time Testing Mode** 🧪
**User Request**: "Test my /api/users endpoint with sample data"

**Decision Agent Output**:
```json
{
  "intent": "TEST_EXECUTION",
  "mode": "testing_mode",
  "tasks": [
    "1. COMPILE: API code in sandbox environment",
    "2. START: Development server on random port",
    "3. EXECUTE: GET /api/users request",
    "4. EXECUTE: POST /api/users with test data",
    "5. VERIFY: Responses match expected format",
    "6. REPORT: Test results with status codes"
  ]
}
```

**System Executes**:
- ✅ Compiles code in Daytona workspace
- ✅ Starts server
- ✅ Runs actual HTTP requests
- ✅ Returns results: ✅ 200 OK, ❌ 500 Error
- ✅ Shows response bodies

---

### **8. Create + Link Mode** (UI Components) 🎨
**User Request**: "Create a signup form and link it to the signup button"

**Decision Agent Output**:
```json
{
  "intent": "CREATE_AND_LINK",
  "mode": "link_mode",
  "tasks": [
    "1. CREATE: components/signup-form.tsx",
    "2. FIND: app/page.tsx (contains signup button)",
    "3. MODIFY: app/page.tsx - Add import",
    "4. MODIFY: app/page.tsx - Add useState",
    "5. MODIFY: app/page.tsx - Wire onClick",
    "6. MODIFY: app/page.tsx - Add component to JSX"
  ]
}
```

---

### **9. Error Fix Mode** 🔧
**User Request**: "TypeError: useForm is not a function in LoginForm.tsx"

**Decision Agent Output**:
```json
{
  "intent": "FIX_ERROR",
  "mode": "error_fix_mode",
  "entities": {
    "errorFile": "LoginForm.tsx",
    "errorType": "TypeError",
    "errorMessage": "useForm is not a function"
  },
  "tasks": [
    "1. OPEN: components/login-form.tsx",
    "2. ADD: 'use client' as first line",
    "3. VERIFY: react-hook-form import is correct",
    "4. TEST: Component now works"
  ]
}
```

---

### **10. Question Mode** ❓
**User Request**: "How does authentication work in this API?"

**Decision Agent Output**:
```json
{
  "intent": "QUESTION",
  "mode": "question_mode",
  "tasks": [],
  "criticalReminders": [
    "🚨 DO NOT modify any files - just answer"
  ]
}
```

**Coding Agent Responds**:
- ✅ Explains auth flow
- ✅ Cites specific files
- ✅ Provides code examples
- ❌ Does NOT modify files

---

## 🔄 **How It All Works Together**

### Example: "Create a REST API with Stripe payments and deploy it"

**Step 1**: Decision Agent breaks it down:
```json
{
  "tasks": [
    "1. Generate complete REST API structure",
    "2. Integrate Stripe payments",
    "3. Create .env with credentials",
    "4. Add tests for all endpoints",
    "5. Check for bugs and fix",
    "6. Deploy to production"
  ]
}
```

**Step 2**: Coding Agent executes:
- Mode 1 (API Generation): Creates complete API
- Mode 2 (API Integration): Adds Stripe
- Mode 5 (Env Config): Creates .env files
- Mode 4 (Testing): Writes tests
- Mode 3 (Bug Detection): Scans and fixes
- Mode 6 (Deployment): Deploys to server

**Result**: Complete, tested, deployed API in 1-2 prompts!

---

## 📊 **Mode Selection Matrix**

| User Request Contains | Decision Agent Selects | Coding Agent Uses |
|-----------------------|------------------------|-------------------|
| "create API", "generate backend" | GENERATE_API | api_generation_mode |
| "add Stripe", "integrate OpenAI" | INTEGRATE_API | api_integration_mode |
| "fix bugs", "check for errors" | BUG_DETECTION | bug_detection_mode |
| "write tests", "test coverage" | TESTING | testing_mode |
| "create .env", "add credentials" | ENV_CONFIG | environment_config_mode |
| "create X and link to Y" | CREATE_AND_LINK | link_mode |
| "update", "modify", "change" | MODIFY | modify_mode |
| "TypeError", "fix error" | FIX_ERROR | error_fix_mode |
| "how does", "what is", "?" | QUESTION | question_mode |

---

## 🎯 **Integration with Your Existing System**

### Your Current `generate-api` Function:
Located in `src/inngest/functions.ts` - handles OpenAPI spec generation

**How Two-Agent System Enhances It**:

```typescript
// OLD: Single massive prompt for all scenarios
const completion = await openaiClient.chat.completions.create({
  messages: [{
    role: "system",
    content: `[3000 lines of mixed instructions]`
  }]
});

// NEW: Decision Agent → Mode Selection → Focused Coding Agent
const decisionResult = await DecisionAgent.analyze(prompt);
// → Returns: "api_generation_mode"

const result = await TwoAgentOrchestrator.execute(prompt, context, {
  mode: decisionResult.mode, // Uses api_generation_mode prompt (200 lines)
  tasks: decisionResult.tasks, // Step-by-step plan
  reminders: decisionResult.criticalReminders
});
```

### For Cloned GitHub Projects:
```typescript
if (projectInfo.isGitHubProject) {
  systemPrompt += `
  🚨 GITHUB PROJECT MODE
  - ONLY modify existing files
  - DO NOT create new files unless explicitly requested
  - Use exact file paths from context
  `;
}
```

---

## 🚀 **Why This Is Better Than Current System**

### Before (Your Current System):
```
User: "Create a REST API with Stripe and deploy it"
     ↓
[ Single 3000-line prompt tries to do everything ]
     ↓
❌ Only generates API structure
❌ Forgets Stripe integration
❌ Doesn't create .env
❌ No tests
❌ No deployment steps
→ User needs 10+ more prompts
```

### After (New Two-Agent System):
```
User: "Create a REST API with Stripe and deploy it"
     ↓
┌─────────────────────┐
│ Decision Agent      │
│ Breaks down:        │
│ 1. API generation   │
│ 2. Stripe integration│
│ 3. Environment setup│
│ 4. Testing          │
│ 5. Deployment       │
└─────────────────────┘
     ↓
┌─────────────────────┐
│ Coding Agent        │
│ Executes each step: │
│ ✅ Complete API     │
│ ✅ Stripe integrated│
│ ✅ .env created     │
│ ✅ Tests written    │
│ ✅ Ready to deploy  │
└─────────────────────┘
     ↓
✅ Complete in 1-2 prompts!
```

---

## 📁 **All Modes Available**

```
src/prompts/coding-agent/
├── base-rules.txt              # Core TypeScript/Next.js rules
├── api-generation-mode.txt     # Generate complete APIs ⭐
├── api-integration-mode.txt    # Integrate external APIs ⭐
├── bug-detection-mode.txt      # Auto-fix bugs ⭐
├── testing-mode.txt            # Write tests ⭐
├── create-mode.txt             # Create new components
├── modify-mode.txt             # Edit existing code
├── link-mode.txt               # Create + link UI components
├── error-fix-mode.txt          # Fix specific errors
└── question-mode.txt           # Answer questions
```

---

## 🎓 **Next Steps**

1. **Update Decision Agent** to recognize all modes ✅ (I'll do this next)
2. **Test Each Mode** with sample prompts
3. **Integrate with** your existing `generate-api` function
4. **Deploy** and monitor performance

---

**This is NOT just for auth - this handles EVERYTHING your users will ask for!** 🔥

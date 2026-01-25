/**
 * SmartAPIForge Documentation Content
 * Organized by category for improved navigation and SEO
 */

export interface DocSection {
  id: string
  title: string
  slug: string
  category: string
  content: string
  subsections?: DocSubsection[]
}

export interface DocSubsection {
  id: string
  title: string
  level: number
}

export const docsContent: DocSection[] = [
  {
    id: "introduction",
    title: "Introduction",
    slug: "introduction",
    category: "getting-started",
    content: `# Introduction

Welcome to SmartAPIForge - your AI-powered API development platform that transforms natural language into production-ready APIs.

## What is SmartAPIForge?

SmartAPIForge is an intelligent API development platform that leverages advanced AI to help developers, teams, and businesses build, test, and deploy APIs faster than ever before. By combining natural language processing with industry best practices, SmartAPIForge eliminates the repetitive work of API development while maintaining code quality and security standards.

### Core Capabilities

**AI-Powered Code Generation**: Describe your API requirements in plain English, and SmartAPIForge generates complete, production-ready endpoints with proper validation, error handling, and documentation.

**Intelligent Project Management**: Organize your APIs into projects with built-in version control, collaboration tools, and deployment pipelines. Each project maintains its own environment, dependencies, and configuration.

**Real-Time Development**: See your changes instantly with hot-reload development servers, live API testing, and interactive documentation that updates as you build.

**Enterprise-Grade Security**: Built-in authentication, authorization, rate limiting, and API key management ensure your APIs are secure from day one.

## Platform Features

### Smart Code Generation
- Natural language to API endpoint conversion
- Automatic TypeScript type generation
- Database schema inference and migration
- OpenAPI/Swagger documentation generation
- Unit and integration test creation

### Development Tools
- Interactive API playground for testing
- Real-time collaboration with team members
- Git integration for version control
- Environment variable management
- Deployment preview for pull requests

### Database Support
- PostgreSQL with advanced querying
- MongoDB for document storage
- MySQL compatibility
- Redis for caching and sessions
- Supabase integration for auth and storage

### Deployment Options
- One-click Vercel deployment
- AWS Lambda functions
- Docker containerization
- Custom server deployment
- Edge function support

## Who Uses SmartAPIForge?

### Startups & Founders
Build and validate your MVP in days instead of months. Focus on product-market fit while SmartAPIForge handles the technical infrastructure.

### Development Teams
Accelerate sprint velocity by 3-5x. Let AI handle boilerplate code while your team focuses on business logic and user experience.

### Enterprise Organizations
Maintain consistency across microservices, enforce security policies, and reduce technical debt with AI-generated, standardized code.

### Solo Developers
Ship side projects faster, monetize APIs quickly, and maintain multiple projects without getting overwhelmed by infrastructure management.

## Key Differentiators

**Context-Aware AI**: Unlike generic code generators, SmartAPIForge understands your entire project context, maintaining consistency across endpoints and following your established patterns.

**Production-Ready Output**: Every generated endpoint includes proper error handling, input validation, logging, and monitoring hooks - no cleanup required.

**Iterative Development**: Modify existing endpoints with natural language commands. SmartAPIForge understands your intent and updates code intelligently.

**Full Stack Integration**: Seamlessly connects with your frontend, database, authentication system, and third-party services.

## Getting Started

Ready to build your first API? Check out our [Quickstart Guide](/docs/getting-started/quick-start) to create your first project in under 5 minutes, or explore [AI Generation](/docs/features/ai-generation) to learn about our AI capabilities.`,
    subsections: [
      { id: "what-is-smartapiforge", title: "What is SmartAPIForge?", level: 2 },
      { id: "core-capabilities", title: "Core Capabilities", level: 3 },
      { id: "platform-features", title: "Platform Features", level: 2 },
      { id: "smart-code-generation", title: "Smart Code Generation", level: 3 },
      { id: "development-tools", title: "Development Tools", level: 3 },
      { id: "database-support", title: "Database Support", level: 3 },
      { id: "deployment-options", title: "Deployment Options", level: 3 },
      { id: "who-uses-smartapiforge", title: "Who Uses SmartAPIForge?", level: 2 },
      { id: "startups-founders", title: "Startups & Founders", level: 3 },
      { id: "development-teams", title: "Development Teams", level: 3 },
      { id: "enterprise-organizations", title: "Enterprise Organizations", level: 3 },
      { id: "solo-developers", title: "Solo Developers", level: 3 },
      { id: "key-differentiators", title: "Key Differentiators", level: 2 },
      { id: "getting-started", title: "Getting Started", level: 2 },
    ],
  },
  {
    id: "quick-start",
    title: "Quickstart",
    slug: "quick-start",
    category: "getting-started",
    content: `# Quickstart Guide

Get your first API up and running in under 5 minutes. This guide walks you through creating an account, starting a project, and generating your first API endpoint.

## Step 1: Create Your Account

Visit [SmartAPIForge](https://smartapiforge.com) and sign up using:
- Email and password
- GitHub OAuth
- Google OAuth

Once registered, you'll be redirected to your dashboard where you can manage all your API projects.

## Step 2: Create a New Project

From your dashboard:

1. Click the **"New Project"** button in the top navigation
2. Enter your project details:
   - **Project Name**: A descriptive name for your API
   - **Description**: What your API does (optional)
   - **Database**: Choose PostgreSQL, MongoDB, or MySQL
   - **Region**: Select the deployment region closest to your users

3. Click **"Create Project"**

SmartAPIForge will automatically set up:
- Project workspace with TypeScript configuration
- Database connection and schema management
- Authentication system with JWT tokens
- Environment variable management
- Git repository (if GitHub is connected)

## Step 3: Generate Your First Endpoint

In your project workspace, use the AI prompt to describe your endpoint:

**Example Prompt:**
\`\`\`
Create a user registration endpoint that accepts email and password,
validates the email format, hashes the password with bcrypt,
stores the user in the database, and returns a JWT token
\`\`\`

SmartAPIForge will generate:
- **Route Handler**: Complete endpoint logic with error handling
- **Validation Schema**: Zod schemas for request validation
- **Database Model**: Prisma/Mongoose model with proper types
- **Tests**: Unit and integration tests
- **Documentation**: OpenAPI specification

## Step 4: Review and Customize

The generated code appears in your editor. You can:
- Review the implementation
- Modify business logic
- Adjust validation rules
- Add custom middleware
- Update response formats

All changes are tracked in real-time with syntax highlighting and error detection.

## Step 5: Test Your Endpoint

Use the built-in API playground:

1. Click **"Test API"** in the toolbar
2. Select your endpoint from the list
3. Fill in the request body:
\`\`\`json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
\`\`\`
4. Click **"Send Request"**
5. View the response with status code, headers, and body

## Step 6: Deploy to Production

When you're ready to deploy:

### Option 1: Vercel (Recommended)
1. Click **"Deploy"** in the top navigation
2. Select **"Vercel"**
3. Authorize SmartAPIForge to access your Vercel account
4. Choose deployment settings
5. Click **"Deploy Now"**

Your API will be live at \`https://your-project.vercel.app\` in under 60 seconds.

### Option 2: Custom Server
1. Download your project code
2. Set up environment variables
3. Run \`npm run build\`
4. Deploy to your preferred hosting provider

## Step 7: Monitor and Iterate

After deployment:
- View real-time logs in the **"Logs"** tab
- Monitor API performance in **"Analytics"**
- Track errors in **"Error Tracking"**
- Manage API keys in **"Settings"**

## Common First Projects

### REST API for Mobile App
\`\`\`
Create endpoints for user authentication, profile management,
and data synchronization with offline support
\`\`\`

### Webhook Handler
\`\`\`
Build a webhook receiver for Stripe payments that validates
signatures, processes events, and updates order status
\`\`\`

### Data Aggregation API
\`\`\`
Create an API that fetches data from multiple sources,
aggregates results, caches responses, and returns JSON
\`\`\`

## Next Steps

Now that you have your first API running:

- **[AI Generation](/docs/features/ai-generation)**: Learn about AI-powered development tools
- **[Vercel Deployment](/docs/deployment/vercel)**: Deep dive into deployment options
- **[FAQ](/docs/troubleshooting/faq)**: Common questions and troubleshooting

## Need Help?

- Join our [Discord Community](https://discord.gg/smartapiforge)
- Check [GitHub Discussions](https://github.com/smartapiforge/discussions)
- Email support@smartapiforge.com`,
    subsections: [
      { id: "step-1-create-your-account", title: "Step 1: Create Your Account", level: 2 },
      { id: "step-2-create-a-new-project", title: "Step 2: Create a New Project", level: 2 },
      { id: "step-3-generate-your-first-endpoint", title: "Step 3: Generate Your First Endpoint", level: 2 },
      { id: "step-4-review-and-customize", title: "Step 4: Review and Customize", level: 2 },
      { id: "step-5-test-your-endpoint", title: "Step 5: Test Your Endpoint", level: 2 },
      { id: "step-6-deploy-to-production", title: "Step 6: Deploy to Production", level: 2 },
      { id: "option-1-vercel-recommended", title: "Option 1: Vercel (Recommended)", level: 3 },
      { id: "option-2-custom-server", title: "Option 2: Custom Server", level: 3 },
      { id: "step-7-monitor-and-iterate", title: "Step 7: Monitor and Iterate", level: 2 },
      { id: "common-first-projects", title: "Common First Projects", level: 2 },
      { id: "next-steps", title: "Next Steps", level: 2 },
      { id: "need-help", title: "Need Help?", level: 2 },
    ],
  },
  {
    id: "ai-generation",
    title: "AI Generation",
    slug: "ai-generation",
    category: "features",
    content: `# AI Generation

SmartAPIForge's AI agents work alongside you to accelerate development, improve code quality, and reduce bugs. These intelligent assistants understand context, learn from your patterns, and provide proactive suggestions.

## AI-Powered Code Generation

Transform natural language descriptions into production-ready API endpoints with full context awareness.

### How It Works

The AI agent analyzes your prompt and:
1. **Understands Intent**: Parses your requirements and identifies key components
2. **Checks Context**: Reviews your existing codebase for patterns and conventions
3. **Generates Code**: Creates endpoints that match your project's style
4. **Adds Tests**: Writes comprehensive test coverage automatically
5. **Creates Docs**: Generates OpenAPI specs and usage examples

### Example Prompts

**Simple Endpoint:**
\`\`\`
Create a GET endpoint that returns all active users
\`\`\`

**Complex Business Logic:**
\`\`\`
Build a payment processing endpoint that:
- Validates credit card details
- Calculates tax based on user location
- Processes payment through Stripe
- Sends confirmation email
- Updates order status in database
- Handles refunds and disputes
\`\`\`

**Database Operations:**
\`\`\`
Create CRUD endpoints for a blog post system with:
- Author relationships
- Tag filtering
- Full-text search
- Pagination
- Draft/published status
\`\`\`

### Generated Components

For each endpoint, SmartAPIForge creates:

**Route Handler** (\`/api/users/route.ts\`)
- Request validation
- Business logic
- Error handling
- Response formatting

**Type Definitions** (\`/types/user.ts\`)
- TypeScript interfaces
- Zod schemas
- API response types

**Database Models** (\`/models/user.ts\`)
- Prisma/Mongoose schemas
- Relationships
- Indexes
- Migrations

**Tests** (\`/tests/users.test.ts\`)
- Unit tests for logic
- Integration tests for endpoints
- Mock data generators

## Intelligent Code Completion

Real-time suggestions as you write code, with full awareness of your project structure.

### Context-Aware Suggestions

- **API Patterns**: Suggests endpoints that complement existing routes
- **Error Handling**: Recommends appropriate error codes and messages
- **Security**: Identifies missing authentication or validation
- **Performance**: Suggests caching, pagination, or optimization

### Auto-Complete Features

- Function signatures based on your database schema
- Import statements for required dependencies
- Middleware chains for common patterns
- Environment variable references

## Automated Testing Suite

Every generated endpoint includes comprehensive tests that cover edge cases and error scenarios.

### Test Coverage

**Unit Tests**
- Input validation for all parameters
- Business logic with mocked dependencies
- Error handling for each failure mode
- Edge cases (null, undefined, empty arrays)

**Integration Tests**
- Full request/response cycle
- Database transactions and rollbacks
- Authentication and authorization
- Rate limiting and throttling

**Performance Tests**
- Load testing with concurrent requests
- Response time benchmarks
- Memory leak detection
- Database query optimization

### Test Generation Example

For a user registration endpoint, SmartAPIForge generates:

\`\`\`typescript
describe('POST /api/auth/register', () => {
  it('creates user with valid data', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123!'
      })
    
    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('token')
  })

  it('rejects duplicate email', async () => {
    // Test implementation
  })

  it('validates password strength', async () => {
    // Test implementation
  })

  it('handles database errors gracefully', async () => {
    // Test implementation
  })
})
\`\`\`

## Code Review Agent

Continuous code analysis that identifies issues before they reach production.

### Security Analysis

- **SQL Injection**: Detects unsafe database queries
- **XSS Vulnerabilities**: Identifies unescaped user input
- **Authentication Flaws**: Finds missing auth checks
- **Data Exposure**: Warns about sensitive data in responses
- **Rate Limiting**: Suggests throttling for expensive operations

### Performance Optimization

- **N+1 Queries**: Identifies inefficient database access
- **Missing Indexes**: Suggests database indexes
- **Large Payloads**: Recommends pagination or compression
- **Blocking Operations**: Finds synchronous code that should be async
- **Memory Leaks**: Detects unclosed connections or listeners

### Code Quality

- **Naming Conventions**: Ensures consistent naming
- **Code Duplication**: Identifies repeated logic
- **Complexity**: Warns about overly complex functions
- **Type Safety**: Enforces TypeScript best practices
- **Documentation**: Suggests missing JSDoc comments

## Smart Refactoring

AI-assisted code improvements that maintain functionality while enhancing quality.

### Refactoring Capabilities

**Extract Function**: Automatically identifies code that should be extracted into reusable functions

**Optimize Queries**: Rewrites database queries for better performance

**Update Dependencies**: Suggests and applies dependency updates with compatibility checks

**Migrate Patterns**: Converts old patterns to modern best practices

### Example Refactoring

**Before:**
\`\`\`typescript
app.get('/api/users', async (req, res) => {
  const users = await db.user.findMany()
  res.json(users)
})
\`\`\`

**After (AI Refactored):**
\`\`\`typescript
app.get('/api/users', 
  authenticate,
  validateQuery(userQuerySchema),
  async (req, res) => {
    const { page = 1, limit = 10, search } = req.query
    
    const users = await db.user.findMany({
      where: search ? {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } }
        ]
      } : undefined,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    })
    
    const total = await db.user.count()
    
    res.json({
      data: users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })
  }
)
\`\`\`

## Documentation Generator

Automatically creates comprehensive, up-to-date API documentation.

### Generated Documentation

**OpenAPI/Swagger Specification**
- Complete API schema
- Request/response examples
- Authentication requirements
- Error codes and messages

**Interactive API Explorer**
- Try endpoints directly in browser
- Pre-filled example requests
- Real-time response viewing
- Authentication testing

**Code Examples**
- JavaScript/TypeScript
- Python
- cURL commands
- HTTP requests

**Integration Guides**
- Authentication setup
- Error handling
- Rate limiting
- Webhooks

## Continuous Learning

SmartAPIForge's AI improves over time by learning from your codebase and preferences.

### Personalization

- **Code Style**: Adapts to your formatting preferences
- **Naming Patterns**: Learns your naming conventions
- **Architecture**: Understands your project structure
- **Dependencies**: Remembers your preferred libraries

### Team Collaboration

- **Shared Patterns**: Team-wide code standards
- **Review History**: Learns from past code reviews
- **Best Practices**: Enforces team guidelines
- **Knowledge Base**: Builds internal documentation`,
    subsections: [
      { id: "ai-powered-code-generation", title: "AI-Powered Code Generation", level: 2 },
      { id: "how-it-works", title: "How It Works", level: 3 },
      { id: "example-prompts", title: "Example Prompts", level: 3 },
      { id: "generated-components", title: "Generated Components", level: 3 },
      { id: "intelligent-code-completion", title: "Intelligent Code Completion", level: 2 },
      { id: "context-aware-suggestions", title: "Context-Aware Suggestions", level: 3 },
      { id: "auto-complete-features", title: "Auto-Complete Features", level: 3 },
      { id: "automated-testing-suite", title: "Automated Testing Suite", level: 2 },
      { id: "test-coverage", title: "Test Coverage", level: 3 },
      { id: "test-generation-example", title: "Test Generation Example", level: 3 },
      { id: "code-review-agent", title: "Code Review Agent", level: 2 },
      { id: "security-analysis", title: "Security Analysis", level: 3 },
      { id: "performance-optimization", title: "Performance Optimization", level: 3 },
      { id: "code-quality", title: "Code Quality", level: 3 },
      { id: "smart-refactoring", title: "Smart Refactoring", level: 2 },
      { id: "refactoring-capabilities", title: "Refactoring Capabilities", level: 3 },
      { id: "example-refactoring", title: "Example Refactoring", level: 3 },
      { id: "documentation-generator", title: "Documentation Generator", level: 2 },
      { id: "generated-documentation", title: "Generated Documentation", level: 3 },
      { id: "continuous-learning", title: "Continuous Learning", level: 2 },
      { id: "personalization", title: "Personalization", level: 3 },
      { id: "team-collaboration", title: "Team Collaboration", level: 3 },
    ],
  },
  {
    id: "vercel",
    title: "Vercel Deployment",
    slug: "vercel",
    category: "deployment",
    content: `# Vercel Deployment

Deploy your APIs to Vercel with one click and enjoy seamless integration with the Vercel ecosystem.

## Quick Deploy

SmartAPIForge is optimized for Vercel deployment with zero configuration required.

### One-Click Deployment
1. Connect your GitHub repository
2. Click "Deploy to Vercel"
3. Your API is live in seconds

### Automatic Deployments
Every push to your main branch automatically deploys to production. Pull requests get preview deployments for testing.

## Environment Variables

Securely manage your API keys and secrets using Vercel's environment variable system.

### Setting Up Variables
- Add variables in the Vercel dashboard
- Use different values for development, preview, and production
- Automatically encrypted and secure

### Best Practices
- Never commit secrets to your repository
- Use different API keys for each environment
- Rotate keys regularly

## Edge Functions

Deploy your APIs to Vercel's Edge Network for ultra-low latency worldwide.

### Benefits
- Sub-50ms response times globally
- Automatic scaling to zero
- Pay only for what you use
- Built-in DDoS protection

### Supported Regions
Deploy to 100+ edge locations worldwide for optimal performance.

## Monitoring and Analytics

Built-in monitoring and analytics help you understand your API usage.

### Real-time Metrics
- Request volume and latency
- Error rates and types
- Geographic distribution
- Bandwidth usage

### Alerts
Set up alerts for:
- High error rates
- Unusual traffic patterns
- Performance degradation
- Budget thresholds`,
    subsections: [
      { id: "quick-deploy", title: "Quick Deploy", level: 2 },
      { id: "one-click-deployment", title: "One-Click Deployment", level: 3 },
      { id: "automatic-deployments", title: "Automatic Deployments", level: 3 },
      { id: "environment-variables", title: "Environment Variables", level: 2 },
      { id: "setting-up-variables", title: "Setting Up Variables", level: 3 },
      { id: "best-practices", title: "Best Practices", level: 3 },
      { id: "edge-functions", title: "Edge Functions", level: 2 },
      { id: "benefits", title: "Benefits", level: 3 },
      { id: "supported-regions", title: "Supported Regions", level: 3 },
      { id: "monitoring-and-analytics", title: "Monitoring and Analytics", level: 2 },
      { id: "real-time-metrics", title: "Real-time Metrics", level: 3 },
      { id: "alerts", title: "Alerts", level: 3 },
    ],
  },
  {
    id: "faq",
    title: "FAQ",
    slug: "faq",
    category: "troubleshooting",
    content: `# Frequently Asked Questions

Find answers to common questions about SmartAPIForge, including general information, technical details, deployment options, and support resources.

## General

### What is SmartAPIForge?
SmartAPIForge is an AI-powered platform for building, testing, and deploying REST APIs. It uses large language models to generate production-ready code from natural language descriptions.

### Is SmartAPIForge free?
SmartAPIForge offers a free tier with generous limits. Paid plans are available for teams and enterprises with additional features and higher usage limits.

### What languages does SmartAPIForge support?
SmartAPIForge generates TypeScript/Node.js code by default, with support for Python, Go, and Java coming soon.

## Technical

### What databases are supported?
SmartAPIForge works with:
- PostgreSQL
- MongoDB
- MySQL
- SQLite
- Redis (for caching)

### Can I use my own database?
Yes! SmartAPIForge can connect to any existing database. Just provide your connection string and SmartAPIForge will generate the appropriate models and queries.

### How does authentication work?
SmartAPIForge supports multiple authentication methods:
- JWT tokens
- OAuth 2.0
- API keys
- Session-based auth

### Is the generated code production-ready?
Yes! SmartAPIForge generates code that follows industry best practices including:
- Input validation
- Error handling
- Security measures
- Performance optimizations
- Comprehensive tests

## Deployment

### Where can I deploy my API?
SmartAPIForge APIs can be deployed to:
- Vercel (recommended)
- AWS Lambda
- Google Cloud Functions
- Azure Functions
- Any Node.js hosting provider

### How much does hosting cost?
Hosting costs depend on your provider and usage. Vercel's free tier is sufficient for most small projects. Production apps typically cost $20-100/month depending on traffic.

### Can I use a custom domain?
Yes! All hosting providers support custom domains. Vercel makes it especially easy with automatic SSL certificates.

## Support

### How do I get help?
- Check our [documentation](/docs/getting-started/introduction)
- Join our [Discord community](https://discord.gg/smartapiforge)
- Email support@smartapiforge.com
- Open an issue on [GitHub](https://github.com/smartapiforge/smartapiforge)

### Do you offer enterprise support?
Yes! Enterprise customers get:
- Dedicated support channel
- SLA guarantees
- Custom training
- Architecture review
- Priority feature requests`,
    subsections: [
      { id: "general", title: "General", level: 2 },
      { id: "what-is-smartapiforge", title: "What is SmartAPIForge?", level: 3 },
      { id: "is-smartapiforge-free", title: "Is SmartAPIForge free?", level: 3 },
      { id: "what-languages-does-smartapiforge-support", title: "What languages does SmartAPIForge support?", level: 3 },
      { id: "technical", title: "Technical", level: 2 },
      { id: "what-databases-are-supported", title: "What databases are supported?", level: 3 },
      { id: "can-i-use-my-own-database", title: "Can I use my own database?", level: 3 },
      { id: "how-does-authentication-work", title: "How does authentication work?", level: 3 },
      { id: "is-the-generated-code-production-ready", title: "Is the generated code production-ready?", level: 3 },
      { id: "deployment", title: "Deployment", level: 2 },
      { id: "where-can-i-deploy-my-api", title: "Where can I deploy my API?", level: 3 },
      { id: "how-much-does-hosting-cost", title: "How much does hosting cost?", level: 3 },
      { id: "can-i-use-a-custom-domain", title: "Can I use a custom domain?", level: 3 },
      { id: "support", title: "Support", level: 2 },
      { id: "how-do-i-get-help", title: "How do I get help?", level: 3 },
      { id: "do-you-offer-enterprise-support", title: "Do you offer enterprise support?", level: 3 },
    ],
  },
]

export const navigationSections = [
  {
    id: "getting-started",
    title: "Getting Started",
    items: [
      { title: "Introduction", href: "/docs/getting-started/introduction" },
      { title: "Quickstart", href: "/docs/getting-started/quick-start" },
    ],
  },
  {
    id: "features",
    title: "Features",
    items: [
      { title: "AI Generation", href: "/docs/features/ai-generation" },
    ],
  },
  {
    id: "deployment",
    title: "Deployment",
    items: [
      { title: "Vercel", href: "/docs/deployment/vercel" },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    items: [
      { title: "FAQ", href: "/docs/troubleshooting/faq" },
    ],
  },
]

# Complete Workflow Testing Guide

## Testing the Full AI → Inngest → E2B Pipeline

### 1. Testing AI Input to API Generation

#### Option A: Using the Web Interface
1. Start your development server:
   ```bash
   npm run dev
   ```
2. Open http://localhost:3000
3. Navigate to the AI input section
4. Enter a prompt like:
   ```
   Create an API for a simple todo application with endpoints to:
   - GET /todos - list all todos
   - POST /todos - create a new todo
   - PUT /todos/:id - update a todo
   - DELETE /todos/:id - delete a todo
   ```

#### Option B: Direct Inngest Function Testing
1. Create a test script to trigger the Inngest function directly:

```javascript
// test-workflow.js
require('dotenv').config();
const { Inngest } = require('inngest');

const inngest = new Inngest({ id: "smart-forge-api" });

async function testWorkflow() {
  try {
    console.log('🚀 Testing complete workflow...');
    
    // Send event to trigger API generation
    const result = await inngest.send({
      name: "api/generate",
      data: {
        prompt: "Create an API for a simple todo application with CRUD operations",
        mode: "standalone", // or "github" with repoUrl
        userId: "test-user"
      }
    });
    
    console.log('✅ Event sent successfully:', result);
    console.log('💡 Check your Inngest dashboard for execution details');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWorkflow();
```

### 2. Monitoring Inngest Execution

#### Check Inngest Dashboard
1. Go to https://app.inngest.com
2. Navigate to your project
3. Look for the "api/generate" function runs
4. Monitor the step-by-step execution:
   - Repository analysis (if GitHub mode)
   - OpenAI API call
   - E2B sandbox validation
   - API execution testing

#### Local Logging
Check your terminal running `npm run dev` for detailed logs:
```
[Inngest] Function started: generateAPI
[Inngest] Step: analyze-repository (if GitHub mode)
[Inngest] Step: generate-api-spec
[Inngest] Step: validate-with-sandbox
[Inngest] Step: execute-and-test
[Inngest] Function completed
```

### 3. Verifying E2B Sandbox Integration

#### Check E2B Template Status
```bash
# List your templates
e2b template list

# Check if smart-forge-api-sandbox exists
e2b template get smart-forge-api-sandbox
```

#### Monitor Sandbox Creation and Execution
Look for these logs in your Inngest function execution:

```
✅ Sandbox validation logs:
- Sandbox created: smart-forge-api-sandbox
- OpenAPI spec written to /tmp/openapi.json
- Implementation written to /tmp/api-implementation.js
- OpenAPI validation: PASSED
- TypeScript compilation: PASSED
- ESLint validation: PASSED
- Jest tests: PASSED

✅ Execution testing logs:
- Dependencies installed
- API server started on port 3001
- Health check: PASSED
- Endpoint testing: 3/3 endpoints tested
- All tests: PASSED
```

#### Manual E2B Testing
You can also test the E2B sandbox directly:

```javascript
// test-e2b-direct.js
require('dotenv').config();
const { Sandbox } = require('e2b');

async function testE2BSandbox() {
  let sandbox;
  
  try {
    console.log('🔧 Creating E2B sandbox...');
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    console.log('✅ Sandbox created successfully');
    
    // Test basic functionality
    const result = await sandbox.process.start({
      cmd: 'node --version'
    });
    
    console.log('📋 Node version:', result.stdout);
    
    // Test OpenAPI validation
    await sandbox.filesystem.write('/tmp/test-spec.json', JSON.stringify({
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {}
    }));
    
    const validation = await sandbox.process.start({
      cmd: 'npx swagger-parser validate /tmp/test-spec.json'
    });
    
    console.log('✅ OpenAPI validation test:', validation.exitCode === 0 ? 'PASSED' : 'FAILED');
    
  } catch (error) {
    console.error('❌ E2B sandbox error:', error);
  } finally {
    if (sandbox) {
      await sandbox.kill();
      console.log('🧹 Sandbox cleaned up');
    }
  }
}

testE2BSandbox();
```

### 4. End-to-End Verification Checklist

#### ✅ Pre-requisites
- [ ] Environment variables set (E2B_API_KEY, OPENAI_API_KEY)
- [ ] E2B template built (`e2b template build`)
- [ ] Development server running (`npm run dev`)
- [ ] Inngest dev server running (if testing locally)

#### ✅ Workflow Steps
- [ ] AI prompt submitted successfully
- [ ] Inngest function triggered
- [ ] Repository analysis completed (GitHub mode)
- [ ] OpenAI API generated spec and code
- [ ] E2B sandbox created and validated code
- [ ] API execution testing completed
- [ ] Results saved to database

#### ✅ Success Indicators
- [ ] No errors in Inngest dashboard
- [ ] E2B sandbox logs show successful validation
- [ ] Generated API code passes all tests
- [ ] API endpoints respond correctly in sandbox
- [ ] Database contains the generated API record

### 5. Troubleshooting Common Issues

#### E2B Sandbox Issues
```bash
# Check E2B CLI authentication
e2b auth whoami

# Rebuild template if needed
e2b template build --force

# Check template logs
e2b template logs smart-forge-api-sandbox
```

#### Inngest Issues
- Check function logs in Inngest dashboard
- Verify webhook endpoints are accessible
- Ensure environment variables are set

#### OpenAI API Issues
- Verify API key is valid and has credits
- Check rate limits
- Monitor token usage

### 6. Performance Monitoring

#### Timing Benchmarks
- Repository analysis: ~10-30 seconds
- OpenAI generation: ~30-60 seconds
- E2B validation: ~20-40 seconds
- API execution testing: ~15-30 seconds
- **Total workflow: ~2-3 minutes**

#### Resource Usage
- E2B sandbox: ~512MB RAM, 1 CPU core
- OpenAI tokens: ~2000-5000 tokens per generation
- Network: Multiple API calls to OpenAI, E2B, GitHub

This comprehensive testing approach ensures your entire AI → Inngest → E2B pipeline is working correctly!
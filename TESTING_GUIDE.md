# Testing Guide for Smart Forge API

This guide covers how to test the complete API generation system with the custom e2b sandbox integration.

## Prerequisites

1. **Environment Variables**: Ensure you have all required environment variables set:
   ```bash
   OPENAI_API_KEY=your_openai_key
   E2B_API_KEY=your_e2b_key
   GITHUB_TOKEN=your_github_token
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_key
   INNGEST_EVENT_KEY=your_inngest_key
   INNGEST_SIGNING_KEY=your_inngest_signing_key
   ```

2. **Dependencies**: Install all dependencies:
   ```bash
   npm install
   ```

3. **E2B Template**: Ensure your custom template is built:
   ```bash
   e2b template build --name smart-forge-api-sandbox
   ```

## Testing Levels

### 1. E2B Sandbox Template Testing

#### Test the Template Build
```bash
# Build the template
e2b template build --name smart-forge-api-sandbox

# List templates to verify
e2b template list
```

#### Test Sandbox Creation and Functions
```javascript
// Create a test file: test-sandbox.js
const { Sandbox } = require('e2b');

async function testSandbox() {
  let sandbox = null;
  
  try {
    // Create sandbox
    sandbox = await Sandbox.create('smart-forge-api-sandbox');
    console.log('✅ Sandbox created successfully');
    
    // Test validation functions
    const healthCheck = await sandbox.commands.run('health_check');
    console.log('Health check:', healthCheck.stdout);
    
    // Test OpenAPI validation function
    const openApiTest = await sandbox.commands.run('validate_openapi_spec --help');
    console.log('OpenAPI validator available:', openApiTest.exitCode === 0);
    
    // Test TypeScript compilation
    const tsTest = await sandbox.commands.run('compile_typescript --help');
    console.log('TypeScript compiler available:', tsTest.exitCode === 0);
    
    // Test ESLint
    const lintTest = await sandbox.commands.run('lint_code --help');
    console.log('ESLint available:', lintTest.exitCode === 0);
    
    // Test Jest
    const jestTest = await sandbox.commands.run('run_tests --help');
    console.log('Jest available:', jestTest.exitCode === 0);
    
  } catch (error) {
    console.error('❌ Sandbox test failed:', error);
  } finally {
    if (sandbox) {
      await sandbox.close();
      console.log('✅ Sandbox cleaned up');
    }
  }
}

testSandbox();
```

Run the test:
```bash
node test-sandbox.js
```

### 2. Inngest Function Testing

#### Start the Development Server
```bash
npm run dev
```

#### Test API Generation (Standalone Mode)

Create a test file `test-inngest.js`:
```javascript
const { Inngest } = require('inngest');

// Initialize Inngest client
const inngest = new Inngest({ 
  id: "smart-forge-api",
  eventKey: process.env.INNGEST_EVENT_KEY 
});

async function testAPIGeneration() {
  try {
    // Test standalone mode
    const result = await inngest.send({
      name: "api/generate",
      data: {
        prompt: "Create a simple REST API for managing books with CRUD operations",
        mode: "standalone",
        userId: "test-user-123"
      }
    });
    
    console.log('✅ API generation job started:', result);
    return result;
  } catch (error) {
    console.error('❌ API generation failed:', error);
  }
}

testAPIGeneration();
```

#### Test API Generation (GitHub Mode)

```javascript
async function testGitHubMode() {
  try {
    const result = await inngest.send({
      name: "api/generate",
      data: {
        prompt: "Add user authentication endpoints to this Express.js app",
        mode: "github",
        repoUrl: "https://github.com/your-username/sample-express-app.git",
        userId: "test-user-123"
      }
    });
    
    console.log('✅ GitHub mode API generation started:', result);
    return result;
  } catch (error) {
    console.error('❌ GitHub mode generation failed:', error);
  }
}
```

### 3. End-to-End Testing

#### Using the Web Interface

1. **Start the application**:
   ```bash
   npm run dev
   ```

2. **Navigate to** `http://localhost:3000`

3. **Test Standalone Mode**:
   - Go to the main page
   - Enter a prompt like: "Create a REST API for a todo application with CRUD operations"
   - Select "Standalone" mode
   - Click "Generate API"
   - Monitor the job progress in the dashboard

4. **Test GitHub Mode**:
   - Enter a prompt like: "Add authentication middleware to this Express app"
   - Select "GitHub" mode
   - Enter a repository URL
   - Click "Generate API"
   - Check the repository analysis and generated code

#### Using API Endpoints

```bash
# Test the Inngest webhook endpoint
curl -X POST http://localhost:3000/api/inngest \
  -H "Content-Type: application/json" \
  -d '{
    "name": "api/generate",
    "data": {
      "prompt": "Create a simple user management API",
      "mode": "standalone",
      "userId": "test-user"
    }
  }'
```

### 4. Monitoring and Debugging

#### Check Job Status

```sql
-- Query Supabase to check job status
SELECT * FROM jobs ORDER BY created_at DESC LIMIT 10;
```

#### Monitor Inngest Dashboard

1. Go to your Inngest dashboard
2. Check the "Functions" tab for `generate-api` function
3. Monitor execution logs and any failures

#### Check Application Logs

```bash
# In your development terminal, watch for:
# - Sandbox creation/cleanup logs
# - Validation results
# - API generation progress
# - Error messages
```

### 5. Testing Specific Components

#### Test Repository Analysis

```javascript
// test-repo-analysis.js
const { Sandbox } = require('e2b');

async function testRepoAnalysis() {
  const sandbox = await Sandbox.create('smart-forge-api-sandbox');
  
  try {
    // Clone a test repository
    const cloneResult = await sandbox.commands.run(
      'git clone https://github.com/expressjs/express.git /home/user/test-repo'
    );
    
    if (cloneResult.exitCode === 0) {
      console.log('✅ Repository cloned successfully');
      
      // Test file reading
      const packageJson = await sandbox.files.read('/home/user/test-repo/package.json');
      console.log('✅ Package.json read:', JSON.parse(packageJson).name);
      
      // Test directory structure
      const structure = await sandbox.commands.run(
        'find /home/user/test-repo -name "*.js" | head -10'
      );
      console.log('✅ Directory structure:', structure.stdout);
    }
  } finally {
    await sandbox.close();
  }
}

testRepoAnalysis();
```

#### Test API Validation

```javascript
// test-validation.js
const { Sandbox } = require('e2b');

async function testValidation() {
  const sandbox = await Sandbox.create('smart-forge-api-sandbox');
  
  try {
    // Create a sample OpenAPI spec
    const sampleSpec = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0.0' },
      paths: {
        '/test': {
          get: {
            responses: {
              '200': { description: 'Success' }
            }
          }
        }
      }
    };
    
    await sandbox.files.write('/home/user/test-spec.json', JSON.stringify(sampleSpec, null, 2));
    
    // Test OpenAPI validation
    const validation = await sandbox.commands.run('validate_openapi_spec /home/user/test-spec.json');
    console.log('✅ OpenAPI validation:', validation.exitCode === 0 ? 'PASSED' : 'FAILED');
    console.log('Output:', validation.stdout || validation.stderr);
    
  } finally {
    await sandbox.close();
  }
}

testValidation();
```

## Expected Results

### Successful Test Indicators

1. **E2B Template**: 
   - Template builds without errors
   - All validation functions are available
   - Health check returns success

2. **Repository Analysis**:
   - Successfully clones repositories
   - Reads package.json and main files
   - Generates comprehensive analysis object

3. **API Generation**:
   - OpenAI generates valid OpenAPI specs
   - Implementation code passes TypeScript compilation
   - Generated APIs start successfully
   - Health endpoints respond correctly

4. **End-to-End**:
   - Jobs are created in Supabase
   - Inngest functions execute without errors
   - Generated code is saved to database
   - Validation results are comprehensive

### Common Issues and Solutions

1. **E2B Template Build Fails**:
   - Check Dockerfile syntax
   - Ensure all dependencies are properly installed
   - Verify JSON configuration files are properly escaped

2. **Sandbox Creation Fails**:
   - Verify E2B_API_KEY is set
   - Check template name matches exactly
   - Ensure sufficient E2B credits

3. **Repository Cloning Fails**:
   - Verify repository URL is accessible
   - Check if repository requires authentication
   - Ensure git is available in sandbox

4. **API Generation Fails**:
   - Check OpenAI API key and credits
   - Verify prompt is clear and specific
   - Monitor OpenAI rate limits

5. **Validation Fails**:
   - Check generated code syntax
   - Verify all dependencies are installed
   - Review validation function outputs

## Performance Testing

```bash
# Test multiple concurrent generations
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/inngest \
    -H "Content-Type: application/json" \
    -d "{
      \"name\": \"api/generate\",
      \"data\": {
        \"prompt\": \"Create API $i\",
        \"mode\": \"standalone\",
        \"userId\": \"test-user-$i\"
      }
    }" &
done
wait
```

This comprehensive testing approach ensures your Smart Forge API system works correctly at all levels!
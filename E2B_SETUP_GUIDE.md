# E2B Integration Setup Guide

## Overview
This guide will help you set up and test the E2B sandbox integration for the Smart API Forge project.

## Prerequisites Setup

### 1. Create .env File
First, copy the example environment file:
```bash
cp .env.example .env
```

### 2. Get Required API Keys

#### E2B API Key
1. Visit [E2B Console](https://e2b.dev/)
2. Sign up or log in
3. Create a new API key
4. Copy the key and add it to your `.env` file:
   ```
   E2B_API_KEY=e2b_your_actual_api_key_here
   ```

#### OpenAI API Key
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Go to API Keys section
4. Create a new API key
5. Add it to your `.env` file:
   ```
   OPENAI_API_KEY=sk-your_actual_openai_key_here
   ```

#### Inngest Event Key
1. Visit [Inngest Dashboard](https://www.inngest.com/)
2. Sign up or log in
3. Create a new project or use existing
4. Get your Event Key from the project settings
5. Add it to your `.env` file:
   ```
   INNGEST_EVENT_KEY=your_inngest_event_key_here
   INNGEST_SIGNING_KEY=your_inngest_signing_key_here
   ```

### 3. Build E2B Template
Build the custom E2B sandbox template:
```bash
e2b template build
```

## Testing the E2B Integration

### Quick Test
Run the workflow test to verify everything is working:
```bash
node test-workflow.js
```

### Manual Testing via Web Interface
1. Start the development server:
   ```bash
   npm run dev
   ```

2. Open http://localhost:3000 in your browser

3. Navigate to the AI input section

4. Enter a prompt like:
   ```
   Create an API for a simple todo application with endpoints to:
   - GET /todos - list all todos
   - POST /todos - create a new todo
   - PUT /todos/:id - update a todo
   - DELETE /todos/:id - delete a todo
   ```

5. Submit the prompt and monitor the logs

## Monitoring the Workflow

### Terminal Logs
Watch the terminal running `npm run dev` for:
- Inngest function execution logs
- E2B sandbox creation and validation
- API generation progress
- Error messages

### Expected Log Flow
```
POST /api/inngest?fnId=Smart-forge-api-generate-api&stepId=step 200
✅ Repository analysis completed
✅ E2B sandbox created: smart-forge-api-sandbox
✅ OpenAPI spec validation passed
✅ TypeScript compilation passed
✅ Syntax validation passed
✅ API saved to database: [uuid]
✅ Job completed successfully: [job-id]
```

### Troubleshooting Common Issues

#### Exit Status 127 Error
- **Problem**: Custom validation commands not found
- **Solution**: Updated to use standard npm/node commands
- **Fixed in**: Latest version uses `npx swagger-parser`, `npx tsc`, etc.

#### Sandbox Creation Fails
- **Problem**: E2B API key invalid or template not built
- **Solution**: 
  1. Verify E2B_API_KEY in .env
  2. Run `e2b template build`
  3. Check E2B dashboard for template status

#### OpenAI API Errors
- **Problem**: Invalid API key or rate limits
- **Solution**:
  1. Verify OPENAI_API_KEY in .env
  2. Check OpenAI dashboard for usage/billing
  3. Ensure sufficient credits

#### Inngest Connection Issues
- **Problem**: Invalid event key or signing key
- **Solution**:
  1. Verify INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY
  2. Check Inngest dashboard for project settings
  3. Ensure dev server is running on correct port

## Validation Commands Used

The E2B sandbox now uses these standard commands:

1. **OpenAPI Validation**:
   ```bash
   cd /home/user && npx swagger-parser validate openapi.json
   ```

2. **TypeScript Compilation**:
   ```bash
   cd /home/user/src && npx tsc --noEmit --skipLibCheck
   ```

3. **Syntax Validation**:
   ```bash
   cd /home/user/src && find . -name "*.js" -exec node --check {} \;
   ```

4. **Test Execution**:
   ```bash
   cd /home/user && if [ -f package.json ] && grep -q "test" package.json; then npm test; else echo "No tests found"; fi
   ```

## Success Indicators

✅ **E2B Working**: Sandbox creates successfully and runs validation commands
✅ **Inngest Working**: Functions execute and complete without errors
✅ **OpenAI Working**: Repository analysis and code generation complete
✅ **Full Integration**: API is generated, validated, and saved to database

## Next Steps

Once E2B is working:
1. Test with different API prompts
2. Monitor sandbox resource usage
3. Check generated API quality
4. Test API endpoints in the sandbox
5. Deploy generated APIs to production

## Support

If you encounter issues:
1. Check the terminal logs for specific error messages
2. Verify all API keys are correctly set
3. Ensure E2B template is built and deployed
4. Check the Inngest and E2B dashboards for additional insights
# Manual Verification Steps for Project ID and AI Results in Background Jobs

## Step 1: Check Messages with Project ID
```sql
-- Check recent AI assistant messages with project associations
SELECT 
    id, 
    content, 
    role, 
    type, 
    project_id, 
    created_at 
FROM messages 
WHERE role = 'assistant' 
    AND project_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

## Step 2: Check Background Jobs Status
```sql
-- Check jobs with project_id and their status
SELECT 
    id, 
    project_id, 
    type, 
    status, 
    created_at, 
    updated_at 
FROM jobs 
WHERE project_id IS NOT NULL 
    AND type IN ('api_generation', 'fragment_generation')
ORDER BY created_at DESC 
LIMIT 10;
```

## Step 3: Check API Fragments (Generated Code)
```sql
-- Check API fragments with generated code
SELECT 
    af.id,
    af.job_id,
    j.project_id,
    af.openapi_spec IS NOT NULL as has_openapi,
    af.implementation_code IS NOT NULL as has_code,
    af.requirements IS NOT NULL as has_requirements,
    af.created_at
FROM api_fragments af
JOIN jobs j ON af.job_id = j.id
WHERE j.project_id IS NOT NULL
ORDER BY af.created_at DESC
LIMIT 5;
```

## Step 4: Check Fragments with Project ID
```sql
-- Check fragments associated with projects
SELECT 
    id, 
    title, 
    project_id, 
    message_id, 
    content IS NOT NULL as has_content,
    created_at 
FROM fragments 
WHERE project_id IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 10;
```

## Step 5: Cross-Reference Analysis
```sql
-- Count records by project association
SELECT 
    'Messages' as table_name,
    COUNT(*) as total_records,
    COUNT(project_id) as with_project_id,
    COUNT(*) - COUNT(project_id) as orphaned
FROM messages
UNION ALL
SELECT 
    'Jobs' as table_name,
    COUNT(*) as total_records,
    COUNT(project_id) as with_project_id,
    COUNT(*) - COUNT(project_id) as orphaned
FROM jobs
UNION ALL
SELECT 
    'Fragments' as table_name,
    COUNT(*) as total_records,
    COUNT(project_id) as with_project_id,
    COUNT(*) - COUNT(project_id) as orphaned
FROM fragments;
```

## Step 6: Check Pending vs Completed Jobs
```sql
-- Check job completion rates by project
SELECT 
    project_id,
    COUNT(*) as total_jobs,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
    COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM jobs 
WHERE project_id IS NOT NULL
GROUP BY project_id
ORDER BY total_jobs DESC;
```

## What to Look For:

### ✅ **Good Signs:**
- Messages have `project_id` values (not NULL)
- Jobs show `completed` status with `project_id`
- API fragments exist with generated code
- Cross-references show high percentage of records with `project_id`

### ⚠️ **Warning Signs:**
- Many NULL `project_id` values in recent records
- Jobs stuck in `pending` status for long periods
- Missing API fragments for completed jobs
- High number of orphaned records

### ❌ **Problem Indicators:**
- All recent records missing `project_id`
- Jobs failing consistently
- No generated code in API fragments
- Background jobs not processing

## Quick Health Check Commands:

### Check if background jobs are running:
```bash
# Check Inngest dashboard or logs
npm run dev  # If using local development
```

### Check database connectivity:
```bash
# Test database connection
node -e "
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('projects').select('count').then(console.log);
"
```

### Verify environment variables:
```bash
# Check if required env vars are set
echo "Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo "Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
```

## Automated Verification:
Run the comprehensive test script:
```bash
node test-ai-results-project-id.js
```

This will automatically perform all the above checks and provide a detailed report.
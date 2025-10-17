# Quick Start Guide - V0-Style Versioning System

## Prerequisites

- Node.js 18+ installed
- Supabase project set up
- OpenAI API key configured
- Inngest dev server

## Setup Steps

### 1. Run Database Migration

```bash
# Apply the versions table migration
npx supabase migration up

# Or if using Supabase CLI
supabase db push
```

Verify the migration:
```bash
# Check that versions table exists
npx supabase db tables list
```

### 2. Start Development Servers

```bash
# Terminal 1: Next.js dev server
npm run dev

# Terminal 2: Inngest dev server  
npx inngest-cli@latest dev
```

### 3. Test the System

#### Test 1: Create First Version
1. Go to `http://localhost:3000/ask`
2. Enter: "create api for weather"
3. Submit and get redirected to `/projects/[id]`
4. Watch as Version 1 is created with streaming
5. See version card appear in the chat sidebar
6. Verify files appear in code viewer

#### Test 2: Iterate on Version
1. In the same project, type: "add authentication"
2. Watch command get classified (check console logs)
3. See Version 2 being created
4. Observe that Version 1 files are preserved
5. New auth files are added
6. Version card shows file changes (new/modified indicators)

#### Test 3: Version Switching
1. Click on Version 1 card
2. File tree updates to show Version 1 files
3. Code viewer displays Version 1 code
4. Click on Version 2 card
5. File tree updates to show Version 2 files
6. Notice the differences

#### Test 4: Command Classification
Try different prompts:
- ✅ "add error handling" → MODIFY_FILE
- ✅ "create a new user service" → CREATE_FILE  
- ✅ "delete the old auth file" → DELETE_FILE
- ✅ "refactor to use typescript" → REFACTOR_CODE
- ✅ "build a rest api for tasks" → GENERATE_API

Check browser console to see classification results.

## Verification Checklist

### Database
- [ ] `versions` table exists
- [ ] `fragments.version_id` column exists
- [ ] `generation_events.version_id` column exists
- [ ] Can query versions: `SELECT * FROM versions;`

### Backend
- [ ] No TypeScript errors: `npm run build`
- [ ] Inngest shows `iterate-api` function
- [ ] tRPC router includes `versions` namespace
- [ ] Command classifier returns results quickly

### Frontend
- [ ] Chat input triggers generation
- [ ] Version cards appear after generation
- [ ] Version list shows all versions
- [ ] Click version card → file tree updates
- [ ] Streaming events include version info
- [ ] No console errors

## Debugging

### Chat doesn't trigger generation
```bash
# Check Inngest is running
curl http://localhost:8288/health

# Check browser console for errors
# Should see: "Command classified: { type: '...', ... }"
```

### Versions not created
```sql
-- Check if versions are being created
SELECT * FROM versions ORDER BY created_at DESC LIMIT 5;

-- Check if messages are linked to versions
SELECT m.content, m.version_id, v.version_number 
FROM messages m 
LEFT JOIN versions v ON m.version_id = v.id 
WHERE m.project_id = 'YOUR_PROJECT_ID'
ORDER BY m.created_at DESC;
```

### Streaming not working
```bash
# Check SSE endpoint
curl http://localhost:3000/api/stream/YOUR_PROJECT_ID

# Should see: ": connected"
```

### Command classification is slow
```javascript
// Check if caching is working
// In browser console after a few commands:
console.log('Cache should contain results');

// Try the same command twice - second should be instant
```

## Common Issues

### Issue: "versions table does not exist"
**Fix**: Run the migration: `npx supabase migration up`

### Issue: "Cannot find module '@/components/version-list'"
**Fix**: Restart Next.js dev server: `npm run dev`

### Issue: "Classification timeout"
**Fix**: Check OpenAI API key is set: `echo $OPENAI_API_KEY`

### Issue: "Inngest function not found"
**Fix**: Restart Inngest dev server: `npx inngest-cli@latest dev`

### Issue: "Version files not loading"
**Fix**: Check version has files: `SELECT id, files FROM versions WHERE id = 'VERSION_ID';`

## Environment Variables

Ensure these are set in `.env.local`:

```bash
# OpenAI (required for classification + generation)
OPENAI_API_KEY=sk-...

# Supabase (required for database)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Optional: GitHub integration
GITHUB_TOKEN=ghp_...
```

## Performance Tips

### Speed up classification
- Most commands use keyword matching (< 100ms)
- Only ambiguous commands use AI (~500ms)
- Results are cached for repeated commands

### Optimize context building
- Default message limit: 20 (configurable)
- Truncation preserves important files
- Adjust in `context-builder.ts` if needed

### Improve streaming
- SSE connection stays open during generation
- Files stream individually with typing animation
- Adjust chunk size for faster/slower animation

## Next Actions

After verifying everything works:

1. **Create a test project**: Full end-to-end test
2. **Test edge cases**: Long prompts, many versions, etc.
3. **Monitor performance**: Check generation times
4. **Gather feedback**: Share with users/team
5. **Plan enhancements**: Version comparison, branching, etc.

## Support

If issues persist:
1. Check `IMPLEMENTATION_SUMMARY.md` for detailed info
2. Review console logs (browser + terminal)
3. Verify database migrations applied correctly
4. Ensure all environment variables are set
5. Check Inngest dashboard for failed functions

## Success!

When you see:
- ✅ Version cards in chat
- ✅ Files in code viewer
- ✅ Version switching works
- ✅ Streaming shows progress
- ✅ Context includes previous code

**Your v0-style versioning system is operational!** 🎉


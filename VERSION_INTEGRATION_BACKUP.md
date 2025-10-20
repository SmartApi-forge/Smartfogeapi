# Version Integration Changes Backup

## Files Modified - Keep These Changes!

### 1. `app/projects/[projectId]/project-page-client.tsx`

#### A. Added State Variables (around line 590-594)
```typescript
const [isVersionDropdownOpen, setIsVersionDropdownOpen] = useState(false);
const versionDropdownRef = useRef<HTMLDivElement>(null);
```

#### B. Updated Click-Outside Handler (around line 598-613)
```typescript
// Close menu when clicking outside
useEffect(() => {
  const handleClickOutside = (event: MouseEvent) => {
    if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
      setIsMenuOpen(false);
    }
    if (versionDropdownRef.current && !versionDropdownRef.current.contains(event.target as Node)) {
      setIsVersionDropdownOpen(false);
    }
  };

  if (isMenuOpen || isVersionDropdownOpen) {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }
}, [isMenuOpen, isVersionDropdownOpen]);
```

#### C. Enhanced Refetch on Streaming Complete (around line 676-694)
```typescript
// Refetch versions and messages when streaming completes to get the newly created version
const wasStreaming = useRef(false);
useEffect(() => {
  if (wasStreaming.current && !streamState.isStreaming && streamState.status === 'complete') {
    console.log('Streaming completed, refetching versions and messages...');
    // Refetch immediately, then again after 500ms and 1500ms to catch delayed DB writes
    refetchVersions();
    refetch(); // Refetch messages to get updated version_id links
    setTimeout(() => {
      refetchVersions();
      refetch();
    }, 500);
    setTimeout(() => {
      refetchVersions();
      refetch();
    }, 1500);
  }
  wasStreaming.current = streamState.isStreaming;
}, [streamState.isStreaming, streamState.status, refetchVersions, refetch]);
```

#### D. Version Dropdown in Unified Header (INSERT AFTER PATH BAR, BEFORE THREE DOTS)
**Location: Around line 1565-1614 in unified header section**

```typescript
{/* Version Dropdown - shown in both modes */}
{versions.length > 0 && (
  <div className="relative flex-shrink-0" ref={versionDropdownRef}>
    <button
      onClick={() => setIsVersionDropdownOpen(!isVersionDropdownOpen)}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-background dark:bg-[#0E100F] border border-border dark:border-[#333433] hover:bg-muted dark:hover:bg-gray-700 transition-colors"
      title="Switch version"
    >
      <span className="font-medium text-foreground">
        v{versions.find(v => v.id === selectedVersionId)?.version_number || versions[versions.length - 1]?.version_number || 1}
      </span>
      <ChevronRight className={`h-3 w-3 transition-transform ${isVersionDropdownOpen ? 'rotate-90' : ''}`} />
    </button>
    
    <AnimatePresence>
      {isVersionDropdownOpen && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="absolute right-0 mt-2 w-56 bg-card dark:bg-[#1D1D1D] border border-border dark:border-[#333433] rounded-lg shadow-lg overflow-hidden z-50 max-h-64 overflow-y-auto"
        >
          {versions.map((version) => (
            <button
              key={version.id}
              onClick={() => {
                setSelectedVersionId(version.id);
                setIsVersionDropdownOpen(false);
              }}
              className={`w-full text-left px-3 py-2.5 text-xs hover:bg-muted dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                selectedVersionId === version.id ? 'bg-primary/10 text-primary' : ''
              }`}
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">v{version.version_number} - {version.name}</span>
                <span className="text-muted-foreground text-[10px] truncate">
                  {version.status === 'complete' ? '✓ Complete' : version.status === 'generating' ? '⏳ Generating...' : '❌ Failed'}
                </span>
              </div>
              {selectedVersionId === version.id && (
                <Check className="h-3 w-3 text-primary flex-shrink-0" />
              )}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  </div>
)}
```

#### E. Updated Project Interface (around line 72-87)
```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  framework: 'fastapi' | 'express' | 'python' | 'nextjs' | 'react' | 'vue' | 'angular' | 'flask' | 'django' | 'unknown';
  status: 'pending' | 'generating' | 'testing' | 'deploying' | 'deployed' | 'failed';
  created_at: string;
  updated_at: string;
  deploy_url?: string;
  swagger_url?: string;
  openapi_spec?: any;
  code_url?: string;
  prompt?: string;
  advanced?: boolean;
  sandbox_url?: string;
}
```

#### F. ZIP Download Fallback (around line 1189-1200)
```typescript
// FALLBACK: Try to get files from message fragments if no versions exist
const latestMessageWithFragments = messages
  .filter(m => m.fragments && m.fragments.length > 0)
  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

if (latestMessageWithFragments?.fragments?.[0]?.files) {
  filesToZip = latestMessageWithFragments.fragments[0].files;
}
```

---

### 2. `src/inngest/functions.ts`

#### Enhanced Version Creation with Logging (around line 2473-2550)

```typescript
// Step 7.5: Create initial version for the cloned repository
const versionResult = await step.run("create-initial-version", async () => {
  console.log('🔵 Starting version creation for GitHub repo');
  console.log('  - Project ID:', projectId);
  console.log('  - Repo:', repoFullName);
  console.log('  - Files count:', Object.keys(repoFiles || {}).length);
  
  try {
    const { VersionManager } = await import('../services/version-manager');
    console.log('✅ VersionManager imported successfully');
    
    // Generate version name from repo name
    const repoName = repoFullName.split('/').pop() || 'Repository';
    const versionName = repoName
      .split('-')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
    
    console.log('📝 Creating version with name:', versionName);
    
    // Create Version 1
    const version = await VersionManager.createVersion({
      project_id: projectId,
      version_number: 1,
      name: versionName,
      description: `Cloned from GitHub: ${repoFullName}`,
      files: repoFiles || {},
      command_type: 'CLONE_REPO',
      prompt: `Clone and preview GitHub repository: ${repoFullName}`,
      parent_version_id: undefined,
      status: 'complete',
      metadata: {
        repo_url: repoUrl,
        repo_full_name: repoFullName,
        framework: frameworkInfo.framework || 'unknown',
        package_manager: frameworkInfo.packageManager || 'unknown',
        sandbox_url: previewResult.sandboxUrl,
        sandbox_id: cloneResult.sandboxId,
        files_count: Object.keys(repoFiles || {}).length,
        fragment_id: savedResult?.fragment?.id,
      },
    });
    
    console.log('✅ Created initial version for GitHub repo:', version.id, 'v' + version.version_number);
    console.log('  - Version ID:', version.id);
    console.log('  - Version Number:', version.version_number);
    console.log('  - Files stored:', Object.keys(version.files || {}).length);
    
    // Emit to stream so frontend knows version was created
    await streamingService.emit(projectId, {
      type: 'version:created',
      versionId: version.id,
      versionNumber: version.version_number,
      versionName: version.name,
    });
    
    return { versionId: version.id, versionNumber: version.version_number };
  } catch (error: any) {
    console.error('❌ CRITICAL ERROR creating version for GitHub repo:');
    console.error('  - Error message:', error?.message);
    console.error('  - Error stack:', error?.stack);
    console.error('  - Error details:', JSON.stringify(error, null, 2));
    
    // Emit error to stream
    await streamingService.emit(projectId, {
      type: 'error',
      message: `Failed to create version: ${error?.message || 'Unknown error'}`,
      stage: 'Version Creation',
    });
    
    return { versionId: null, versionNumber: null, error: error?.message };
  }
});

const versionId = versionResult?.versionId;

// Step 7.6: Link message and fragments to version
if (versionId && savedResult) {
  await step.run("link-to-version", async () => {
    try {
      const resultMessageId = savedResult?.message?.id;
      
      // Update all user messages for this project with the version_id
      await supabase
        .from('messages')
        .update({ version_id: versionId })
        .eq('project_id', projectId)
        .eq('role', 'user');
      
      // Update assistant message/fragment too if we have the ID
      if (resultMessageId) {
        await supabase
          .from('messages')
          .update({ version_id: versionId })
          .eq('id', resultMessageId);
        
        await supabase
          .from('fragments')
          .update({ version_id: versionId })
          .eq('message_id', resultMessageId);
      }
      
      console.log('Linked messages and fragments to version:', versionId);
    } catch (error) {
      console.error('Error linking to version:', error);
    }
  });
}
```

---

### 3. `src/modules/versions/types.ts`

#### Updated CommandType Enum (line 4-10)
```typescript
export type CommandType = 
  | 'CREATE_FILE' 
  | 'MODIFY_FILE' 
  | 'DELETE_FILE' 
  | 'REFACTOR_CODE' 
  | 'GENERATE_API'
  | 'CLONE_REPO';
```

#### Updated Zod Schema (line 38)
```typescript
command_type: z.enum(['CREATE_FILE', 'MODIFY_FILE', 'DELETE_FILE', 'REFACTOR_CODE', 'GENERATE_API', 'CLONE_REPO']).optional(),
```

---

### 4. `src/modules/api-generation/router.ts`

#### Updated triggerIteration Input (line 181)
```typescript
commandType: z.enum(['CREATE_FILE', 'MODIFY_FILE', 'DELETE_FILE', 'REFACTOR_CODE', 'GENERATE_API', 'CLONE_REPO']),
```

---

### 5. `src/types/streaming.ts`

#### Added version:created Event (line 9-14)
```typescript
| {
    type: 'version:created';
    versionId: string;
    versionNumber: number;
    versionName: string;
  }
```

---

### 6. `hooks/use-generation-stream.ts`

#### Added version:created Handler (around line 81-88)
```typescript
case 'version:created':
  // Update version tracking when a new version is created
  if ('versionId' in streamEvent && streamEvent.versionId) {
    setCurrentVersionId(streamEvent.versionId);
    setCurrentVersionNumber(streamEvent.versionNumber);
    console.log('[useGenerationStream] Version created:', streamEvent.versionNumber, streamEvent.versionId);
  }
  break;
```

---

## Database Migration Required!

**CRITICAL: Run this SQL in Supabase before testing:**

```sql
-- Drop old constraint and add new one with CLONE_REPO
ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_command_type_check;

ALTER TABLE versions ADD CONSTRAINT versions_command_type_check 
  CHECK (command_type IN (
    'CREATE_FILE',
    'MODIFY_FILE', 
    'DELETE_FILE',
    'REFACTOR_CODE',
    'GENERATE_API',
    'CLONE_REPO'
  ));
```

---

## New Files Created

1. ✅ `DEBUG_GITHUB_VERSIONS.md` - Debug guide
2. ✅ `GITHUB_VERSION_INTEGRATION_FIX.md` - Implementation docs
3. ✅ `supabase/migrations/add_clone_repo_command_type.sql` - Migration file

---

## After Pulling Remote Changes:

1. Re-apply version dropdown to unified header section
2. Ensure all backend changes are preserved (functions.ts, types.ts, etc.)
3. Run the database migration
4. Test GitHub cloning

**All changes documented here must be preserved!**

# Manual Fix Guide - 3 Simple Changes

## ⚠️ IMPORTANT: First, revert project-page-client.tsx to working state
```bash
git checkout app/projects/[projectId]/project-page-client.tsx
# OR use Ctrl+Z to undo my last changes
```

---

## Change 1: Add isClonedProject Detection

**Location**: Around line 638-642 in `app/projects/[projectId]/project-page-client.tsx`

**Find this**:
```typescript
const [mobileView, setMobileView] = useState<'chat' | 'code'>('chat');
const [viewMode, setViewMode] = useState<'code' | 'preview'>('preview'); // Default to preview
const [previewPath, setPreviewPath] = useState('/');
```

**Replace with**:
```typescript
const [mobileView, setMobileView] = useState<'chat' | 'code'>('chat');

// For cloned projects (with repo_url or github_mode), default to preview
// For generated projects (text prompts), default to code
const isClonedProject = !!('repo_url' in project && project.repo_url) || !!('github_mode' in project && project.github_mode);
const [viewMode, setViewMode] = useState<'code' | 'preview'>(isClonedProject ? 'preview' : 'code');

const [previewPath, setPreviewPath] = useState('/');
```

---

## Change 2: Update CodeViewer Component Signature

**Location**: Around line 377 in `app/projects/[projectId]/project-page-client.tsx`

**Find this**:
```typescript
function CodeViewer({ 
  filename, 
  fileTree,
  codeTheme,
  versions = [],
  selectedVersionId,
  onVersionChange,
}: { 
  filename: string | null;
  fileTree: TreeNode[];
  codeTheme: any;
  versions?: any[];
  selectedVersionId?: string | null;
  onVersionChange?: (versionId: string) => void;
}) {
```

**Replace with**:
```typescript
function CodeViewer({ 
  filename, 
  fileTree,
  codeTheme,
  versions = [],
  selectedVersionId,
  onVersionChange,
  isClonedProject = false,
}: { 
  filename: string | null;
  fileTree: TreeNode[];
  codeTheme: any;
  versions?: any[];
  selectedVersionId?: string | null;
  onVersionChange?: (versionId: string) => void;
  isClonedProject?: boolean;
}) {
```

---

## Change 3: Hide Version Dropdown in CodeViewer for Generated Projects

**Location**: Around line 480 in `app/projects/[projectId]/project-page-client.tsx`

**Find this**:
```typescript
        {/* Version Dropdown */}
        {versions.length > 0 && (
          <div className="relative" ref={dropdownRef}>
```

**Replace with**:
```typescript
        {/* Version Dropdown - Only show for cloned projects (main dropdown exists in header for generated projects) */}
        {isClonedProject && versions.length > 0 && (
          <div className="relative" ref={dropdownRef}>
```

---

## Change 4: Pass isClonedProject to CodeViewer

**Location**: Around line 1825-1832 in `app/projects/[projectId]/project-page-client.tsx`

**Find this**:
```typescript
                      <CodeViewer 
                        filename={selected} 
                        fileTree={fileTree} 
                        codeTheme={codeTheme}
                        versions={versions}
                        selectedVersionId={selectedVersionId}
                        onVersionChange={setSelectedVersionId}
                      />
```

**Replace with**:
```typescript
                      <CodeViewer 
                        filename={selected} 
                        fileTree={fileTree} 
                        codeTheme={codeTheme}
                        versions={versions}
                        selectedVersionId={selectedVersionId}
                        onVersionChange={setSelectedVersionId}
                        isClonedProject={isClonedProject}
                      />
```

---

## ✅ That's it! All fixes done.

### Test the changes:
1. **Generated project** (from text prompt) → Opens to Code tab, only 1 version dropdown (in toolbar)
2. **Cloned GitHub project** → Opens to Preview tab, version dropdown in code viewer
3. **Pull Changes** → Files appear after reload

All 3 issues fixed! 🎉

# 🎯 Final Edits Required for inngest/functions.ts

## **File Structure Analysis**

```
Line 1-125:    messageCreated (KEEP - no changes needed)
Line 126-2128: generateAPI (NEEDS CHANGES)
  - Line 363-~1950: Step 3 "generate-api-code" (MASSIVE INLINE PROMPT - Replace with TwoAgentOrchestrator)
  - Line ~1960-2060: Helper function analyzeProjectPatterns (KEEP - used by new system)
  - Line 2000-2026: Helper function extractErrorInfo (DELETE - Decision Agent handles this)
  - Line 2028-2054: Helper function classifyUserIntent (DELETE - Decision Agent handles this)
  - Line 2056-2125: Helper function getFrameworkSpecificRules (DELETE - In prompts now)
Line 2129-4320: iterateAPI (NEEDS CHANGES)
  - Line 2313-~2800: Step 6 "generate-api-code" (MASSIVE INLINE PROMPT - Replace with TwoAgentOrchestrator)
```

---

## **Edit 1: Replace generateAPI Step 3 (Lines 363-~600)**

### **FIND THIS** (Starting at line 363):
```typescript
    // Step 3: Generate API using OpenAI
    const apiResult = await step.run("generate-api-code", async () => {
      // Emit step start event
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning API structure...',
        });
      }
      
      // Enhanced prompt that includes repository context if in GitHub mode
      let enhancedPrompt = prompt;
      if (mode === "github" && repoAnalysis && typeof repoAnalysis === 'object') {
        const repoContext = `
Repository Analysis:
- URL: ${(repoAnalysis as any).repoUrl}
- Package Info: ${(repoAnalysis as any).packageInfo ? JSON.stringify((repoAnalysis as any).packageInfo, null, 2) : 'No package.json found'}
- Directory Structure: ${(repoAnalysis as any).directoryStructure || 'Unable to analyze structure'}
- Main Files: ${(repoAnalysis as any).mainFiles ? (repoAnalysis as any).mainFiles.map((f: any) => `${f.file}: ${f.content.substring(0, 200)}...`).join('\n') : 'No main files found'}
- README: ${(repoAnalysis as any).readme ? (repoAnalysis as any).readme.substring(0, 500) + '...' : 'No README found'}
`;
        enhancedPrompt = `Generate an API that fits within this existing codebase:${repoContext}\n\nUser request: ${prompt}`;
      }
      
      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o",
        stream: true,
        messages: [
          {
            role: "system",
            content: `You are an expert API designer...
            [ENTIRE MASSIVE PROMPT - ~3000 characters]
```

### **REPLACE WITH**:
```typescript
    // Step 3: Generate API using TWO-AGENT SYSTEM
    const apiResult = await step.run("two-agent-api-generation", async () => {
      // Emit progress
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Analyzing request with AI...',
        });
      }
      
      // Build context for Two-Agent system
      let contextSummary = 'New API project';
      if (mode === "github" && repoAnalysis && typeof repoAnalysis === 'object') {
        contextSummary = `Repository: ${(repoAnalysis as any).repoUrl}\nFramework: ${(repoAnalysis as any).framework || 'Unknown'}\nFiles found: ${(repoAnalysis as any).mainFiles?.length || 0}`;
      }
      
      const context = {
        conversationHistory: [],
        previousFiles: {},
        relevantFiles: {},
        configFiles: {},
        summary: contextSummary,
      };
      
      // Use Two-Agent Orchestrator for intelligent code generation
      const result = await TwoAgentOrchestrator.execute(prompt, context, {
        projectId: projectId || undefined,
        versionId: null,
        isGitHubProject: mode === "github",
        repoFullName: mode === "github" ? ((repoAnalysis as any)?.repoUrl || '') : '',
        onProgress: async (stage, message) => {
          if (projectId) {
            await streamingService.emit(projectId, {
              type: 'step:start',
              step: stage,
              message,
            });
          }
        },
      });
      
      // Convert TwoAgentOrchestrator result to expected format
      return {
        state: {
          data: {
            summary: result.description || 'API generated successfully',
            files: { ...result.newFiles, ...result.modifiedFiles },
            requirements: [],
          } as AgentState
        }
      };
```

**Impact**: ~240 lines → ~45 lines (81% reduction)

---

## **Edit 2: Delete Helper Functions (Lines 2000-2125)**

### **DELETE THESE 3 FUNCTIONS**:

```typescript
// Line 2000-2026: DELETE
function extractErrorInfo(prompt: string): { ... } | null {
  // ... entire function ...
}

// Line 2028-2054: DELETE  
function classifyUserIntent(prompt: string): 'question' | 'code-change' | 'both' {
  // ... entire function ...
}

// Line 2056-2125: DELETE
function getFrameworkSpecificRules(framework: string): string {
  // ... entire function ...
}
```

### **KEEP THIS ONE** (analyzeProjectPatterns is still used):
```typescript
// Line ~1960-1999: KEEP
function analyzeProjectPatterns(...) {
  // This is still used by the system
}
```

**Impact**: 126 lines deleted

---

## **Edit 3: Replace iterateAPI Step 6 (Lines 2313-~2800)**

### **FIND THIS** (Starting at line 2313):
```typescript
      // Step 6: Generate code with context
      const apiResult = await step.run("generate-api-code", async () => {
        // Emit step start event
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning changes...',
          versionId,
        });
        
        // Build enhanced prompt with smart context
        const enhancedPrompt = SmartContextBuilder.formatForPrompt(context, prompt);
        
        // Extract list of relevant files...
        const relevantFilePaths = Object.keys(context.relevantFiles || {});
        const allExistingFilePaths = Object.keys(context.previousFiles || {});
        
        // ... MASSIVE INLINE PROMPT (~500 lines)
        const completion = await openaiClient.chat.completions.create({
          model: "gpt-4o",
          stream: true,
          messages: [{
            role: "system",
            content: `You are v0, an expert code iteration assistant...
            [ENTIRE MASSIVE PROMPT]
```

### **REPLACE WITH**:
```typescript
      // Step 6: Generate code using TWO-AGENT SYSTEM
      const apiResult = await step.run("two-agent-code-generation", async () => {
        // Use Two-Agent Orchestrator with full context
        const result = await TwoAgentOrchestrator.execute(prompt, context, {
          projectId,
          versionId,
          isGitHubProject: projectInfo.isGitHubProject,
          repoFullName: projectInfo.repoFullName,
          onProgress: async (stage, message) => {
            await streamingService.emit(projectId, {
              type: 'step:start',
              step: stage,
              message,
              versionId,
            });
          },
        });
        
        // Handle question responses (no code changes)
        if (result.isAnswer) {
          return {
            state: {
              data: {
                summary: result.answer,
                files: {},
                requirements: [],
                isAnswer: true,
              } as AgentState
            }
          };
        }
        
        // Return code changes
        return {
          state: {
            data: {
              summary: result.description || 'Code updated successfully',
              files: { ...result.newFiles, ...result.modifiedFiles },
              requirements: [],
            } as AgentState
          }
        };
```

**Impact**: ~500 lines → ~35 lines (93% reduction)

---

## **Summary of All Changes**

| Edit | Location | Lines Before | Lines After | Reduction |
|------|----------|--------------|-------------|-----------|
| **1. generateAPI Step 3** | ~363-600 | ~240 | ~45 | **81%** |
| **2. Delete helpers** | 2000-2125 | 126 | 0 | **100%** |
| **3. iterateAPI Step 6** | ~2313-2800 | ~500 | ~35 | **93%** |
| **TOTAL** | Multiple | **~866** | **~80** | **91%** |

**Final File Size**: 4320 lines → ~3534 lines (**-786 lines, -18% total**)

---

## **Why Manual Editing is Recommended**

Given the massive size and complexity:
1. The inline prompts are **3000+ characters** each
2. They span **hundreds of lines**
3. The exact line numbers shift as edits are made
4. There's validation code interspersed throughout

**Recommended Approach**:
1. Open `src/inngest/functions.ts`
2. Find line 363 ("Step 3: Generate API using OpenAI")
3. Replace the entire step.run block with the new code above
4. Find lines 2000-2125 (helper functions)
5. Delete the 3 functions (keep analyzeProjectPatterns)
6. Find line 2313 ("Step 6: Generate code with context")
7. Replace the entire step.run block with the new code above

---

## **Testing After Changes**

```bash
# 1. Check compilation
npm run build

# 2. Test new API generation
# Navigate to /ask and try: "Create a REST API for user management"

# 3. Test iteration
# On existing project, try: "Add authentication to the API"

# 4. Test all modes
# Try questions, bug fixes, API integration, etc.
```

---

**All preparation is complete. The edits above will complete the integration!** 🎉

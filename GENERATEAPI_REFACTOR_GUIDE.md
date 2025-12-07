# generateAPI Refactoring Guide - EXACT INSTRUCTIONS

## 🎯 **What to Replace**

### **File**: `src/inngest/functions.ts`
### **Lines**: **363-709** (347 lines total)

---

## 📍 **Step 1: Find the Start**

Look for line **363**:
```typescript
const apiResult = await step.run("generate-api-code", async () => {
```

## 📍 **Step 2: Find the End**

Look for line **709**:
```typescript
    });
```
*(This closes the `step.run("generate-api-code")` block)*

---

## ✂️ **Step 3: Delete Everything Between**

Delete lines **363-709** entirely. This includes:
- ❌ Line 387: `openaiClient.chat.completions.create`
- ❌ Lines 392-508: Massive inline system prompt
- ❌ Lines 509-709: Manual streaming + JSON parsing loop

---

## ✨ **Step 4: Replace With New Code**

Paste this **EXACT code** at line 363:

```typescript
    // Step 3: Generate API using TWO-AGENT SYSTEM
    const apiResult = await step.run("generate-api-code", async () => {
      // Build context for initial API generation
      const context = {
        previousFiles: {},
        relevantFiles: {},
        configFiles: {},
        summary: mode === "github" && repoAnalysis 
          ? `Repository: ${(repoAnalysis as any).repoUrl}\nPackage: ${JSON.stringify((repoAnalysis as any).packageInfo)}`
          : 'New API project',
        conversationHistory: [],
      };

      // Emit step start event
      if (projectId) {
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning API structure...',
        });
      }

      // Use Two-Agent Orchestrator for initial generation
      const result = await TwoAgentOrchestrator.execute(prompt, context, {
        projectId: projectId || 'temp-project',
        versionId: undefined, // No version yet for initial generation
        isGitHubProject: mode === "github",
        repoFullName: repoUrl,
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

      // Convert TwoAgentOrchestrator result to AIResult format
      const combinedFiles = { ...result.newFiles, ...result.modifiedFiles };

      return {
        state: {
          data: {
            summary: result.description || 'API generated successfully',
            files: combinedFiles,
            requirements: [],
          } as AgentState
        }
      };
    });
```

---

## ✅ **Step 5: Verify**

After replacement, verify:
1. Line 363 now starts with: `// Step 3: Generate API using TWO-AGENT SYSTEM`
2. The new code block is ~50 lines (not 347)
3. No more `openaiClient.chat.completions.create` in this section
4. File compiles without errors

---

## 📊 **Expected Results**

**Before**: 347 lines of manual OpenAI streaming
**After**: ~50 lines of clean TwoAgentOrchestrator call
**Savings**: **297 lines** (85% reduction)

---

## 🚨 **Important Notes**

1. **Context Building**: The new code creates a simple context object since this is initial generation (no previous files)
2. **Mode Handling**: Preserves `mode === "github"` detection for repo context
3. **Streaming**: Uses `onProgress` callback for streaming events
4. **Compatibility**: Returns same `AIResult` format as before
5. **Project ID**: Uses temp ID if none provided (for standalone API gen)

---

## 🔧 **After Refactoring**

The rest of the `generateAPI` function continues unchanged:
- Step 4: Validate generated API
- Step 5: Save to database
- Step 6: Create sandbox
- Step 7: Version creation
- Step 8: GitHub PR (if applicable)
- etc.

---

## 💡 **Benefits**

✅ Consistent with `iterateAPI` approach
✅ Uses modular prompt system
✅ Better error handling
✅ Automatic streaming progress
✅ Cleaner, more maintainable code
✅ ~300 lines saved!

---

**Ready to refactor?** Just delete lines 363-709 and paste the new code! 🚀

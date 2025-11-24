# Step 6 Manual Replacement Guide - iterateAPI

## ✅ Status: Imports Added (Lines 13-14)
```typescript
import { TwoAgentOrchestrator } from '../services/two-agent-orchestrator';
import { DecisionAgent } from '../services/decision-agent';
```

## 🎯 What to Replace

**File:** `src/inngest/functions.ts`

**START:** Line 2312 - `// Step 6: Generate code with context`  
**END:** Line ~3017 - `});` (end of step.run("generate-api-code"))

This is approximately **705 lines** of massive inline prompt that needs to be replaced with **~50 lines** of clean TwoAgentOrchestrator code.

## 📋 EXACT Replacement Instructions

### Step 1: Find the Start
Locate line 2312:
```typescript
      // Step 6: Generate code with context
      const apiResult = await step.run("generate-api-code", async () => {
```

### Step 2: Find the End  
Scroll down to find the matching closing `});` - approximately line 3017. 

The line BEFORE it should be something like:
```typescript
        }
      }
    });
```

### Step 3: Delete Everything Between
Delete from line 2312 to line ~3017 (inclusive).

### Step 4: Paste This New Code

```typescript
      // Step 6: Generate code using TWO-AGENT SYSTEM
      const apiResult = await step.run("generate-api-code", async () => {
        // Emit step start event
        await streamingService.emit(projectId, {
          type: 'step:start',
          step: 'Planning',
          message: 'Planning changes...',
          versionId,
        });

        // Use Two-Agent Orchestrator for code generation
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
                summary: result.answer || 'Question answered',
                files: {},
                requirements: [],
                isAnswer: true,
              } as AgentState
            }
          };
        }

        // Merge new and modified files
        const combinedFiles = { ...result.newFiles, ...result.modifiedFiles };

        // Return in expected format
        return {
          state: {
            data: {
              summary: result.description || 'Code updated successfully',
              files: combinedFiles,
              requirements: [],
            } as AgentState
          }
        };
      });
```

## ✅ After Replacement

1. Save the file
2. Run: `npx tsc --noEmit --skipLibCheck`
3. Check for errors
4. Test the application

## 📊 Expected Results

- **Before**: ~705 lines with massive inline prompt
- **After**: ~50 lines with clean TwoAgentOrchestrator call  
- **Reduction**: ~655 lines saved (93%)

## 🎯 What This Does

1. Uses `TwoAgentOrchestrator.execute()` instead of manual OpenAI calls
2. Passes context and options properly
3. Handles streaming progress via `onProgress` callback
4. Handles question responses vs code changes
5. Returns proper format expected by rest of function

## ⚠️ Important Notes

- The rest of the `iterateAPI` function (Steps 7-10) remain unchanged
- This replacement only affects Step 6 (code generation)
- All other steps (context building, sandbox, validation) stay the same

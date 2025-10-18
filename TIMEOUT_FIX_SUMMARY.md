# Timeout Fix Summary

## Problem
- Inngest runs were failing after ~5 minutes per attempt
- Each attempt was timing out before the Next.js 15 build could complete
- No sandbox URL was being returned

## Root Causes
1. **Duplicate dependency installation** - Dependencies were being installed twice (once in Inngest, once in startPreviewServer)
2. **Insufficient timeouts** - Various timeouts were too short for Next.js 15 + Tailwind v4 projects
3. **Generic error messages** - Errors weren't showing detailed npm/build logs

## Fixes Applied

### 1. Removed Duplicate Installation
**File:** `src/inngest/functions.ts`
- Removed separate `installDependencies` call in Inngest function
- Dependencies now installed only once inside `startPreviewServer`
- Reduces total time and prevents double timeout issues

### 2. Increased Timeouts

#### Install Dependencies Timeout
**File:** `src/services/github-repository-service.ts`
- Primary install: `300000ms` (5 min) → `600000ms` (10 min)
- Fallback install: `300000ms` (5 min) → `600000ms` (10 min)

#### Server Start Timeout
**File:** `src/services/github-repository-service.ts`
- Server start command: `600000ms` (10 min) → `1200000ms` (20 min)
- This accommodates the 10-minute wait inside `compile_fullstack.sh` plus extra buffer

#### Script Wait Timeout
**File:** `compile_fullstack.sh`
- wait_for_server: `60 attempts` (1 min) → `600 attempts` (10 min)
- This allows Next.js 15 builds to complete properly

### 3. Improved Error Reporting
**File:** `src/services/github-repository-service.ts`
- Now captures full stderr, stdout, and server logs
- Shows last 100 lines of server logs on failure
- Includes npm install output in error context
- Helps diagnose actual build issues vs timeouts

### 4. Better Log Output
**File:** `compile_fullstack.sh`
- Shows last 50 lines of logs (was 20)
- More context for debugging build failures

### 5. Function Retry Configuration
**File:** `src/inngest/functions.ts`
- Added `retries: 2` to function config
- Allows Inngest to retry failed attempts
- Increases chance of success for intermittent failures

## Timeline for Next.js 15 Builds

### Typical Build Times:
1. **npm install**: 2-5 minutes
2. **First Next.js build**: 5-10 minutes (with Tailwind v4)
3. **Server startup**: 10-30 seconds
4. **Total**: 7-15 minutes

### Our Timeouts:
- Install: 10 minutes ✅
- Server start command: 20 minutes ✅
- Script wait: 10 minutes ✅
- **Total capacity**: ~30 minutes ✅

## Testing
These changes will take effect immediately on the next deployment. To test:
1. Deploy the updated code to Vercel
2. Trigger a new repository clone operation
3. Monitor Inngest dashboard for longer execution times
4. Check for detailed error messages if failures occur

## Expected Behavior After Fix
- ✅ Install step should complete within 10 minutes
- ✅ Server start should wait up to 10 minutes for build
- ✅ Sandbox URL should be returned in Inngest output
- ✅ Detailed error logs if build still fails
- ✅ Automatic retry on transient failures

## Notes
- **Template rebuild not required** - All timeout changes are in the codebase
- **Vercel limits** - Ensure your Vercel plan supports long function execution times
- **E2B limits** - E2B sandboxes have default limits; check your plan if issues persist

-- Migration: Enhanced Sandbox Persistence Metadata
-- Purpose: Add columns to support automatic sandbox restoration and tracking
-- Date: 2024

-- Add metadata column (CRITICAL: needed by restart API)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add columns for enhanced sandbox tracking
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS last_sandbox_check TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS sandbox_status TEXT DEFAULT 'unknown';

-- Add index for faster sandbox status queries
CREATE INDEX IF NOT EXISTS idx_projects_sandbox_status ON public.projects(sandbox_status);
CREATE INDEX IF NOT EXISTS idx_projects_last_sandbox_check ON public.projects(last_sandbox_check);
CREATE INDEX IF NOT EXISTS idx_projects_metadata_gin ON public.projects USING GIN (metadata);

-- Add check constraint for sandbox_status
ALTER TABLE public.projects
DROP CONSTRAINT IF EXISTS projects_sandbox_status_check;

ALTER TABLE public.projects
ADD CONSTRAINT projects_sandbox_status_check 
CHECK (sandbox_status IN ('active', 'expired', 'restoring', 'failed', 'unknown'));

-- Initialize metadata for existing projects with framework info
UPDATE public.projects
SET metadata = jsonb_build_object(
  'framework', COALESCE(framework, 'unknown')
)
WHERE metadata IS NULL OR metadata = '{}'::jsonb;

-- Comments for documentation
COMMENT ON COLUMN public.projects.last_sandbox_check IS 'Last time sandbox status was checked (for auto-restoration logic)';
COMMENT ON COLUMN public.projects.sandbox_status IS 'Current sandbox status: active, expired, restoring, failed, unknown';
COMMENT ON COLUMN public.projects.metadata IS 'JSON metadata including: sandboxId, framework, port, packageManager, startCommand, lastRestarted, lastSuccessfulRestore';

-- Example metadata structure:
-- {
--   "sandboxId": "abc123xyz",
--   "framework": "nextjs",
--   "port": 3000,
--   "packageManager": "npm",
--   "startCommand": "npm run dev",
--   "lastRestarted": "2024-01-01T00:00:00Z",
--   "lastSuccessfulRestore": "2024-01-01T00:00:00Z"
-- }

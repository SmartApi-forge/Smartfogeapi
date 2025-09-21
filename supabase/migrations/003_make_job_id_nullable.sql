-- Make job_id nullable in api_fragments table to allow API generation without job tracking
ALTER TABLE public.api_fragments 
  ALTER COLUMN job_id DROP NOT NULL;

-- Update RLS policies to handle null job_id cases
DROP POLICY IF EXISTS "Users can view own api_fragments" ON public.api_fragments;
DROP POLICY IF EXISTS "Users can create api_fragments for own jobs" ON public.api_fragments;
DROP POLICY IF EXISTS "Users can update own api_fragments" ON public.api_fragments;

-- New RLS policies that handle null job_id
CREATE POLICY "Users can view own api_fragments" ON public.api_fragments
  FOR SELECT USING (
    job_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create api_fragments" ON public.api_fragments
  FOR INSERT WITH CHECK (
    job_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own api_fragments" ON public.api_fragments
  FOR UPDATE USING (
    job_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

-- Add index for performance on nullable job_id
DROP INDEX IF EXISTS idx_api_fragments_job_id;
CREATE INDEX idx_api_fragments_job_id ON public.api_fragments(job_id) WHERE job_id IS NOT NULL;
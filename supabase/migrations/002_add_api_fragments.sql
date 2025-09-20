-- Add api_fragments table for storing generated API code and specifications
CREATE TABLE public.api_fragments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  job_id UUID REFERENCES public.jobs(id) ON DELETE CASCADE NOT NULL,
  openapi_spec JSONB,
  implementation_code JSONB,
  requirements TEXT[],
  description TEXT,
  validation_results JSONB,
  pr_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add missing columns to jobs table for Inngest workflow
ALTER TABLE public.jobs 
  ADD COLUMN IF NOT EXISTS prompt TEXT,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'standalone' CHECK (mode IN ('standalone', 'github')),
  ADD COLUMN IF NOT EXISTS repo_url TEXT;

-- Enable RLS for api_fragments
ALTER TABLE public.api_fragments ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_fragments
CREATE POLICY "Users can view own api_fragments" ON public.api_fragments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create api_fragments for own jobs" ON public.api_fragments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own api_fragments" ON public.api_fragments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jobs 
      WHERE jobs.id = api_fragments.job_id 
      AND jobs.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at on api_fragments
CREATE TRIGGER handle_api_fragments_updated_at
  BEFORE UPDATE ON public.api_fragments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add indexes for better performance
CREATE INDEX idx_api_fragments_job_id ON public.api_fragments(job_id);
CREATE INDEX idx_jobs_user_id_status ON public.jobs(user_id, status);
CREATE INDEX idx_jobs_mode ON public.jobs(mode);
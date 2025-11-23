-- Update Vercel integration schema for Platforms API approach
-- This replaces the OAuth-based approach with direct API deployment

-- Drop old OAuth table if it exists
DROP TABLE IF EXISTS public.vercel_connections CASCADE;

-- Update deployments table to support new flow
ALTER TABLE public.deployments
ADD COLUMN IF NOT EXISTS transfer_code TEXT,
ADD COLUMN IF NOT EXISTS claim_url TEXT,
ADD COLUMN IF NOT EXISTS claimed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMP WITH TIME ZONE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_deployments_vercel_deployment_id 
  ON public.deployments(vercel_deployment_id);

CREATE INDEX IF NOT EXISTS idx_deployments_project_id_user_id 
  ON public.deployments(project_id, user_id);

-- Update RLS policies for deployments
DROP POLICY IF EXISTS "Users can view their own deployments" ON public.deployments;
DROP POLICY IF EXISTS "Users can create their own deployments" ON public.deployments;
DROP POLICY IF EXISTS "Users can update their own deployments" ON public.deployments;
DROP POLICY IF NOT EXISTS "Users can delete their own deployments" ON public.deployments;

CREATE POLICY "Users can view their own deployments"
  ON public.deployments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments"
  ON public.deployments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments"
  ON public.deployments
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments"
  ON public.deployments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment for documentation
COMMENT ON TABLE public.deployments IS 'Vercel deployments using Platforms API - no OAuth required';
COMMENT ON COLUMN public.deployments.transfer_code IS 'Code for user to claim project ownership';
COMMENT ON COLUMN public.deployments.claim_url IS 'URL for user to claim project';
COMMENT ON COLUMN public.deployments.claimed IS 'Whether user has claimed the project';


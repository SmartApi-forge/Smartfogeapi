-- Migration: Add GitHub branch tracking for v0-style UI
-- This adds columns needed for the new GitHub branch selector UI

-- Add active_branch column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS active_branch TEXT DEFAULT 'main';

-- Add last_push_at timestamp to track when changes were last pushed
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS last_push_at TIMESTAMP WITH TIME ZONE;

-- Add last_pull_at timestamp to track when changes were last pulled
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS last_pull_at TIMESTAMP WITH TIME ZONE;

-- Add has_local_changes flag to indicate if there are unpushed changes
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS has_local_changes BOOLEAN DEFAULT FALSE;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_active_branch ON public.projects(active_branch);
CREATE INDEX IF NOT EXISTS idx_projects_github_mode ON public.projects(github_mode) WHERE github_mode = TRUE;

-- Add comments for documentation
COMMENT ON COLUMN public.projects.active_branch IS 'Currently active branch for GitHub-connected projects';
COMMENT ON COLUMN public.projects.last_push_at IS 'Timestamp of last push to GitHub';
COMMENT ON COLUMN public.projects.last_pull_at IS 'Timestamp of last pull from GitHub';
COMMENT ON COLUMN public.projects.has_local_changes IS 'Indicates if there are local changes not yet pushed to GitHub';

-- Create github_integrations table for simpler access token storage
CREATE TABLE IF NOT EXISTS public.github_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  github_username TEXT NOT NULL,
  github_user_id TEXT NOT NULL,
  avatar_url TEXT,
  scopes TEXT[],
  is_connected BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.github_integrations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for github_integrations
CREATE POLICY "Users can view their own GitHub integration" ON public.github_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GitHub integration" ON public.github_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own GitHub integration" ON public.github_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own GitHub integration" ON public.github_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER handle_github_integrations_updated_at
  BEFORE UPDATE ON public.github_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_github_integrations_user_id ON public.github_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_github_integrations_github_user_id ON public.github_integrations(github_user_id);

-- Comments
COMMENT ON TABLE public.github_integrations IS 'Stores GitHub OAuth tokens and connection status for users';
COMMENT ON COLUMN public.github_integrations.is_connected IS 'Indicates if the user is currently connected to GitHub';

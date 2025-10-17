-- GitHub Integration Schema
-- This migration adds tables and columns for GitHub repository integration

-- Create user_integrations table for storing OAuth tokens
CREATE TABLE IF NOT EXISTS public.user_integrations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('github', 'gitlab', 'bitbucket')),
  access_token TEXT NOT NULL, -- Will be encrypted
  refresh_token TEXT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  provider_user_id TEXT NOT NULL,
  provider_username TEXT NOT NULL,
  provider_email TEXT,
  scopes TEXT[], -- Array of granted OAuth scopes
  metadata JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, provider, provider_user_id)
);

-- Create github_repositories table for connected repositories
CREATE TABLE IF NOT EXISTS public.github_repositories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  integration_id UUID REFERENCES public.user_integrations(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  repo_id BIGINT NOT NULL, -- GitHub repository ID
  repo_full_name TEXT NOT NULL, -- owner/repo format
  repo_name TEXT NOT NULL,
  repo_owner TEXT NOT NULL,
  repo_url TEXT NOT NULL,
  default_branch TEXT DEFAULT 'main',
  is_private BOOLEAN DEFAULT FALSE,
  description TEXT,
  language TEXT,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT CHECK (sync_status IN ('idle', 'cloning', 'syncing', 'error')) DEFAULT 'idle',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, repo_full_name)
);

-- Create github_sync_history table for tracking push/pull operations
CREATE TABLE IF NOT EXISTS public.github_sync_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  repository_id UUID REFERENCES public.github_repositories(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('push', 'pull', 'clone', 'create_repo', 'create_branch', 'create_pr')),
  branch_name TEXT,
  commit_sha TEXT,
  commit_message TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
  error_message TEXT,
  files_changed INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add github_repo_id column to projects table to link projects with GitHub repos
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS github_repo_id UUID REFERENCES public.github_repositories(id) ON DELETE SET NULL;

-- Add github_mode column to projects to track if project was created from GitHub
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS github_mode BOOLEAN DEFAULT FALSE;

-- Add sandbox_url column to projects for storing E2B sandbox preview URLs
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS sandbox_url TEXT;

-- Enable RLS
ALTER TABLE public.user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_repositories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.github_sync_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_integrations
CREATE POLICY "Users can view their own integrations" ON public.user_integrations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own integrations" ON public.user_integrations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations" ON public.user_integrations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations" ON public.user_integrations
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for github_repositories
CREATE POLICY "Users can view their own repositories" ON public.github_repositories
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own repositories" ON public.github_repositories
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own repositories" ON public.github_repositories
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own repositories" ON public.github_repositories
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for github_sync_history
CREATE POLICY "Users can view their own sync history" ON public.github_sync_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sync history" ON public.github_sync_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER handle_user_integrations_updated_at
  BEFORE UPDATE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_github_repositories_updated_at
  BEFORE UPDATE ON public.github_repositories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_user_integrations_user_id ON public.user_integrations(user_id);
CREATE INDEX idx_user_integrations_provider ON public.user_integrations(provider, is_active);
CREATE INDEX idx_github_repositories_user_id ON public.github_repositories(user_id);
CREATE INDEX idx_github_repositories_project_id ON public.github_repositories(project_id);
CREATE INDEX idx_github_repositories_repo_full_name ON public.github_repositories(repo_full_name);
CREATE INDEX idx_github_sync_history_repository_id ON public.github_sync_history(repository_id);
CREATE INDEX idx_github_sync_history_project_id ON public.github_sync_history(project_id);
CREATE INDEX idx_github_sync_history_user_id ON public.github_sync_history(user_id);
CREATE INDEX idx_github_sync_history_created_at ON public.github_sync_history(created_at DESC);
CREATE INDEX idx_projects_github_repo_id ON public.projects(github_repo_id);

-- Comments for documentation
COMMENT ON TABLE public.user_integrations IS 'Stores OAuth integration tokens for external services';
COMMENT ON TABLE public.github_repositories IS 'Stores connected GitHub repositories';
COMMENT ON TABLE public.github_sync_history IS 'Tracks all GitHub sync operations (push, pull, clone, etc.)';
COMMENT ON COLUMN public.projects.github_repo_id IS 'Links project to a connected GitHub repository';
COMMENT ON COLUMN public.projects.github_mode IS 'Indicates if project was created from GitHub repository';
COMMENT ON COLUMN public.projects.sandbox_url IS 'E2B sandbox URL for preview server';


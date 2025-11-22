-- Migration: Add repo_url to projects table for easier access
-- This stores the GitHub repository URL directly in the projects table
-- to avoid joins when displaying project information

-- Add repo_url column to projects table
ALTER TABLE public.projects
ADD COLUMN IF NOT EXISTS repo_url TEXT;

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_projects_repo_url ON public.projects(repo_url);

-- Add comment for documentation
COMMENT ON COLUMN public.projects.repo_url IS 'GitHub repository URL for projects created from GitHub repositories';

-- Update existing projects with repo_url from github_repositories
UPDATE public.projects p
SET repo_url = gr.repo_url
FROM public.github_repositories gr
WHERE p.github_repo_id = gr.id
AND p.repo_url IS NULL
AND gr.repo_url IS NOT NULL;



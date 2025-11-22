-- Vercel Integration Schema
-- This migration adds tables for Vercel OAuth integration and deployments

-- Create vercel_connections table for storing user's Vercel OAuth tokens
CREATE TABLE IF NOT EXISTS public.vercel_connections (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_token TEXT NOT NULL, -- Vercel OAuth access token
  team_id TEXT, -- null for personal accounts, team ID for team accounts
  configuration_id TEXT NOT NULL, -- Vercel integration configuration ID
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Create deployments table for tracking Vercel deployments
CREATE TABLE IF NOT EXISTS public.deployments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  vercel_project_id TEXT NOT NULL, -- Vercel project ID
  vercel_deployment_id TEXT NOT NULL, -- Vercel deployment ID
  deployment_url TEXT NOT NULL, -- Live deployment URL
  status TEXT DEFAULT 'building' CHECK (status IN ('building', 'ready', 'error', 'canceled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.vercel_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vercel_connections
CREATE POLICY "Users can view their own Vercel connections" ON public.vercel_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own Vercel connections" ON public.vercel_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own Vercel connections" ON public.vercel_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own Vercel connections" ON public.vercel_connections
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for deployments
CREATE POLICY "Users can view their own deployments" ON public.deployments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own deployments" ON public.deployments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own deployments" ON public.deployments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own deployments" ON public.deployments
  FOR DELETE USING (auth.uid() = user_id);

-- Triggers for updated_at
CREATE TRIGGER handle_vercel_connections_updated_at
  BEFORE UPDATE ON public.vercel_connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_deployments_updated_at
  BEFORE UPDATE ON public.deployments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Indexes for performance
CREATE INDEX idx_vercel_connections_user_id ON public.vercel_connections(user_id);
CREATE INDEX idx_deployments_user_id ON public.deployments(user_id);
CREATE INDEX idx_deployments_project_id ON public.deployments(project_id);
CREATE INDEX idx_deployments_vercel_project_id ON public.deployments(vercel_project_id);
CREATE INDEX idx_deployments_created_at ON public.deployments(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.vercel_connections IS 'Stores Vercel OAuth connections for users';
COMMENT ON TABLE public.deployments IS 'Tracks Vercel deployments for projects';


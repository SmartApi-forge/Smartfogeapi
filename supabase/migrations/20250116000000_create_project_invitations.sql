-- Create project_invitations table for sharing projects
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  token TEXT NOT NULL UNIQUE,
  access_level TEXT NOT NULL DEFAULT 'public' CHECK (access_level IN ('public', 'workspace', 'personal', 'business')),
  email TEXT, -- Optional: for email invitations
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
  expires_at TIMESTAMP WITH TIME ZONE,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_collaborators table to track who has access to which projects
CREATE TABLE IF NOT EXISTS public.project_collaborators (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  access_level TEXT NOT NULL DEFAULT 'view' CHECK (access_level IN ('view', 'edit', 'admin')),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Enable RLS on new tables
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_invitations

-- Project owners can view all invitations for their projects
CREATE POLICY "Project owners can view invitations" ON public.project_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_invitations.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Project owners can create invitations
CREATE POLICY "Project owners can create invitations" ON public.project_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_invitations.project_id 
      AND projects.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

-- Project owners can update their invitations
CREATE POLICY "Project owners can update invitations" ON public.project_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_invitations.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Project owners can delete invitations
CREATE POLICY "Project owners can delete invitations" ON public.project_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_invitations.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Anyone can view invitation by token (for acceptance page)
CREATE POLICY "Anyone can view invitation by token" ON public.project_invitations
  FOR SELECT USING (true);

-- RLS Policies for project_collaborators

-- Users can view collaborators for projects they own or are collaborators on
CREATE POLICY "Users can view project collaborators" ON public.project_collaborators
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_collaborators.project_id 
      AND projects.user_id = auth.uid()
    ) OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators pc
      WHERE pc.project_id = project_collaborators.project_id
      AND pc.user_id = auth.uid()
    )
  );

-- Project owners can add collaborators
CREATE POLICY "Project owners can add collaborators" ON public.project_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_collaborators.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Project owners can update collaborators
CREATE POLICY "Project owners can update collaborators" ON public.project_collaborators
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_collaborators.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Project owners can remove collaborators
CREATE POLICY "Project owners can remove collaborators" ON public.project_collaborators
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects 
      WHERE projects.id = project_collaborators.project_id 
      AND projects.user_id = auth.uid()
    )
  );

-- Update projects RLS to include collaborators

-- Allow collaborators to view projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects or shared projects" ON public.projects
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators 
      WHERE project_collaborators.project_id = projects.id 
      AND project_collaborators.user_id = auth.uid()
    )
  );

-- Create updated_at triggers
CREATE TRIGGER handle_project_invitations_updated_at
  BEFORE UPDATE ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_project_collaborators_updated_at
  BEFORE UPDATE ON public.project_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_project_invitations_project_id ON public.project_invitations(project_id);
CREATE INDEX idx_project_invitations_token ON public.project_invitations(token);
CREATE INDEX idx_project_invitations_status ON public.project_invitations(status);
CREATE INDEX idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_user_id ON public.project_collaborators(user_id);

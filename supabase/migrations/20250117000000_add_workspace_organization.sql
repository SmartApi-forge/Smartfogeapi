-- Add workspace and organization fields to profiles for access level control
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS organization_id UUID;

-- Add visibility field to projects to store the access level
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'public' 
  CHECK (visibility IN ('public', 'workspace', 'personal', 'business'));

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON public.profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_organization_id ON public.profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON public.projects(visibility);

-- Update project_invitations to also store project visibility at invitation time
ALTER TABLE public.project_invitations ADD COLUMN IF NOT EXISTS project_visibility TEXT;

-- Create a function to validate project access based on visibility level
CREATE OR REPLACE FUNCTION public.can_access_project(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_project_visibility TEXT;
  v_project_owner_id UUID;
  v_user_workspace_id UUID;
  v_user_organization_id UUID;
  v_owner_workspace_id UUID;
  v_owner_organization_id UUID;
  v_is_collaborator BOOLEAN;
BEGIN
  -- Get project details
  SELECT visibility, user_id INTO v_project_visibility, v_project_owner_id
  FROM public.projects
  WHERE id = p_project_id;

  -- If project not found, deny access
  IF v_project_visibility IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner always has access
  IF v_project_owner_id = p_user_id THEN
    RETURN TRUE;
  END IF;

  -- Check if user is a collaborator
  SELECT EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = p_project_id AND user_id = p_user_id
  ) INTO v_is_collaborator;

  IF v_is_collaborator THEN
    RETURN TRUE;
  END IF;

  -- Public visibility: everyone with the link can access
  IF v_project_visibility = 'public' THEN
    RETURN TRUE;
  END IF;

  -- Personal visibility: only owner can access (already checked above)
  IF v_project_visibility = 'personal' THEN
    RETURN FALSE;
  END IF;

  -- Get user's workspace and organization
  SELECT workspace_id, organization_id INTO v_user_workspace_id, v_user_organization_id
  FROM public.profiles
  WHERE id = p_user_id;

  -- Get owner's workspace and organization
  SELECT workspace_id, organization_id INTO v_owner_workspace_id, v_owner_organization_id
  FROM public.profiles
  WHERE id = v_project_owner_id;

  -- Workspace visibility: same workspace as owner
  IF v_project_visibility = 'workspace' THEN
    RETURN v_user_workspace_id IS NOT NULL 
      AND v_owner_workspace_id IS NOT NULL 
      AND v_user_workspace_id = v_owner_workspace_id;
  END IF;

  -- Business visibility: same organization as owner
  IF v_project_visibility = 'business' THEN
    RETURN v_user_organization_id IS NOT NULL 
      AND v_owner_organization_id IS NOT NULL 
      AND v_user_organization_id = v_owner_organization_id;
  END IF;

  -- Default: deny access
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update RLS policy for projects to use the new access control function
DROP POLICY IF EXISTS "Users can view own projects or shared projects" ON public.projects;
CREATE POLICY "Users can view accessible projects" ON public.projects
  FOR SELECT USING (
    auth.uid() = user_id OR
    public.can_access_project(id, auth.uid()) OR
    EXISTS (
      SELECT 1 FROM public.project_collaborators 
      WHERE project_collaborators.project_id = projects.id 
      AND project_collaborators.user_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.workspace_id IS 'Workspace ID for workspace-level access control';
COMMENT ON COLUMN public.profiles.organization_id IS 'Organization ID for business-level access control';
COMMENT ON COLUMN public.projects.visibility IS 'Project visibility level: public, workspace, personal, or business';
COMMENT ON FUNCTION public.can_access_project IS 'Validates if a user can access a project based on visibility settings';

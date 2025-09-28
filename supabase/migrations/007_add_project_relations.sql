-- Add project_id to messages table to establish project-message relationship
ALTER TABLE public.messages 
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Add project_id to fragments table to establish project-fragment relationship  
ALTER TABLE public.fragments
ADD COLUMN project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- Create indexes for performance on the new foreign keys
CREATE INDEX idx_messages_project_id ON public.messages(project_id);
CREATE INDEX idx_fragments_project_id ON public.fragments(project_id);

-- Update RLS policies for messages to include project-based access
DROP POLICY IF EXISTS "Users can view messages they sent or received" ON public.messages;
CREATE POLICY "Users can view messages they sent, received, or from their projects" ON public.messages
  FOR SELECT USING (
    auth.uid() = sender_id OR 
    auth.uid() = receiver_id OR 
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND user_id = auth.uid()
    ))
  );

-- Update RLS policies for fragments to include project-based access
DROP POLICY IF EXISTS "Anyone can view fragments" ON public.fragments;
CREATE POLICY "Users can view fragments from their messages or projects" ON public.fragments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND (
        auth.uid() = m.sender_id OR 
        auth.uid() = m.receiver_id OR
        (m.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = m.project_id AND p.user_id = auth.uid()
        ))
      )
    ) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND user_id = auth.uid()
    ))
  );

-- Update create policies for fragments to include project-based creation
DROP POLICY IF EXISTS "Anyone can create fragments" ON public.fragments;
CREATE POLICY "Users can create fragments for their messages or projects" ON public.fragments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND (
        auth.uid() = m.sender_id OR 
        auth.uid() = m.receiver_id OR
        (m.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = m.project_id AND p.user_id = auth.uid()
        ))
      )
    ) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND user_id = auth.uid()
    ))
  );

-- Update other fragment policies similarly
DROP POLICY IF EXISTS "Anyone can update fragments" ON public.fragments;
CREATE POLICY "Users can update fragments from their messages or projects" ON public.fragments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND (
        auth.uid() = m.sender_id OR 
        auth.uid() = m.receiver_id OR
        (m.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = m.project_id AND p.user_id = auth.uid()
        ))
      )
    ) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND user_id = auth.uid()
    ))
  );

DROP POLICY IF EXISTS "Anyone can delete fragments" ON public.fragments;
CREATE POLICY "Users can delete fragments from their messages or projects" ON public.fragments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.messages m 
      WHERE m.id = message_id AND (
        auth.uid() = m.sender_id OR 
        auth.uid() = m.receiver_id OR
        (m.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.projects p 
          WHERE p.id = m.project_id AND p.user_id = auth.uid()
        ))
      )
    ) OR
    (project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects 
      WHERE id = project_id AND user_id = auth.uid()
    ))
  );

-- Add comments for documentation
COMMENT ON COLUMN public.messages.project_id IS 'Foreign key to projects table - groups messages by project';
COMMENT ON COLUMN public.fragments.project_id IS 'Foreign key to projects table - groups fragments by project';
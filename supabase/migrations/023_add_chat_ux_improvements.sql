-- Migration: Chat UX Improvements
-- Requirements: 5.8, 8.2

CREATE TABLE IF NOT EXISTS public.message_attachments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image', 'pdf', 'markdown', 'code', 'other')),
  size INTEGER NOT NULL,
  storage_path TEXT NOT NULL,
  thumbnail_path TEXT,
  content_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_message ON public.message_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_attachments_project ON public.message_attachments(project_id);
CREATE INDEX IF NOT EXISTS idx_attachments_type ON public.message_attachments(type);

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'code';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS context_sources JSONB DEFAULT '[]';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS file_reading_events JSONB DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_messages_mode ON public.messages(mode);

ALTER TABLE public.message_attachments ENABLE ROW LEVEL SECURITY;


CREATE POLICY "Users can view attachments from their projects" ON public.message_attachments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can create attachments for their projects" ON public.message_attachments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can update attachments from their projects" ON public.message_attachments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can delete attachments from their projects" ON public.message_attachments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
  );

COMMENT ON TABLE public.message_attachments IS 'Stores file attachments for chat messages';
COMMENT ON COLUMN public.message_attachments.type IS 'Attachment type: image, pdf, markdown, code, or other';
COMMENT ON COLUMN public.message_attachments.storage_path IS 'Path to the file in storage bucket';
COMMENT ON COLUMN public.message_attachments.thumbnail_path IS 'Path to thumbnail for image attachments';
COMMENT ON COLUMN public.message_attachments.content_hash IS 'Hash of file content for deduplication';
COMMENT ON COLUMN public.messages.mode IS 'Chat mode: ask (conversational) or code (file modifications)';
COMMENT ON COLUMN public.messages.context_sources IS 'JSON array of context sources used for RAG retrieval';
COMMENT ON COLUMN public.messages.file_reading_events IS 'JSON array of file reading events for UI indicators';

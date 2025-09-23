-- Create fragments table for storing message fragments/chunks
CREATE TABLE public.fragments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  fragment_type TEXT DEFAULT 'text' CHECK (fragment_type IN ('text', 'code', 'json', 'markdown')),
  order_index INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for fragments
ALTER TABLE public.fragments ENABLE ROW LEVEL SECURITY;

-- RLS policies for fragments (public access for now, can be restricted later)
CREATE POLICY "Anyone can view fragments" ON public.fragments
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create fragments" ON public.fragments
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update fragments" ON public.fragments
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete fragments" ON public.fragments
  FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER handle_fragments_updated_at
  BEFORE UPDATE ON public.fragments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_fragments_message_id ON public.fragments(message_id);
CREATE INDEX idx_fragments_type ON public.fragments(fragment_type);
CREATE INDEX idx_fragments_order ON public.fragments(message_id, order_index);
CREATE INDEX idx_fragments_created_at ON public.fragments(created_at DESC);
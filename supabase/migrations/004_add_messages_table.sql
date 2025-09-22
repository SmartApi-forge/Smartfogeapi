-- Create messages table for storing conversation messages
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  type TEXT NOT NULL CHECK (type IN ('result', 'error')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages (public access for now, can be restricted later)
CREATE POLICY "Anyone can view messages" ON public.messages
  FOR SELECT USING (true);

CREATE POLICY "Anyone can create messages" ON public.messages
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can update messages" ON public.messages
  FOR UPDATE USING (true);

CREATE POLICY "Anyone can delete messages" ON public.messages
  FOR DELETE USING (true);

-- Add trigger for updated_at
CREATE TRIGGER handle_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_messages_role ON public.messages(role);
CREATE INDEX idx_messages_type ON public.messages(type);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
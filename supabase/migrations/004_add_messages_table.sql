-- Create messages table for storing conversation messages
CREATE TABLE public.messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  content TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  type TEXT NOT NULL CHECK (type IN ('result', 'error')),
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for messages - user-scoped access
CREATE POLICY "Users can view messages they sent or received" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can create messages as sender" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    (receiver_id IS NULL OR EXISTS (SELECT 1 FROM auth.users WHERE id = receiver_id))
  );

CREATE POLICY "Users can update messages they sent or received" ON public.messages
  FOR UPDATE USING (auth.uid() = sender_id OR auth.uid() = receiver_id)
  WITH CHECK (
    auth.uid() = sender_id OR auth.uid() = receiver_id AND
    sender_id = OLD.sender_id AND -- Prevent changing sender_id
    created_at = OLD.created_at -- Prevent changing created_at
  );

CREATE POLICY "Users can delete messages they sent" ON public.messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Add trigger for updated_at
CREATE TRIGGER handle_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX idx_messages_role ON public.messages(role);
CREATE INDEX idx_messages_type ON public.messages(type);
CREATE INDEX idx_messages_created_at ON public.messages(created_at DESC);
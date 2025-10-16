-- Create code_modifications table to track AI-generated code changes
CREATE TABLE IF NOT EXISTS code_modifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  old_content TEXT,
  new_content TEXT NOT NULL,
  line_start INTEGER,
  line_end INTEGER,
  modification_type TEXT NOT NULL CHECK (modification_type IN ('edit', 'create', 'delete')),
  reason TEXT,
  applied BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX idx_code_modifications_project_id ON code_modifications(project_id);
CREATE INDEX idx_code_modifications_message_id ON code_modifications(message_id);
CREATE INDEX idx_code_modifications_applied ON code_modifications(applied);

-- Add RLS policies
ALTER TABLE code_modifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view code modifications for their own projects
CREATE POLICY "Users can view their own code modifications"
  ON code_modifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_modifications.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can insert code modifications for their own projects
CREATE POLICY "Users can insert code modifications for their own projects"
  ON code_modifications
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_modifications.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can update code modifications for their own projects
CREATE POLICY "Users can update their own code modifications"
  ON code_modifications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_modifications.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Policy: Users can delete code modifications for their own projects
CREATE POLICY "Users can delete their own code modifications"
  ON code_modifications
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = code_modifications.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_code_modifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_code_modifications_updated_at
  BEFORE UPDATE ON code_modifications
  FOR EACH ROW
  EXECUTE FUNCTION update_code_modifications_updated_at();



-- Create versions table for storing code iteration snapshots
CREATE TABLE IF NOT EXISTS versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  files JSONB NOT NULL DEFAULT '{}',
  command_type TEXT CHECK (command_type IN ('CREATE_FILE', 'MODIFY_FILE', 'DELETE_FILE', 'REFACTOR_CODE', 'GENERATE_API')),
  prompt TEXT NOT NULL,
  parent_version_id UUID REFERENCES versions(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'generating' CHECK (status IN ('generating', 'complete', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_number)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_versions_project_id ON versions(project_id);
CREATE INDEX IF NOT EXISTS idx_versions_parent ON versions(parent_version_id);
CREATE INDEX IF NOT EXISTS idx_versions_status ON versions(status);
CREATE INDEX IF NOT EXISTS idx_versions_created_at ON versions(created_at DESC);

-- Add version_id column to fragments table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'fragments' AND column_name = 'version_id'
  ) THEN
    ALTER TABLE fragments ADD COLUMN version_id UUID REFERENCES versions(id) ON DELETE SET NULL;
    CREATE INDEX idx_fragments_version_id ON fragments(version_id);
  END IF;
END $$;

-- Add version_id column to generation_events table if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'generation_events' AND column_name = 'version_id'
  ) THEN
    ALTER TABLE generation_events ADD COLUMN version_id UUID REFERENCES versions(id) ON DELETE SET NULL;
    CREATE INDEX idx_generation_events_version_id ON generation_events(version_id);
  END IF;
END $$;

-- Update event_type check constraint to include version events
ALTER TABLE generation_events DROP CONSTRAINT IF EXISTS generation_events_event_type_check;
ALTER TABLE generation_events ADD CONSTRAINT generation_events_event_type_check 
  CHECK (event_type = ANY (ARRAY[
    'project:created'::text, 
    'version:start'::text,
    'version:complete'::text,
    'step:start'::text, 
    'step:complete'::text, 
    'file:generating'::text, 
    'code:chunk'::text, 
    'file:complete'::text, 
    'validation:start'::text, 
    'validation:complete'::text, 
    'complete'::text, 
    'error'::text
  ]));

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_versions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for auto-updating updated_at
DROP TRIGGER IF EXISTS versions_updated_at_trigger ON versions;
CREATE TRIGGER versions_updated_at_trigger
  BEFORE UPDATE ON versions
  FOR EACH ROW
  EXECUTE FUNCTION update_versions_updated_at();

-- Enable Row Level Security
ALTER TABLE versions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for versions table
CREATE POLICY "Users can view their own project versions"
  ON versions FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert versions for their own projects"
  ON versions FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own project versions"
  ON versions FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own project versions"
  ON versions FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add helpful comment
COMMENT ON TABLE versions IS 'Stores complete snapshots of code for each iteration/version of a project';
COMMENT ON COLUMN versions.files IS 'Complete file snapshot stored as JSONB. NOT diffs - full files.';
COMMENT ON COLUMN versions.parent_version_id IS 'Links to the previous version for history tracking';
COMMENT ON COLUMN versions.metadata IS 'Stores OpenAPI spec, validation results, and other metadata';


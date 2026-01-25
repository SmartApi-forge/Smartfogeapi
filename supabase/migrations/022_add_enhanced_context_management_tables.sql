-- Enhanced Context Management Tables
-- Requirements: 1.4, 3.1, 3.4, 16.1

-- Project Knowledge table for long-term memory storage
-- Stores project patterns, architectural decisions, and file relationships
CREATE TABLE IF NOT EXISTS project_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  patterns JSONB NOT NULL DEFAULT '{}',
  architectural_decisions TEXT[] DEFAULT '{}',
  file_relationships JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id)
);

-- File hashes table for Merkle tree tracking
-- Stores content hashes for efficient change detection
CREATE TABLE IF NOT EXISTS file_hashes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version_id UUID REFERENCES versions(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  file_size INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, version_id, file_path)
);

-- Environment variables table (encrypted)
-- Stores project environment variables securely
CREATE TABLE IF NOT EXISTS project_env_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  encrypted_value TEXT NOT NULL,
  is_secret BOOLEAN DEFAULT true,
  is_required BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, key)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_project_knowledge_project ON project_knowledge(project_id);
CREATE INDEX IF NOT EXISTS idx_file_hashes_project ON file_hashes(project_id);
CREATE INDEX IF NOT EXISTS idx_file_hashes_version ON file_hashes(version_id);
CREATE INDEX IF NOT EXISTS idx_file_hashes_content_hash ON file_hashes(content_hash);
CREATE INDEX IF NOT EXISTS idx_env_variables_project ON project_env_variables(project_id);

-- Enable RLS on new tables
ALTER TABLE project_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE file_hashes ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_env_variables ENABLE ROW LEVEL SECURITY;

-- RLS Policies for project_knowledge
CREATE POLICY "Users can view their own project knowledge"
  ON project_knowledge FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own project knowledge"
  ON project_knowledge FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own project knowledge"
  ON project_knowledge FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own project knowledge"
  ON project_knowledge FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for file_hashes
CREATE POLICY "Users can view their own file hashes"
  ON file_hashes FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own file hashes"
  ON file_hashes FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own file hashes"
  ON file_hashes FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own file hashes"
  ON file_hashes FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- RLS Policies for project_env_variables
CREATE POLICY "Users can view their own env variables"
  ON project_env_variables FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own env variables"
  ON project_env_variables FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own env variables"
  ON project_env_variables FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own env variables"
  ON project_env_variables FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE project_knowledge IS 'Stores long-term memory including project patterns, architectural decisions, and file relationships';
COMMENT ON TABLE file_hashes IS 'Stores content hashes for Merkle tree-based change detection';
COMMENT ON TABLE project_env_variables IS 'Stores encrypted environment variables for projects';

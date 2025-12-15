-- V0/Lovable Architecture Database Schema Migration
-- This migration creates the new optimized tables for direct SSE streaming architecture
-- Requirements: 2.1, 2.4, 3.1, 3.4, 4.1, 4.2, 8.1, 8.2, 8.3, 8.4, 8.5

-- ============================================================================
-- PART 1: Create conversation_messages table
-- Requirements: 2.1, 2.4, 8.1, 8.4, 8.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  user_message TEXT NOT NULL,
  assistant_response TEXT,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, turn_index)
);

-- Indexes for conversation_messages
CREATE INDEX IF NOT EXISTS idx_conv_messages_project ON conversation_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_conv_messages_turn ON conversation_messages(project_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_conv_messages_created ON conversation_messages(created_at DESC);

-- Enable RLS for conversation_messages
ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversation_messages
CREATE POLICY "Users can view their own conversation messages"
  ON conversation_messages FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own conversation messages"
  ON conversation_messages FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own conversation messages"
  ON conversation_messages FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own conversation messages"
  ON conversation_messages FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Trigger for updated_at on conversation_messages
CREATE TRIGGER handle_conversation_messages_updated_at
  BEFORE UPDATE ON conversation_messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

COMMENT ON TABLE conversation_messages IS 'Stores conversation turns for V0/Lovable architecture - replaces messages JSONB in projects';
COMMENT ON COLUMN conversation_messages.turn_index IS 'Sequential index starting from 1 for each conversation turn';
COMMENT ON COLUMN conversation_messages.user_message IS 'The user prompt for this turn';
COMMENT ON COLUMN conversation_messages.assistant_response IS 'The AI assistant response for this turn';


-- ============================================================================
-- PART 2: Create file_snapshots table
-- Requirements: 3.1, 3.4, 8.1, 8.4, 8.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  files_jsonb JSONB NOT NULL DEFAULT '{}',
  file_count INTEGER,
  total_size_bytes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, turn_index)
);

-- Indexes for file_snapshots
CREATE INDEX IF NOT EXISTS idx_file_snapshots_project ON file_snapshots(project_id);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_turn ON file_snapshots(project_id, turn_index DESC);
CREATE INDEX IF NOT EXISTS idx_file_snapshots_files_gin ON file_snapshots USING GIN (files_jsonb);

-- Enable RLS for file_snapshots
ALTER TABLE file_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for file_snapshots
CREATE POLICY "Users can view their own file snapshots"
  ON file_snapshots FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own file snapshots"
  ON file_snapshots FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own file snapshots"
  ON file_snapshots FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own file snapshots"
  ON file_snapshots FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE file_snapshots IS 'Stores complete file state after each conversation turn for V0/Lovable architecture';
COMMENT ON COLUMN file_snapshots.turn_index IS 'Turn index (0 for initial GitHub clone, 1+ for conversation turns)';
COMMENT ON COLUMN file_snapshots.files_jsonb IS 'JSONB containing all files: {path: {content, language, size}}';
COMMENT ON COLUMN file_snapshots.file_count IS 'Total number of files in this snapshot';
COMMENT ON COLUMN file_snapshots.total_size_bytes IS 'Total size of all files in bytes';


-- ============================================================================
-- PART 3: Create file_changes table
-- Requirements: 4.1, 4.2, 8.1, 8.4, 8.5
-- ============================================================================

CREATE TABLE IF NOT EXISTS file_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  turn_index INTEGER NOT NULL,
  changes JSONB NOT NULL DEFAULT '[]',
  execution_status TEXT DEFAULT 'pending' CHECK (execution_status IN ('pending', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for file_changes
CREATE INDEX IF NOT EXISTS idx_file_changes_project ON file_changes(project_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_turn ON file_changes(project_id, turn_index);
CREATE INDEX IF NOT EXISTS idx_file_changes_status ON file_changes(execution_status);

-- Enable RLS for file_changes
ALTER TABLE file_changes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for file_changes
CREATE POLICY "Users can view their own file changes"
  ON file_changes FOR SELECT
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own file changes"
  ON file_changes FOR INSERT
  WITH CHECK (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own file changes"
  ON file_changes FOR UPDATE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own file changes"
  ON file_changes FOR DELETE
  USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

COMMENT ON TABLE file_changes IS 'Tracks file changes for each conversation turn';
COMMENT ON COLUMN file_changes.changes IS 'JSONB array of changes: [{file, action, reason}]';
COMMENT ON COLUMN file_changes.execution_status IS 'Status of applying changes: pending, success, or failed';
COMMENT ON COLUMN file_changes.error_message IS 'Error message if execution_status is failed';


-- ============================================================================
-- PART 4: Remove unused tables and columns
-- Requirements: 8.2, 8.3
-- ============================================================================

-- Note: Using CASCADE to handle any dependent objects (triggers, policies, etc.)
-- These tables are being removed as part of the V0/Lovable architecture simplification

-- Drop jobs table (only 2 rows, adds complexity - replaced by direct streaming)
DROP TABLE IF EXISTS jobs CASCADE;

-- Drop api_fragments table (0 rows, unused - replaced by file_snapshots)
DROP TABLE IF EXISTS api_fragments CASCADE;

-- Drop templates table (0 rows, unused)
DROP TABLE IF EXISTS templates CASCADE;

-- Drop file_embeddings table (embeddings not working - using file snapshots instead)
DROP TABLE IF EXISTS file_embeddings CASCADE;

-- Drop file_hashes table (part of old context system - replaced by file_snapshots)
DROP TABLE IF EXISTS file_hashes CASCADE;

-- Note: The messages JSONB column doesn't exist in projects table based on schema review
-- The messages table exists separately and will be kept for now as it may have other uses
-- If there was a messages column in projects, it would be removed like this:
-- ALTER TABLE projects DROP COLUMN IF EXISTS messages;

-- ============================================================================
-- Summary of changes:
-- ============================================================================
-- CREATED:
--   - conversation_messages: Stores conversation turns (user_message, assistant_response)
--   - file_snapshots: Stores complete file state after each turn (files_jsonb)
--   - file_changes: Tracks what files changed in each turn (changes jsonb)
--
-- REMOVED:
--   - jobs: Replaced by direct SSE streaming
--   - api_fragments: Replaced by file_snapshots
--   - templates: Unused
--   - file_embeddings: Embeddings not working, using file snapshots
--   - file_hashes: Part of old context system
-- ============================================================================


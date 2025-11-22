-- Add CLONE_REPO to the command_type check constraint
-- This allows GitHub repository cloning to create versions

-- First, drop the existing constraint
ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_command_type_check;

-- Add the updated constraint with CLONE_REPO included
ALTER TABLE versions ADD CONSTRAINT versions_command_type_check 
  CHECK (command_type IN (
    'CREATE_FILE',
    'MODIFY_FILE', 
    'DELETE_FILE',
    'REFACTOR_CODE',
    'GENERATE_API',
    'CLONE_REPO'
  ));

-- Add comment to explain the constraint
COMMENT ON CONSTRAINT versions_command_type_check ON versions IS 
  'Ensures command_type is one of the allowed values including CLONE_REPO for GitHub integration';

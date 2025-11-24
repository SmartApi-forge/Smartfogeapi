-- Update command_type constraint to support new DecisionAgent intent types
-- Replaces old legacy command types with new AI-powered classification

-- Drop the existing constraint
ALTER TABLE versions DROP CONSTRAINT IF EXISTS versions_command_type_check;

-- Add the updated constraint with DecisionAgent intent types
ALTER TABLE versions ADD CONSTRAINT versions_command_type_check 
  CHECK (command_type IN (
    'CREATE',
    'MODIFY',
    'CREATE_AND_LINK',
    'FIX_ERROR',
    'QUESTION'
  ));

-- Add comment to explain the new constraint
COMMENT ON CONSTRAINT versions_command_type_check ON versions IS 
  'Ensures command_type is one of the DecisionAgent intent types (CREATE, MODIFY, CREATE_AND_LINK, FIX_ERROR, QUESTION)';

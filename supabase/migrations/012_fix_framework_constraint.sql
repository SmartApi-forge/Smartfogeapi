-- Fix projects_framework_check constraint to allow more frameworks
-- This allows GitHub integration to work with frontend frameworks

-- Drop the existing constraint
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_framework_check;

-- Add new constraint with more framework options
ALTER TABLE projects ADD CONSTRAINT projects_framework_check 
  CHECK (framework IN (
    'fastapi', 
    'express', 
    'nextjs', 
    'react', 
    'vue', 
    'angular', 
    'flask', 
    'django', 
    'python', 
    'unknown'
  ));

-- Also update the status constraint to include 'pending' status
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check 
  CHECK (status IN ('pending', 'generating', 'testing', 'deploying', 'deployed', 'failed'));

-- Update templates table constraint as well
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_framework_check;
ALTER TABLE templates ADD CONSTRAINT templates_framework_check 
  CHECK (framework IN (
    'fastapi', 
    'express', 
    'nextjs', 
    'react', 
    'vue', 
    'angular', 
    'flask', 
    'django', 
    'python', 
    'unknown'
  ));

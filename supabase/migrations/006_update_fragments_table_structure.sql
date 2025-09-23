-- Update fragments table structure to match TypeScript types and requirements
-- This migration adds the required fields for the saveResult functionality

-- Add the new required columns
ALTER TABLE public.fragments 
ADD COLUMN IF NOT EXISTS sandbox_url TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS files JSONB DEFAULT '{}';

-- Update existing records to have default values for new columns
UPDATE public.fragments 
SET 
  sandbox_url = COALESCE(sandbox_url, 'https://example.com'),
  title = COALESCE(title, 'fragment'),
  files = COALESCE(files, '{}');

-- Make sandbox_url and title NOT NULL after setting defaults
ALTER TABLE public.fragments 
ALTER COLUMN sandbox_url SET NOT NULL,
ALTER COLUMN title SET NOT NULL;

-- Add constraints for data validation
ALTER TABLE public.fragments 
ADD CONSTRAINT fragments_sandbox_url_check CHECK (sandbox_url ~ '^https?://.*'),
ADD CONSTRAINT fragments_title_check CHECK (length(title) > 0);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_fragments_sandbox_url ON public.fragments(sandbox_url);
CREATE INDEX IF NOT EXISTS idx_fragments_title ON public.fragments(title);

-- Update the RLS policies to ensure proper access control
-- (keeping existing policies but ensuring they work with new structure)

-- Add comment for documentation
COMMENT ON COLUMN public.fragments.sandbox_url IS 'URL of the generated sandbox environment';
COMMENT ON COLUMN public.fragments.title IS 'Title/name of the fragment';
COMMENT ON COLUMN public.fragments.files IS 'JSON object containing file paths and content';
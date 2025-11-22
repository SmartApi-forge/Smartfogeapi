-- FIX FOR: column reference "version_id" is ambiguous
-- This SQL fixes the search_file_embeddings function to properly qualify the version_id column

-- Drop the existing function if it exists
DROP FUNCTION IF EXISTS search_file_embeddings(vector, uuid, uuid, float, int, text[]);

-- Recreate the function with properly qualified column names
CREATE OR REPLACE FUNCTION search_file_embeddings(
  query_embedding vector(1536),
  project_id uuid,
  version_id uuid DEFAULT NULL,
  similarity_threshold float DEFAULT 0.5,
  match_limit int DEFAULT 10,
  file_types text[] DEFAULT NULL
)
RETURNS TABLE (
  file_path text,
  similarity float,
  tokens int,
  language text,
  file_type text,
  imports text[],
  exports text[]
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fe.file_path,
    1 - (fe.embedding <=> query_embedding) AS similarity,
    fe.tokens,
    fe.language,
    fe.file_type,
    fe.imports,
    fe.exports
  FROM file_embeddings fe
  WHERE 
    fe.project_id = search_file_embeddings.project_id
    AND (
      search_file_embeddings.version_id IS NULL 
      OR fe.version_id = search_file_embeddings.version_id  -- Fully qualified
    )
    AND (
      file_types IS NULL 
      OR fe.file_type = ANY(file_types)
    )
    AND (1 - (fe.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY similarity DESC
  LIMIT match_limit;
END;
$$;

-- Grant execute permission to the authenticated role
GRANT EXECUTE ON FUNCTION search_file_embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION search_file_embeddings TO service_role;

-- Test the function with a dummy query (this will return empty results but verify syntax)
-- SELECT * FROM search_file_embeddings(
--   array_fill(0::float, ARRAY[1536])::vector,
--   '00000000-0000-0000-0000-000000000000'::uuid,
--   NULL,
--   0.5,
--   5,
--   NULL
-- );

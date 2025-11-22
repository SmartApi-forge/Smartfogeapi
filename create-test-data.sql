-- Sample Test Data for Messages Project Filtering
-- Run this in your Supabase SQL editor to create test data

-- STEP 1: First check what users exist in the users table (not auth.users)
-- Run this query first to see available user IDs:
-- SELECT id, email FROM users LIMIT 5;

-- STEP 2: If no users exist, create a test user first:
-- INSERT INTO users (id, email, created_at, updated_at) 
-- VALUES ('8b6238f7-2627-41a6-bdc6-5bd73a497384', 'santhoshpitchai13@gmail.com', NOW(), NOW())
-- ON CONFLICT (id) DO NOTHING;

-- STEP 3: Then create the projects with a valid user_id
-- First, let's create some test projects (if they don't exist)
INSERT INTO projects (id, user_id, name, description, created_at, updated_at) 
VALUES 
  ('550e8400-e29b-41d4-a716-446655440000', '8b6238f7-2627-41a6-bdc6-5bd73a497384', 'Test Project Alpha', 'First test project for message filtering', NOW(), NOW()),
  ('6ba7b810-9dad-11d1-80b4-00c04fd430c8', '8b6238f7-2627-41a6-bdc6-5bd73a497384', 'Test Project Beta', 'Second test project for message filtering', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

-- Insert test messages for Project Alpha
INSERT INTO messages (id, content, role, type, project_id, created_at, updated_at) 
VALUES 
  ('msg-alpha-001', 'Hello from Project Alpha - Message 1', 'user', 'text', '550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('msg-alpha-002', 'This is the second message in Project Alpha', 'assistant', 'text', '550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),
  ('msg-alpha-003', 'Project Alpha - Third message with system role', 'system', 'text', '550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '3 minutes', NOW() - INTERVAL '3 minutes'),
  ('msg-alpha-004', 'Fourth message in Project Alpha', 'user', 'text', '550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('msg-alpha-005', 'Fifth and final test message for Project Alpha', 'assistant', 'text', '550e8400-e29b-41d4-a716-446655440000', NOW() - INTERVAL '1 minute', NOW() - INTERVAL '1 minute')
ON CONFLICT (id) DO NOTHING;

-- Insert test messages for Project Beta
INSERT INTO messages (id, content, role, type, project_id, created_at, updated_at) 
VALUES 
  ('msg-beta-001', 'Hello from Project Beta - Message 1', 'user', 'text', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
  ('msg-beta-002', 'Second message in Project Beta', 'assistant', 'text', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '9 minutes'),
  ('msg-beta-003', 'Project Beta - Third message', 'user', 'text', '6ba7b810-9dad-11d1-80b4-00c04fd430c8', NOW() - INTERVAL '8 minutes', NOW() - INTERVAL '8 minutes')
ON CONFLICT (id) DO NOTHING;

-- Insert some fragments for the messages to test includeFragment functionality
-- Note: fragments table requires sandbox_url, title, and files fields based on schema
INSERT INTO fragments (id, content, message_id, sandbox_url, title, files, created_at, updated_at) 
VALUES 
  ('frag-alpha-001-1', 'Fragment 1 for Alpha Message 1', 'msg-alpha-001', 'https://example.com/sandbox/1', 'Fragment 1 Title', '{}', NOW() - INTERVAL '5 minutes', NOW() - INTERVAL '5 minutes'),
  ('frag-alpha-001-2', 'Fragment 2 for Alpha Message 1', 'msg-alpha-001', 'https://example.com/sandbox/2', 'Fragment 2 Title', '{}', NOW() - INTERVAL '4 minutes 30 seconds', NOW() - INTERVAL '4 minutes 30 seconds'),
  ('frag-alpha-002-1', 'Fragment for Alpha Message 2', 'msg-alpha-002', 'https://example.com/sandbox/3', 'Fragment 3 Title', '{}', NOW() - INTERVAL '4 minutes', NOW() - INTERVAL '4 minutes'),
  ('frag-alpha-004-1', 'Fragment for Alpha Message 4', 'msg-alpha-004', 'https://example.com/sandbox/4', 'Fragment 4 Title', '{}', NOW() - INTERVAL '2 minutes', NOW() - INTERVAL '2 minutes'),
  ('frag-beta-001-1', 'Fragment for Beta Message 1', 'msg-beta-001', 'https://example.com/sandbox/5', 'Fragment 5 Title', '{}', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
  ('frag-beta-002-1', 'Fragment for Beta Message 2', 'msg-beta-002', 'https://example.com/sandbox/6', 'Fragment 6 Title', '{}', NOW() - INTERVAL '9 minutes', NOW() - INTERVAL '9 minutes')
ON CONFLICT (id) DO NOTHING;

-- Verification queries to check the test data
-- Run these to verify your test data was inserted correctly

-- Check messages by project
SELECT 
  'Project Alpha Messages' as test_case,
  COUNT(*) as message_count
FROM messages 
WHERE project_id = '550e8400-e29b-41d4-a716-446655440000'

UNION ALL

SELECT 
  'Project Beta Messages' as test_case,
  COUNT(*) as message_count
FROM messages 
WHERE project_id = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

-- Check messages with fragments
SELECT 
  m.id,
  m.content,
  m.project_id,
  COUNT(f.id) as fragment_count
FROM messages m
LEFT JOIN fragments f ON m.id = f.message_id
WHERE m.project_id IN ('550e8400-e29b-41d4-a716-446655440000', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')
GROUP BY m.id, m.content, m.project_id
ORDER BY m.project_id, m.created_at;

-- Test the actual query that your API will use
SELECT 
  m.*,
  COALESCE(
    JSON_AGG(
      JSON_BUILD_OBJECT(
        'id', f.id,
        'content', f.content,
        'message_id', f.message_id,
        'created_at', f.created_at,
        'updated_at', f.updated_at
      )
    ) FILTER (WHERE f.id IS NOT NULL),
    '[]'::json
  ) as fragments
FROM messages m
LEFT JOIN fragments f ON m.id = f.message_id
WHERE m.project_id = '550e8400-e29b-41d4-a716-446655440000'
GROUP BY m.id
ORDER BY m.updated_at DESC
LIMIT 10;
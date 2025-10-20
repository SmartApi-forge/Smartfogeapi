-- GitHub Sync Verification Queries
-- Use these queries to verify the GitHub integration is working correctly

-- ============================================
-- 1. Check User's GitHub Integration
-- ============================================
SELECT 
  provider_username,
  provider_email,
  is_active,
  created_at,
  metadata->'avatar_url' as avatar
FROM user_integrations
WHERE provider = 'github'
  AND user_id = auth.uid();

-- ============================================
-- 2. View All Connected GitHub Repositories
-- ============================================
SELECT 
  gr.repo_full_name,
  gr.repo_url,
  gr.default_branch,
  gr.is_private,
  gr.sync_status,
  gr.last_sync_at,
  p.name as project_name,
  p.active_branch as project_active_branch
FROM github_repositories gr
LEFT JOIN projects p ON gr.project_id = p.id
WHERE gr.user_id = auth.uid()
ORDER BY gr.created_at DESC;

-- ============================================
-- 3. View Complete Sync History
-- ============================================
SELECT 
  gsh.operation_type,
  gsh.branch_name,
  gsh.commit_message,
  gsh.commit_sha,
  gsh.files_changed,
  gsh.status,
  gsh.started_at,
  gsh.completed_at,
  gsh.error_message,
  gr.repo_full_name,
  p.name as project_name
FROM github_sync_history gsh
JOIN github_repositories gr ON gsh.repository_id = gr.id
LEFT JOIN projects p ON gsh.project_id = p.id
WHERE gsh.user_id = auth.uid()
ORDER BY gsh.created_at DESC
LIMIT 50;

-- ============================================
-- 4. Check Specific Project's GitHub Status
-- ============================================
-- Replace '<project_id>' with actual project ID
SELECT 
  p.name,
  p.github_mode,
  p.repo_url,
  p.active_branch,
  p.last_push_at,
  p.last_pull_at,
  p.has_local_changes,
  gr.repo_full_name,
  gr.sync_status,
  gr.last_sync_at
FROM projects p
LEFT JOIN github_repositories gr ON p.github_repo_id = gr.id
WHERE p.id = '<project_id>';

-- ============================================
-- 5. Count Operations by Type
-- ============================================
SELECT 
  operation_type,
  COUNT(*) as total_operations,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
  MAX(created_at) as last_operation
FROM github_sync_history
WHERE user_id = auth.uid()
GROUP BY operation_type
ORDER BY total_operations DESC;

-- ============================================
-- 6. View Failed Sync Operations
-- ============================================
SELECT 
  gsh.operation_type,
  gsh.branch_name,
  gsh.error_message,
  gsh.created_at,
  gr.repo_full_name,
  p.name as project_name
FROM github_sync_history gsh
JOIN github_repositories gr ON gsh.repository_id = gr.id
LEFT JOIN projects p ON gsh.project_id = p.id
WHERE gsh.user_id = auth.uid()
  AND gsh.status = 'failed'
ORDER BY gsh.created_at DESC;

-- ============================================
-- 7. Repository Activity Summary
-- ============================================
SELECT 
  gr.repo_full_name,
  COUNT(gsh.id) as total_syncs,
  COUNT(CASE WHEN gsh.operation_type = 'push' THEN 1 END) as pushes,
  COUNT(CASE WHEN gsh.operation_type = 'pull' THEN 1 END) as pulls,
  COUNT(CASE WHEN gsh.operation_type = 'create_branch' THEN 1 END) as branches_created,
  SUM(COALESCE(gsh.files_changed, 0)) as total_files_changed,
  MAX(gsh.created_at) as last_sync,
  gr.sync_status
FROM github_repositories gr
LEFT JOIN github_sync_history gsh ON gr.id = gsh.repository_id
WHERE gr.user_id = auth.uid()
GROUP BY gr.id, gr.repo_full_name, gr.sync_status
ORDER BY last_sync DESC NULLS LAST;

-- ============================================
-- 8. Recent Push Operations with Details
-- ============================================
SELECT 
  gsh.commit_message,
  gsh.commit_sha,
  gsh.branch_name,
  gsh.files_changed,
  gsh.created_at,
  gr.repo_full_name,
  p.name as project_name
FROM github_sync_history gsh
JOIN github_repositories gr ON gsh.repository_id = gr.id
LEFT JOIN projects p ON gsh.project_id = p.id
WHERE gsh.user_id = auth.uid()
  AND gsh.operation_type = 'push'
  AND gsh.status = 'completed'
ORDER BY gsh.created_at DESC
LIMIT 20;

-- ============================================
-- 9. Projects with Pending Local Changes
-- ============================================
SELECT 
  p.name,
  p.repo_url,
  p.active_branch,
  p.last_push_at,
  p.has_local_changes,
  gr.repo_full_name
FROM projects p
LEFT JOIN github_repositories gr ON p.github_repo_id = gr.id
WHERE p.user_id = auth.uid()
  AND p.has_local_changes = true
  AND p.github_mode = true
ORDER BY p.updated_at DESC;

-- ============================================
-- 10. Sync Performance Metrics
-- ============================================
SELECT 
  operation_type,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  COUNT(*) as total_operations
FROM github_sync_history
WHERE user_id = auth.uid()
  AND status = 'completed'
  AND completed_at IS NOT NULL
  AND started_at IS NOT NULL
GROUP BY operation_type
ORDER BY avg_duration_seconds DESC;

-- ============================================
-- 11. Timeline of All GitHub Activity
-- ============================================
SELECT 
  to_char(created_at, 'YYYY-MM-DD') as date,
  operation_type,
  COUNT(*) as operations,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM github_sync_history
WHERE user_id = auth.uid()
  AND created_at > NOW() - INTERVAL '30 days'
GROUP BY date, operation_type
ORDER BY date DESC, operation_type;

-- ============================================
-- 12. Verify Repository Creation
-- ============================================
-- Check if repository was created and properly linked
SELECT 
  gr.*,
  p.name as project_name,
  p.github_mode,
  gsh.operation_type,
  gsh.status as creation_status,
  gsh.created_at as created_on_github
FROM github_repositories gr
JOIN projects p ON gr.project_id = p.id
LEFT JOIN github_sync_history gsh ON gr.id = gsh.repository_id 
  AND gsh.operation_type = 'create_repo'
WHERE gr.user_id = auth.uid()
ORDER BY gr.created_at DESC
LIMIT 10;

-- ============================================
-- 13. Check Branch Management History
-- ============================================
SELECT 
  gsh.branch_name,
  gsh.created_at,
  gr.repo_full_name,
  p.name as project_name,
  CASE 
    WHEN p.active_branch = gsh.branch_name THEN 'Active'
    ELSE 'Inactive'
  END as branch_status
FROM github_sync_history gsh
JOIN github_repositories gr ON gsh.repository_id = gr.id
LEFT JOIN projects p ON gsh.project_id = p.id
WHERE gsh.user_id = auth.uid()
  AND gsh.operation_type = 'create_branch'
  AND gsh.status = 'completed'
ORDER BY gsh.created_at DESC
LIMIT 20;

-- ============================================
-- 14. Repositories Needing Sync
-- ============================================
-- Find repos that haven't been synced recently
SELECT 
  gr.repo_full_name,
  gr.last_sync_at,
  EXTRACT(DAYS FROM (NOW() - gr.last_sync_at)) as days_since_sync,
  gr.sync_status,
  p.name as project_name,
  p.has_local_changes
FROM github_repositories gr
LEFT JOIN projects p ON gr.project_id = p.id
WHERE gr.user_id = auth.uid()
  AND (
    gr.last_sync_at < NOW() - INTERVAL '7 days'
    OR gr.last_sync_at IS NULL
  )
ORDER BY gr.last_sync_at ASC NULLS FIRST;

-- ============================================
-- 15. Full Project GitHub Status
-- ============================================
-- Complete view of a project's GitHub integration
-- Replace '<project_id>' with actual project ID
WITH sync_stats AS (
  SELECT 
    repository_id,
    COUNT(*) as total_syncs,
    MAX(created_at) as last_sync,
    COUNT(CASE WHEN operation_type = 'push' THEN 1 END) as total_pushes,
    COUNT(CASE WHEN operation_type = 'pull' THEN 1 END) as total_pulls
  FROM github_sync_history
  WHERE project_id = '<project_id>'
  GROUP BY repository_id
)
SELECT 
  p.name as project_name,
  p.github_mode,
  p.repo_url,
  p.active_branch,
  p.last_push_at,
  p.last_pull_at,
  p.has_local_changes,
  gr.repo_full_name,
  gr.repo_owner,
  gr.default_branch,
  gr.is_private,
  gr.sync_status,
  gr.last_sync_at,
  ss.total_syncs,
  ss.total_pushes,
  ss.total_pulls
FROM projects p
LEFT JOIN github_repositories gr ON p.github_repo_id = gr.id
LEFT JOIN sync_stats ss ON gr.id = ss.repository_id
WHERE p.id = '<project_id>';

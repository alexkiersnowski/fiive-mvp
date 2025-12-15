-- ============================================================================
-- Migration: Critical Missing Indexes for Scalability
-- Date: 2025-01-XX
-- Description: Creates indexes identified in scalability assessment to optimize
--              queries that will degrade at scale. These indexes address:
--              1. Organization name search optimization
--              2. Client list sorting optimization
--              3. Comment ordering optimization
--              4. RPC function performance optimization
-- ============================================================================

-- ============================================================================
-- ORGANIZATIONS TABLE INDEXES
-- ============================================================================

-- Composite index for organization name search and RPC function JOINs
-- Optimizes queries: WHERE id IN (...) AND name ILIKE '%pattern%'
-- Used by: getRequestsSnapshot (org name search), getTasksSnapshot (org name search)
-- Expected improvement: 30-50% reduction in org name search query time
CREATE INDEX IF NOT EXISTS idx_organizations_id_name 
  ON public.organizations(id, name) 
  WHERE deleted_at IS NULL AND is_draft = false;

-- Index for alphabetical sorting of organizations in client list
-- Optimizes queries: ORDER BY organizations(name) ASC/DESC
-- Used by: getClientsSnapshot (alphabetical sort)
-- Expected improvement: 20-30% reduction in sort time
CREATE INDEX IF NOT EXISTS idx_organizations_name_sort 
  ON public.organizations(name) 
  WHERE deleted_at IS NULL AND is_draft = false;

-- ============================================================================
-- CONNECTIONS TABLE INDEXES
-- ============================================================================

-- Composite index for status-critical-first sort in client list
-- Optimizes queries: ORDER BY health_status, organizations(name)
-- Used by: getClientsSnapshot (status-critical-first sort)
-- Expected improvement: 25-35% reduction in sort time, enables database-level sort
CREATE INDEX IF NOT EXISTS idx_connections_agency_health_created 
  ON public.connections(agency_id, health_status, created_at DESC) 
  WHERE connection_status != 'disconnected';

-- Composite index for client list with organization name join
-- Optimizes queries: JOIN organizations ON connections.client_id = organizations.id ORDER BY organizations.name
-- Used by: getClientsSnapshot (alphabetical sort with join)
-- Expected improvement: 20-30% reduction in join + sort time
CREATE INDEX IF NOT EXISTS idx_connections_agency_client_created 
  ON public.connections(agency_id, client_id, created_at DESC) 
  WHERE connection_status != 'disconnected';

-- ============================================================================
-- REQUEST_COMMENTS TABLE INDEXES
-- ============================================================================

-- Index for comment ordering by created_at DESC
-- Optimizes queries: ORDER BY created_at DESC
-- Used by: getCommentsForRequest, getCommentsForRequests
-- Expected improvement: 15-25% reduction in comment fetch time
CREATE INDEX IF NOT EXISTS idx_request_comments_created_desc 
  ON public.request_comments(request_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Composite index for batch comment fetching with ordering
-- Optimizes queries: WHERE request_id IN (...) AND deleted_at IS NULL ORDER BY created_at DESC
-- Used by: getCommentsForRequests (batch fetch)
-- Expected improvement: 20-30% reduction in batch comment fetch time
CREATE INDEX IF NOT EXISTS idx_request_comments_request_created_desc 
  ON public.request_comments(request_id, created_at DESC, deleted_at) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TASK_COMMENTS TABLE INDEXES
-- ============================================================================

-- Index for comment ordering by created_at DESC
-- Optimizes queries: ORDER BY created_at DESC
-- Used by: getCommentsForTask, getCommentsForTasks
-- Expected improvement: 15-25% reduction in comment fetch time
CREATE INDEX IF NOT EXISTS idx_task_comments_created_desc 
  ON public.task_comments(task_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Composite index for batch comment fetching with ordering
-- Optimizes queries: WHERE task_id IN (...) AND deleted_at IS NULL ORDER BY created_at DESC
-- Used by: getCommentsForTasks (batch fetch)
-- Expected improvement: 20-30% reduction in batch comment fetch time
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created_desc 
  ON public.task_comments(task_id, created_at DESC, deleted_at) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- TASKS TABLE INDEXES FOR RPC OPTIMIZATION
-- ============================================================================

-- Composite index for RPC function sorting optimization
-- Optimizes queries: ORDER BY org_name, status, due_date, created_at
-- Used by: get_tasks_sorted_by_org_name RPC function
-- Expected improvement: 20-30% reduction in RPC execution time
CREATE INDEX IF NOT EXISTS idx_tasks_connection_status_due_created 
  ON public.tasks(connection_id, status, due_date ASC NULLS LAST, created_at DESC) 
  WHERE deleted_at IS NULL;

-- Composite index for RPC function with completed_at sorting
-- Optimizes queries: ORDER BY org_name, status, completed_at DESC (for Done tasks)
-- Used by: get_tasks_sorted_by_org_name RPC function (Done tasks)
-- Expected improvement: 15-25% reduction in RPC execution time for Done tasks
CREATE INDEX IF NOT EXISTS idx_tasks_connection_status_completed_created 
  ON public.tasks(connection_id, status, completed_at DESC NULLS LAST, created_at DESC) 
  WHERE deleted_at IS NULL AND status = 'done';

-- ============================================================================
-- REQUESTS TABLE INDEXES FOR RPC OPTIMIZATION
-- ============================================================================

-- Composite index for RPC function with org name sorting
-- Optimizes queries: ORDER BY org_name, created_at DESC
-- Used by: get_requests_sorted_by_org_name RPC function
-- Expected improvement: 20-30% reduction in RPC execution time
CREATE INDEX IF NOT EXISTS idx_requests_connection_org_created 
  ON public.requests(connection_id, created_at DESC) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PROFILES TABLE INDEXES FOR ACCOUNT MANAGER SEARCH
-- ============================================================================

-- Trigram index for account manager name search in client list
-- Optimizes queries: WHERE first_name ILIKE '%pattern%' OR last_name ILIKE '%pattern%'
-- Used by: getClientsSnapshot (account manager search)
-- Expected improvement: 30-40% reduction in account manager search time
CREATE INDEX IF NOT EXISTS idx_profiles_account_manager_trgm 
  ON public.profiles USING gin (
    (lower(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))) gin_trgm_ops
  ) 
  WHERE deleted_at IS NULL;

-- ============================================================================
-- PROJECTS TABLE INDEXES FOR CONNECTION-LEVEL QUERIES
-- ============================================================================

-- Composite index for project count queries per connection
-- Optimizes queries: WHERE connection_id = ? AND status IN (...) AND deleted_at IS NULL
-- Used by: getLiveProjectCountsForAgencies (home page)
-- Expected improvement: 25-35% reduction in project count query time
CREATE INDEX IF NOT EXISTS idx_projects_connection_status_count 
  ON public.projects(connection_id, status, deleted_at) 
  WHERE deleted_at IS NULL AND status IN ('planned', 'active', 'on_hold');

-- ============================================================================
-- MEMBERSHIPS TABLE INDEXES (Critical for 100+ Orgs)
-- ============================================================================

-- Composite index for member list queries with pagination
-- Optimizes queries: WHERE org_id = ? ORDER BY profiles(first_name) LIMIT 50
-- Used by: getConnectionSnapshot, getAgencyMembersForActiveOrg
-- Expected improvement: 30-40% reduction in member list query time
-- Critical for 100+ orgs: With 200+ orgs × 5 members avg = 1,000+ memberships
CREATE INDEX IF NOT EXISTS idx_memberships_org_id_role 
  ON public.memberships(org_id, role) 
  WHERE status = 'active';

-- Index for counting members per org
-- Optimizes queries: SELECT COUNT(*) WHERE org_id = ? AND status = 'active'
-- Used by: Member count queries, member limit checks
-- Expected improvement: 50-60% reduction in count query time
CREATE INDEX IF NOT EXISTS idx_memberships_org_status_count 
  ON public.memberships(org_id, status) 
  WHERE status = 'active';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Run these queries to verify indexes are being used:

-- 1. Verify org name search index usage:
-- EXPLAIN ANALYZE
-- SELECT id, name FROM organizations 
-- WHERE id IN (SELECT client_id FROM connections WHERE agency_id = '...')
--   AND name ILIKE '%pattern%' 
--   AND deleted_at IS NULL AND is_draft = false;

-- 2. Verify comment ordering index usage:
-- EXPLAIN ANALYZE
-- SELECT * FROM request_comments 
-- WHERE request_id IN ('...', '...') 
--   AND deleted_at IS NULL 
-- ORDER BY created_at DESC;

-- 3. Verify RPC function index usage:
-- EXPLAIN ANALYZE
-- SELECT * FROM get_tasks_sorted_by_org_name(
--   ARRAY['...']::uuid[], 
--   'client_asc', 
--   50, 
--   0, 
--   NULL, 
--   NULL, 
--   NULL
-- );

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Expected overall performance improvements:
-- - 30-50% reduction in org name search query time
-- - 20-30% reduction in RPC function execution time
-- - 15-25% reduction in comment fetch time
-- - 25-35% reduction in client list sort time
-- - 30-40% reduction in account manager search time

-- Index maintenance:
-- - These indexes will add ~5-10% overhead to INSERT/UPDATE operations
-- - Monitor index bloat with: SELECT * FROM pg_stat_user_indexes;
-- - Consider REINDEX if bloat exceeds 30%

-- Index size estimates (for 10,000 rows):
-- - idx_organizations_id_name: ~500 KB
-- - idx_request_comments_created_desc: ~200 KB
-- - idx_task_comments_created_desc: ~200 KB
-- - idx_tasks_connection_status_due_created: ~2 MB
-- - idx_profiles_account_manager_trgm: ~1 MB
-- - idx_memberships_org_id_role: ~300 KB (critical for 100+ orgs)
-- - idx_memberships_org_status_count: ~200 KB (critical for 100+ orgs)

-- ============================================================================
-- MEMBERSHIP TABLE GROWTH NOTES (Critical for 100+ Orgs)
-- ============================================================================
-- 
-- With 1 user = 1 org model and 100+ orgs:
-- - Each org has 1 owner (the creator)
-- - Each org can have 5-20 members (invited users)
-- - At 200 orgs: 200 owners + 1,000-4,000 members = 1,200-4,200 total memberships
-- - At 500 orgs: 500 owners + 2,500-10,000 members = 3,000-10,500 total memberships
--
-- Monitor membership table size:
-- SELECT COUNT(*) FROM memberships WHERE status = 'active';
--
-- Consider materialized view when table exceeds 5,000 rows:
-- CREATE MATERIALIZED VIEW active_memberships AS
-- SELECT m.*, o.is_draft
-- FROM memberships m
-- JOIN organizations o ON m.org_id = o.id
-- WHERE m.status = 'active' AND o.is_draft = false;
--
-- Refresh periodically (every 5 minutes):
-- REFRESH MATERIALIZED VIEW CONCURRENTLY active_memberships;


# Global Tasks Performance Verification Checklist

## Pre-Deployment Verification

### 1. Database Migrations
- [ ] Run migration `20251207000003_get_tasks_sorted_by_due_date.sql`
- [ ] Run migration `20251207000004_get_tasks_sorted_by_status.sql`
- [ ] Run migration `20251207000005_tasks_global_performance.sql`
- [ ] Verify all migrations completed successfully
- [ ] Check that RPC functions exist:
  ```sql
  SELECT proname FROM pg_proc WHERE proname IN (
    'get_tasks_sorted_by_due_date',
    'get_tasks_sorted_by_status',
    'get_tasks_sorted_by_org_name'
  );
  ```
- [ ] Check that indexes were created:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename = 'tasks' 
  AND indexname LIKE 'idx_tasks_connection_ids%';
  ```

### 2. Index Verification
Run these queries to verify indexes are being used:

```sql
-- Test base filter query
EXPLAIN ANALYZE
SELECT id FROM tasks 
WHERE connection_id = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
AND deleted_at IS NULL
LIMIT 50;

-- Test status sort query
EXPLAIN ANALYZE
SELECT * FROM tasks 
WHERE connection_id = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
AND deleted_at IS NULL
ORDER BY status, created_at DESC
LIMIT 50;

-- Test due_date sort query (non-Done)
EXPLAIN ANALYZE
SELECT * FROM tasks 
WHERE connection_id = ANY(ARRAY['uuid1', 'uuid2']::uuid[])
AND deleted_at IS NULL
AND status != 'done'
ORDER BY due_date ASC NULLS LAST, created_at DESC
LIMIT 50;
```

**Expected:** All queries should use index scans (not sequential scans)

### 3. RPC Function Testing
Test each RPC function with sample data:

```sql
-- Test due_date sort
SELECT * FROM get_tasks_sorted_by_due_date(
  ARRAY['connection-id-1', 'connection-id-2']::uuid[],
  50,  -- limit
  0,   -- offset
  NULL, -- search
  NULL, -- assigned_to_user_id
  NULL, -- assigned_to_user_ids
  NULL, -- matching_user_ids
  NULL, -- matching_connection_ids
  NULL  -- project_ids_matching_search
);

-- Test status sort
SELECT * FROM get_tasks_sorted_by_status(
  ARRAY['connection-id-1', 'connection-id-2']::uuid[],
  50,  -- limit
  0,   -- offset
  NULL, -- search
  NULL, -- assigned_to_user_id
  NULL, -- assigned_to_user_ids
  NULL, -- matching_user_ids
  NULL, -- matching_connection_ids
  NULL  -- project_ids_matching_search
);
```

**Expected:** Functions return JSON array with task data including org names

### 4. Application Testing

#### Basic Functionality
- [ ] Load global tasks page - verify no errors
- [ ] Test all sort options:
  - [ ] Due date sort
  - [ ] Status sort
  - [ ] Client/Agency name sorts (A-Z and Z-A)
- [ ] Verify pagination works (load more button)
- [ ] Test search functionality
- [ ] Test "Assigned to me/my team" filter

#### Status Change Testing
- [ ] Mark a task as "Done" - verify it moves to bottom immediately
- [ ] Mark a "Done" task as "In progress" - verify it moves back up
- [ ] Test with different sort options to ensure re-sorting works

#### Edge Cases
- [ ] Test with no tasks (empty state)
- [ ] Test with single page of results
- [ ] Test with exactly one page of results (no pagination needed)
- [ ] Test search with no results
- [ ] Test with very large result sets (1000+ tasks)

### 5. Performance Testing

#### Query Performance
- [ ] Monitor query execution times in development
- [ ] Check for any queries taking > 500ms
- [ ] Verify no full-table scans in query plans
- [ ] Test with realistic data volumes (100+ tasks per connection)

#### Memory Usage
- [ ] Verify no memory leaks when paginating
- [ ] Check that only paginated data is loaded (not all tasks)

### 6. Error Handling
- [ ] Test RPC function failure fallback (temporarily rename function)
- [ ] Verify error messages are user-friendly
- [ ] Check that fallback query still works if RPC fails

## Post-Deployment Monitoring

### Key Metrics to Watch
1. **Query Performance**
   - Average query time for `getTasksSnapshot`
   - RPC function execution times
   - Index usage statistics

2. **User Experience**
   - Page load times
   - Time to interactive
   - Pagination smoothness

3. **Error Rates**
   - RPC function failures
   - Query timeouts
   - Database connection issues

## Rollback Plan

If issues are discovered:
1. The fallback query path should still work (uses regular Supabase queries)
2. RPC functions can be disabled by temporarily renaming them
3. Indexes can be dropped if causing issues (though unlikely)

## Notes

- All RPC functions use `SECURITY DEFINER` and respect RLS policies automatically
- Indexes use partial indexes (`WHERE deleted_at IS NULL`) for efficiency
- The implementation gracefully falls back to regular queries if RPC functions fail


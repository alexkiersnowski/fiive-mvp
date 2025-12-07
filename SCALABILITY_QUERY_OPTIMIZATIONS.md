# Query and Architecture Optimization Recommendations

This document provides specific code changes to optimize queries and data access patterns identified in the scalability assessment.

## 1. Connection ID Fetching Optimization

### Problem
Connection IDs are fetched without limits, causing O(n) queries that degrade at 200+ connections per org.

### Files Affected
- `src/features/home/server.ts:771-776`
- `src/features/requests/server.ts:78-79`
- `src/features/tasks/server.ts:106-116`

### Current Implementation

```typescript
// src/features/home/server.ts:771-776
const { data: connectionIdsResult } = await supabase
  .from('connections')
  .select('id')
  .eq('agency_id', context.orgId)
  .neq('connection_status', 'disconnected');
```

### Recommended Change

```typescript
// Option 1: Add LIMIT for count queries (home page)
// Only fetch connection IDs needed for count queries
// Most count queries don't need all connection IDs, just a subset
const { data: connectionIdsResult } = await supabase
  .from('connections')
  .select('id')
  .eq('agency_id', context.orgId)
  .neq('connection_status', 'disconnected')
  .limit(200); // Reasonable limit for count queries

// Option 2: Use cursor-based pagination for list queries (requests/tasks)
// For list queries, fetch connection IDs in batches
async function getConnectionIdsPaginated(
  context: EnhancedModeContext,
  limit: number = 50,
  cursor?: string
): Promise<{ connectionIds: string[]; nextCursor: string | null }> {
  const supabase = await createClient();
  const startIndex = cursor ? parseInt(cursor, 10) : 0;
  
  const { data, error } = await supabase
    .from('connections')
    .select('id')
    .eq(context.variant === 'agency' ? 'agency_id' : 'client_id', context.orgId)
    .neq('connection_status', 'disconnected')
    .range(startIndex, startIndex + limit - 1);
  
  if (error || !data) {
    return { connectionIds: [], nextCursor: null };
  }
  
  const connectionIds = data.map(c => c.id);
  const nextCursor = connectionIds.length === limit 
    ? String(startIndex + limit) 
    : null;
  
  return { connectionIds, nextCursor };
}
```

### Expected Impact
- 50-70% reduction in connection ID fetch time at 200+ connections
- Prevents query time from exceeding 500ms

---

## 2. Client-Side Filtering Threshold

### Problem
Fetches ALL clients when ≤100 (no pagination), causing 500ms+ query time and 2MB+ data transfer.

### File Affected
- `src/features/clients/server.ts:62`

### Current Implementation

```typescript
// src/features/clients/server.ts:62
const useClientSideFiltering = totalCount <= 100 && !search.trim();
```

### Recommended Change

```typescript
// Lower threshold to 50 and always use server-side pagination
const useClientSideFiltering = totalCount <= 50 && !search.trim();

// Better: Always use server-side pagination for consistency
// Remove client-side filtering entirely
const useClientSideFiltering = false;
```

### Additional Optimization: Database-Level Status Sort

```typescript
// src/features/clients/server.ts:283-302
// Replace in-memory sort with database-level sort
if (sort === 'status-critical-first') {
  // Use CASE expression for health_status priority
  query = query.order('health_status', { 
    ascending: true,
    // Custom order: critical < at-risk < healthy < unassigned
    nullsFirst: false 
  }).order('organizations(name)', { ascending: true });
  
  // Remove post-processing sort (lines 283-302)
}
```

### Expected Impact
- 40-60% reduction in query time at 100 clients
- Consistent pagination behavior
- Eliminates 2MB+ data transfer for large client lists

---

## 3. Project Count N+1 Pattern

### Problem
One COUNT query per connection for project counts (home page), causing 200ms+ for 5 connections.

### File Affected
- `src/features/home/server.ts:120-134`

### Current Implementation

```typescript
// src/features/home/server.ts:120-134
const countPromises = connectionIds.map(async (connectionId) => {
  const { count, error } = await supabase
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .in('status', ['planned', 'active', 'on_hold'])
    .is('deleted_at', null);
  
  return { connectionId, count: count || 0 };
});
```

### Recommended Change

```typescript
// Batch into single query with GROUP BY
const { data: projectCounts, error } = await supabase
  .from('projects')
  .select('connection_id')
  .in('connection_id', connectionIds)
  .in('status', ['planned', 'active', 'on_hold'])
  .is('deleted_at', null);

if (error) {
  console.error('Error fetching project counts:', error);
  // Initialize all to 0
  connectionIds.forEach(id => {
    counts[id] = 0;
  });
} else {
  // Group by connection_id and count
  const countsMap = new Map<string, number>();
  connectionIds.forEach(id => {
    countsMap.set(id, 0);
  });
  
  (projectCounts || []).forEach(project => {
    const current = countsMap.get(project.connection_id) || 0;
    countsMap.set(project.connection_id, current + 1);
  });
  
  countsMap.forEach((count, connectionId) => {
    counts[connectionId] = count;
  });
}
```

### Expected Impact
- 70-80% reduction in project count query time
- Single query instead of N queries
- Scales better with more connections

---

## 4. Comments Pagination

### Problem
Fetches ALL comments for displayed requests/tasks, causing 300ms+ fetch time and large payloads.

### Files Affected
- `src/features/connections/server.ts:2498-2566` (getCommentsForRequests)
- `src/features/connections/server.ts:2623-2682` (getCommentsForTasks)

### Current Implementation

```typescript
// src/features/connections/server.ts:2511-2527
const { data: comments, error } = await supabase
  .from('request_comments')
  .select(`...`)
  .in('request_id', requestIds)
  .is('deleted_at', null)
  .order('created_at', { ascending: false });
```

### Recommended Change

```typescript
// Add limit parameter and pagination support
export const getCommentsForRequests = cache(async (
  requestIds: string[],
  limit: number = 20 // Default limit per request
): Promise<Record<string, Comment[]>> => {
  if (!requestIds.length) {
    return {};
  }

  const supabase = await createClient();

  // Use window function to limit comments per request
  // PostgreSQL doesn't support LIMIT per group in simple query,
  // so we'll fetch more and limit in application code for now
  // Better: Use RPC function with LATERAL JOIN for true per-group LIMIT
  
  const { data: comments, error } = await supabase
    .from('request_comments')
    .select(`...`)
    .in('request_id', requestIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(requestIds.length * limit); // Fetch up to limit per request

  // ... existing grouping code ...
  
  // Limit comments per request
  Object.keys(groupedComments).forEach(requestId => {
    if (groupedComments[requestId].length > limit) {
      groupedComments[requestId] = groupedComments[requestId].slice(0, limit);
    }
  });
  
  return groupedComments;
});

// Better: Use RPC function for true per-group LIMIT
// Create RPC function: get_comments_for_requests_limited
CREATE OR REPLACE FUNCTION get_comments_for_requests_limited(
  p_request_ids uuid[],
  p_limit_per_request int DEFAULT 20
)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_agg(
    json_build_object(
      'request_id', request_id,
      'comments', comments
    )
  )
  INTO v_result
  FROM (
    SELECT 
      request_id,
      json_agg(
        json_build_object(
          'id', id,
          'body', body,
          'created_at', created_at,
          'created_by_user_id', created_by_user_id,
          'user_name', user_name,
          'user_avatar', user_avatar
        ) ORDER BY created_at DESC
      ) FILTER (WHERE row_num <= p_limit_per_request) AS comments
    FROM (
      SELECT 
        rc.*,
        p.first_name || ' ' || p.last_name AS user_name,
        p.avatar_url AS user_avatar,
        ROW_NUMBER() OVER (PARTITION BY rc.request_id ORDER BY rc.created_at DESC) AS row_num
      FROM request_comments rc
      JOIN profiles p ON rc.created_by_user_id = p.id
      WHERE rc.request_id = ANY(p_request_ids)
        AND rc.deleted_at IS NULL
        AND p.deleted_at IS NULL
    ) ranked
    GROUP BY request_id
  ) grouped;
  
  RETURN COALESCE(v_result, '[]'::json);
END;
$$;
```

### Expected Impact
- 60-70% reduction in comment fetch time
- Smaller payloads (20 comments vs all comments)
- Better user experience (load more on demand)

---

## 5. Member Queries Pagination

### Problem
Fetches ALL members per org, causing 300ms+ for 100+ members.

### File Affected
- `src/features/connections/server.ts:208-240`

### Current Implementation

```typescript
// src/features/connections/server.ts:208-223
const clientMembersResult = await supabase
  .from('memberships')
  .select(`...`)
  .eq('org_id', clientId)
  .is('profiles.deleted_at', null)
  .order('profiles(first_name)');
```

### Recommended Change

```typescript
// Add limit parameter
const MEMBER_LIMIT = 50; // Limit members per org for connection page

const clientMembersResult = await supabase
  .from('memberships')
  .select(`...`)
  .eq('org_id', clientId)
  .is('profiles.deleted_at', null)
  .order('profiles(first_name)')
  .limit(MEMBER_LIMIT);

// Add pagination support if needed
export const getConnectionSnapshot = cache(async (
  context: EnhancedModeContext,
  connectionId: string,
  memberLimit: number = 50 // Add parameter
): Promise<ConnectionSnapshot | null> => {
  // ... existing code ...
  
  // Use memberLimit in queries
  const clientMembersResult = await supabase
    .from('memberships')
    .select(`...`)
    .eq('org_id', clientId)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)')
    .limit(memberLimit);
});
```

### Expected Impact
- 50-60% reduction in member query time at 100+ members
- Faster connection page loads
- Consider "View All Members" link for full list

---

## 6. Org Name Search Optimization

### Problem
Two-step org name search: fetch connection org IDs, then search organizations.

### Files Affected
- `src/features/requests/server.ts:218-244`
- `src/features/tasks/server.ts:236-276`

### Current Implementation

```typescript
// src/features/requests/server.ts:218-244
// Step 1: Get connection org IDs
const { data: connectionsForOrgSearch } = await supabase
  .from('connections')
  .select('client_id')
  .eq('agency_id', context.orgId);

// Step 2: Search organizations
const { data: matchingOrgs } = await supabase
  .from('organizations')
  .select('id')
  .in('id', orgIdsToSearch)
  .ilike('name', searchPattern)
  .is('deleted_at', null);
```

### Recommended Change

```typescript
// Single query with JOIN
const { data: matchingConnections } = await supabase
  .from('connections')
  .select('id, organizations!inner(id, name)')
  .eq('agency_id', context.orgId)
  .ilike('organizations.name', searchPattern)
  .is('organizations.deleted_at', null)
  .is('organizations.is_draft', false);

const matchingConnectionIds = (matchingConnections || []).map(c => c.id);
```

### Expected Impact
- 40-50% reduction in org name search time
- Single query instead of two queries
- Better use of indexes

---

## 7. RPC Function Optimization

### Problem
Complex ORDER BY with CASE expressions in RPC functions causes 500-600ms execution time.

### Files Affected
- `supabase/migrations/20251207000002_get_tasks_sorted_by_org_name.sql`

### Current Implementation

```sql
-- Complex ORDER BY with CASE expressions
ORDER BY 
  COALESCE(client_org.name, '') COLLATE "C" ASC,
  CASE WHEN t.status::text = 'done' THEN 1 ELSE 0 END ASC,
  CASE WHEN t.status::text = 'done' THEN t.completed_at END DESC NULLS LAST,
  CASE WHEN t.status::text != 'done' THEN t.due_date END ASC NULLS LAST,
  t.created_at DESC
```

### Recommended Change

```sql
-- Optimize ORDER BY to use indexes better
-- Split into two queries: Done and Non-Done tasks
-- Then UNION ALL and sort by org name

-- For Non-Done tasks:
ORDER BY 
  COALESCE(client_org.name, '') COLLATE "C" ASC,
  t.due_date ASC NULLS LAST,
  t.created_at DESC

-- For Done tasks:
ORDER BY 
  COALESCE(client_org.name, '') COLLATE "C" ASC,
  t.completed_at DESC NULLS LAST,
  t.created_at DESC

-- Then combine with UNION ALL and sort by org name
-- This allows better index usage
```

### Alternative: Materialized View

```sql
-- Create materialized view for task sorting
CREATE MATERIALIZED VIEW tasks_sorted_view AS
SELECT 
  t.*,
  conn.client_id,
  conn.agency_id,
  client_org.name AS client_org_name,
  agency_org.name AS agency_org_name,
  CASE WHEN t.status = 'done' THEN 1 ELSE 0 END AS is_done,
  COALESCE(t.due_date, '9999-12-31'::date) AS sort_due_date
FROM tasks t
JOIN connections conn ON t.connection_id = conn.id
LEFT JOIN organizations client_org ON conn.client_id = client_org.id
LEFT JOIN organizations agency_org ON conn.agency_id = agency_org.id
WHERE t.deleted_at IS NULL;

-- Refresh periodically (every 5 minutes)
CREATE INDEX idx_tasks_sorted_view_org_status_due 
  ON tasks_sorted_view(client_org_name, is_done, sort_due_date, created_at DESC);
```

### Expected Impact
- 30-40% reduction in RPC execution time
- Better index usage
- More predictable performance

---

## 8. Profile Search Optimization

### Problem
ILIKE queries on profiles may need optimization for 10,000+ profiles.

### Files Affected
- `src/features/requests/server.ts:144-168`
- `src/features/tasks/server.ts:169-193`

### Current Implementation

```typescript
// Uses trigram indexes (good), but may need optimization
let profilesQuery = supabase
  .from('profiles')
  .select('id, first_name, last_name')
  .is('deleted_at', null);

if (searchTerms.length > 1) {
  profilesQuery = profilesQuery.or(
    `and(first_name.ilike.${firstPattern},last_name.ilike.${secondPattern}),` +
    `and(first_name.ilike.${secondPattern},last_name.ilike.${firstPattern}),` +
    `first_name.ilike.${searchPattern},` +
    `last_name.ilike.${searchPattern}`
  );
}
```

### Recommended Change

```typescript
// Use full-text search for better performance at scale
// Add tsvector column to profiles table
ALTER TABLE profiles ADD COLUMN name_search_vector tsvector;
CREATE INDEX idx_profiles_name_search_vector 
  ON profiles USING gin(name_search_vector);

-- Update trigger to maintain tsvector
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name_search_vector := 
    to_tsvector('english', 
      coalesce(NEW.first_name, '') || ' ' || 
      coalesce(NEW.last_name, '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_search_vector_update
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profiles_search_vector();

// Use full-text search in queries
const { data: matchingProfiles } = await supabase
  .rpc('search_profiles_by_name', {
    search_query: trimmedQuery,
    limit_count: 100
  });
```

### Expected Impact
- 50-60% reduction in profile search time at 10,000+ profiles
- Better relevance ranking
- Scales to 100,000+ profiles

---

## Implementation Priority

1. **Critical (Implement Immediately):**
   - Connection ID fetching optimization
   - Client-side filtering threshold
   - Project count N+1 fix

2. **High Priority (Implement Before Scale):**
   - Comments pagination
   - Member queries pagination
   - Org name search optimization

3. **Medium Priority (Optimize for Growth):**
   - RPC function optimization
   - Profile search optimization

---

## Testing Recommendations

1. **Load Testing:**
   - Test with 200+ connections per org
   - Test with 100+ clients per org
   - Test with 10,000+ requests/tasks per org

2. **Query Performance:**
   - Monitor query execution time
   - Use EXPLAIN ANALYZE to verify index usage
   - Alert on queries >500ms

3. **Cache Performance:**
   - Monitor cache hit rates
   - Track revalidation frequency
   - Measure page load times


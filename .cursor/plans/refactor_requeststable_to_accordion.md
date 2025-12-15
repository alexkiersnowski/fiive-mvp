# Refactor RequestsTable to Accordion with Fetch-on-Expand

## Overview
Transform `RequestsTable.tsx` from a virtualized windowed pagination approach to a true accordion-based drill-down model with proper data fetching. The component will default to collapsed state at all levels, and fetch requests only when a client group is expanded.

## Critical Data Fetching Requirements

### Current State Analysis
- **Current pagination**: `getRequestsFlat` returns 50 requests at a time via `get_requests_flat_all_statuses` RPC
- **Current load more**: Scroll-based pagination appends requests until all are loaded
- **Problem**: Removing load more without replacement would only show first 50 requests

### Required Data Flow

1. **Initial Load** (no requests fetched):
   - Fetch `allConnectionsMetadata` (all client headers) ✅ Already done
   - Fetch `statusCounts` (counts per status) ✅ Already done via `get_requests_counts`
   - Fetch `clientCounts` (counts per client per status) ✅ Already done via `get_requests_counts`
   - Render all status headers and client headers (collapsed by default)

2. **Status Expanded** (still no requests):
   - Show client headers for that status
   - Client headers show counts from `clientCounts`
   - No data fetch needed

3. **Client Expanded** (fetch requests):
   - Fetch requests for that specific client (orgId) in that specific status
   - Use new query: `get_requests_for_client_status`
   - Cache fetched requests in component state
   - Render request rows

4. **Client Collapsed**:
   - Keep requests in cache (don't refetch on re-expand)
   - Hide request rows

## Database Query Requirements

### New RPC Function Needed
Create `get_requests_for_client_status` that:
- Takes: `connection_ids[]`, `client_org_id`, `status`, `assigned_to_user_id?`, `created_by_user_id?`
- Returns: All requests for that client org in that status (no pagination needed - single client)
- Filters: By connection IDs that belong to the client org, by status, by optional user filters
- Sorts: `created_at DESC, id DESC`

**File**: `supabase/migrations/20251215_get_requests_for_client_status.sql`

```sql
CREATE OR REPLACE FUNCTION get_requests_for_client_status(
  p_connection_ids uuid[],
  p_client_org_id uuid, -- The organization ID (client_id for agency view, agency_id for client view)
  p_status text,
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL,
  p_view_type text DEFAULT 'agency'
)
RETURNS SETOF requests
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
  FROM requests r
  INNER JOIN connections c ON r.connection_id = c.id
  WHERE r.connection_id = ANY(p_connection_ids)
  AND (
    (p_view_type = 'agency' AND c.client_id = p_client_org_id) OR
    (p_view_type != 'agency' AND c.agency_id = p_client_org_id)
  )
  AND r.status::text = p_status
  AND r.deleted_at IS NULL
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  ORDER BY r.created_at DESC, r.id DESC;
$$;
```

### Server Function
Create `getRequestsForClientStatus` in `src/features/requests/server.ts`:
- Wraps the RPC call
- Transforms raw request rows to `Request[]` format (reuse `transformRequestsToRequestFormat`)
- Returns `Request[]`

### Action Function
Create `fetchRequestsForClientStatus` in `src/features/requests/actions.ts`:
- Client action wrapper for `getRequestsForClientStatus`

## Component State Management

### New State Structure
```typescript
// Map<`${status}-${clientOrgId}`, Request[]>
const requestsByClientStatus = useState<Map<string, Request[]>>(new Map());

// Map<`${status}-${clientOrgId}`, boolean>
const isLoadingClientStatus = useState<Map<string, boolean>>(new Map());
```

### Fetch Logic
When client is expanded:
1. Check if requests already cached: `requestsByClientStatus.get(`${status}-${clientOrgId}`)`
2. If cached, use cached data
3. If not cached, fetch via `fetchRequestsForClientStatus`
4. Store in `requestsByClientStatus` map
5. Show loading state while fetching

## Implementation Steps

### 1. Create Database Migration
**File**: `supabase/migrations/20251215_get_requests_for_client_status.sql`
- Create RPC function `get_requests_for_client_status`
- Optimize with proper indexes (if needed)

### 2. Add Server Function
**File**: `src/features/requests/server.ts`
- Add `getRequestsForClientStatus` function
- Reuse transformation logic from existing functions
- Handle context validation and RLS

### 3. Add Action Function
**File**: `src/features/requests/actions.ts`
- Add `fetchRequestsForClientStatus` client action wrapper

### 4. Update RequestsContent State
**File**: `src/app/(dashboard)/requests/RequestsContent.tsx`
- Remove initial request fetching (only fetch counts)
- Add `requestsByClientStatus` state map
- Add `isLoadingClientStatus` state map
- Add `fetchRequestsForClientStatus` handler
- Pass fetch handler to RequestsTable

### 5. Refactor RequestsTable Component
**File**: `src/features/requests/RequestsTable.tsx`

**Remove**:
- Virtualization (`useVirtualizer`, `VirtualListBody`)
- `renderableItems` flat array logic
- Placeholder items
- Scroll-based `onLoadMore` detection
- `onLoadMore` prop usage

**Add**:
- Hierarchical grouping: `Map<status, Map<clientOrgId, Request[]>>`
- `requestsByClientStatus` prop (from parent)
- `isLoadingClientStatus` prop (from parent)
- `onFetchClientRequests` callback prop
- Direct accordion rendering (no virtualization)

**Rendering Logic**:
```typescript
{statusGroups.map(status => (
  <StatusGroupHeader
    key={status}
    status={status}
    statusCount={statusCounts.get(status)}
    isCollapsed={collapsedStatuses.has(status)}
    onToggle={() => onToggleStatus(status)}
  />
  {!collapsedStatuses.has(status) && clientGroupsByStatus[status].map(client => {
    const cacheKey = `${status}-${client.orgId}`;
    const clientRequests = requestsByClientStatus.get(cacheKey) || [];
    const isLoading = isLoadingClientStatus.get(cacheKey) || false;
    
    return (
      <React.Fragment key={client.orgId}>
        <ClientGroupHeader
          clientId={client.orgId}
          clientName={client.name}
          count={clientCounts.get(cacheKey) || 0}
          isCollapsed={collapsedClients.get(status)?.has(client.orgId)}
          onToggle={() => {
            onToggleClient(status, client.orgId);
            // Fetch if expanding and not cached
            if (!collapsedClients.get(status)?.has(client.orgId) && clientRequests.length === 0 && !isLoading) {
              onFetchClientRequests(status, client.orgId);
            }
          }}
        />
        {!collapsedClients.get(status)?.has(client.orgId) && (
          <>
            {isLoading && <LoadingSkeleton />}
            {clientRequests.map(request => (
              <GlobalRequestRow key={request.id} request={request} ... />
            ))}
          </>
        )}
      </React.Fragment>
    );
  })}
))}
```

### 6. Update Default Collapse State
**File**: `src/app/(dashboard)/requests/RequestsContent.tsx`
- Change initial `collapsedStatuses` to include ALL statuses
- Change initial `collapsedClients` to empty Map (all collapsed)

### 7. Update Initial Page Load
**File**: `src/app/(dashboard)/requests/page.tsx`
- Remove initial request fetching
- Only fetch counts via `getRequestsCounts`
- Pass empty requests array to snapshot

## Key Changes Summary

### Database
- ✅ New RPC: `get_requests_for_client_status` (fetch requests for one client in one status)

### Server
- ✅ New function: `getRequestsForClientStatus` (server-side)
- ✅ New action: `fetchRequestsForClientStatus` (client action)

### Component State
- ✅ `requestsByClientStatus`: Map<`${status}-${clientOrgId}`, Request[]>
- ✅ `isLoadingClientStatus`: Map<`${status}-${clientOrgId}`, boolean>
- ✅ Remove: `rows`, `offset`, `isLoadingMore` (flat pagination state)

### Component Logic
- ✅ Remove virtualization entirely
- ✅ Remove scroll-based pagination
- ✅ Add fetch-on-expand for client groups
- ✅ Cache fetched requests (don't refetch on re-expand)
- ✅ Default all groups to collapsed

## Testing Considerations

- Verify status groups collapse/expand correctly
- Verify client groups fetch data on first expand
- Verify client groups use cached data on re-expand
- Verify loading states show during fetch
- Verify counts display correctly in headers
- Verify search results also use accordion structure
- Verify no performance issues with many collapsed headers
- Verify requests are properly grouped by status → client

---

## Migration Cleanup

### Migrations to DELETE (No Longer Needed)

#### 1. `20251214_get_requests_flat_ordered.sql`
- **Purpose**: Status-specific flat pagination with offset/limit
- **Used by**: `getRequestsSnapshotForStatus` (line 989 in server.ts)
- **Status**: ❌ DELETE - Replaced by fetch-on-expand per client
- **Reason**: Accordion fetches all requests for a client when expanded, no pagination needed

#### 2. `20251215_get_requests_flat_all_statuses.sql`
- **Purpose**: Flat pagination across all statuses with offset/limit
- **Used by**: `getRequestsFlat` (line 2623 in server.ts)
- **Status**: ❌ DELETE - Replaced by fetch-on-expand per client
- **Reason**: Accordion doesn't use flat pagination, fetches per client on expand

#### 3. `20251214_get_requests_skeleton.sql`
- **Purpose**: Returns status counts and client counts (metadata only)
- **Used by**: `getRequestsSnapshotForStatus` (line 962 in server.ts)
- **Status**: ❌ DELETE - Duplicates `get_requests_counts` functionality
- **Reason**: `get_requests_counts` already provides the same data. Consolidate to one function.

#### 4. `20251207000001_get_requests_sorted_by_org_name.sql`
- **Purpose**: Complex RPC for sorting requests by org name with search
- **Used by**: ❌ NOT USED ANYWHERE (grep found no matches)
- **Status**: ❌ DELETE - Dead code, never integrated
- **Reason**: Old approach that was never used

### Migrations to KEEP (Still Needed)

#### 1. `20251215_get_requests_counts.sql`
- **Purpose**: Returns status counts and client counts (metadata only)
- **Used by**: `getRequestsCounts` (line 2562 in server.ts)
- **Status**: ✅ KEEP - Needed for accordion header counts
- **Note**: This replaces `get_requests_skeleton` functionality

#### 2. `20251207000000_requests_org_name_sort_indexes.sql`
- **Purpose**: Indexes for optimizing org name sorting
- **Status**: ✅ KEEP - Still useful for new `get_requests_for_client_status` query
- **Note**: Indexes help with JOIN performance when fetching by client org

#### 3. `20251206163334_global_requests_performance.sql`
- **Purpose**: Composite indexes for global requests queries
- **Status**: ✅ KEEP - Still useful for filtering and sorting
- **Note**: Indexes help with connection_id IN (...) patterns

#### 4. `20251206120001_requests_new_count_index.sql`
- **Purpose**: Index for counting new requests
- **Status**: ✅ KEEP - Still used by `getGlobalNewRequestsCount`

#### 5. `20251113_requests_tasks_search_indexes.sql`
- **Purpose**: Search indexes for requests
- **Status**: ✅ KEEP - Still used by search functionality

#### 6. `20251104_requests_project_name_cache.sql`
- **Purpose**: Project name caching column
- **Status**: ✅ KEEP - Still used in request data structure

### Migration Cleanup Steps

1. **Create Rollback Migration** (Production Safety)
   **File**: `supabase/migrations/20251216_remove_obsolete_request_functions.sql`
   
   ```sql
   -- Drop obsolete RPC functions that are no longer needed after accordion refactor
   DROP FUNCTION IF EXISTS get_requests_flat_ordered(uuid[], text, int, int, uuid[], uuid, uuid, text);
   DROP FUNCTION IF EXISTS get_requests_flat_all_statuses(uuid[], int, int, uuid, uuid, text);
   DROP FUNCTION IF EXISTS get_requests_skeleton(uuid[], uuid, uuid);
   DROP FUNCTION IF EXISTS get_requests_sorted_by_org_name(uuid[], text, int, int, text, uuid, uuid);
   ```

2. **Delete Migration Files** (Development)
   - `supabase/migrations/20251214_get_requests_flat_ordered.sql`
   - `supabase/migrations/20251215_get_requests_flat_all_statuses.sql`
   - `supabase/migrations/20251214_get_requests_skeleton.sql`
   - `supabase/migrations/20251207000001_get_requests_sorted_by_org_name.sql`

3. **Update Server Functions**
   - Remove `getRequestsSnapshotForStatus` function
   - Remove `getRequestsFlat` function
   - Remove calls to obsolete RPCs

4. **Update Actions**
   - Remove `fetchMoreRequestsForStatus`
   - Remove `fetchRequestsFlat`

# Flat Pagination Strategy - Single Ordered Stream

## Executive Summary

**The Problem**: Current nested pagination (connection offset + request offset per connection) creates multiple competing pagination axes, state explosion (125 states), and race conditions. Virtualization requires **one invariant**: exactly one ordered list that maps 1:1 to scroll position.

**The Solution**: **Flat pagination** with server-side collapse filtering:
- **Backend**: Single ordered stream `ORDER BY status, connection_name (A-Z), created_at DESC, id DESC`
- **Backend**: Accepts `excludedConnectionIds` to skip collapsed connections server-side
- **Frontend**: Group flat list in memory (detect connection_id changes, insert headers)
- **Virtual List**: Works on flat list, frontend derives grouping for display
- **Collapse/Expand**: Reset offset to 0 and clear list when collapsing/expanding (fresh filter)

**Key Principle**: Database pagination order === scroll order. Everything else (headers, grouping) is derived, not fetched.

## Architecture: Flat Pagination

### Current (Broken) Flow
```
❌ Nested Pagination:
1. Paginate connections (offset 0, limit 20)
2. For each connection, paginate requests (offset 0, limit 50 per connection)
3. Try to coordinate: connection offset + N request offsets + virtual row index
   → 125 independent pagination states
   → Race conditions, offset drift, inconsistent counts
```

### New (Flat) Flow
```
✅ Single Pagination Axis:
1. Fetch skeleton/metadata (status counts, client counts) - lightweight
   → Builds virtual list structure, gives totalCount for height calculation
2. Fetch flat stream: ORDER BY status, connection_name, created_at DESC, id DESC
   WHERE connection_id NOT IN (excludedConnectionIds) -- server-side collapse!
   OFFSET X LIMIT Y (single offset, single limit)
3. Frontend groups flat list: detect connection_id changes, insert headers
4. Virtual list works on flat list directly
   → One offset, one cursor, zero drift, perfect virtualization
5. Collapse/Expand: Reset to offset 0, clear list, refetch with updated excludedConnectionIds
   → Treats collapse/expand as "fresh filter" - ensures no visual jumps
```

## Implementation Plan

### Phase 1: Create Skeleton RPC (Metadata Only)

**File**: `supabase/migrations/YYYYMMDD_get_requests_skeleton.sql`

```sql
-- Returns status counts and client counts WITHOUT fetching request rows
-- Used for initial load to build virtual list structure
CREATE OR REPLACE FUNCTION get_requests_skeleton(
  p_connection_ids uuid[],
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'status_counts', (
      SELECT json_object_agg(status, count)
      FROM (
        SELECT 
          r.status,
          COUNT(*) as count
        FROM requests r
        WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.status
      ) status_counts
    ),
    'client_counts', (
      -- Return counts per connection_id (not org_id) for accurate collapse math
      SELECT json_object_agg(connection_id, count)
      FROM (
        SELECT 
          r.connection_id,
          COUNT(*) as count
        FROM requests r
        WHERE r.connection_id = ANY(p_connection_ids)
        AND r.deleted_at IS NULL
        AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
        AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
        GROUP BY r.connection_id
      ) client_counts
    )
  ) INTO v_result;
  
  RETURN v_result;
END;
$$;
```

**Purpose**: Lightweight metadata query to build virtual list structure without fetching request rows. Returns total counts per status/connection for virtual list height calculation and collapse math.

### Phase 2: Create Flat Requests RPC (CRITICAL: Correct Display Name Sorting)

**File**: `supabase/migrations/YYYYMMDD_get_requests_flat_ordered.sql`

```sql
-- Returns flat ordered stream of requests
-- ORDER BY status, connection_name (A-Z), created_at DESC, id DESC
-- Single pagination axis: OFFSET X LIMIT Y
-- Server-side collapse: excludes connection_ids in excluded_connection_ids array
-- CRITICAL: Sort by display name (Client name for Agency view, Agency name for Client view)
CREATE OR REPLACE FUNCTION get_requests_flat_ordered(
  p_connection_ids uuid[],
  p_status text, -- Required: filter by specific status (per-status streams)
  p_offset_count int DEFAULT 0,
  p_limit_count int DEFAULT 50,
  p_excluded_connection_ids uuid[] DEFAULT ARRAY[]::uuid[], -- Server-side collapse filter
  p_assigned_to_user_id uuid DEFAULT NULL,
  p_created_by_user_id uuid DEFAULT NULL,
  p_view_type text DEFAULT 'agency' -- 'agency' or 'client' - determines which org name to sort by
)
RETURNS SETOF requests
LANGUAGE sql
STABLE
AS $$
  SELECT r.*
  FROM requests r
  INNER JOIN connections c ON r.connection_id = c.id
  INNER JOIN organizations display_org ON (
    -- For agency view: sort by client organization name
    -- For client view: sort by agency organization name
    -- Use OR condition for clarity (PostgreSQL optimizes this well)
    (p_view_type = 'agency' AND c.client_id = display_org.id) OR
    (p_view_type != 'agency' AND c.agency_id = display_org.id)
  )
  WHERE r.connection_id = ANY(p_connection_ids)
  AND r.connection_id != ALL(p_excluded_connection_ids) -- Server-side collapse: skip excluded connections
  AND r.deleted_at IS NULL
  AND r.status = p_status -- Filter by specific status
  AND (p_assigned_to_user_id IS NULL OR r.assignee_user_id = p_assigned_to_user_id)
  AND (p_created_by_user_id IS NULL OR r.created_by_user_id = p_created_by_user_id)
  ORDER BY 
    r.status,
    LOWER(COALESCE(display_org.name, 'Unknown')) ASC, -- Order by display name (A-Z) - MUST match index
    r.created_at DESC,
    r.id DESC
  OFFSET p_offset_count
  LIMIT p_limit_count;
$$;
```

**Key Points**:
- **Display name resolution**: Uses `p_view_type` to determine which org name to sort by (client name for agency view, agency name for client view)
- **Single ORDER BY**: status → display_name (A-Z) → created_at DESC → id DESC
- **Server-side collapse**: `connection_id != ALL(p_excluded_connection_ids)` skips collapsed connections
- **Per-status streams**: Filters by specific status (not global stream)
- **Deterministic ordering**: id DESC as tiebreaker
- **LOWER(COALESCE(...))**: Must match index expression exactly

### Phase 3: Update Server Implementation

**File**: `src/features/requests/server.ts`

**Replace `getRequestsSnapshotForStatus`**:

```typescript
export const getRequestsSnapshotForStatus = cache(async (
  context: EnhancedModeContext,
  status: RequestStatus,
  options: RequestsPaginationOptions = {}
): Promise<RequestsSnapshot> => {
  const { 
    offset = 0, 
    limit = 50, // Single limit for flat stream
    excludedConnectionIds = [], // Server-side collapse filter
    assignedToUserId, 
    createdByUserId 
  } = options;
  
  const supabase = await createClient();
  
  // Get all connection IDs for this context (existing logic)
  const allConnectionIds = await getConnectionIdsForOrg(context, supabase);
  
  if (allConnectionIds.length === 0) {
    return { /* empty snapshot */ };
  }
  
  // PHASE 1: Fetch skeleton/metadata (lightweight, no request rows)
  const { data: skeletonData, error: skeletonError } = await supabase.rpc(
    'get_requests_skeleton',
    {
      p_connection_ids: allConnectionIds,
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
    }
  );
  
  // PHASE 2: Fetch flat ordered stream (single offset, single limit)
  const { data: requestsData, error: requestsError } = await supabase.rpc(
    'get_requests_flat_ordered',
    {
      p_connection_ids: allConnectionIds,
      p_status: status,
      p_offset_count: offset,
      p_limit_count: limit,
      p_excluded_connection_ids: excludedConnectionIds, // Server-side collapse filter
      p_assigned_to_user_id: assignedToUserId || null,
      p_created_by_user_id: createdByUserId || null,
      p_view_type: context.variant, // 'agency' or 'client' - determines display name sorting
    }
  );
  
  if (requestsError) {
    console.error('Error fetching flat requests:', requestsError);
    return { /* error response */ };
  }
  
  // PHASE 3: Transform requests (existing logic, lines 1289-1485)
  // ... transform requestsData to Request[] format ...
  
  // Calculate hasMore: if we got exactly limit items, there might be more
  const hasMore = (requestsData?.length || 0) === limit;
  
  return {
    requests: requests,
    total: skeletonData?.status_counts?.[status] || 0,
    unfilteredTotalCount: skeletonData?.status_counts?.[status] || 0,
    offset: offset + (requestsData?.length || 0), // Next offset
    hasMore,
    fetchedConnectionIds: [], // Not used in flat pagination
    allConnectionsMetadata: allConnectionsMetadata, // Still needed for grouping
    statusCounts: skeletonData?.status_counts || {},
    totalClientCount: Object.keys(skeletonData?.client_counts || {}).length,
    clientCounts: skeletonData?.client_counts || {}, // NEW: Store per-connection counts for collapse math
    status,
  };
});
```

**Key Changes**:
- Single `offset` and `limit` (not per-connection)
- Pass `excludedConnectionIds` to RPC
- Pass `p_view_type` for correct display name sorting
- Return `clientCounts` from skeleton for collapse math

### Phase 4: Update Frontend Grouping (Derived, Not Fetched)

**File**: `src/features/requests/requestGrouping.ts`

**Add function to group flat list**:

```typescript
/**
 * Groups flat ordered stream into status/client structure for display
 * Input: Flat list ordered by status, connection_name, created_at DESC, id DESC
 * Output: Flattened items with status headers and client blocks
 * 
 * Key: Detect connection_id changes to insert headers
 * Note: Since we fetch per-status streams, we don't need to track status changes
 */
export function flattenGroupedRequestsFromFlatList(
  flatRequests: Request[], // Already ordered: status → connection_name → created_at DESC
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  collapsedClients: Map<string, Set<string>>, // Map<status, Set<connectionId>>
  isAgency: boolean
): FlattenedItem[] {
  const items: FlattenedItem[] = [];
  
  let currentConnectionId: string | null = null;
  let currentClientRequests: Request[] = [];
  
  for (const request of flatRequests) {
    const connectionId = request.connectionId;
    const status = request.status;
    const clientId = isAgency ? request.client.id : (request.agency?.id || 'unknown');
    
    // Connection changed: close previous client block, start new one
    if (connectionId !== currentConnectionId) {
      // Close previous client block
      if (currentConnectionId && currentClientRequests.length > 0) {
        const prevStatus = currentClientRequests[0].status;
        const isCollapsed = collapsedClients.get(prevStatus)?.has(currentConnectionId) || false;
        
        if (!isCollapsed) {
          items.push(createClientBlock(
            clientId,
            prevStatus,
            currentClientRequests,
            allConnectionsMetadata,
            isAgency
          ));
        }
      }
      
      // Start new client block
      currentConnectionId = connectionId;
      currentClientRequests = [request];
    } else {
      // Same connection: add to current block
      currentClientRequests.push(request);
    }
  }
  
  // Close final client block
  if (currentConnectionId && currentClientRequests.length > 0) {
    const status = currentClientRequests[0].status;
    const isCollapsed = collapsedClients.get(status)?.has(currentConnectionId) || false;
    const clientId = isAgency ? currentClientRequests[0].client.id : (currentClientRequests[0].agency?.id || 'unknown');
    
    if (!isCollapsed) {
      items.push(createClientBlock(
        clientId,
        status,
        currentClientRequests,
        allConnectionsMetadata,
        isAgency
      ));
    }
  }
  
  return items;
}

function createClientBlock(
  clientId: string,
  status: RequestStatus,
  requests: Request[],
  allConnectionsMetadata: Map<string, { name: string; logoUrl?: string }>,
  isAgency: boolean
): FlattenedItem {
  const metadata = allConnectionsMetadata.get(clientId);
  return {
    type: 'client-block',
    status,
    clientId,
    clientName: isAgency ? metadata?.name : undefined,
    clientLogoUrl: isAgency ? metadata?.logoUrl : undefined,
    agencyId: !isAgency ? clientId : undefined,
    agencyName: !isAgency ? metadata?.name : undefined,
    agencyLogoUrl: !isAgency ? metadata?.logoUrl : undefined,
    requests,
    count: requests.length,
  };
}
```

**Key Points**:
- Input is flat ordered list (not grouped)
- Detect connection_id changes by comparing adjacent items
- Insert client blocks when connection_id changes
- No status tracking needed (we fetch per-status streams)

### Phase 5: Update Virtual List Integration

**File**: `src/features/requests/RequestsTable.tsx`

**Update to work with flat list**:

```typescript
// Use flat list directly (not grouped)
const flattenedItems = useMemo<FlattenedItem[]>(() => {
  if (isSearchMode) {
    // Search mode: use existing grouping
    return flattenGroupedRequests(groupedRequests, allClients, ...);
  }
  
  // Normal mode: use flat list grouping
  return flattenGroupedRequestsFromFlatList(
    requestsByStatus[status] || [], // Flat ordered list
    allConnectionsMetadata,
    collapsedClientsState.map,
    isAgency
  );
}, [requestsByStatus, allConnectionsMetadata, collapsedClientsState.map, isAgency, isSearchMode]);
```

**Update `handleLoadMore`**:

```typescript
const handleLoadMore = useCallback((status: RequestStatus, virtualItems: VirtualItem[]) => {
  if (!onLoadMoreForStatus || !paginationByStatus) return;
  
  const pagination = paginationByStatus[status];
  
  // Simple check: hasMore and not loading
  if (pagination?.hasMore && !pagination?.isLoading) {
    // Check if we're near the end (80% threshold)
    const visibleCount = virtualItems.length;
    const totalLoaded = requestsByStatus[status]?.length || 0;
    const isNearEnd = visibleCount >= totalLoaded * 0.8;
    
    if (isNearEnd) {
      onLoadMoreForStatus(status);
    }
  }
}, [onLoadMoreForStatus, paginationByStatus, requestsByStatus]);
```

### Phase 6: Handle Collapse/Expand (CRITICAL: Reset Strategy)

**File**: `src/app/(dashboard)/requests/RequestsContent.tsx`

**Track collapsed connections and client counts**:

```typescript
// Track collapsed connection IDs per status
const [collapsedConnectionIdsByStatus, setCollapsedConnectionIdsByStatus] = useState<
  Record<RequestStatus, Set<string>>
>({
  new: new Set(),
  in_review: new Set(),
  accepted: new Set(),
  closed: new Set(),
  canceled: new Set(),
});

// Store client counts from skeleton for collapse math
const [clientCountsByConnection, setClientCountsByConnection] = useState<
  Record<string, number>
>({});
```

**Update `loadMoreForStatus`** to pass excluded connection IDs:

```typescript
const loadMoreForStatus = useCallback(async (status: RequestStatus) => {
  const pagination = paginationByStatus[status];
  if (!pagination.hasMore || pagination.isLoading) return;
  
  // Get excluded connection IDs for this status (collapsed connections)
  const excludedConnectionIds = Array.from(collapsedConnectionIdsByStatus[status]);
  
  setPaginationByStatus(prev => ({
    ...prev,
    [status]: { ...prev[status], isLoading: true }
  }));
  
  try {
    const snapshot = await fetchMoreRequestsForStatus(context, {
      status,
      offset: pagination.offset,
      limit: 50,
      excludedConnectionIds, // Pass to server - server skips these connections
      assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
      createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
    });
    
    startTransition(() => {
      // Merge new requests (deduplicate by id)
      setRequestsByStatus(prev => {
        const existingIds = new Set(prev[status].map(r => r.id));
        const newRequests = snapshot.requests.filter(r => !existingIds.has(r.id));
        return {
          ...prev,
          [status]: [...prev[status], ...newRequests], // Already sorted by server
        };
      });
      
      setPaginationByStatus(prev => ({
        ...prev,
        [status]: {
          offset: snapshot.offset,
          hasMore: snapshot.hasMore,
          isLoading: false,
        }
      }));
      
      // Store client counts from skeleton for collapse math
      if (snapshot.clientCounts) {
        setClientCountsByConnection(prev => ({
          ...prev,
          ...snapshot.clientCounts!,
        }));
      }
    });
  } catch (error) {
    // Handle error
  }
}, [paginationByStatus, collapsedConnectionIdsByStatus, context, assignedToMe, startTransition]);
```

**CRITICAL: Collapse/Expand handlers with reset strategy**:

```typescript
const handleCollapseConnection = useCallback((connectionId: string, status: RequestStatus) => {
  // 1. Calculate new excluded set BEFORE state update
  const currentExcluded = collapsedConnectionIdsByStatus[status];
  const newExcluded = Array.from(new Set([...currentExcluded, connectionId]));
  
  // 2. Update the exclusion set
  setCollapsedConnectionIdsByStatus(prev => ({
    ...prev,
    [status]: new Set(newExcluded),
  }));
  
  // 3. RESET the list for this status
  // Treat collapse/expand as "fresh filter" - ensures no visual jumps
  setRequestsByStatus(prev => ({
    ...prev,
    [status]: [], // Clear data
  }));
  
  // 4. Reset pagination to offset 0
  setPaginationByStatus(prev => ({
    ...prev,
    [status]: {
      offset: 0,
      hasMore: true,
      isLoading: false,
    },
  }));
  
  // 5. Fetch from offset 0 with updated excludedConnectionIds
  fetchMoreRequestsForStatus(context, {
    status,
    offset: 0, // Reset to top ensures no gaps
    limit: 50,
    excludedConnectionIds: newExcluded,
    assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
    createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
  });
}, [collapsedConnectionIdsByStatus, context, assignedToMe]);

const handleExpandConnection = useCallback((connectionId: string, status: RequestStatus) => {
  // 1. Calculate new excluded set BEFORE state update
  const currentExcluded = collapsedConnectionIdsByStatus[status];
  const newExcluded = Array.from(currentExcluded).filter(id => id !== connectionId);
  
  // 2. Remove from collapsed set
  setCollapsedConnectionIdsByStatus(prev => {
    const newSet = new Set(prev[status]);
    newSet.delete(connectionId);
    return {
      ...prev,
      [status]: newSet,
    };
  });
  
  // 3. RESET the list for this status
  setRequestsByStatus(prev => ({
    ...prev,
    [status]: [], // Clear data
  }));
  
  // 4. Reset pagination to offset 0
  setPaginationByStatus(prev => ({
    ...prev,
    [status]: {
      offset: 0,
      hasMore: true,
      isLoading: false,
    },
  }));
  
  // 5. Fetch from offset 0 with updated excludedConnectionIds
  fetchMoreRequestsForStatus(context, {
    status,
    offset: 0, // Reset to top ensures no gaps
    limit: 50,
    excludedConnectionIds: newExcluded,
    assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
    createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined,
  });
}, [collapsedConnectionIdsByStatus, context, assignedToMe]);
```

**Key Points**:
- **Reset strategy**: Clear list and reset offset to 0 when collapsing/expanding
- **Treat as fresh filter**: Ensures no visual jumps or gaps
- **Fast refetch**: Query is fast (<200ms), user won't mind quick reload
- **Calculate excluded set before state update**: Avoids stale closure issues

### Phase 7: Virtual List Total Count Math

**File**: `src/app/(dashboard)/requests/RequestsContent.tsx`

**Calculate effective totalCount for virtual list**:

```typescript
// Calculate effective total for Virtual List (subtract collapsed connection counts)
const effectiveTotalByStatus = useMemo(() => {
  const effective: Record<RequestStatus, number> = {
    new: 0,
    in_review: 0,
    accepted: 0,
    closed: 0,
    canceled: 0,
  };
  
  Object.keys(effective).forEach(status => {
    let total = statusCounts[status as RequestStatus] || 0;
    
    // Subtract counts of collapsed connections
    collapsedConnectionIdsByStatus[status as RequestStatus].forEach(connectionId => {
      const count = clientCountsByConnection[connectionId] || 0;
      total -= count;
    });
    
    effective[status as RequestStatus] = Math.max(0, total); // Ensure non-negative
  });
  
  return effective;
}, [statusCounts, collapsedConnectionIdsByStatus, clientCountsByConnection]);
```

**Pass to RequestsTable**:

```typescript
<RequestsTable
  // ... existing props ...
  totalCount={effectiveTotalByStatus[status]} // Use effective total (accounts for collapsed)
  // ...
/>
```

**Key Points**:
- Subtract collapsed connection counts from totalCount
- Use `clientCountsByConnection` from skeleton data
- Ensures scrollbar height is accurate (no whitespace at bottom)

### Phase 8: Update Types

**File**: `src/features/requests/types.ts`

```typescript
export type RequestsSnapshot = {
  requests: Request[]; // Flat ordered list
  total: number;
  unfilteredTotalCount: number;
  offset: number; // Single offset for flat stream
  hasMore: boolean; // Single hasMore flag
  allConnectionsMetadata?: Map<string, { name: string; logoUrl?: string }>;
  statusCounts?: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  };
  clientCounts?: Record<string, number>; // NEW: Per-connection counts for collapse math
  totalClientCount?: number;
  status?: RequestStatus;
};

export type RequestsPaginationOptions = {
  search?: string;
  offset?: number; // Single offset (not per-connection)
  limit?: number; // Single limit (not per-connection)
  excludedConnectionIds?: string[]; // Server-side collapse: connections to skip
  assignedToUserId?: string;
  createdByUserId?: string;
  status?: RequestStatus;
};
```

## Database Indexes

```sql
-- Optimize flat ordered query
CREATE INDEX IF NOT EXISTS idx_requests_status_connection_created_id
ON requests(status, connection_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;

-- Index on organizations name for efficient sorting (MUST match ORDER BY expression)
CREATE INDEX IF NOT EXISTS idx_organizations_name_lower
ON organizations(LOWER(COALESCE(name, 'Unknown')))
WHERE deleted_at IS NULL;

-- Composite index for the join + sort combination
-- Helps the RPC function's ORDER BY status, LOWER(display_org.name), created_at DESC, id DESC
CREATE INDEX IF NOT EXISTS idx_requests_status_created_id_connection
ON requests(status, created_at DESC, id DESC, connection_id)
WHERE deleted_at IS NULL;
```

**Critical**: The `LOWER(COALESCE(name, 'Unknown'))` expression in the index MUST exactly match the ORDER BY expression in the RPC function, or Postgres won't use the index.

## Performance Targets

- **Initial Load**: < 500ms
  - Skeleton RPC: ~50ms (metadata only)
  - Flat requests RPC: ~200ms for 50 rows
  - Transform: ~250ms
- **Load More**: < 300ms
- **Collapse/Expand**: < 200ms (reset + refetch)
- **Memory**: < 10MB for 500 requests (down from 50MB)
- **Network**: < 200KB per page (down from 2-5MB)

## Implementation Sequence

Follow this exact order to maintain stability:

1. **Database (Phase 1 & 2)**: Deploy the skeleton and flat_ordered RPCs
2. **Server Loader (Phase 3)**: Update server.ts to use the new RPCs
   - **Checkpoint**: Page should load, but might look "ungrouped" or flat
3. **Frontend Grouping (Phase 4)**: Implement `flattenGroupedRequestsFromFlatList`
   - **Checkpoint**: Page looks correct (grouped), but infinite scroll might be janky
4. **Pagination Logic (Phase 5)**: Wire up "Load More" to use single global offset
5. **Collapse Logic (Phase 6)**: Wire up exclusion array with reset strategy
6. **Total Count Math (Phase 7)**: Calculate effective totalCount for virtual list
7. **Types (Phase 8)**: Update types to remove connection-based pagination
8. **Indexes**: Add database indexes for optimization

## Why This Works

1. **Single Pagination Axis**: One offset, one limit, one cursor
2. **Deterministic Ordering**: Database order === scroll order
3. **No State Explosion**: One pagination state per status (5 total, not 125)
4. **Race-Condition Proof**: Single source of truth (database offset)
5. **Virtual List Correctness**: Guaranteed 1:1 mapping to scroll position
6. **Server-Side Collapse**: Collapsed items don't exist in stream, offsets stay stable
7. **Reset Strategy**: Collapse/expand treated as fresh filter, no visual jumps
8. **Accurate Scrollbar**: Effective totalCount accounts for collapsed items

## Files to Modify

1. `supabase/migrations/YYYYMMDD_get_requests_skeleton.sql` - NEW skeleton RPC
2. `supabase/migrations/YYYYMMDD_get_requests_flat_ordered.sql` - NEW flat RPC with display name sorting
3. `src/features/requests/server.ts` - Replace connection-based pagination with flat pagination
4. `src/features/requests/types.ts` - Remove connection-based pagination types, add excludedConnectionIds
5. `src/features/requests/requestGrouping.ts` - Add `flattenGroupedRequestsFromFlatList`
6. `src/app/(dashboard)/requests/RequestsContent.tsx` - Update to use flat pagination with reset strategy
7. `src/features/requests/RequestsTable.tsx` - Update virtual list for flat list
8. `src/features/tasks/server.ts` - Mirror changes (create task RPCs)
9. `src/features/tasks/taskGrouping.ts` - Mirror changes
10. `src/app/(dashboard)/tasks/TasksContent.tsx` - Mirror changes
11. `src/features/tasks/TasksTable.tsx` - Mirror changes

## Testing Checklist

- [ ] Initial load fetches skeleton metadata correctly
- [ ] Flat stream RPC returns correctly ordered requests
- [ ] Frontend groups flat list correctly (headers appear at connection boundaries)
- [ ] Virtual list scrolls smoothly with correct height
- [ ] Load more fetches next batch correctly (offset increments)
- [ ] Collapse connection: list resets, excluded IDs passed to server
- [ ] Expand connection: list resets, excluded IDs updated correctly
- [ ] Effective totalCount calculation is accurate (no whitespace at bottom)
- [ ] No duplicate requests loaded
- [ ] No missing requests (48 vs 50 bug fixed)
- [ ] Performance: Initial load < 500ms
- [ ] Performance: Load more < 300ms
- [ ] Performance: Collapse/expand < 200ms

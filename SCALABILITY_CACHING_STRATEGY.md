# Caching Strategy Recommendations

This document outlines the current caching behavior and recommended improvements for better scalability.

## Current State Analysis

### Current Caching Implementation

1. **React `cache()` Function:**
   - Used extensively for request deduplication
   - Per-request cache (not shared across requests)
   - Good for preventing duplicate queries within same request

2. **Next.js `revalidate` Setting:**
   - Home page: `revalidate = 30` (30 seconds)
   - Settings pages: `revalidate = 30`
   - Onboarding pages: `revalidate = 0` (always dynamic)

3. **`revalidatePath()` Usage:**
   - 190+ calls throughout codebase
   - Invalidates entire pages (not granular)
   - No cache tags used (commented out)

4. **No `revalidateTag()` Usage:**
   - All cache tag code is commented out
   - No granular cache invalidation

### Current Issues

1. **Over-Invalidation:**
   - `revalidatePath('/home')` invalidates entire home page
   - `revalidatePath('/requests')` invalidates entire requests page
   - No way to invalidate specific org's data

2. **Cache Thrashing:**
   - High mutation rate causes frequent invalidations
   - Cache misses lead to expensive queries
   - No distinction between org-specific and global data

3. **Stale Data:**
   - 30s revalidate may be too long for some use cases
   - No way to force refresh specific data

4. **No Cache Warming:**
   - No proactive cache population
   - Cache misses on every first request

---

## Recommended Caching Strategy

### 1. Implement Cache Tags

Replace `revalidatePath()` with `revalidateTag()` for granular invalidation.

#### Cache Tag Structure

```
home:${orgId}              - Home page data for specific org
requests:${orgId}          - Requests list for specific org
tasks:${orgId}            - Tasks list for specific org
clients:${orgId}          - Clients list for specific org
agencies:${orgId}         - Agencies list for specific org
connection:${connectionId} - Connection-specific data
request:${requestId}      - Individual request data
task:${taskId}            - Individual task data
```

#### Implementation

```typescript
// src/features/home/loaders.ts
import { unstable_cache } from 'next/cache';

export const getHomeSnapshot = unstable_cache(
  async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
    // ... existing implementation ...
  },
  ['home-snapshot'],
  {
    tags: [`home:${context.orgId}`],
    revalidate: 30
  }
);

// Invalidation
import { revalidateTag } from 'next/cache';

export function invalidateHome(orgId: string) {
  revalidateTag(`home:${orgId}`);
}
```

#### Update All Server Functions

```typescript
// src/features/requests/server.ts
export const getRequestsSnapshot = unstable_cache(
  async (
    context: EnhancedModeContext,
    options: RequestsPaginationOptions = {}
  ): Promise<RequestsSnapshot> => {
    // ... existing implementation ...
  },
  ['requests-snapshot'],
  {
    tags: [`requests:${context.orgId}`],
    revalidate: 30
  }
);

// src/features/tasks/server.ts
export const getTasksSnapshot = unstable_cache(
  async (
    context: EnhancedModeContext,
    options: TasksPaginationOptions = {}
  ): Promise<TasksSnapshot> => {
    // ... existing implementation ...
  },
  ['tasks-snapshot'],
  {
    tags: [`tasks:${context.orgId}`],
    revalidate: 30
  }
);

// src/features/clients/server.ts
export const getClientsSnapshot = unstable_cache(
  async (
    context: EnhancedModeContext,
    options: ClientsPaginationOptions = {}
  ): Promise<ClientsSnapshot> => {
    // ... existing implementation ...
  },
  ['clients-snapshot'],
  {
    tags: [`clients:${context.orgId}`],
    revalidate: 30
  }
);

// src/features/connections/server.ts
export const getConnectionSnapshot = unstable_cache(
  async (
    context: EnhancedModeContext,
    connectionId: string
  ): Promise<ConnectionSnapshot | null> => {
    // ... existing implementation ...
  },
  ['connection-snapshot'],
  {
    tags: [`connection:${connectionId}`],
    revalidate: 30
  }
);
```

### 2. Update Server Actions

Replace `revalidatePath()` calls with `revalidateTag()`.

#### Before

```typescript
// src/features/connections/requests/actions.ts
revalidatePath('/home');
revalidatePath('/requests');
revalidatePath(`/clients/${connectionId}/overview`);
```

#### After

```typescript
// src/features/connections/requests/actions.ts
import { revalidateTag } from 'next/cache';

// Get orgId from context
const context = await getActiveContext();
if (context) {
  revalidateTag(`home:${context.orgId}`);
  revalidateTag(`requests:${context.orgId}`);
  revalidateTag(`connection:${connectionId}`);
}
```

#### Update All Server Actions

```typescript
// src/features/connections/requests/actions.ts
// After creating/updating/deleting request:
revalidateTag(`home:${context.orgId}`);
revalidateTag(`requests:${context.orgId}`);
revalidateTag(`connection:${connectionId}`);
revalidateTag(`request:${requestId}`);

// src/features/connections/tasks/actions.ts
// After creating/updating/deleting task:
revalidateTag(`home:${context.orgId}`);
revalidateTag(`tasks:${context.orgId}`);
revalidateTag(`connection:${connectionId}`);
revalidateTag(`task:${taskId}`);

// src/features/clients/actions.ts
// After creating/updating/deleting client:
revalidateTag(`clients:${context.orgId}`);
revalidateTag(`connection:${connectionId}`);
```

### 3. Optimize Revalidate Times

Adjust revalidate times based on data freshness requirements.

```typescript
// Home page: 10s (more responsive)
export const revalidate = 10;

// List pages: 30s (acceptable staleness)
export const revalidate = 30;

// Detail pages: 60s (less frequent updates)
export const revalidate = 60;

// Settings pages: 0 (always fresh)
export const revalidate = 0;
```

### 4. Add Cache Warming

Pre-populate cache for frequently accessed data.

```typescript
// src/lib/cache/warm.ts
export async function warmHomePageCache(orgId: string) {
  const context = await getActiveContext();
  if (!context || context.orgId !== orgId) return;
  
  // Pre-fetch home page data
  await getHomeSnapshot(context);
}

// Call after mutations that affect home page
export async function createRequest(...) {
  // ... create request ...
  
  // Warm cache for affected orgs
  await warmHomePageCache(context.orgId);
}
```

### 5. Cache Connection IDs

Cache connection IDs per org with 30s TTL.

```typescript
// src/lib/cache/connectionIds.ts
import { unstable_cache } from 'next/cache';

export const getCachedConnectionIds = unstable_cache(
  async (context: EnhancedModeContext): Promise<string[]> => {
    const supabase = await createClient();
    
    const connectionQuery = context.variant === 'agency'
      ? supabase
          .from('connections')
          .select('id')
          .eq('agency_id', context.orgId)
          .neq('connection_status', 'disconnected')
      : supabase
          .from('connections')
          .select('id')
          .eq('client_id', context.orgId)
          .neq('connection_status', 'disconnected');
    
    const { data: connections } = await connectionQuery;
    return (connections || []).map(c => c.id);
  },
  ['connection-ids'],
  {
    tags: [`connection-ids:${context.orgId}`],
    revalidate: 30
  }
);
```

### 6. Cache Count Queries

Cache count queries with shorter TTL.

```typescript
// src/features/home/server.ts
export const getCachedNewRequestsCount = unstable_cache(
  async (
    context: EnhancedModeContext,
    connectionIds: string[]
  ): Promise<number> => {
    // ... existing implementation ...
  },
  ['new-requests-count'],
  {
    tags: [`requests:${context.orgId}`],
    revalidate: 10 // Shorter TTL for counts
  }
);
```

---

## Migration Plan

### Phase 1: Implement Cache Tags (Week 1)

1. Replace `cache()` with `unstable_cache()` in all server functions
2. Add cache tags to all functions
3. Update invalidation functions to use `revalidateTag()`

### Phase 2: Update Server Actions (Week 2)

1. Replace all `revalidatePath()` calls with `revalidateTag()`
2. Add orgId context to all server actions
3. Update invalidation logic

### Phase 3: Optimize Revalidate Times (Week 3)

1. Adjust revalidate times based on data freshness requirements
2. Monitor cache hit rates
3. Fine-tune based on metrics

### Phase 4: Add Cache Warming (Week 4)

1. Implement cache warming for frequently accessed data
2. Add cache warming after mutations
3. Monitor cache hit rates

---

## Expected Performance Improvements

1. **Cache Hit Rate:**
   - Current: ~40-50% (estimated)
   - Target: 70-80%
   - Impact: 30-50% reduction in database queries

2. **Page Load Time:**
   - Current: 500-800ms (with cache miss)
   - Target: 200-400ms (with cache hit)
   - Impact: 50-60% reduction in page load time

3. **Database Load:**
   - Current: High (frequent invalidations)
   - Target: Low (granular invalidations)
   - Impact: 40-50% reduction in database queries

4. **User Experience:**
   - Faster page loads
   - More responsive updates
   - Better perceived performance

---

## Monitoring Recommendations

1. **Cache Hit Rate:**
   - Track cache hit/miss ratios per tag
   - Alert on cache hit rate <70%

2. **Revalidation Frequency:**
   - Track how often each tag is invalidated
   - Identify tags with high invalidation rate

3. **Page Load Time:**
   - Monitor page load time with/without cache
   - Track improvement over time

4. **Database Query Count:**
   - Monitor database query count
   - Track reduction after implementing cache tags

---

## Rollback Plan

If issues arise:

1. Revert to `revalidatePath()` temporarily
2. Keep `unstable_cache()` but remove tags
3. Gradually re-introduce tags one at a time
4. Monitor for issues

---

## Conclusion

Implementing granular cache tags will significantly improve scalability by:
- Reducing database load
- Improving page load times
- Enabling better cache invalidation
- Supporting multi-tenant caching

The migration should be done gradually, starting with low-risk functions and monitoring performance throughout.




















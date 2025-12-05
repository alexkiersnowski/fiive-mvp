import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';
import { getUnifiedHomeData, getHomeCountsAggregated } from './server';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // Use unified query to fetch all data in a single database call
  const unifiedData = await getUnifiedHomeData(context);
  
  // Pass connection IDs from unified data to avoid redundant connection queries
  const connectionIds = unifiedData.connectionIds || [];
  
  // Fetch all counts in a single optimized query (combines 4 count queries into parallel execution)
  const counts = await getHomeCountsAggregated(context, connectionIds);
  
  return {
    clients: {
      total: unifiedData.connectionCount,
    },
    health: unifiedData.healthCounts,
    agencies: unifiedData.agencyPreviews,
    requests: {
      newCount: counts.newRequestsCount,
      inReviewCount: counts.inReviewRequestsCount,
    },
    contracts: {
      endingSoonCount: unifiedData.contractsEndingCount,
    },
    tasks: {
      dueSoonCount: counts.tasksDueSoonCount,
      assignedCount: counts.assignedTasksCount,
    },
  };
});

export function invalidateHome(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`home:${orgId}`);
  console.log(`Invalidating home cache for org: ${orgId}`);
}


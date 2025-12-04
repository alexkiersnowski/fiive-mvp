import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';
import { getUnifiedHomeData, getTasksDueSoonCount } from './server';
import { getGlobalNewRequestsCount, getGlobalInReviewRequestsCount } from '@/features/requests/server';
import { getGlobalAssignedTasksCount } from '@/features/tasks/server';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // Use unified query to fetch all data in a single database call
  const unifiedData = await getUnifiedHomeData(context);
  
  // Pass connection IDs from unified data to avoid redundant connection queries
  // This eliminates 4 redundant database queries per page load
  const connectionIds = unifiedData.connectionIds || [];
  
  // Fetch new requests count, in-review requests count, tasks due soon count, and assigned tasks count in parallel
  // All count functions now accept optional connectionIds to avoid redundant queries
  const [newRequestsCount, inReviewRequestsCount, tasksDueSoonCount, assignedTasksCount] = await Promise.all([
    getGlobalNewRequestsCount(context, connectionIds),
    getGlobalInReviewRequestsCount(context, connectionIds),
    getTasksDueSoonCount(context, connectionIds),
    getGlobalAssignedTasksCount(context, connectionIds),
  ]);
  
  return {
    clients: {
      total: unifiedData.connectionCount,
    },
    health: unifiedData.healthCounts,
    agencies: unifiedData.agencyPreviews,
    requests: {
      newCount: newRequestsCount,
      inReviewCount: inReviewRequestsCount,
    },
    contracts: {
      endingSoonCount: unifiedData.contractsEndingCount,
    },
    tasks: {
      dueSoonCount: tasksDueSoonCount,
      assignedCount: assignedTasksCount,
    },
  };
});

export function invalidateHome(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`home:${orgId}`);
  console.log(`Invalidating home cache for org: ${orgId}`);
}


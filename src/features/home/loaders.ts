import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';
import { getUnifiedHomeData, getTasksDueSoonCount } from './server';
import { getGlobalNewRequestsCount, getGlobalInReviewRequestsCount } from '@/features/requests/server';
import { getGlobalAssignedTasksCount } from '@/features/tasks/server';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // Use unified query to fetch all data in a single database call
  const unifiedData = await getUnifiedHomeData(context);
  
  // Fetch new requests count, in-review requests count, tasks due soon count, and assigned tasks count in parallel with unified data
  const [newRequestsCount, inReviewRequestsCount, tasksDueSoonCount, assignedTasksCount] = await Promise.all([
    getGlobalNewRequestsCount(context),
    getGlobalInReviewRequestsCount(context),
    getTasksDueSoonCount(context),
    getGlobalAssignedTasksCount(context),
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


import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';
import { getUnifiedHomeData } from './server';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // Use unified query to fetch all data in a single database call
  const unifiedData = await getUnifiedHomeData(context);
  
  return {
    clients: {
      total: unifiedData.connectionCount,
    },
    health: unifiedData.healthCounts,
    agencies: unifiedData.agencyPreviews,
    requests: {
      newCount: 0, // TODO: Implement when requests feature is ready
    },
    contracts: {
      endingSoonCount: unifiedData.contractsEndingCount,
    },
    tasks: {
      dueSoonCount: 0, // TODO: Implement when tasks feature is ready
    },
  };
});

export function invalidateHome(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`home:${orgId}`);
  console.log(`Invalidating home cache for org: ${orgId}`);
}


import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // TODO: Replace with actual data fetching when database is ready
  // For now, return mock data for scaffolding
  
  return {
    clients: {
      total: 0,
    },
    requests: {
      newCount: 0,
    },
    contracts: {
      endingSoonCount: 0,
    },
    tasks: {
      dueSoonCount: 0,
    },
  };
});

export function invalidateHome(orgId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`home:${orgId}`);
  console.log(`Invalidating home cache for org: ${orgId}`);
}


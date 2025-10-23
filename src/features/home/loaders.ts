import { cache } from 'react';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { HomeSnapshot } from './types';
import { getClientsSnapshot } from '@/features/clients/server';
import { getAgenciesSnapshot } from '@/features/agencies/server';
import { getHealthCounts, getContractsEndingCount } from './server';

export const getHomeSnapshot = cache(async (context: EnhancedModeContext): Promise<HomeSnapshot> => {
  // Get actual connection count and health data based on user type
  let connectionCount = 0;
  let agencyPreviews: Array<{ id: string; connectionId: string; name: string; logo?: string; projectCount: number }> = [];
  
  if (context.variant === 'agency') {
    // Agency sees clients count and health status
    const clientsSnapshot = await getClientsSnapshot(context);
    connectionCount = clientsSnapshot.total;
  } else {
    // Client sees agencies count and preview of up to 5 agencies
    const agenciesSnapshot = await getAgenciesSnapshot(context, { limit: 5 });
    connectionCount = agenciesSnapshot.total;
    
    // Map agencies to preview format with project count (default to 0 for now)
    agencyPreviews = agenciesSnapshot.agencies.slice(0, 5).map(agency => ({
      id: agency.id,
      connectionId: agency.connectionId,
      name: agency.name,
      logo: agency.logo,
      projectCount: 0 // TODO: Wire up actual project count when available
    }));
  }
  
  // Get health counts and contracts ending count using dedicated queries
  const healthCounts = await getHealthCounts(context);
  const contractsEndingCount = await getContractsEndingCount(context);
  
  return {
    clients: {
      total: connectionCount,
    },
    health: healthCounts,
    agencies: agencyPreviews,
    requests: {
      newCount: 0, // TODO: Implement when requests feature is ready
    },
    contracts: {
      endingSoonCount: contractsEndingCount,
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


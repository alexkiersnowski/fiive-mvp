import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type HealthCounts = {
  healthy: number;
  atRisk: number;
  critical: number;
  unassigned: number;
};

export const getHealthCounts = cache(async (context: EnhancedModeContext): Promise<HealthCounts> => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // Clients don't have health counts - they see agencies
    return { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 };
  }
  
  const { data: connections, error } = await supabase
    .from('connections')
    .select('health_status')
    .eq('agency_id', context.orgId);
  
  if (error) {
    console.error('Error fetching health counts:', error);
    return { healthy: 0, atRisk: 0, critical: 0, unassigned: 0 };
  }
  
  const counts: HealthCounts = {
    healthy: 0,
    atRisk: 0,
    critical: 0,
    unassigned: 0
  };
  
  connections?.forEach(conn => {
    switch (conn.health_status) {
      case 'healthy':
        counts.healthy++;
        break;
      case 'at_risk':
        counts.atRisk++;
        break;
      case 'critical':
        counts.critical++;
        break;
      case 'unassigned':
      default:
        counts.unassigned++;
        break;
    }
  });
  
  return counts;
});

export const getContractsEndingCount = cache(async (context: EnhancedModeContext): Promise<number> => {
  const supabase = await createClient();
  
  if (context.variant !== 'agency') {
    // Clients don't have contract ending counts - they see agencies
    return 0;
  }
  
  // Calculate 90 days from now
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  
  // Format dates for PostgreSQL (YYYY-MM-DD)
  const todayStr = today.toISOString().split('T')[0];
  const ninetyDaysStr = ninetyDaysFromNow.toISOString().split('T')[0];
  
  const { data: connections, error } = await supabase
    .from('connections')
    .select('contract_end_on')
    .eq('agency_id', context.orgId)
    .not('contract_end_on', 'is', null)
    .gte('contract_end_on', todayStr)
    .lte('contract_end_on', ninetyDaysStr);
  
  if (error) {
    console.error('Error fetching contracts ending count:', error);
    return 0;
  }
  
  return connections?.length || 0;
});

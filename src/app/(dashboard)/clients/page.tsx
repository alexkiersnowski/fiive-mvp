import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getClientsSnapshot } from '@/features/clients/server';
import { ClientsContent } from './ClientsContent';

interface ClientsPageProps {
  searchParams: Promise<{
    search?: string;
    sort?: string;
  }>;
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  // CRITICAL: Validate context and ensure user is an agency (only agencies can see clients)
  if (!context || !validateOrgContext(context) || !context.capabilities.canSeeClients) {
    notFound();
  }
  
  // Additional safety check: agencies should not access this if variant is wrong
  if (context.variant !== 'agency') {
    console.error(`SECURITY VIOLATION: Non-agency user attempted to access /clients route. Variant: ${context.variant}, User ID: ${context.userId}`);
    notFound();
  }

  const resolvedSearchParams = await searchParams;

  const snapshotStartTime = performance.now();
  const snapshot = await getClientsSnapshot(context, {
    search: resolvedSearchParams.search || '',
    limit: 50,
    sort: resolvedSearchParams.sort || 'newest-first'
  });
  console.log(`[Performance] getClientsSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);
  console.log(`[Performance] ClientsPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <ClientsContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialSortValue={resolvedSearchParams.sort || 'newest-first'}
    />
  );
}


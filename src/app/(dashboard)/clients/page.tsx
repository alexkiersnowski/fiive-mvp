import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getClientsSnapshot } from '@/features/clients/server';
import { ClientsContent } from './ClientsContent';

interface ClientsPageProps {
  searchParams: {
    search?: string;
    sort?: string;
  };
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  if (!context || !context.capabilities.canSeeClients) {
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


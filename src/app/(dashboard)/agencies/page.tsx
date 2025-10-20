import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getAgenciesSnapshot } from '@/features/agencies/server';
import { AgenciesContent } from './AgenciesContent';

interface AgenciesPageProps {
  searchParams: {
    search?: string;
  };
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  if (!context || !context.capabilities.canSeeAgencies) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;

  const snapshotStartTime = performance.now();
  const snapshot = await getAgenciesSnapshot(context, {
    search: resolvedSearchParams.search || '',
    limit: 50
  });
  console.log(`[Performance] getAgenciesSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);
  console.log(`[Performance] AgenciesPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  return (
    <AgenciesContent 
      snapshot={snapshot}
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
    />
  );
}
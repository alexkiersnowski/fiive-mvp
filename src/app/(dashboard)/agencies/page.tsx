import type { Metadata } from 'next';
import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getAgenciesSnapshot } from '@/features/agencies/server';
import { AgenciesContent } from './AgenciesContent';

export const metadata: Metadata = {
  title: 'Fiive | Agencies',
};

interface AgenciesPageProps {
  searchParams: Promise<{
    search?: string;
  }>;
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const pageStartTime = performance.now();
  
  const context = await getActiveContext();
  
  // CRITICAL: Validate context and ensure user is a client (only clients can see agencies)
  if (!context || !validateOrgContext(context) || !context.capabilities.canSeeAgencies) {
    notFound();
  }
  
  // Additional safety check: clients should not access this if variant is wrong
  if (context.variant !== 'client') {
    console.error(`SECURITY VIOLATION: Non-client user attempted to access /agencies route. Variant: ${context.variant}, User ID: ${context.userId}`);
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
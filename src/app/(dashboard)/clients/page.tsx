import type { Metadata } from 'next';
import { getActiveContext } from '@/lib/mode/getActiveContext';
import { validateOrgContext } from '@/lib/mode/validateContext';
import { notFound } from 'next/navigation';
import { getClientsSnapshot } from '@/features/clients/server';
import { ClientsContent } from './ClientsContent';
import { countInternalConnections, checkPaywall } from '@/lib/paywall/checkConnectionLimit';

export const metadata: Metadata = {
  title: 'Fiive | Clients',
};

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

  // Extract billing status and org ID for paywall checks
  const billingStatus = context.organization.billing_status || 'free';
  const orgId = context.orgId;

  // Prefetch paywall checks in parallel with clients snapshot for optimal performance
  // Only check for free agencies (paid agencies have no limits)
  const snapshotStartTime = performance.now();
  const [snapshotResult, paywallChecksResult] = await Promise.allSettled([
    getClientsSnapshot(context, {
      search: resolvedSearchParams.search || '',
      limit: 50,
      sort: resolvedSearchParams.sort || 'created'
    }),
    // Run paywall checks in parallel (only for free agencies)
    billingStatus === 'free'
      ? (async () => {
          // Count internal connections once and use for both checks
          const internalCount = await countInternalConnections(orgId);
          const [internalPaywall, agencyInitiatedPaywall] = await Promise.all([
            // Check paywall for internal connection (Add a new client)
            checkPaywall({
              billingStatus,
              isAgencyInitiated: true,
              isClientInitiated: false,
              isInternal: true,
              internalCount,
              clientInitiatedCount: 0,
            }),
            // Check paywall for agency-initiated connection (Connect to client)
            checkPaywall({
              billingStatus,
              isAgencyInitiated: true,
              isClientInitiated: false,
              isInternal: false,
              internalCount: 0,
              clientInitiatedCount: 0,
            }),
          ]);
          return { internalPaywall, agencyInitiatedPaywall };
        })()
      : Promise.resolve({ 
          internalPaywall: { allowed: true },
          agencyInitiatedPaywall: { allowed: true }
        }),
  ]);

  // Handle snapshot result
  if (snapshotResult.status === 'rejected') {
    console.error('Error fetching clients snapshot:', snapshotResult.reason);
    throw snapshotResult.reason;
  }
  const snapshot = snapshotResult.value;
  console.log(`[Performance] getClientsSnapshot: ${(performance.now() - snapshotStartTime).toFixed(2)}ms`);
  console.log(`[Performance] ClientsPage TOTAL: ${(performance.now() - pageStartTime).toFixed(2)}ms`);

  // Extract paywall check results (default to true on error - fail open)
  const canAddNewClient = paywallChecksResult.status === 'fulfilled'
    ? paywallChecksResult.value.internalPaywall.allowed
    : true;
  
  const canConnectToClient = paywallChecksResult.status === 'fulfilled'
    ? paywallChecksResult.value.agencyInitiatedPaywall.allowed
    : true;

  if (paywallChecksResult.status === 'rejected') {
    console.error('Error checking paywall:', paywallChecksResult.reason);
  }

  return (
    <ClientsContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={resolvedSearchParams.search || ''}
      initialSortValue={resolvedSearchParams.sort || 'created'}
      canAddNewClient={canAddNewClient}
      canConnectToClient={canConnectToClient}
    />
  );
}


import { redirect } from 'next/navigation';
import { getActiveContext } from '@/lib/mode/getActiveContext';
import { checkWorkspaceAccessOrThrow } from '@/lib/paywall/checkWorkspaceAccess';
import ConnectionLayoutWrapper from '@/features/connections/ConnectionLayoutWrapper';

interface ClientConnectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ connectionId: string }>;
}

export default async function ClientConnectionLayout({ children, params }: ClientConnectionLayoutProps) {
  const context = await getActiveContext();
  const resolvedParams = await params;
  const connectionId = resolvedParams.connectionId;

  // Only agencies can access client workspaces
  if (context && context.variant === 'agency') {
    try {
      await checkWorkspaceAccessOrThrow({
        agencyId: context.orgId,
        connectionId,
        billingStatus: context.organization.billing_status || 'free',
      });
    } catch {
      // Access blocked - redirect to clients page with paywall query param
      redirect('/clients?paywall=workspace');
    }
  }

  return (
    <ConnectionLayoutWrapper
      params={params}
      baseRoute="clients"
      requiredCapability="canSeeClients"
    >
      {children}
    </ConnectionLayoutWrapper>
  );
}


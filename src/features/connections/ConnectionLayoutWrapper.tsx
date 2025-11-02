import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getConnectionSnapshot, validateConnectionAccess } from './server';
import { ConnectionLayout } from './ConnectionLayout';

interface ConnectionLayoutWrapperProps {
  children: React.ReactNode;
  params: Promise<{ connectionId: string }>;
  baseRoute: 'clients' | 'agencies';
  requiredCapability: 'canSeeClients' | 'canSeeAgencies';
}

/**
 * Shared connection layout wrapper for both agencies and clients
 * Handles validation, access checks, and snapshot fetching
 */
export default async function ConnectionLayoutWrapper({ 
  children, 
  params, 
  baseRoute,
  requiredCapability 
}: ConnectionLayoutWrapperProps) {
  const context = await getActiveContext();
  
  if (!context || !context.capabilities[requiredCapability]) {
    notFound();
  }

  const resolvedParams = await params;
  const connectionId = resolvedParams.connectionId;

  // Validate connectionId format (UUID)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(connectionId)) {
    notFound();
  }

  // Validate connection access first (lightweight check)
  const isValid = await validateConnectionAccess(connectionId, context);
  if (!isValid) {
    notFound();
  }

  // For request detail pages: ConnectionLayout will detect via usePathname and skip snapshot usage
  // For other pages: fetch full snapshot as they need it
  // We always validate first, but ConnectionLayout optimizes by not using snapshot for request detail pages
  const snapshot = await getConnectionSnapshot(context, connectionId);

  return (
    <ConnectionLayout 
      snapshot={snapshot}
      context={context}
      baseRoute={baseRoute}
    >
      {children}
    </ConnectionLayout>
  );
}


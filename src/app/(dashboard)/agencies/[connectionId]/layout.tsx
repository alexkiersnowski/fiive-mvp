import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getConnectionSnapshot, validateConnectionAccess } from '@/features/connections/server';
import { ConnectionLayout } from '@/features/connections/ConnectionLayout';

interface AgencyConnectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    connectionId: string;
  }>;
}

export default async function AgencyConnectionLayout({ children, params }: AgencyConnectionLayoutProps) {
  const context = await getActiveContext();
  
  if (!context || !context.capabilities.canSeeAgencies) {
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
      baseRoute="agencies"
    >
      {children}
    </ConnectionLayout>
  );
}


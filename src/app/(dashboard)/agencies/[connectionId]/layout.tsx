import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getConnectionSnapshot } from '@/features/connections/server';
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

  // Fetch connection data once for the entire layout
  const snapshot = await getConnectionSnapshot(context, connectionId);
  
  if (!snapshot) {
    notFound();
  }

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


import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
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

  // Check if we're on a detail page (request, task, or project detail)
  // Skip snapshot fetch for detail pages since ConnectionLayout doesn't use it
  // Note: Server components don't have direct pathname access, so we use a best-effort detection
  // ConnectionLayout will handle null snapshot gracefully for detail pages
  const headersList = await headers();
  const referer = headersList.get('referer') || '';
  let isDetailPage = false;
  
  // Try to detect detail pages from referer header (works for client-side navigation)
  if (referer) {
    try {
      const url = new URL(referer);
      const pathname = url.pathname;
      // Check if pathname matches detail page patterns
      isDetailPage = /\/requests\/[^/]+$/.test(pathname) || 
                     /\/tasks\/[^/]+$/.test(pathname) || 
                     /\/projects\/[^/]+$/.test(pathname);
    } catch {
      // If URL parsing fails, assume we need snapshot (conservative approach)
    }
  }
  // Note: On initial page load without referer, we'll fetch snapshot (conservative)
  // This is acceptable since ConnectionLayout handles both cases correctly
  
  // Only fetch snapshot if not detected as detail page
  const snapshot = isDetailPage ? null : await getConnectionSnapshot(context, connectionId);

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


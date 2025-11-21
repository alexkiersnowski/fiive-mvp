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

  // Check if we're on a detail page (request, task, or project detail) or settings page
  // Skip snapshot fetch for detail pages and settings page since ConnectionLayout doesn't use it
  // Note: Server components don't have direct pathname access, so we use a best-effort detection
  // ConnectionLayout will handle null snapshot gracefully for detail pages and settings page
  const headersList = await headers();
  const pathnameHeader = headersList.get('x-pathname');
  const referer = headersList.get('referer') || '';
  
  // Only use pathname header if available (more reliable than referer)
  // If pathname header is not available, we'll always fetch snapshot to be safe
  let isDetailPage = false;
  let isSettingsPage = false;
  
  if (pathnameHeader) {
    // Pathname header is available - use it directly (most reliable)
    try {
      const urlPathname = pathnameHeader.startsWith('/') 
        ? pathnameHeader 
        : (() => {
            try {
              const url = new URL(pathnameHeader);
              return url.pathname;
            } catch {
              return pathnameHeader;
            }
          })();
      
      // Check if pathname matches detail page patterns or settings page
      isDetailPage = /\/requests\/[^/]+$/.test(urlPathname) || 
                     /\/tasks\/[^/]+$/.test(urlPathname) || 
                     /\/projects\/[^/]+$/.test(urlPathname);
      isSettingsPage = /\/settings$/.test(urlPathname);
    } catch {
      // If URL parsing fails, assume we need snapshot (conservative approach)
      isDetailPage = false;
      isSettingsPage = false;
    }
  }
  // If pathname header is not available, always fetch snapshot (conservative approach)
  // This ensures pages like overview always get the snapshot they need
  
  // Only fetch snapshot if not detected as detail page or settings page
  // getConnectionSnapshot is cached, so multiple calls within the same request are deduplicated
  const snapshot = (isDetailPage || isSettingsPage) ? null : await getConnectionSnapshot(context, connectionId);

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


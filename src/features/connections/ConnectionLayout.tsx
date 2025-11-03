'use client'

import { usePathname } from 'next/navigation';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import { ConnectionHeader } from './ConnectionHeader';
import { ConnectionTabs } from './ConnectionTabs';
import { ConnectionProvider, useConnection } from './ConnectionContext';

interface ConnectionLayoutProps {
  snapshot: ConnectionSnapshot | null;
  context: EnhancedModeContext;
  baseRoute: 'clients' | 'agencies';
  children: React.ReactNode;
}

function ConnectionLayoutContent({ snapshot, context, baseRoute, children }: Omit<ConnectionLayoutProps, 'snapshot' | 'context'> & { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const pathname = usePathname();
  const currentUserType = baseRoute === 'clients' ? 'agency' : 'client';
  const { isEmpty, newRequestsCount } = useConnection();
  
  // Check if we're on a request detail page (pattern: /agencies/[connectionId]/requests/[requestId] or /clients/[connectionId]/requests/[requestId])
  const isRequestDetailPage = /\/requests\/[^/]+$/.test(pathname);
  
  // Detect if we're on the requests tab (but not a detail page)
  const isOnRequestsTab = !isRequestDetailPage && /\/requests$/.test(pathname);
  
  // Only use height: 100% when on requests tab with empty state, otherwise use minHeight: 100%
  const containerHeight = isOnRequestsTab && isEmpty ? '100%' : undefined;
  const containerMinHeight = !containerHeight ? '100%' : undefined;
  
  return (
    <div style={{ 
      padding: '16px 16px 24px 24px',
      height: containerHeight,
      minHeight: containerMinHeight,
    }}>
      <ConnectionHeader snapshot={snapshot} />
      <ConnectionTabs 
        connectionId={snapshot.connection.id}
        baseRoute={baseRoute}
        currentUserType={currentUserType}
        newRequestsCount={newRequestsCount}
      />
      <div style={{ 
        paddingTop: '16px',
        flex: 1
      }}>
        {children}
      </div>
    </div>
  );
}

export function ConnectionLayout({ snapshot, context, baseRoute, children }: ConnectionLayoutProps) {
  const pathname = usePathname();
  
  // Check if we're on a request detail page (pattern: /agencies/[connectionId]/requests/[requestId] or /clients/[connectionId]/requests/[requestId])
  const isRequestDetailPage = /\/requests\/[^/]+$/.test(pathname);
  
  // Check if we're on a project detail page (pattern: /agencies/[connectionId]/projects/[projectId] or /clients/[connectionId]/projects/[projectId])
  const isProjectDetailPage = /\/projects\/[^/]+$/.test(pathname);
  
  // For request or project detail pages, render children directly without ConnectionProvider
  // RequestDetailContent and ProjectDetailContent don't use ConnectionProvider and DashboardLayout handles styling
  if (isRequestDetailPage || isProjectDetailPage) {
    return <>{children}</>;
  }
  
  // For other pages, we need the snapshot
  if (!snapshot) {
    return <>{children}</>;
  }
  
  // For other pages, render normally with header and tabs
  return (
    <ConnectionProvider snapshot={snapshot} context={context}>
      <ConnectionLayoutContent snapshot={snapshot} context={context} baseRoute={baseRoute}>
        {children}
      </ConnectionLayoutContent>
    </ConnectionProvider>
  );
}


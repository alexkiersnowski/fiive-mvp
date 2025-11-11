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

function ConnectionLayoutContent({ 
  snapshot, 
  context, 
  baseRoute, 
  children,
  isRequestDetailPage 
}: Omit<ConnectionLayoutProps, 'snapshot' | 'context'> & { 
  snapshot: ConnectionSnapshot; 
  context: EnhancedModeContext;
  isRequestDetailPage: boolean;
}) {
  const pathname = usePathname();
  const currentUserType = context.variant;
  const { isEmpty, newRequestsCount } = useConnection();
  
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
  
  // Compute detail page checks once (used in multiple places)
  const isRequestDetailPage = /\/requests\/[^/]+$/.test(pathname);
  const isTaskDetailPage = /\/tasks\/[^/]+$/.test(pathname);
  const isProjectDetailPage = /\/projects\/[^/]+$/.test(pathname);
  
  // For request, task, or project detail pages, render children directly without ConnectionProvider
  // RequestDetailContent, TaskDetailContent, and ProjectDetailContent don't use ConnectionProvider and DashboardLayout handles styling
  if (isRequestDetailPage || isTaskDetailPage || isProjectDetailPage) {
    return <>{children}</>;
  }
  
  // For other pages, we need the snapshot
  if (!snapshot) {
    return <>{children}</>;
  }
  
  // For other pages, render normally with header and tabs
  return (
    <ConnectionProvider snapshot={snapshot} context={context}>
      <ConnectionLayoutContent 
        snapshot={snapshot} 
        context={context} 
        baseRoute={baseRoute}
        isRequestDetailPage={isRequestDetailPage}
      >
        {children}
      </ConnectionLayoutContent>
    </ConnectionProvider>
  );
}


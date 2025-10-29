'use client'

import { usePathname } from 'next/navigation';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import { ConnectionHeader } from './ConnectionHeader';
import { ConnectionTabs } from './ConnectionTabs';
import { ConnectionProvider } from './ConnectionContext';

interface ConnectionLayoutProps {
  snapshot: ConnectionSnapshot | null;
  context: EnhancedModeContext;
  baseRoute: 'clients' | 'agencies';
  children: React.ReactNode;
}

export function ConnectionLayout({ snapshot, context, baseRoute, children }: ConnectionLayoutProps) {
  const pathname = usePathname();
  const currentUserType = baseRoute === 'clients' ? 'agency' : 'client';
  
  // Check if we're on a request detail page (pattern: /agencies/[connectionId]/requests/[requestId] or /clients/[connectionId]/requests/[requestId])
  const isRequestDetailPage = /\/requests\/[^/]+$/.test(pathname);
  
  // For request detail pages, render children directly without ConnectionProvider
  // RequestDetailContent doesn't use ConnectionProvider and DashboardLayout handles styling
  if (isRequestDetailPage) {
    return <>{children}</>;
  }
  
  // For other pages, we need the snapshot
  if (!snapshot) {
    return <>{children}</>;
  }
  
  // For other pages, render normally with header and tabs
  return (
    <ConnectionProvider snapshot={snapshot} context={context}>
      <div style={{ 
        padding: '16px 16px 24px 24px',
        minHeight: '100%',
      }}>
        <ConnectionHeader snapshot={snapshot} />
        <ConnectionTabs 
          connectionId={snapshot.connection.id}
          baseRoute={baseRoute}
          currentUserType={currentUserType}
        />
        <div style={{ 
          paddingTop: '16px',
          flex: 1
        }}>
          {children}
        </div>
      </div>
    </ConnectionProvider>
  );
}


'use client'

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import { ConnectionHeader } from './ConnectionHeader';
import { ConnectionTabs } from './ConnectionTabs';
import { ConnectionProvider, useConnection } from './ConnectionContext';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Users, X } from '@phosphor-icons/react';

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
  
  // Determine if alert should be shown (draft connection, agency user, client partner, and on overview tab only)
  const isOnOverviewTab = pathname.endsWith('/overview') || pathname === `/${baseRoute}/${snapshot.connection.id}`;
  const shouldShowAlert = snapshot.connection.isDraft && 
                         snapshot.currentUserType === 'agency' && 
                         snapshot.partner.type === 'client' &&
                         isOnOverviewTab;
  
  // Dismiss state management with sessionStorage
  const storageKey = `draft-alert-dismissed-${snapshot.connection.id}`;
  // Use mounted state to prevent flicker - don't render alert until we've checked sessionStorage
  const [isMounted, setIsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Check sessionStorage after mount to avoid hydration issues
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem(storageKey) === 'true';
      setIsDismissed(dismissed);
    } catch {
      // Ignore storage errors (e.g., private browsing mode)
      setIsDismissed(false);
    } finally {
      setIsMounted(true);
    }
  }, [storageKey]);
  
  // Handle dismiss
  const handleDismiss = () => {
    setIsDismissed(true);
    try {
      sessionStorage.setItem(storageKey, 'true');
    } catch (error) {
      // Ignore storage errors (e.g., private browsing mode)
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to save alert dismissal to sessionStorage:', error);
      }
    }
  };
  
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
      {shouldShowAlert && isMounted && !isDismissed && (
        <div style={{ paddingTop: '16px' }}>
          <Alert className="relative" style={{ backgroundColor: 'var(--color-neutral-3)', padding: '20px' }}>
            <Users size={16} />
            <AlertTitle className="text-sm-medium" style={{ color: 'var(--color-base-text-primary)' }}>You're setting up a shared workspace with your client</AlertTitle>
            <AlertDescription className="text-sm-regular mt-0.5" style={{ color: 'var(--color-base-text-secondary)' }}>
              Once invited, your accounts will connect, and the client will access their own portal. They'll manage their own name, logo, and info. Requests and contacts are always shared. Tasks, projects, and resources are managed by your team. Set up the workspace now, or invite your client to complete it together.
            </AlertDescription>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="absolute top-3 right-3 h-6 w-6 p-0 hover:bg-[var(--color-interactive-surface-hover)] opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
              style={{ height: '24px', width: '24px' }}
              aria-label="Dismiss alert"
            >
              <X size={16} />
            </Button>
          </Alert>
        </div>
      )}
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


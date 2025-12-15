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
import { Users, X, PencilSimpleSlash } from '@phosphor-icons/react';

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
  
  // Determine if alert should be shown (internal connection, agency user, client partner, and on overview tab only)
  const isOnOverviewTab = pathname.endsWith('/overview') || pathname === `/${baseRoute}/${snapshot.connection.id}`;
  const shouldShowInternalAlert = snapshot.connection.isInternal && 
                         snapshot.currentUserType === 'agency' && 
                         snapshot.partner.type === 'client' &&
                         isOnOverviewTab;
  
  // Determine if disconnected alert should be shown (disconnected connection, on all tabs)
  const shouldShowDisconnectedAlert = snapshot.connection.status === 'disconnected';
  
  // Dismiss state management with localStorage (persists across sessions)
  const storageKey = `internal-alert-dismissed-${snapshot.connection.id}`;
  // Use mounted state to prevent flicker - don't render alert until we've checked localStorage
  const [isMounted, setIsMounted] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  
  // Check localStorage after mount to avoid hydration issues
  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey) === 'true';
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
      localStorage.setItem(storageKey, 'true');
    } catch (error) {
      // Ignore storage errors (e.g., private browsing mode)
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Failed to save alert dismissal to localStorage:', error);
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
      {shouldShowInternalAlert && isMounted && !isDismissed && (
        <div style={{ paddingTop: '16px' }}>
          <Alert className="relative" style={{ backgroundColor: 'var(--color-neutral-3)', padding: '20px' }}>
            <Users size={16} />
            <AlertTitle className="text-sm-medium" style={{ color: 'var(--color-base-text-primary)' }}>You&apos;re managing your client workspace</AlertTitle>
            <AlertDescription className="text-sm-regular mt-0.5" style={{ color: 'var(--color-base-text-secondary)' }}>
            This workspace is internal to your agency. You can manage the entire relationship privately, or invite your client to connect through their portal if you want to collaborate in a shared workspace.
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
      {shouldShowDisconnectedAlert && (
        <div style={{ paddingTop: '16px' }}>
          <Alert className="relative" style={{ backgroundColor: 'var(--color-neutral-3)', padding: '20px' }}>
            <PencilSimpleSlash size={16} />
            <AlertDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
              This workspace is read-only. To resume collaboration, reconnect using your {currentUserType === 'client' ? 'agency' : 'client'}&apos;s connection code.
            </AlertDescription>
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
  const isSettingsPage = /\/settings$/.test(pathname);
  
  // For request, task, project detail pages, or settings page, render children directly without ConnectionProvider
  // RequestDetailContent, TaskDetailContent, ProjectDetailContent, and ConnectionSettingsForm don't use ConnectionProvider and DashboardLayout handles styling
  if (isRequestDetailPage || isTaskDetailPage || isProjectDetailPage || isSettingsPage) {
    return <>{children}</>;
  }
  
  // For other pages (like overview, requests list, tasks list, projects list), we need the snapshot and ConnectionProvider
  // If snapshot is null, something went wrong - but we should still try to render (ConnectionProvider will handle null gracefully)
  // However, ConnectionLayoutContent requires snapshot, so we need to check
  if (!snapshot) {
    // If snapshot is null for a page that needs it, return null or error state
    // This shouldn't happen in normal flow, but handle gracefully
    console.error('ConnectionLayout: snapshot is null for page that requires it', { pathname });
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


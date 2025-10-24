import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import { ConnectionHeader } from './ConnectionHeader';
import { ConnectionTabs } from './ConnectionTabs';
import { ConnectionProvider } from './ConnectionContext';

interface ConnectionLayoutProps {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
  baseRoute: 'clients' | 'agencies';
  children: React.ReactNode;
}

export function ConnectionLayout({ snapshot, context, baseRoute, children }: ConnectionLayoutProps) {
  const currentUserType = baseRoute === 'clients' ? 'agency' : 'client';
  
  return (
    <ConnectionProvider snapshot={snapshot} context={context}>
      <div style={{ 
        padding: '24px 16px 24px 24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <ConnectionHeader snapshot={snapshot} />
        <ConnectionTabs 
          connectionId={snapshot.connection.id}
          baseRoute={baseRoute}
          currentUserType={currentUserType}
        />
        <div style={{ flex: 1 }}>
          {children}
        </div>
      </div>
    </ConnectionProvider>
  );
}


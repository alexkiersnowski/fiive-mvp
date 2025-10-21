import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Circle, DotsThree, Link, Plus } from '@phosphor-icons/react/ssr';
import { StatusBadge } from '@/components/ui/connection-badge';
import { EngagementBadge } from '@/components/ui/engagement-badge';
import type { Client } from './types';

// Style constants to prevent object recreation on each render
const STYLES = {
  connectionBadge: {
    borderRadius: 'var(--radius-1-max, 3px)',
  },
  connectedBadge: {
    borderRadius: 'var(--radius-1-max, 3px)',
    backgroundColor: 'var(--color-semantic-info-3)',
    color: 'var(--color-semantic-info-11)'
  },
  disconnectedBadge: {
    borderRadius: 'var(--radius-1-max, 3px)',
    backgroundColor: 'var(--color-neutral-alpha-3)',
    color: 'var(--color-neutral-11)'
  },
  avatarFallback: {
    background: 'var(--color-neutral-9, #8B8D98)'
  },
  primaryText: {
    color: 'var(--color-base-text-primary)'
  },
  tertiaryText: {
    color: 'var(--color-base-text-tertiary)'
  },
  healthBadge: {
    borderRadius: 'var(--radius-1-max, 3px)',
    backgroundColor: 'var(--color-semantic-success-3, #e6f6eb)',
    border: 'none',
    cursor: 'default'
  },
  healthText: {
    color: 'var(--color-semantic-success-11, #218358)'
  },
  tableContainer: {
    minHeight: 0, 
    maxHeight: '100%', 
    borderColor: 'var(--color-neutral-5)'
  },
  rowStyle: {
    backgroundColor: 'var(--color-base-surface-page-background)', 
    borderBottomColor: 'var(--color-neutral-5)'
  },
  rowHoverStyle: {
    backgroundColor: 'var(--color-neutral-3)'
  }
} as const;

// Event handlers to prevent recreation on each render
const handleRowMouseEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
  e.currentTarget.style.backgroundColor = 'var(--color-neutral-3)';
};

const handleRowMouseLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
  e.currentTarget.style.backgroundColor = 'var(--color-base-surface-page-background)';
};

interface ClientsTableProps {
  clients: Client[];
  searchValue?: string;
  sortValue?: string;
  isLoading?: boolean;
  hasNextPage?: boolean;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  onAddClient?: () => void;
}

// Extract column components for better readability and reusability
const ConnectionCell = React.memo(function ConnectionCell({ client }: { client: Client }) {
  // Map connection_status to badge variant
  const getVariant = (status: string): "connected" | "invited" | "disconnected" | "draft" => {
    if (status === 'connected') return 'connected';
    if (status === 'invited') return 'invited';
    if (status === 'disconnected') return 'disconnected';
    return 'draft';
  };
  
  return (
    <TableCell className="py-0 w-10">
      <div className="w-4 h-4 flex items-center justify-center">
        <StatusBadge 
          variant={getVariant(client.status)}
          className="w-4 h-4 p-0"
          showTooltip={true}
        />
      </div>
    </TableCell>
  );
});

const ClientCell = React.memo(function ClientCell({ client }: { client: Client }) {
  return (
    <TableCell className="py-0 w-1/4">
      <div className="flex items-center gap-3">
        <Avatar className="w-5 h-5">
          <AvatarImage src={client.logo} alt={client.name} />
          <AvatarFallback 
            className="text-xs font-medium text-white"
            style={STYLES.avatarFallback}
          >
            {client.name.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm-regular" style={STYLES.primaryText}>
          {client.name}
        </span>
      </div>
    </TableCell>
  );
});

const AccountManagerCell = React.memo(function AccountManagerCell({ client }: { client: Client }) {
  const isUnassigned = client.accountManager.name === 'Unassigned';
  
  return (
    <TableCell className="py-0 w-[18.75%] pl-4">
      {isUnassigned ? (
        <span className="text-sm-regular" style={STYLES.tertiaryText}>
          Unassigned
        </span>
      ) : (
        <ListRow
          avatar={true}
          avatarUrl={client.accountManager.avatar}
          text={client.accountManager.name}
          actions={false}
          variant="stacked"
        />
      )}
    </TableCell>
  );
});

const StatusCell = React.memo(function StatusCell({ client }: { client: Client }) {
  const hasStatus = client.badge && client.badge !== '';
  
  // Map engagement status string to badge variant
  const getEngagementVariant = (status: string): "onboarding" | "active" | "paused" | "offboarded" => {
    const normalized = status.toLowerCase();
    if (normalized === 'onboarding') return 'onboarding';
    if (normalized === 'active') return 'active';
    if (normalized === 'paused') return 'paused';
    if (normalized === 'offboarded' || normalized === 'draft') return 'offboarded';
    return 'offboarded'; // Default fallback
  };
  
  return (
    <TableCell className="py-0 w-[18.75%]">
      {hasStatus ? (
        <EngagementBadge 
          variant={getEngagementVariant(client.badge!)}
          size="sm"
          showText={true}
          neutral={true}
        />
      ) : (
        <span className="text-sm-regular" style={STYLES.tertiaryText}>
          No status
        </span>
      )}
    </TableCell>
  );
});

const ContractEndCell = React.memo(function ContractEndCell({ client }: { client: Client }) {
  return (
    <TableCell className="py-0 w-[18.75%]">
      <span 
        className="text-sm-regular" 
        style={client.contractEnd ? STYLES.primaryText : STYLES.tertiaryText}
      >
        {client.contractEnd || "No end date"}
      </span>
    </TableCell>
  );
});

const HealthCell = React.memo(function HealthCell({ client }: { client: Client }) {
  const hasHealth = client.health && client.health !== 'unassigned' && client.health !== 'n/a';
  
  return (
    <TableCell className="py-0 w-[18.75%]">
      {hasHealth ? (
        <Badge 
          variant="outline" 
          className="text-xs border-0"
          style={STYLES.healthBadge}
        >
          <span style={STYLES.healthText}>
            {client.health.charAt(0).toUpperCase() + client.health.slice(1)}
          </span>
        </Badge>
      ) : (
        <span className="text-sm-regular" style={STYLES.tertiaryText}>
          Unassigned
        </span>
      )}
    </TableCell>
  );
});

const ActionsCell = React.memo(function ActionsCell({ client }: { client: Client }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <TableCell className="py-0 w-auto" onClick={(e) => e.stopPropagation()}>
      <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`p-0 cursor-pointer transition-colors duration-75 ${
              isDropdownOpen 
                ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
                : 'hover:bg-[var(--color-interactive-surface-hover)]'
            }`}
            style={{ height: '32px', width: '32px' }}
          >
            <DotsThree size={16} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem>
            <Link size={16} style={{ color: 'var(--color-base-text-primary)' }} />
            Connection settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </TableCell>
  );
});

const ClientRow = React.memo(function ClientRow({ client }: { client: Client }) {
  const router = useRouter();
  
  const handleRowClick = () => {
    router.push(`/clients/${client.id}/overview`);
  };

  return (
    <TableRow 
      key={client.id} 
      className="h-11 cursor-pointer transition-colors duration-75"
      style={STYLES.rowStyle}
      onMouseEnter={handleRowMouseEnter}
      onMouseLeave={handleRowMouseLeave}
      onClick={handleRowClick}
    >
      <ConnectionCell client={client} />
      <ClientCell client={client} />
      <AccountManagerCell client={client} />
      <StatusCell client={client} />
      <ContractEndCell client={client} />
      <HealthCell client={client} />
      <ActionsCell client={client} />
    </TableRow>
  );
});

export function ClientsTable({ clients, searchValue = '', sortValue = 'alphabetical', isLoading = false, hasNextPage = false, onScroll, onAddClient }: ClientsTableProps) {
  // Client-side filtering for search
  const filteredClients = React.useMemo(() => {
    if (!searchValue.trim()) {
      return clients;
    }

    const query = searchValue.toLowerCase().trim();
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    return clients.filter(client => {
      if (searchTerms.length === 0) return true;
      
      // Create searchable text for the crucial fields: Client name, Account manager name, Status, Health
      const searchableText = [
        client.name.toLowerCase(),
        client.accountManager.name.toLowerCase(),
        client.status.toLowerCase(),
        client.health.toLowerCase()
      ].join(' ');
      
      // Check if all search terms are present
      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [clients, searchValue]);

  // Server handles all sorting, so we just use the filtered clients as-is
  const sortedClients = filteredClients;

  return (
    <div 
      className={`rounded-md border ${sortedClients.length > 0 ? 'overflow-y-auto' : 'overflow-hidden'}`}
      style={STYLES.tableContainer}
      onScroll={onScroll}
    >
      <Table noWrapper className="w-full">
        <TableHeader className="sticky top-0 z-10" style={{ backgroundColor: 'var(--color-neutral-3)' }}>
          <TableRow className="hover:bg-transparent">
            <TableHead className="py-0 w-10">
              <div className="w-4 h-4 flex items-center justify-center">
                <Badge 
                  className="w-4 h-4 p-0 flex items-center justify-center opacity-0"
                  style={{ 
                    borderRadius: 'var(--radius-1-max, 3px)',
                    backgroundColor: 'var(--color-neutral-alpha-3)',
                    color: 'var(--color-neutral-11)'
                  }}
                >
                  <Circle weight="fill" size={6} style={{ width: '0.375rem', height: '0.375rem' }} />
                </Badge>
              </div>
            </TableHead>
            <TableHead className="py-0 text-xs-medium w-1/4" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Client
            </TableHead>
            <TableHead className="py-0 text-xs-medium w-[18.75%] pl-4" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Account manager
            </TableHead>
            <TableHead className="py-0 text-xs-medium w-[18.75%]" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Status
            </TableHead>
            <TableHead className="py-0 text-xs-medium w-[18.75%]" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Contract end
            </TableHead>
            <TableHead className="py-0 text-xs-medium w-[18.75%]" style={{ color: 'var(--color-base-text-tertiary)' }}>
              Health
            </TableHead>
            <TableHead className="py-0 w-auto">
              <Button
                variant="ghost"
                className="p-0 cursor-pointer opacity-0"
                style={{ height: '32px', width: '32px' }}
              >
                <DotsThree size={16} />
              </Button>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedClients.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
          
          {/* Loading indicator */}
          {isLoading && (
            <TableRow 
              className="h-11 hover:bg-transparent"
              style={{ 
                backgroundColor: 'var(--color-base-surface-page-background)', 
                borderBottomColor: 'var(--color-neutral-5)' 
              }}
            >
              <TableCell colSpan={7} className="h-16 text-center">
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin"></div>
                  Loading more clients...
                </div>
              </TableCell>
            </TableRow>
          )}
          
          {/* Empty state - no clients at all */}
          {clients.length === 0 && !isLoading && (
            <TableRow 
              className="hover:bg-transparent"
              style={{ 
                backgroundColor: 'var(--color-base-surface-page-background)', 
                borderBottomColor: 'var(--color-neutral-5)',
                height: '100%'
              }}
            >
              <TableCell colSpan={7} className="text-left" style={{ height: 'calc(100vh - 200px)', minHeight: '400px', paddingLeft: '120px' }}>
                <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
                  <div className="flex flex-col items-start gap-2">
                    <h2 className="display-8-medium">Your best work starts here</h2>
                    <span className="text-sm-regular text-neutral-11">Add your first client and start creating connections that drive success</span>
                  </div>
                  {onAddClient && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
                      onClick={onAddClient}
                    >
                      <Plus size={16} weight="regular" />
                      Add client
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          )}

          {/* No search results */}
          {clients.length > 0 && sortedClients.length === 0 && !isLoading && (
            <TableRow 
              className="hover:bg-transparent"
              style={{ 
                backgroundColor: 'var(--color-base-surface-page-background)', 
                borderBottomColor: 'var(--color-neutral-5)',
                height: '100%'
              }}
            >
              <TableCell colSpan={7} className="text-left" style={{ height: 'calc(100vh - 200px)', minHeight: '400px', paddingLeft: '120px' }}>
                <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
                  <div className="flex flex-col items-start gap-2">
                    <h2 className="display-8-medium">No results</h2>
                    <span className="text-sm-regular text-neutral-11">No clients match your search criteria</span>
                  </div>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
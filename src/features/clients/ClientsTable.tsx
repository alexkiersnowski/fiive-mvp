import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Circle, DotsThree, Link, Plus } from '@phosphor-icons/react/ssr';
import { StatusBadge } from '@/components/ui/connection-badge';
import { EngagementBadge } from '@/components/ui/engagement-badge';
import { HealthBadge } from '@/components/ui/health-badge';
import { ProfileCard } from '@/components/ui/profile-card';
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table';
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
    borderColor: 'var(--color-neutral-5)',
    backgroundColor: 'var(--color-base-surface-page-background)',
  },
} as const;

interface ClientsTableProps {
  clients: Client[];
  searchValue?: string;
  sortValue?: string;
  isLoading?: boolean;
  hasNextPage?: boolean;
  onAddClient?: () => void;
  onLoadMore?: (virtualRows: any[]) => void;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  headerOffset?: number;
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

const AccountManagerCell = React.memo(function AccountManagerCell({ 
  client, 
  onAccountManagerClick 
}: { 
  client: Client; 
  onAccountManagerClick: (accountManager: Client['accountManager']) => void;
}) {
  const isUnassigned = client.accountManager.name === 'Unassigned';
  
  const handleClick = () => {
    if (!isUnassigned) {
      onAccountManagerClick(client.accountManager);
    }
  };
  
  return (
    <TableCell className="py-0 w-[18.75%] pl-4">
      {isUnassigned ? (
        <span className="text-sm-regular" style={STYLES.tertiaryText}>
          Unassigned
        </span>
      ) : (
        <ListRow
          avatar
          avatarUrl={client.accountManager.avatar}
          text={client.accountManager.name}
          actions={false}
          variant="stacked"
          className="min-w-0"
          onClick={handleClick}
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
      <div className="inline-flex">
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
      </div>
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
  // Map health value to health badge variant
  const getHealthVariant = (health: string): "healthy" | "at_risk" | "critical" | null => {
    const normalized = health.toLowerCase().replace('-', '_');
    if (normalized === 'healthy') return 'healthy';
    if (normalized === 'at_risk') return 'at_risk';
    if (normalized === 'critical') return 'critical';
    return null;
  };
  
  const healthVariant = getHealthVariant(client.health);
  
  return (
    <TableCell className="py-0 w-[18.75%]">
      <div className="inline-flex">
        {healthVariant ? (
          <HealthBadge 
            variant={healthVariant}
            size="sm"
            showText={true}
          />
        ) : (
          <span className="text-sm-regular" style={STYLES.tertiaryText}>
            Unassigned
          </span>
        )}
      </div>
    </TableCell>
  );
});

const ActionsCell = React.memo(function ActionsCell({ client }: { client: Client }) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  return (
    <TableCell className="py-0 w-[44px] p-0" onClick={(e) => e.stopPropagation()}>
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

export function ClientsTable({
  clients,
  searchValue = '',
  sortValue = 'alphabetical',
  isLoading = false,
  hasNextPage = false,
  onAddClient,
  onLoadMore,
  parentRef,
  headerOffset = 0,
}: ClientsTableProps) {
  const router = useRouter();
  const [selectedAccountManager, setSelectedAccountManager] = useState<Client['accountManager'] | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);

  const handleAccountManagerClick = useCallback((accountManager: Client['accountManager']) => {
    setSelectedAccountManager(accountManager);
    setProfileDialogOpen(true);
  }, []);

  const displayedClients = useMemo(() => {
    let filtered = clients;
    if (searchValue.trim()) {
      const query = searchValue.toLowerCase().trim();
      const searchTerms = query.split(' ').filter((term) => term.length > 0);

      filtered = clients.filter((client) => {
        if (searchTerms.length === 0) return true;

        const searchableText = [
          client.name.toLowerCase(),
          client.accountManager.name.toLowerCase(),
          client.status.toLowerCase(),
          client.health.toLowerCase(),
          client.contractEnd?.toLowerCase() || '',
          client.badge?.toLowerCase() || '',
        ].join(' ');

        return searchTerms.every((term) => searchableText.includes(term));
      });
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortValue) {
        case 'newest-first':
          {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;

            if (dateA !== dateB) {
              return dateB - dateA;
            }

            return a.name.localeCompare(b.name);
          }
        case 'alphabetical':
          return a.name.localeCompare(b.name);
        case 'reverse-alphabetical':
          return b.name.localeCompare(a.name);
        case 'contract-end-soonest':
          if (!a.contractEnd && !b.contractEnd) return 0;
          if (!a.contractEnd) return 1;
          if (!b.contractEnd) return -1;
          const parseDate = (dateStr: string) => {
            const [day, month, year] = dateStr.split(' ');
            const monthMap: { [key: string]: number } = {
              Jan: 0,
              Feb: 1,
              Mar: 2,
              Apr: 3,
              May: 4,
              Jun: 5,
              Jul: 6,
              Aug: 7,
              Sep: 8,
              Oct: 9,
              Nov: 10,
              Dec: 11,
            };
            return new Date(parseInt(year), monthMap[month], parseInt(day));
          };
          const dateA = parseDate(a.contractEnd);
          const dateB = parseDate(b.contractEnd);
          return dateA.getTime() - dateB.getTime();
        case 'status-critical-first': {
          const healthPriority = {
            critical: 0,
            'at-risk': 1,
            healthy: 2,
            unassigned: 3,
          };

          const priorityA = healthPriority[a.health as keyof typeof healthPriority] ?? 999;
          const priorityB = healthPriority[b.health as keyof typeof healthPriority] ?? 999;

          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }

          return a.name.localeCompare(b.name);
        }
        default:
          return a.name.localeCompare(b.name);
      }
    });

    return sorted;
  }, [clients, searchValue, sortValue]);

  const guardedLoadMore = useCallback(
    (virtualRows: any[]) => {
      if (!hasNextPage || isLoading) return;
      onLoadMore?.(virtualRows);
    },
    [hasNextPage, isLoading, onLoadMore],
  );

  const { containerRef, rowVirtualizer, virtualItems } = useVirtualTable({
    items: displayedClients,
    onLoadMore: guardedLoadMore,
    scrollRestoreDeps: [searchValue, sortValue],
    parentRef,
  });

  const handleRowClick = useCallback(
    (client: Client) => {
      router.push(`/clients/${client.id}/overview`);
    },
    [router],
  );

  const emptyStateContent =
    !isLoading && clients.length === 0 ? (
      <TableRow
        className="hover:bg-transparent"
        style={{
          backgroundColor: 'var(--color-base-surface-page-background)',
          borderBottomColor: 'var(--color-neutral-5)',
          height: '100%',
        }}
      >
        <TableCell
          colSpan={7}
          className="text-left"
          style={{ height: 'calc(100vh - 200px)', minHeight: '400px', paddingLeft: '120px' }}
        >
          <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
            <div className="flex flex-col items-start gap-2">
              <h2 className="display-8-medium">Your best work starts here</h2>
              <span className="text-sm-regular text-neutral-11">
                Add your first client and start creating connections that drive success
              </span>
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
    ) : !isLoading && displayedClients.length === 0 ? (
      <TableRow
        className="hover:bg-transparent"
        style={{
          backgroundColor: 'var(--color-base-surface-page-background)',
          borderBottomColor: 'var(--color-neutral-5)',
          height: '100%',
        }}
      >
        <TableCell
          colSpan={7}
          className="text-left"
          style={{ height: 'calc(100vh - 200px)', minHeight: '400px', paddingLeft: '120px' }}
        >
          <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
            <div className="flex flex-col items-start gap-2">
              <h2 className="display-8-medium">No results</h2>
              <span className="text-sm-regular text-neutral-11">No clients match your search criteria</span>
            </div>
          </div>
        </TableCell>
      </TableRow>
    ) : undefined;

  const columnLayout = (
    <colgroup>
      <col className="w-10" />
      <col className="w-1/4" />
      <col className="w-[18.75%]" />
      <col className="w-[18.75%]" />
      <col className="w-[18.75%]" />
      <col className="w-[18.75%]" />
      <col className="w-[44px]" />
    </colgroup>
  );

  return (
    <div className="w-full min-w-0">
      <div
        className="sticky z-10"
        style={{
          top: headerOffset,
          backgroundColor: 'var(--color-neutral-2)',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-neutral-3)',
            borderTopLeftRadius: 'var(--radius-6)',
            borderTopRightRadius: 'var(--radius-6)',
            borderLeft: '1px solid var(--color-neutral-4)',
            borderRight: '1px solid var(--color-neutral-4)',
            borderTop: '1px solid var(--color-neutral-4)',
            overflow: 'hidden',
          }}
        >
          <Table className="table-fixed w-full border-collapse">
            {columnLayout}
            <TableHeader>
              <TableRow
                className="hover:bg-transparent"
                style={{
                  borderBottom: '1px solid var(--color-neutral-4)',
                }}
              >
                <TableHead className="py-0">
                  <div className="w-4 h-4 flex items-center justify-center">
                    <Badge
                      className="w-4 h-4 p-0 flex items-center justify-center opacity-0"
                      style={{
                        borderRadius: 'var(--radius-1-max, 3px)',
                        backgroundColor: 'var(--color-neutral-alpha-3)',
                        color: 'var(--color-neutral-11)',
                      }}
                    >
                      <Circle weight="fill" size={6} style={{ width: '0.375rem', height: '0.375rem' }} />
                    </Badge>
                  </div>
                </TableHead>
                <TableHead className="py-0 text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Client
                </TableHead>
                <TableHead className="py-0 text-xs-medium pl-4" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Account manager
                </TableHead>
                <TableHead className="py-0 text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Status
                </TableHead>
                <TableHead className="py-0 text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Contract end
                </TableHead>
                <TableHead className="py-0 text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Health
                </TableHead>
                <TableHead className="py-0">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
          </Table>
        </div>
      </div>

      <div
        className="w-full overflow-x-auto"
        ref={containerRef}
        style={{ backgroundColor: 'var(--color-neutral-2)' }}
      >
        <div
          style={{
            borderLeft: '1px solid var(--color-neutral-4)',
            borderRight: '1px solid var(--color-neutral-4)',
            borderBottom: '1px solid var(--color-neutral-4)',
            borderBottomLeftRadius: 'var(--radius-6)',
            borderBottomRightRadius: 'var(--radius-6)',
            overflow: 'hidden',
            backgroundColor: 'var(--color-neutral-2)',
          }}
        >
          <VirtualTableBody
            items={displayedClients}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            onRowClick={handleRowClick}
            emptyState={emptyStateContent}
            colGroup={columnLayout}
            rowClassName="h-11 bg-[var(--color-base-surface-page-background)] border-b border-[var(--color-neutral-5)] last:border-b-0 cursor-pointer transition-colors duration-75 hover:bg-[var(--color-interactive-surface-hover)]"
            renderRow={(client) => (
              <>
                <ConnectionCell client={client} />
                <ClientCell client={client} />
                <AccountManagerCell client={client} onAccountManagerClick={handleAccountManagerClick} />
                <StatusCell client={client} />
                <ContractEndCell client={client} />
                <HealthCell client={client} />
                <ActionsCell client={client} />
              </>
            )}
          />
        </div>
      </div>
     
      {isLoading && (
        <div
          className="flex items-center justify-center gap-2 py-4 text-sm-regular"
          style={{ color: 'var(--color-base-text-tertiary)' }}
        >
          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
          Loading more clients...
        </div>
      )}

      {selectedAccountManager && (
        <ProfileCard
          member={{
            id: selectedAccountManager.id,
            first_name: selectedAccountManager.firstName,
            last_name: selectedAccountManager.lastName,
            email: selectedAccountManager.email,
            job_title: selectedAccountManager.jobTitle,
            avatar_url: selectedAccountManager.avatar,
            organization: {
              id: selectedAccountManager.organization.id,
              name: selectedAccountManager.organization.name,
              logo_url: selectedAccountManager.organization.logo_url,
            },
          }}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false);
            setSelectedAccountManager(null);
          }}
        />
      )}
    </div>
  );
}
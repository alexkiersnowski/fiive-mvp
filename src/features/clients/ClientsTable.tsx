import React, { useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Table, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Circle, DotsThree, Link, PaperPlaneTilt, Plus, Trash, XCircle } from '@phosphor-icons/react/ssr';
import { StatusBadge } from '@/components/ui/connection-badge';
import { EngagementBadge } from '@/components/ui/engagement-badge';
import { HealthBadge } from '@/components/ui/health-badge';
import { ProfileCard } from '@/components/ui/profile-card';
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table';
import { toast } from 'sonner';
import { deleteClient } from './actions';
import { resendInviteEmail, cancelInvitation } from '@/features/connections/actions';
import type { Client } from './types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { VirtualItem } from '@tanstack/react-virtual';

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
  isBootstrapping?: boolean;
  isSearching?: boolean; // True when search is pending server confirmation
  hasNextPage?: boolean;
  unfilteredTotalCount?: number; // Total count without search/filter applied
  onAddClient?: () => void;
  onLoadMore?: (virtualRows: VirtualItem[]) => void;
  parentRef?: React.RefObject<HTMLDivElement | null>;
  headerOffset?: number;
  context: EnhancedModeContext;
  onClientDeleted?: () => void; // Callback to refresh data after deletion
  onClientDeleteOptimistic?: (clientId: string) => void; // Callback for optimistic removal
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
  billingStatus?: string;
  onPaywallTrigger?: () => void;
}

// Extract column components for better readability and reusability
const ConnectionCell = React.memo(function ConnectionCell({ client }: { client: Client }) {
  // Map connection_status to badge variant
  const getVariant = (status: string): "connected" | "invited" | "disconnected" | "internal" => {
    if (status === 'connected') return 'connected';
    if (status === 'invited') return 'invited';
    if (status === 'disconnected') return 'disconnected';
    return 'internal';
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

const ActionsCell = React.memo(function ActionsCell({ 
  client, 
  context: _context, 
  onDeleteClick,
  allowedConnectionIds,
  billingStatus,
  onPaywallTrigger,
}: { 
  client: Client; 
  context: EnhancedModeContext;
  onDeleteClick: (clientId: string, clientName: string) => void;
  allowedConnectionIds?: string[] | null;
  billingStatus?: string;
  onPaywallTrigger?: () => void;
}) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const isDraft = client.is_draft === true;
  const isInvited = client.status === 'invited';

  const handleConnectionSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    
    // Check if access is blocked (free plan only)
    if (billingStatus === 'free' && allowedConnectionIds != null) {
      if (!allowedConnectionIds.includes(client.id)) {
        onPaywallTrigger?.();
        return;
      }
    }
    
    router.push(`/clients/${client.id}/settings`);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!client.clientId) {
      toast.error('Unable to delete: Client ID not found');
      return;
    }

    setIsDropdownOpen(false);
    onDeleteClick(client.clientId, client.name);
  };

  const handleResendClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    setIsResending(true);
    
    try {
      const result = await resendInviteEmail({
        connectionId: client.id
      });

      if (result.success) {
        toast.success('Invitation email resent');
      } else {
        toast.error(result.error || 'Failed to resend invitation email');
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation email');
    } finally {
      setIsResending(false);
    }
  };

  const handleCancelClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    setIsCanceling(true);
    
    try {
      const result = await cancelInvitation({
        connectionId: client.id
      });

      if (result.success) {
        toast.success('Invitation canceled');
      } else {
        toast.error(result.error || 'Failed to cancel invitation');
      }
    } catch (error) {
      console.error('Error canceling invitation:', error);
      toast.error('Failed to cancel invitation');
    } finally {
      setIsCanceling(false);
    }
  };

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
          <DropdownMenuItem onClick={handleConnectionSettingsClick}>
            <Link size={16} style={{ color: 'var(--color-base-text-primary)' }} />
            Connection settings
          </DropdownMenuItem>
          {isInvited && (
            <>
              <DropdownMenuItem 
                onClick={handleResendClick}
                disabled={isResending}
              >
                <PaperPlaneTilt size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                {isResending ? 'Resending...' : 'Resend email'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleCancelClick}
                disabled={isCanceling}
                className="focus:bg-red-50"
              >
                <XCircle size={16} style={{ color: 'var(--color-red-11)' }} />
                <span style={{ color: 'var(--color-red-11)' }}>
                  {isCanceling ? 'Canceling...' : 'Cancel invitation'}
                </span>
              </DropdownMenuItem>
            </>
          )}
          {isDraft && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleDelete}
                className="focus:bg-red-50"
              >
                <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                <span style={{ color: 'var(--color-red-11)' }}>
                  Delete client
                </span>
              </DropdownMenuItem>
            </>
          )}
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
  isBootstrapping = false,
  isSearching = false,
  hasNextPage = false,
  unfilteredTotalCount = 0,
  onAddClient,
  onLoadMore,
  parentRef,
  headerOffset = 0,
  context,
  onClientDeleted,
  onClientDeleteOptimistic,
  allowedConnectionIds,
  billingStatus,
  onPaywallTrigger,
}: ClientsTableProps) {
  const router = useRouter();
  const [selectedAccountManager, setSelectedAccountManager] = useState<Client['accountManager'] | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{clientId: string; clientName: string} | null>(null);

  const handleDeleteClick = useCallback((clientId: string, clientName: string) => {
    setPendingDelete({ clientId, clientName });
    setDeleteDialogOpen(true);
  }, []);

  const confirmDeleteClient = useCallback(async () => {
    if (pendingDelete) {
      const { clientId, clientName: _clientName } = pendingDelete;
      
      // Optimistically remove client from UI immediately (row disappears right away)
      onClientDeleteOptimistic?.(clientId);
      
      // Close dialog (name stays visible during close animation because pendingDelete state persists)
      setDeleteDialogOpen(false);
      
      // Clear pendingDelete after dialog closes (keeps name visible during close animation)
      setTimeout(() => {
        setPendingDelete(null);
      }, 200); // Delay to let dialog close animation complete
      
      // Show success toast immediately
      toast.success('Client deleted');
      
      // Delete in background - only refresh on error to restore state
      try {
        const result = await deleteClient(clientId, context);
        if (!result.success) {
          // If deletion failed, refresh from server to restore correct state
          toast.error(result.error || 'Failed to delete client');
          onClientDeleted?.();
        }
        // On success, optimistic update is already correct - no refresh needed
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error deleting client:', error);
        }
        // If deletion failed, refresh from server to restore correct state
        toast.error('Failed to delete client');
        onClientDeleted?.();
      }
    }
  }, [pendingDelete, context, onClientDeleted, onClientDeleteOptimistic]);

  const handleAccountManagerClick = useCallback((accountManager: Client['accountManager']) => {
    setSelectedAccountManager(accountManager);
    setProfileDialogOpen(true);
  }, []);

  // Clients are already filtered and sorted server-side
  // No need for client-side filtering/sorting anymore
  const displayedClients = useMemo(() => {
    return clients;
  }, [clients]);

  const guardedLoadMore = useCallback(
    (virtualRows: VirtualItem[]) => {
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
      // Check if this is an allowed workspace (free plan only)
      // allowedConnectionIds is null for paid plans (no limit)
      // allowedConnectionIds is array for free plans (check if client.id is in array)
      if (billingStatus === 'free' && allowedConnectionIds != null) {
        if (!allowedConnectionIds.includes(client.id)) {
          onPaywallTrigger?.();
          return; // Prevent navigation
        }
      }
      
      router.push(`/clients/${client.id}/overview`);
    },
    [router, billingStatus, allowedConnectionIds, onPaywallTrigger],
  );

  // Empty state logic: ONLY show empty state when no connections exist at all
  // When connections exist but search returns no results, VirtualTableBody will show "no results"
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0;

  // Empty state component matching RequestsTable/TasksTable design
  // Only show full-page empty state when truly empty (no connections exist)
  // Let VirtualTableBody handle "No results" with its built-in message
  const emptyStateContent = isEmptyState ? (
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
        style={{ height: 'calc(100vh - 264px)', minHeight: '400px', paddingLeft: '120px' }}
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
          {(isBootstrapping || (isSearching && displayedClients.length === 0 && searchValue.trim().length > 0)) ? (
            <div className="px-5 py-2">
              <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
            </div>
          ) : (
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
                <ActionsCell 
                  client={client} 
                  context={context} 
                  onDeleteClick={handleDeleteClick}
                  allowedConnectionIds={allowedConnectionIds}
                  billingStatus={billingStatus}
                  onPaywallTrigger={onPaywallTrigger}
                />
              </>
            )}
          />
          )}
        </div>
      </div>

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

      {/* Delete Client Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Delete {pendingDelete?.clientName}?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            This will permanently delete the client and all related data. It won&apos;t affect any live clients or shared workspaces.
          </DialogDescription>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setDeleteDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteClient}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
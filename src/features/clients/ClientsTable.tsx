import React, { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Circle, DotsThree, Link } from '@phosphor-icons/react/ssr';
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
  statusBadge: {
    borderRadius: 'var(--radius-1-max, 3px)',
    backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
    border: 'none',
    cursor: 'default'
  },
  statusText: {
    color: 'var(--color-neutral-11, #44474f)'
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
}

// Extract column components for better readability and reusability
const ConnectionCell = React.memo(function ConnectionCell({ client }: { client: Client }) {
  const isConnected = client.status === 'active' || client.status === 'onboarding';
  
  return (
    <TableCell className="py-0 w-10">
      <div className="w-4 h-4 flex items-center justify-center">
        <Badge 
          className="w-4 h-4 p-0 flex items-center justify-center"
          style={isConnected ? STYLES.connectedBadge : STYLES.disconnectedBadge}
        >
          <Circle weight="fill" size={6} style={{ width: '0.375rem', height: '0.375rem' }} />
        </Badge>
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
  return (
    <TableCell className="py-0 w-[18.75%] pl-4">
      <ListRow
        avatar={true}
        avatarUrl={client.accountManager.avatar}
        text={client.accountManager.name}
        actions={false}
        variant="stacked"
      />
    </TableCell>
  );
});

const StatusCell = React.memo(function StatusCell({ client }: { client: Client }) {
  const hasStatus = client.status && client.status !== 'draft';
  
  return (
    <TableCell className="py-0 w-[18.75%]">
      {hasStatus ? (
        <Badge 
          variant="outline" 
          className="text-xs border-0"
          style={STYLES.statusBadge}
        >
          <span style={STYLES.statusText}>
            {client.status.charAt(0).toUpperCase() + client.status.slice(1)}
          </span>
        </Badge>
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
    <TableCell className="py-0 w-auto">
      <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className={`p-0 cursor-pointer transition-colors duration-75 ${
              isDropdownOpen 
                ? 'bg-[var(--color-interactive-surface-hover)] pointer-events-none' 
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
  return (
    <TableRow 
      key={client.id} 
      className="h-11 cursor-pointer transition-colors duration-75"
      style={STYLES.rowStyle}
      onMouseEnter={handleRowMouseEnter}
      onMouseLeave={handleRowMouseLeave}
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

export function ClientsTable({ clients, searchValue = '', sortValue = 'alphabetical', isLoading = false, hasNextPage = false, onScroll }: ClientsTableProps) {
  // Server handles all sorting, so we just use the clients as-is
  const sortedClients = clients;

  return (
    <div 
      className="rounded-md border overflow-y-auto" 
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
          
          {/* No results */}
          {sortedClients.length === 0 && !isLoading && (
            <TableRow 
              className="h-11 hover:bg-transparent"
              style={{ 
                backgroundColor: 'var(--color-base-surface-page-background)', 
                borderBottomColor: 'var(--color-neutral-5)' 
              }}
            >
              <TableCell colSpan={7} className="h-24 text-center">
                No results.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
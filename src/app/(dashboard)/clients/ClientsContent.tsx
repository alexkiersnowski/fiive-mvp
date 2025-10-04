'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, SortAscending, CaretDown, Check } from '@phosphor-icons/react/ssr';
import { SearchInput } from '@/components/ui/search-input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ClientsTable } from '@/features/clients/ClientsTable';
import { getClientsSnapshot } from '@/features/clients/server';
import type { ClientsSnapshot, Client } from '@/features/clients/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

interface ClientsContentProps {
  snapshot: ClientsSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
  initialSortValue?: string;
}

export function ClientsContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialSortValue = 'newest-first' 
}: ClientsContentProps) {
  const [clients, setClients] = useState<Client[]>(snapshot.clients);
  const [totalCount, setTotalCount] = useState(snapshot.total);
  const [cursor, setCursor] = useState<string | null>(snapshot.cursor || null);
  const [hasNextPage, setHasNextPage] = useState(snapshot.hasNextPage);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [sortValue, setSortValue] = useState(initialSortValue || 'newest-first');
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false);

  // Sort options
  const sortOptions = [
    { value: 'newest-first', label: 'Newest first', buttonLabel: 'Newest first' },
    { value: 'alphabetical', label: 'Client (A–Z)', buttonLabel: 'Client (A–Z)' },
    { value: 'reverse-alphabetical', label: 'Client (Z–A)', buttonLabel: 'Client (Z–A)' },
    { value: 'contract-end-soonest', label: 'Contract end (soonest first)', buttonLabel: 'Contract end' },
    { value: 'status-critical-first', label: 'Health (critical first)', buttonLabel: 'Health' }
  ];

  const getCurrentSortLabel = () => {
    return sortOptions.find(option => option.value === sortValue)?.buttonLabel || 'Newest first';
  };

  // Load more clients when scrolling near bottom
  const loadMore = useCallback(async () => {
    if (isLoading || !hasNextPage || !cursor) return;
    
    setIsLoading(true);
    try {
      const newSnapshot = await getClientsSnapshot(context, {
        search: searchValue,
        cursor,
        limit: 50,
        sort: sortValue
      });
      
      setClients(prev => [...prev, ...newSnapshot.clients]);
      setCursor(newSnapshot.cursor || null);
      setHasNextPage(newSnapshot.hasNextPage);
      setTotalCount(newSnapshot.total);
    } catch (error) {
      console.error('Failed to load more clients:', error);
    } finally {
      setIsLoading(false);
    }
  }, [searchValue, cursor, hasNextPage, isLoading, context]);

  // Handle scroll to detect when to load more
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    // Store scroll values immediately to avoid null reference issues
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Load more when user is 200px from bottom for smoother experience
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
    
    if (isNearBottom && hasNextPage && !isLoading) {
      loadMore();
    }
  }, [loadMore, hasNextPage, isLoading]);


  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // Reset pagination state when search changes
    setClients([]);
    setCursor(null);
    setHasNextPage(true);
    setTotalCount(0);
    
    startTransition(async () => {
      try {
        const newSnapshot = await getClientsSnapshot(context, {
          search: value,
          limit: 50,
          sort: sortValue
        });
        
        setClients(newSnapshot.clients);
        setCursor(newSnapshot.cursor || null);
        setHasNextPage(newSnapshot.hasNextPage);
        setTotalCount(newSnapshot.total);
      } catch (error) {
        console.error('Failed to search clients:', error);
      }
    });
  };

  const handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue);
    // Reset pagination state when sort changes
    setClients([]);
    setCursor(null);
    setHasNextPage(true);
    setTotalCount(0);
    
    startTransition(async () => {
      try {
        const newSnapshot = await getClientsSnapshot(context, {
          search: searchValue,
          limit: 50,
          sort: newSortValue
        });
        
        setClients(newSnapshot.clients);
        setCursor(newSnapshot.cursor || null);
        setHasNextPage(newSnapshot.hasNextPage);
        setTotalCount(newSnapshot.total);
      } catch (error) {
        console.error('Failed to sort clients:', error);
      }
    });
  };

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 16px 24px 32px' }}>
      {/* Fixed Header Section */}
      <div className="flex-shrink-0">
      {/* Page Header */}
      <div className="flex items-center justify-between w-full mb-5">
        <div>
            <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
            Clients
          </h1>
        </div>
        <Button
          variant="default"
          size="lg"
          className="cursor-pointer text-sm flex items-center gap-2"
        >
          <Plus size={16} />
          Add client
        </Button>
      </div>
      
        <div className="flex items-center justify-between w-full mb-4">
        <SearchInput 
          placeholder="Search clients"
            count={totalCount}
            countLabel={totalCount === 1 ? "client" : "clients"}
          value={searchValue}
            onChange={handleSearchChange}
        />
        <DropdownMenu modal={false} open={isSortDropdownOpen} onOpenChange={setIsSortDropdownOpen}>
          <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="cursor-pointer text-sm-regular h-[32px] flex items-center gap-2 shadow-none"
          disabled={isPending}
        >
          <SortAscending size={16} />
              {getCurrentSortLabel()}
          <CaretDown size={16} />
        </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={(e) => {
                  handleSortChange(option.value);
                  setIsSortDropdownOpen(false);
                  // Blur the button after selection to prevent focus
                  const trigger = e.currentTarget.closest('[data-radix-dropdown-menu-trigger]') as HTMLElement;
                  setTimeout(() => {
                    trigger?.blur();
                  }, 0);
                }}
                className="flex items-center justify-between"
              >
                <span>{option.label}</span>
                {sortValue === option.value && (
                  <Check size={16} className="text-inherit" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      </div>

      {/* Table Component */}
      <div className="flex-1 min-h-0">
        <ClientsTable 
          clients={clients}
          searchValue={searchValue}
          sortValue={sortValue}
          isLoading={isLoading}
          hasNextPage={hasNextPage}
          onScroll={handleScroll}
        />
      </div>
    </div>
  );
}
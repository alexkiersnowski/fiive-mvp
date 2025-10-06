'use client'

import { useState, useTransition, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, SortAscending, CaretDown, Check, Link } from '@phosphor-icons/react/ssr';
import { SearchInput } from '@/components/ui/search-input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioCards, RadioCard, AgencyIcon, ClientIcon } from '@/components/ui/radio-cards';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { ClientsTable } from '@/features/clients/ClientsTable';
import { getClientsSnapshot } from '@/features/clients/server';
import type { ClientsSnapshot, Client } from '@/features/clients/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const accountTypeSchema = z.object({
  accountType: z.string().min(1, "Please make a selection")
});

const addNewClientSchema = z.object({
  clientName: z.string().min(1, "Client name is required")
});

const connectToClientSchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
});

type AccountTypeFormData = z.infer<typeof accountTypeSchema>;
type AddNewClientFormData = z.infer<typeof addNewClientSchema>;
type ConnectToClientFormData = z.infer<typeof connectToClientSchema>;

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
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [isAddNewClientDialogOpen, setIsAddNewClientDialogOpen] = useState(false);
  const [isConnectToClientDialogOpen, setIsConnectToClientDialogOpen] = useState(false);

  const selectionForm = useForm<AccountTypeFormData>({
    resolver: zodResolver(accountTypeSchema),
    defaultValues: {
      accountType: ""
    },
    mode: "onSubmit",
  });

  const addNewClientForm = useForm<AddNewClientFormData>({
    resolver: zodResolver(addNewClientSchema),
    defaultValues: {
      clientName: ""
    },
    mode: "onSubmit",
  });

  const connectToClientForm = useForm<ConnectToClientFormData>({
    resolver: zodResolver(connectToClientSchema),
    defaultValues: {
      connectionCode: ""
    },
    mode: "onSubmit",
  });

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

  const handleAddClientClick = () => {
    setIsAddClientDialogOpen(true);
    selectionForm.reset();
  };

  const handleSelectionDialogClose = () => {
    setIsAddClientDialogOpen(false);
    selectionForm.reset();
  };

  const handleAddNewClientDialogClose = () => {
    setIsAddNewClientDialogOpen(false);
    addNewClientForm.reset();
  };

  const handleConnectToClientDialogClose = () => {
    setIsConnectToClientDialogOpen(false);
    connectToClientForm.reset();
  };

  const handleSelectionSubmit = (data: AccountTypeFormData) => {
    if (data.accountType === 'agency') {
      setIsAddClientDialogOpen(false);
      setIsAddNewClientDialogOpen(true);
    } else if (data.accountType === 'client') {
      setIsAddClientDialogOpen(false);
      setIsConnectToClientDialogOpen(true);
    }
  };

  const handleAddNewClientSubmit = (data: AddNewClientFormData) => {
    // TODO: Add client to database
    console.log('Adding new client:', data.clientName);
    handleAddNewClientDialogClose();
  };

  const handleConnectToClientSubmit = (data: ConnectToClientFormData) => {
    // TODO: Connect to client using connection code
    console.log('Connecting to client with code:', data.connectionCode);
    handleConnectToClientDialogClose();
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
          onClick={handleAddClientClick}
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

      {/* Add Client Dialog */}
      <Dialog open={isAddClientDialogOpen} onOpenChange={setIsAddClientDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '664px', maxWidth: '664px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="sr-only">Add Client</DialogTitle>
          <Form {...selectionForm}>
            <form onSubmit={selectionForm.handleSubmit(handleSelectionSubmit)} className="space-y-5">
              <FormField
                control={selectionForm.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <RadioCards
                        value={field.value}
                        onValueChange={field.onChange}
                        className="mt-10 mx-4"
                      >
                        <RadioCard value="agency" icon={<Plus size={24} weight="regular" />}>
                          <h3 className="display-5-medium mb-2">
                            Add a new client
                          </h3>
                          <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                            Your client isn't on Fiive. Create a shared workspace and invite them when ready.
                          </p>
                        </RadioCard>
                        <RadioCard value="client" icon={<Link size={24} weight="regular" />}>
                          <h3 className="display-5-medium mb-2">
                            Connect to a client
                          </h3>
                          <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                            Your client is already on Fiive. Enter their connection code to collaborate.
                          </p>
                        </RadioCard>
                      </RadioCards>
                    </FormControl>
                    <FormMessage className="mx-4" />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={handleSelectionDialogClose}
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add New Client Dialog */}
      <Dialog open={isAddNewClientDialogOpen} onOpenChange={setIsAddNewClientDialogOpen}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>Add a new client</DialogTitle>
          <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
            Create a shared workspace you can invite your client to later
          </DialogDescription>
          <Form {...addNewClientForm}>
            <form onSubmit={addNewClientForm.handleSubmit(handleAddNewClientSubmit)} className="space-y-5">
              <div className="mt-3">
                <FormField
                  control={addNewClientForm.control}
                  name="clientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Client name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="E.g. Fiive"
                          className="h-10 px-4 py-2 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={handleAddNewClientDialogClose}
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Connect to Client Dialog */}
      <Dialog open={isConnectToClientDialogOpen} onOpenChange={setIsConnectToClientDialogOpen}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>Connect to a client</DialogTitle>
          <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
            Use a connection code to link your workspace with a client who's already on Fiive
          </DialogDescription>
          <Form {...connectToClientForm}>
            <form onSubmit={connectToClientForm.handleSubmit(handleConnectToClientSubmit)} className="space-y-5">
              <div className="mt-3">
                <FormField
                  control={connectToClientForm.control}
                  name="connectionCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Connection code</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                          className="h-10 px-4 py-2 text-sm"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ask your client to share the connection code in their admin settings
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={handleConnectToClientDialogClose}
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
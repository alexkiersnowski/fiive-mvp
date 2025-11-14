'use client'

import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Link } from '@phosphor-icons/react/ssr';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioCards, RadioCard } from '@/components/ui/radio-cards';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/shadcn-io/spinner';
import { ClientsTable } from '@/features/clients/ClientsTable';
import { ClientsHeader } from '@/features/clients/ClientsHeader';
import { createNewClient, connectToExistingClient, refreshClientsData } from '@/features/clients/actions';
import { 
  accountTypeSchema, 
  addNewClientSchema, 
  connectToClientSchema,
  type ClientsSnapshot, 
  type Client,
  type AccountTypeFormData,
  type AddNewClientFormData,
  type ConnectToClientFormData
} from '@/features/clients/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

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
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  const [clients, setClients] = useState<Client[]>(snapshot.clients);
  const [totalCount, setTotalCount] = useState(snapshot.total);
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState(snapshot.unfilteredTotalCount);
  const [cursor, setCursor] = useState<string | null>(snapshot.cursor || null);
  const [hasNextPage, setHasNextPage] = useState(snapshot.hasNextPage);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(initialSearchValue);
  const [sortValue, setSortValue] = useState(initialSortValue || 'newest-first');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingServerResults, setIsFetchingServerResults] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isAddClientDialogOpen, setIsAddClientDialogOpen] = useState(false);
  const [isAddNewClientDialogOpen, setIsAddNewClientDialogOpen] = useState(false);
  const [isConnectToClientDialogOpen, setIsConnectToClientDialogOpen] = useState(false);
  const [isConnectSuccess, setIsConnectSuccess] = useState(false);
  const [connectedClientName, setConnectedClientName] = useState('');
  const [connectedClientLogo, setConnectedClientLogo] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);

  // Sync local state with server snapshot when props change
  useEffect(() => {
    // Use transition for smooth updates (prevents flicker)
    startTransition(() => {
      setClients(snapshot.clients);
      setTotalCount(snapshot.total);
      setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
      setCursor(snapshot.cursor || null);
      setHasNextPage(snapshot.hasNextPage);
      setIsFetchingServerResults(false);
    });
  }, [snapshot, startTransition]);

  // Debounce server fetch (150ms - reduced from 300ms for faster response)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Trigger server fetch when debounced search or sort changes (for complete results)
  useEffect(() => {
    const currentSearchParam = searchParams.get('search') || '';
    const currentSortParam = searchParams.get('sort') || 'newest-first';
    
    if (debouncedSearchValue !== currentSearchParam || sortValue !== currentSortParam) {
      setIsFetchingServerResults(true);
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearchValue.trim()) {
        params.set('search', debouncedSearchValue.trim());
      } else {
        params.delete('search');
      }
      params.set('sort', sortValue);
      router.push(`/clients?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearchValue, sortValue, router, searchParams]);

  // Display: Use server results directly (no optimistic filtering)
  const displayedClients = clients;
  const displayedTotal = totalCount;

  // Locate the dashboard main scroll container
  useEffect(() => {
    if (!rootRef.current) return;
    const scrollElement = rootRef.current.closest('main');
    if (scrollElement instanceof HTMLElement) {
      parentRef.current = scrollElement as HTMLDivElement;
    }
  }, []);

  // Track header height for sticky table offset
  useEffect(() => {
    if (!headerWrapperRef.current) return;
    const node = headerWrapperRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderOffset(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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

  const loadMore = useCallback(async () => {
    // TODO: Implement pagination with server actions
    // For now, pagination is handled server-side via cursor
    console.log('Pagination handled server-side via cursor');
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    // Debounced server fetch handled by useEffect
  }, []);

  const handleSortChange = useCallback((newSortValue: string) => {
    setSortValue(newSortValue);
    // Server fetch handled by useEffect
  }, []);

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
  };

  useEffect(() => {
    if (!isAddNewClientDialogOpen) {
      const timeoutId = window.setTimeout(() => {
        addNewClientForm.reset();
      }, 250);

      return () => {
        window.clearTimeout(timeoutId);
      };
    }
  }, [isAddNewClientDialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConnectToClientDialogClose = () => {
    setIsConnectToClientDialogOpen(false);
    // Reset success state after modal closes to prevent brief flash
    setTimeout(() => {
      setIsConnectSuccess(false);
      connectToClientForm.reset();
      setConnectedClientName('');
      setConnectedClientLogo(undefined);
      setIsConnecting(false);
    }, 300); // 300ms delay to allow modal close animation
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

  const handleAddNewClientSubmit = async (data: AddNewClientFormData) => {
    setIsCreatingClient(true);

    try {
      // Wait for server confirmation - no optimistic updates
      // Spinner will show for the entire duration of this call
      const result = await createNewClient(data.clientName, context);

      if (result.success) {
        // Refresh data from server to ensure data integrity
        const refreshedSnapshot = await refreshClientsData(context, {
          search: debouncedSearchValue,
          sort: sortValue
        });

        // Update table with server response
        startTransition(() => {
          setClients(refreshedSnapshot.clients);
          setTotalCount(refreshedSnapshot.total);
          setUnfilteredTotalCount(refreshedSnapshot.unfilteredTotalCount);
          setCursor(refreshedSnapshot.cursor || null);
          setHasNextPage(refreshedSnapshot.hasNextPage);
        });

        // Close dialog only after everything is complete (spinner stops in finally)
        handleAddNewClientDialogClose();
      } else {
        // Keep dialog open and show error - no optimistic updates to rollback
        addNewClientForm.setError('clientName', {
          message: result.error || 'Failed to create client. Please try again.'
        });
      }
    } catch (error) {
      console.error('Unexpected error creating client:', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      
      // Keep dialog open and show error - no optimistic updates to rollback
      addNewClientForm.setError('clientName', {
        message: error instanceof Error ? error.message : 'Failed to create client. Please try again.'
      });
    } finally {
      // Stop spinner after all operations complete
      setIsCreatingClient(false);
    }
  };

  const handleConnectToClientSubmit = async (data: ConnectToClientFormData) => {
    console.log('CLIENT: Submitting connection code:', data.connectionCode);
    console.log('CLIENT: Context:', context);
    
    setIsConnecting(true);
    
    try {
      // Start the connection request and a minimum delay in parallel
      const [result] = await Promise.all([
        connectToExistingClient(data.connectionCode, context),
        new Promise(resolve => setTimeout(resolve, 650)) // Minimum 650ms for UX satisfaction
      ]);
      
      console.log('CLIENT: Result received:', result);
      
      if (result.success) {
        setConnectedClientName(result.clientName || '');
        setConnectedClientLogo(result.clientLogo);
        
        // Refresh clients data from server and update local state
        try {
          const refreshedSnapshot = await refreshClientsData(context, {
            search: debouncedSearchValue,
            sort: sortValue
          });
        startTransition(() => {
          setClients(refreshedSnapshot.clients);
          setTotalCount(refreshedSnapshot.total);
          setUnfilteredTotalCount(refreshedSnapshot.unfilteredTotalCount);
          setCursor(refreshedSnapshot.cursor || null);
          setHasNextPage(refreshedSnapshot.hasNextPage);
        });
        } catch (error) {
          console.error('Failed to refresh clients:', error);
        }
        
        // Show success modal
        setIsConnectSuccess(true);
      } else {
        // Show error message in form
        connectToClientForm.setError('connectionCode', {
          message: result.error || 'Invalid connection code'
        });
      }
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div ref={rootRef} className="flex flex-col" style={{ padding: '0 16px 24px 24px' }}>
      <div
        ref={headerWrapperRef}
        className="sticky z-20"
        style={{
          top: 0,
          backgroundColor: 'var(--color-neutral-2)',
          backdropFilter: 'saturate(180%) blur(12px)',
        }}
      >
        <ClientsHeader
          totalCount={displayedTotal}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          sortValue={sortValue}
          sortOptions={sortOptions}
          onSortChange={handleSortChange}
          onAddClient={handleAddClientClick}
        />
      </div>

      <ClientsTable
        clients={displayedClients}
        searchValue={searchValue}
        sortValue={sortValue}
        isLoading={isLoading}
        isBootstrapping={isFetchingServerResults && displayedClients.length === 0}
        isSearching={searchValue.trim() !== debouncedSearchValue.trim()}
        hasNextPage={hasNextPage}
        unfilteredTotalCount={unfilteredTotalCount}
        onLoadMore={loadMore}
        onAddClient={handleAddClientClick}
        parentRef={parentRef}
        headerOffset={headerOffset}
        context={context}
        onClientDeleteOptimistic={(clientId) => {
          // Optimistically remove client from UI immediately (synchronous for instant feedback)
          setClients(prev => prev.filter(client => client.clientId !== clientId));
          setTotalCount(prev => Math.max(0, prev - 1));
          setUnfilteredTotalCount(prev => Math.max(0, prev - 1));
        }}
        onClientDeleted={async () => {
          // Only refresh on error to restore correct state if deletion failed
          // On success, the optimistic update is already correct, so we merge with server response
          const refreshedSnapshot = await refreshClientsData(context, {
            search: debouncedSearchValue,
            sort: sortValue
          });
          startTransition(() => {
            // Merge server response with optimistic state (server response is source of truth)
            setClients(refreshedSnapshot.clients);
            setTotalCount(refreshedSnapshot.total);
            setUnfilteredTotalCount(refreshedSnapshot.unfilteredTotalCount);
            setCursor(refreshedSnapshot.cursor || null);
            setHasNextPage(refreshedSnapshot.hasNextPage);
          });
        }}
      />

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
                            Your client isn&apos;t on Fiive. Create a shared workspace and invite them when ready.
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
                  className="cursor-pointer relative"
                  disabled={isCreatingClient}
                >
                  <span className={isCreatingClient ? 'invisible' : ''}>Continue</span>
                  {isCreatingClient && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Spinner size={16} />
                    </div>
                  )}
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
                          disabled={isCreatingClient}
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
                  className="cursor-pointer relative"
                  disabled={isCreatingClient}
                >
                  <span className={isCreatingClient ? 'invisible' : ''}>Continue</span>
                  {isCreatingClient && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Spinner size={16} />
                    </div>
                  )}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Connect to Client Dialog */}
      <Dialog open={isConnectToClientDialogOpen} onOpenChange={(open) => {
        if (!open) {
          handleConnectToClientDialogClose();
        } else {
          setIsConnectToClientDialogOpen(true);
        }
      }}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', height: isConnectSuccess ? '322px' : 'auto', gap: '12px' }} className="[&>button]:hidden" showCloseButton={false}>
          <div className="flex flex-col h-full">
            {!isConnectSuccess ? (
              <>
                <DialogTitle className="display-5-medium mb-3" style={{ color: 'var(--color-base-text-primary)' }}>Connect to a client</DialogTitle>
                <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  Use a connection code to link your workspace with a client who&apos;s already on Fiive
                </DialogDescription>
                <Form {...connectToClientForm}>
                  <form onSubmit={connectToClientForm.handleSubmit(handleConnectToClientSubmit)} className="space-y-5 flex-1 flex flex-col">
                    <div className="mt-5">
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
                    <div className="flex justify-end gap-3 pt-2 mt-auto">
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
                        className="cursor-pointer relative"
                        disabled={isConnecting}
                      >
                        <span className={isConnecting ? "invisible" : ""}>Continue</span>
                        {isConnecting && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner size={16} />
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </>
            ) : (
              <div className="flex flex-col h-full">
                <Avatar className="w-20 h-20 mt-2 mb-4">
                  <AvatarImage src={connectedClientLogo} alt={connectedClientName} />
                  <AvatarFallback 
                    className="text-white text-lg font-medium"
                    style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
                  >
                    {connectedClientName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                
                <DialogTitle className="display-5-medium mb-2" style={{ color: 'var(--color-base-text-primary)' }}>Connected to {connectedClientName}</DialogTitle>
                <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  You can now collaborate through your shared workspace
                </DialogDescription>
                
                <div className="flex-1"></div>
                
                <div className="flex justify-end pt-2 mt-auto">
                  <Button 
                    onClick={handleConnectToClientDialogClose}
                    style={{ height: '40px' }}
                    className="cursor-pointer"
                  >
                    Continue
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
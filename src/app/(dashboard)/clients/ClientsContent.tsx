'use client'

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
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
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  const [clients, setClients] = useState<Client[]>(snapshot.clients);
  const [totalCount, setTotalCount] = useState(snapshot.total);
  const [cursor, setCursor] = useState<string | null>(snapshot.cursor || null);
  const [hasNextPage, setHasNextPage] = useState(snapshot.hasNextPage);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [sortValue, setSortValue] = useState(initialSortValue || 'newest-first');
  const [isLoading, setIsLoading] = useState(false);
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
    setClients(snapshot.clients);
    setTotalCount(snapshot.total);
    setCursor(snapshot.cursor || null);
    setHasNextPage(snapshot.hasNextPage);
  }, [snapshot]);

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
    console.log('Pagination not yet implemented for real data');
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // Search will be applied instantly via useMemo in ClientsTable
  };

  const handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue);
    // Sort will be applied instantly via useMemo in ClientsTable
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
      const result = await createNewClient(data.clientName, context);

      if (result.success) {
        const payload = result.data;

        const unassignedAccountManager: Client['accountManager'] = {
          id: '',
          name: 'Unassigned',
          firstName: '',
          lastName: '',
          email: '',
          jobTitle: undefined,
          avatar: undefined,
          organization: {
            id: context.organization.id,
            name: context.organization.name,
            logo_url: context.organization.logoUrl
          }
        };

        const newClient: Client = {
          id: payload.connection_id,
          name: payload.client_name,
          logo: payload.logo_url || undefined,
          status: 'draft',
          createdAt: payload.created_at,
          accountManager: unassignedAccountManager,
          contractEnd: undefined,
          health: 'unassigned',
          badge: payload.engagement_status ?? undefined
        };

        setClients(prev => [newClient, ...prev]);
        setTotalCount(prev => prev + 1);

        handleAddNewClientDialogClose();
      } else {
        addNewClientForm.setError('clientName', {
          message: result.error || 'Failed to create client'
        });
      }
    } catch (error) {
      console.error('Failed to create client:', error);
      addNewClientForm.setError('clientName', {
        message: 'Failed to create client. Please try again.'
      });

      try {
        const refreshedSnapshot = await refreshClientsData(context);
        setClients(refreshedSnapshot.clients);
        setTotalCount(refreshedSnapshot.total);
        setCursor(refreshedSnapshot.cursor || null);
        setHasNextPage(refreshedSnapshot.hasNextPage);
      } catch (refreshError) {
        console.error('Failed to refresh clients after error:', refreshError);
      }
    } finally {
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
          const refreshedSnapshot = await refreshClientsData(context);
          setClients(refreshedSnapshot.clients);
          setTotalCount(refreshedSnapshot.total);
          setCursor(refreshedSnapshot.cursor || null);
          setHasNextPage(refreshedSnapshot.hasNextPage);
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
          totalCount={totalCount}
          searchValue={searchValue}
          onSearchChange={handleSearchChange}
          sortValue={sortValue}
          sortOptions={sortOptions}
          onSortChange={handleSortChange}
          onAddClient={handleAddClientClick}
        />
      </div>

      <ClientsTable
        clients={clients}
        searchValue={searchValue}
        sortValue={sortValue}
        isLoading={isLoading}
        hasNextPage={hasNextPage}
        onLoadMore={loadMore}
        onAddClient={handleAddClientClick}
        parentRef={parentRef}
        headerOffset={headerOffset}
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
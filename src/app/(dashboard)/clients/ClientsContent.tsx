'use client'

import { useState, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, SortAscending, CaretDown, Check, Link } from '@phosphor-icons/react/ssr';
import { SearchInput } from '@/components/ui/search-input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioCards, RadioCard } from '@/components/ui/radio-cards';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/shadcn-io/spinner';
import { ClientsTable } from '@/features/clients/ClientsTable';
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
  const [isConnectSuccess, setIsConnectSuccess] = useState(false);
  const [connectedClientName, setConnectedClientName] = useState('');
  const [connectedClientLogo, setConnectedClientLogo] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);

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
    // TODO: Implement pagination with server actions
    console.log('Pagination not yet implemented for real data');
  }, []);

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
  };

  const handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue);
    // TODO: Implement sorting with server actions
    console.log('Sorting not yet implemented for real data');
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
    const result = await createNewClient(data.clientName, context);
    
    if (result.success) {
      handleAddNewClientDialogClose();
      // Optionally: Show success toast or refresh the clients list
      // TODO: Add toast notification when toast system is implemented
    } else {
      // Show error message in form
      addNewClientForm.setError('clientName', {
        message: result.error || 'Failed to create client'
      });
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
          className={`cursor-pointer text-sm-regular h-[32px] flex items-center gap-2 shadow-none transition-all duration-75 ${
            isSortDropdownOpen 
              ? 'bg-interactive-surface-hover hover:bg-interactive-surface-hover' 
              : 'hover:bg-interactive-surface-hover'
          }`}
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
          onAddClient={handleAddClientClick}
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
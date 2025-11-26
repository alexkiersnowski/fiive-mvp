'use client'

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Link } from '@phosphor-icons/react/ssr';
import { SearchInput } from '@/components/ui/search-input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioCards, RadioCard } from '@/components/ui/radio-cards';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/shadcn-io/spinner';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { AgenciesSnapshot } from '@/features/agencies/types';
import { connectToExistingAgency, refreshAgenciesData, createNewAgencyAndInvite } from '@/features/agencies/actions';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AgencyCard } from '@/features/agencies/AgencyCard';

const accountTypeSchema = z.object({
  accountType: z.string().min(1, "Please make a selection")
});

const addNewAgencySchema = z.object({
  agencyName: z.string().min(1, "Agency name is required"),
  primaryContactEmail: z.string().email("Please enter a valid email address")
});

const connectToAgencySchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
});

type AccountTypeFormData = z.infer<typeof accountTypeSchema>;
type AddNewAgencyFormData = z.infer<typeof addNewAgencySchema>;
type ConnectToAgencyFormData = z.infer<typeof connectToAgencySchema>;

interface AgenciesContentProps {
  snapshot: AgenciesSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
}

export function AgenciesContent({ 
  snapshot,
  context,
  initialSearchValue = '' 
}: AgenciesContentProps) {
  const [agencies, setAgencies] = useState(snapshot.agencies);
  const [_totalCount, setTotalCount] = useState(snapshot.total);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [isAddAgencyDialogOpen, setIsAddAgencyDialogOpen] = useState(false);
  const [isAddNewAgencyDialogOpen, setIsAddNewAgencyDialogOpen] = useState(false);
  const [isConnectToAgencyDialogOpen, setIsConnectToAgencyDialogOpen] = useState(false);
  const [isConnectSuccess, setIsConnectSuccess] = useState(false);
  const [connectedAgencyName, setConnectedAgencyName] = useState('');
  const [connectedAgencyLogo, setConnectedAgencyLogo] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingAgency, setIsCreatingAgency] = useState(false);

  // Client-side filtering for search
  const filteredAgencies = useMemo(() => {
    if (!searchValue.trim()) {
      return agencies;
    }

    const query = searchValue.toLowerCase().trim();
    const searchTerms = query.split(' ').filter(term => term.length > 0);
    
    return agencies.filter(agency => {
      if (searchTerms.length === 0) return true;
      
      // Create searchable text for the crucial fields: Agency name, Industry, Status, Account Manager
      const searchableText = [
        agency.name.toLowerCase(),
        agency.industry?.toLowerCase() || '',
        agency.status.toLowerCase(),
        agency.accountManager.name.toLowerCase()
      ].join(' ');
      
      // Check if all search terms are present
      return searchTerms.every(term => searchableText.includes(term));
    });
  }, [agencies, searchValue]);

  const selectionForm = useForm<AccountTypeFormData>({
    resolver: zodResolver(accountTypeSchema),
    defaultValues: {
      accountType: ""
    },
    mode: "onSubmit",
  });

  const addNewAgencyForm = useForm<AddNewAgencyFormData>({
    resolver: zodResolver(addNewAgencySchema),
    defaultValues: {
      agencyName: "",
      primaryContactEmail: ""
    },
    mode: "onSubmit",
  });

  const connectToAgencyForm = useForm<ConnectToAgencyFormData>({
    resolver: zodResolver(connectToAgencySchema),
    defaultValues: {
      connectionCode: ""
    },
    mode: "onSubmit",
  });


  const handleSearchChange = (value: string) => {
    setSearchValue(value);
  };


  const handleAddAgencyClick = () => {
    setIsAddAgencyDialogOpen(true);
    selectionForm.reset();
  };

  const handleSelectionDialogClose = () => {
    setIsAddAgencyDialogOpen(false);
    selectionForm.reset();
  };

  const handleAddNewAgencyDialogClose = () => {
    setIsAddNewAgencyDialogOpen(false);
    addNewAgencyForm.reset();
  };

  const handleConnectToAgencyDialogClose = () => {
    setIsConnectToAgencyDialogOpen(false);
    connectToAgencyForm.reset();
    // Reset success state after modal closes to prevent brief flash
    setTimeout(() => {
      setConnectedAgencyName('');
      setConnectedAgencyLogo(undefined);
      setIsConnecting(false);
    }, 300); // 300ms delay to allow modal close animation
  };

  const handleSelectionSubmit = (data: AccountTypeFormData) => {
    if (data.accountType === 'agency') {
      setIsAddAgencyDialogOpen(false);
      setIsAddNewAgencyDialogOpen(true);
    } else if (data.accountType === 'client') {
      setIsAddAgencyDialogOpen(false);
      setIsConnectToAgencyDialogOpen(true);
    }
  };

  const handleAddNewAgencySubmit = async (data: AddNewAgencyFormData) => {
    setIsCreatingAgency(true);
    
    try {
      const result = await createNewAgencyAndInvite(
        data.agencyName,
        data.primaryContactEmail,
        context
      );
      
      if (result.success) {
        // Update local state with fresh data
        const refreshedData = await refreshAgenciesData(context);
        setAgencies(refreshedData.agencies);
        setTotalCount(refreshedData.total);
        
        // Close dialog and show success
        handleAddNewAgencyDialogClose();
        // Success toast will be handled by the action if needed
      } else {
        // Show error in form
        addNewAgencyForm.setError('root', {
          message: result.error || 'Failed to create agency'
        });
      }
    } catch (error) {
      console.error('Error creating agency:', error);
      addNewAgencyForm.setError('root', {
        message: 'Failed to create agency. Please try again.'
      });
    } finally {
      setIsCreatingAgency(false);
    }
  };

  const handleConnectToAgencySubmit = async (data: ConnectToAgencyFormData) => {
    console.log('AGENCY: Submitting connection code:', data.connectionCode);
    console.log('AGENCY: Context:', context);
    
    setIsConnecting(true);
    
    try {
      // Start the connection request and a minimum delay in parallel
      const [result] = await Promise.all([
        connectToExistingAgency(data.connectionCode, context),
        new Promise(resolve => setTimeout(resolve, 650)) // UX delay
      ]);
      
      if (result.success) {
        // Update local state with fresh data
        const refreshedData = await refreshAgenciesData(context);
        setAgencies(refreshedData.agencies);
        setTotalCount(refreshedData.total);
        
        // Set success state for modal
        setConnectedAgencyName(result.agencyName || 'Agency');
        setConnectedAgencyLogo(result.agencyLogo);
        setIsConnectSuccess(true);
      } else {
        // Show error in form
        connectToAgencyForm.setError('connectionCode', {
          message: result.error || 'Failed to connect to agency'
        });
      }
    } catch (error) {
      console.error('Error connecting to agency:', error);
      connectToAgencyForm.setError('connectionCode', {
        message: 'Failed to connect to agency. Please try again.'
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 16px 24px 24px' }}>
      {/* Fixed Header Section */}
      <div className="flex-shrink-0">
      {/* Page Header */}
      <div className="flex items-center justify-between w-full mb-5">
        <div>
            <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
            Agencies
          </h1>
        </div>
        <Button
          variant="default"
          size="lg"
          className="cursor-pointer text-sm flex items-center gap-2"
          onClick={handleAddAgencyClick}
        >
          <Plus size={16} />
          Add agency
        </Button>
      </div>
      
        <div className="flex items-center justify-between w-full mb-4">
        <SearchInput 
          placeholder="Search agencies"
            count={filteredAgencies.length}
            countLabel={filteredAgencies.length === 1 ? "agency" : "agencies"}
          value={searchValue}
            onChange={handleSearchChange}
        />
      </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        {/* Empty state - no agencies at all */}
        {agencies.length === 0 && (
          <div 
            className="rounded-md border overflow-hidden"
            style={{ 
              backgroundColor: 'var(--color-base-surface-page-background)', 
              borderColor: 'var(--color-neutral-5)',
              minHeight: '400px',
              height: '100%',
              width: '100%',
            }}
          >
            <div className="text-left" style={{ height: '100%', paddingLeft: '120px' }}>
              <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
                <div className="flex flex-col items-start gap-2">
                  <h2 className="display-8-medium">Your best work starts here</h2>
                  <span className="text-sm-regular text-neutral-11">Add your first agency to begin managing partnerships in one place</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
                  onClick={handleAddAgencyClick}
                >
                  <Plus size={16} weight="regular" />
                  Add agency
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* No search results */}
        {agencies.length > 0 && filteredAgencies.length === 0 && searchValue.trim() && (
          <div className="flex items-center justify-center h-full min-h-64 -mt-8">
            <div className="text-center">
              <h2 className="display-8-medium mb-2" style={{ color: 'var(--color-base-text-tertiary)' }}>No results</h2>
              <p className="text-sm-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>No agencies match your search criteria</p>
            </div>
          </div>
        )}

        {/* Agency cards */}
        {filteredAgencies.length > 0 && (
          <div className="grid grid-cols-2 gap-4">
            {filteredAgencies.map((agency) => (
              <AgencyCard
                key={agency.id}
                agencyId={agency.id}
                connectionId={agency.connectionId}
                agencyName={agency.name}
                agencyType={agency.industry}
                avatarUrl={agency.logo}
                status={agency.status}
                accountManager={agency.accountManager}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add Agency Dialog */}
      <Dialog open={isAddAgencyDialogOpen} onOpenChange={setIsAddAgencyDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '664px', maxWidth: '664px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="sr-only">Add Agency</DialogTitle>
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
                            Add a new agency
                          </h3>
                          <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                            Your agency isn&apos;t on Fiive. Create a shared workspace and invite them when ready.
                          </p>
                        </RadioCard>
                        <RadioCard value="client" icon={<Link size={24} weight="regular" />}>
                          <h3 className="display-5-medium mb-2">
                            Connect to an agency
                          </h3>
                          <p className="text-sm-regular text-left" style={{ color: 'var(--color-base-text-secondary)' }}>
                            Your agency is already on Fiive. Enter their connection code to collaborate.
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

      {/* Add New Agency Dialog */}
      <Dialog open={isAddNewAgencyDialogOpen} onOpenChange={setIsAddNewAgencyDialogOpen}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>Add a new agency</DialogTitle>
          <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
            Invite your agency to start collaborating
          </DialogDescription>
          <Form {...addNewAgencyForm}>
            <form onSubmit={addNewAgencyForm.handleSubmit(handleAddNewAgencySubmit)} className="space-y-5">
              <div className="mt-3 space-y-4">
                <FormField
                  control={addNewAgencyForm.control}
                  name="agencyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Agency name</FormLabel>
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
                <FormField
                  control={addNewAgencyForm.control}
                  name="primaryContactEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-sm font-medium">Primary contact email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="email@example.com"
                          className="h-10 px-4 py-2 text-sm"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {addNewAgencyForm.formState.errors.root && (
                  <p className="text-sm text-red-600">
                    {addNewAgencyForm.formState.errors.root.message}
                  </p>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button 
                  type="button"
                  variant="ghost" 
                  onClick={handleAddNewAgencyDialogClose}
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  style={{ height: '40px' }}
                  className="cursor-pointer relative"
                  disabled={isCreatingAgency}
                >
                  <span className={isCreatingAgency ? "invisible" : ""}>Continue</span>
                  {isCreatingAgency && (
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

      {/* Connect to Agency Dialog */}
      <Dialog open={isConnectToAgencyDialogOpen} onOpenChange={setIsConnectToAgencyDialogOpen}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', height: isConnectSuccess ? '322px' : 'auto', gap: '12px' }} className="[&>button]:hidden" showCloseButton={false}>
          <div className="flex flex-col h-full">
            {!isConnectSuccess ? (
              <>
                <DialogTitle className="display-5-medium mb-3" style={{ color: 'var(--color-base-text-primary)' }}>Connect to an agency</DialogTitle>
                <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  Use a connection code to link your workspace with an agency who&apos;s already on Fiive
                </DialogDescription>
                <Form {...connectToAgencyForm}>
                  <form onSubmit={connectToAgencyForm.handleSubmit(handleConnectToAgencySubmit)} className="space-y-5 flex-1 flex flex-col">
                    <div className="mt-5">
                      <FormField
                        control={connectToAgencyForm.control}
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
                              Ask your agency to share the connection code in their admin settings
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
                        onClick={handleConnectToAgencyDialogClose}
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
                <AvatarImage src={connectedAgencyLogo} alt={connectedAgencyName} />
                <AvatarFallback 
                  className="text-white text-lg font-medium"
                  style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
                >
                  {connectedAgencyName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <DialogTitle className="display-5-medium mb-2" style={{ color: 'var(--color-base-text-primary)' }}>Connected to {connectedAgencyName}</DialogTitle>
              <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                You can now collaborate through your shared workspace
              </DialogDescription>
              
              <div className="flex-1"></div>
              
              <div className="flex justify-end pt-2 mt-auto">
                <Button 
                  onClick={handleConnectToAgencyDialogClose}
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

'use client'

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Check, Link } from '@phosphor-icons/react/ssr';
import { SearchInput } from '@/components/ui/search-input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { RadioCards, RadioCard } from '@/components/ui/radio-cards';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AgencyCard } from '@/features/agencies/AgencyCard';

const accountTypeSchema = z.object({
  accountType: z.string().min(1, "Please make a selection")
});

const addNewAgencySchema = z.object({
  agencyName: z.string().min(1, "Agency name is required")
});

const connectToAgencySchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
});

type AccountTypeFormData = z.infer<typeof accountTypeSchema>;
type AddNewAgencyFormData = z.infer<typeof addNewAgencySchema>;
type ConnectToAgencyFormData = z.infer<typeof connectToAgencySchema>;

interface AgenciesContentProps {
  initialSearchValue?: string;
}

// Sample agency data
const agenciesData = [
  {
    id: 1,
    agencyName: "Sample Agency",
    agencyType: "Creative agency",
    status: "connected" as const,
    accountManager: {
      name: "John Smith",
      avatarUrl: undefined
    }
  },
  {
    id: 2,
    agencyName: "Design Studio",
    agencyType: "Branding agency",
    status: "invited" as const,
    accountManager: {
      name: "Sarah Johnson",
      avatarUrl: undefined
    }
  },
  {
    id: 3,
    agencyName: "Marketing Co",
    agencyType: "Digital agency",
    status: "disconnected" as const,
    accountManager: {
      name: "Mike Chen",
      avatarUrl: undefined
    }
  }
];

export function AgenciesContent({ 
  initialSearchValue = '' 
}: AgenciesContentProps) {
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [isAddAgencyDialogOpen, setIsAddAgencyDialogOpen] = useState(false);
  const [isAddNewAgencyDialogOpen, setIsAddNewAgencyDialogOpen] = useState(false);
  const [isConnectToAgencyDialogOpen, setIsConnectToAgencyDialogOpen] = useState(false);

  // Filter agencies based on search value
  const filteredAgencies = agenciesData.filter(agency => {
    if (!searchValue.trim()) return true;
    
    const searchLower = searchValue.toLowerCase();
    return (
      agency.agencyName.toLowerCase().includes(searchLower) ||
      agency.agencyType.toLowerCase().includes(searchLower) ||
      agency.status.toLowerCase().includes(searchLower) ||
      agency.accountManager.name.toLowerCase().includes(searchLower)
    );
  });

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
      agencyName: ""
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


  // Mock data for now
  const totalCount: number = filteredAgencies.length;

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    // TODO: Implement search functionality
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

  const handleAddNewAgencySubmit = (data: AddNewAgencyFormData) => {
    // TODO: Add agency to database
    console.log('Adding new agency:', data.agencyName);
    handleAddNewAgencyDialogClose();
  };

  const handleConnectToAgencySubmit = (data: ConnectToAgencyFormData) => {
    // TODO: Connect to agency using connection code
    console.log('Connecting to agency with code:', data.connectionCode);
    handleConnectToAgencyDialogClose();
  };

  return (
    <div className="h-full flex flex-col" style={{ padding: '24px 16px 24px 32px' }}>
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
            count={totalCount}
            countLabel={totalCount === 1 ? "agency" : "agencies"}
          value={searchValue}
            onChange={handleSearchChange}
        />
      </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0">
        <div className="grid grid-cols-2 gap-4">
          {filteredAgencies.map((agency) => (
            <AgencyCard
              key={agency.id}
              agencyName={agency.agencyName}
              agencyType={agency.agencyType}
              status={agency.status}
              accountManager={agency.accountManager}
            />
          ))}
        </div>
        
        {/* No results message */}
        {filteredAgencies.length === 0 && searchValue.trim() && (
          <div className="flex items-center justify-center h-full min-h-64 text-tertiary -mt-8">
            No agencies found matching "{searchValue}"
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
            Create a shared workspace you can invite your agency to later
          </DialogDescription>
          <Form {...addNewAgencyForm}>
            <form onSubmit={addNewAgencyForm.handleSubmit(handleAddNewAgencySubmit)} className="space-y-5">
              <div className="mt-3">
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
                  className="cursor-pointer"
                >
                  Continue
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Connect to Agency Dialog */}
      <Dialog open={isConnectToAgencyDialogOpen} onOpenChange={setIsConnectToAgencyDialogOpen}>
        <DialogContent style={{ padding: '24px', maxWidth: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto" showCloseButton={false}>
          <DialogTitle className="display-5-medium" style={{ color: 'var(--color-base-text-primary)' }}>Connect to an agency</DialogTitle>
          <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
            Use a connection code to link your workspace with an agency who&apos;s already on Fiive
          </DialogDescription>
          <Form {...connectToAgencyForm}>
            <form onSubmit={connectToAgencyForm.handleSubmit(handleConnectToAgencySubmit)} className="space-y-5">
              <div className="mt-3">
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
              <div className="flex justify-end gap-3 pt-2">
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

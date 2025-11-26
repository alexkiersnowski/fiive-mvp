'use client'

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/connection-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineEdit } from '@/components/ui/inline-edit';
import { ImageUpload } from '@/components/ui/image-upload';
import { ArrowLeft, DotsThree, Link, PaperPlaneTilt, Trash, XCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateDraftClientOrganization, inviteClientToConnection, resendInviteEmail, cancelInvitation, reconnectConnection } from './actions';
import { deleteClient } from '@/features/clients/actions';
import { useConnection } from './ConnectionContext';
import type { ConnectionSnapshot } from './types';
import type { StatusVariant } from '@/components/ui/connection-badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/shadcn-io/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

interface ConnectionHeaderProps {
  snapshot: ConnectionSnapshot;
}

const reconnectSchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
})

export function ConnectionHeader({ snapshot }: ConnectionHeaderProps) {
  const router = useRouter();
  const { context } = useConnection();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [partnerName, setPartnerName] = useState(snapshot.partner.name);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [emailValidationError, setEmailValidationError] = useState<string>('');
  const [isResending, setIsResending] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);

  // Form for reconnect dialog
  const reconnectForm = useForm<{ connectionCode: string }>({
    resolver: zodResolver(reconnectSchema),
    defaultValues: {
      connectionCode: ""
    },
    mode: "onSubmit",
  });
  
  // Determine if name should be editable (internal connection, agency user, client partner)
  const isNameEditable = snapshot.connection.isInternal && 
                         snapshot.currentUserType === 'agency' && 
                         snapshot.partner.type === 'client';
  
  // Logo is editable under same conditions as name
  const isLogoEditable = isNameEditable;
  
  // Check if this is an internal connection
  const isInternal = snapshot.connection.isInternal && snapshot.partner.type === 'client';
  
  // Check if this is an invited connection (works for both client and agency partners)
  const isInvited = snapshot.connection.status === 'invited';
  
  // Check if this is a disconnected connection
  const isDisconnected = snapshot.connection.status === 'disconnected';
  
  // Determine back link and label based on partner type
  const backHref = snapshot.partner.type === 'client' ? '/clients' : '/agencies';
  const backLabel = snapshot.partner.type === 'client' ? 'All clients' : 'All agencies';
  
  // Handle name save
  const handleNameSave = async (value: string) => {
    const trimmedValue = value.trim();
    
    // Validation: Name cannot be empty
    if (!trimmedValue) {
      toast.error('Organization name cannot be empty');
      return;
    }
    
    // Optimistic update
    const previousName = partnerName;
    setPartnerName(trimmedValue);
    
    try {
      const result = await updateDraftClientOrganization({
        connectionId: snapshot.connection.id,
        name: trimmedValue
      });
      
      if (!result.success) {
        // Revert optimistic update on error
        setPartnerName(previousName);
        toast.error(result.error || 'Failed to update organization name');
      } else {
        toast.success('Organization name updated');
      }
    } catch (error) {
      // Revert optimistic update on error
      setPartnerName(previousName);
      console.error('Failed to update organization name:', error);
      toast.error('Failed to update organization name');
    }
  };
  
  // Handle logo change
  const handleLogoChange = async (file: File | null) => {
    if (!file) {
      setLogoFile(null);
      return;
    }
    
    setLogoFile(file);
    setIsUploadingLogo(true);
    
    try {
      const result = await updateDraftClientOrganization({
        connectionId: snapshot.connection.id,
        logo_file: file
      });
      
      if (!result.success) {
        toast.error(result.error || 'Failed to update organization logo');
        setLogoFile(null);
      } else {
        toast.success('Organization logo updated');
        setLogoFile(null); // Clear after successful upload
      }
    } catch (error) {
      console.error('Failed to update organization logo:', error);
      toast.error('Failed to update organization logo');
      setLogoFile(null);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Handle validation errors from ImageUpload component
  const handleLogoError = (error: string) => {
    toast.error(error);
  };

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  };

  // Handle email changes (clear validation errors)
  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInviteEmail(e.target.value)
    // Clear any existing validation errors when user changes input
    setEmailValidationError('')
  }

  // Handle invite client
  const handleInviteClient = async () => {
    const trimmedEmail = inviteEmail.trim()
    
    // Clear previous errors
    setEmailValidationError('')
    
    if (!trimmedEmail) {
      setEmailValidationError('Please enter an email address')
      return
    }

    if (!isValidEmail(trimmedEmail)) {
      setEmailValidationError('Please enter a valid email address')
      return
    }

    setIsInviting(true)
    try {
      const result = await inviteClientToConnection({
        connectionId: snapshot.connection.id,
        email: trimmedEmail
      })

      if (result.success) {
        toast.success('Client invitation sent')
        setInviteDialogOpen(false)
        setInviteEmail('')
        setEmailValidationError('')
      } else {
        // Show server validation errors inline
        setEmailValidationError(result.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error inviting client:', error)
      setEmailValidationError('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  };
  
  // Handle delete internal
  const handleDeleteClick = () => {
    setIsSettingsOpen(false);
    setDeleteDialogOpen(true);
  };

  // Handle resend email
  const handleResendClick = async () => {
    setIsSettingsOpen(false);
    setIsResending(true);
    try {
      const result = await resendInviteEmail({
        connectionId: snapshot.connection.id
      });

      if (result.success) {
        toast.success('Invitation email resent');
      } else {
        // Show error message from server (includes rate limit messages)
        toast.error(result.error || 'Failed to resend invitation email');
      }
    } catch (error) {
      console.error('Error resending invitation:', error);
      toast.error('Failed to resend invitation email');
    } finally {
      setIsResending(false);
    }
  };

  // Handle cancel invitation
  const handleCancelClick = async () => {
    setIsSettingsOpen(false);
    setIsCanceling(true);
    try {
      const result = await cancelInvitation({
        connectionId: snapshot.connection.id
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

  // Handle reconnect
  const handleReconnect = async (data: { connectionCode: string }) => {
    // Validate connection code matches partner organization's connection code
    if (data.connectionCode.trim() !== snapshot.partner.connectionCode) {
      reconnectForm.setError('connectionCode', {
        message: 'Invalid code. Please check and try again.'
      });
      return;
    }

    setIsReconnecting(true);
    try {
      const result = await reconnectConnection({ 
        connectionId: snapshot.connection.id,
        connectionCode: data.connectionCode.trim()
      });

      if (result.success) {
        toast.success('Connection reconnected');
        setReconnectDialogOpen(false);
        reconnectForm.reset();
        router.refresh();
      } else {
        // If connection code was valid but update failed (e.g., RLS), close modal and show toast
        // Otherwise, show error in form field
        const isPermissionError = result.error?.includes('permission') || result.error?.includes('blocked');
        if (isPermissionError) {
          toast.error(result.error || 'Failed to reconnect connection');
          setReconnectDialogOpen(false);
          reconnectForm.reset();
        } else {
          reconnectForm.setError('connectionCode', {
            message: result.error || 'Invalid code. Please check and try again.'
          });
        }
      }
    } catch (error) {
      console.error('Error reconnecting connection:', error);
      reconnectForm.setError('connectionCode', {
        message: 'Failed to reconnect connection'
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  const confirmDeleteClient = async () => {
    const clientOrgId = snapshot.partner.id;
    
    if (!clientOrgId) {
      toast.error('Unable to delete: Client ID not found');
      setDeleteDialogOpen(false);
      return;
    }

    // Show success toast immediately
    toast.success('Client deleted');
    
    // Close dialog
    setDeleteDialogOpen(false);
    
    // Navigate back to clients list
    router.push('/clients');
    
    // Delete in background
    try {
      const result = await deleteClient(clientOrgId, context);
      if (!result.success) {
        toast.error(result.error || 'Failed to delete client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete client');
    }
  };
  
  // Sync partner name when snapshot changes
  useEffect(() => {
    setPartnerName(snapshot.partner.name);
  }, [snapshot.partner.name]);

  return (
    <div>
      {/* Back button */}
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft size={16} weight="regular" />
          <span className="ml-1">{backLabel}</span>
        </Button>
      </div>

      {/* Avatar/Logo, Title, Status Badge, and Settings */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-5">
          {isLogoEditable ? (
            <div className="flex-shrink-0">
              <ImageUpload
                onLogoChange={handleLogoChange}
                onError={handleLogoError}
                initialLogoUrl={snapshot.partner.logo}
                uploadText="Upload logo"
                changeText="Change logo"
                size={60}
                iconSize={16}
                className="[&>div]:gap-0 [&>div>div:last-child]:hidden"
              />
            </div>
          ) : (
            <Avatar className="h-15 w-15">
              <AvatarImage src={snapshot.partner.logo} alt={partnerName} />
              <AvatarFallback 
                className="text-white font-medium text-lg"
                style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
              >
                {partnerName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
          {isNameEditable ? (
            <InlineEdit
              type="text"
              value={partnerName}
              onSave={handleNameSave}
              placeholder="Organization name"
              textClass="display-9-medium text-primary"
              multiline={true}
              preventNewLines={true}
              className="px-0"
              maxLength={255}
            />
          ) : (
            <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              {partnerName}
            </h1>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          {snapshot.connection.status === 'internal' ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div>
                  <StatusBadge 
                    variant={snapshot.connection.status as StatusVariant}
                    size="lg"
                    showText={true}
                    showTooltip={false}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <p>Agency-only until connected</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <StatusBadge 
              variant={snapshot.connection.status as StatusVariant}
              size="lg"
              showText={true}
            />
          )}
          
          <DropdownMenu modal={false} open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`cursor-pointer shadow-none transition-all duration-75 ${
                  isSettingsOpen 
                    ? 'bg-interactive-surface-hover hover:bg-interactive-surface-hover' 
                    : 'hover:bg-interactive-surface-hover'
                }`}
                style={{ height: '32px', width: '32px' }}
              >
                <DotsThree size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => router.push(`${backHref}/${snapshot.connection.id}/settings`)}>
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
                    Resend email
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
              {isInternal && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
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
          
          {isInternal && (
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm flex items-center gap-2"
              onClick={() => setInviteDialogOpen(true)}
            >
              Invite client
            </Button>
          )}
          
          {isDisconnected && (
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm flex items-center gap-2"
              onClick={() => setReconnectDialogOpen(true)}
            >
              Reconnect
            </Button>
          )}
          
          {/* Invite Client Dialog */}
          <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
            <DialogContent style={{ padding: '24px', width: '440px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
              <DialogHeader className="space-y-0">
                <DialogTitle className="display-5-medium mb-0">
                  Invite client
                </DialogTitle>
              </DialogHeader>
              <DialogDescription 
                className="text-sm-regular mb-0"
              >
                Invite your client&apos;s primary contact to set up their account and connect to your workspace
              </DialogDescription>
              <div style={{ marginTop: '12px' }}>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={inviteEmail}
                  onChange={handleEmailChange}
                  className="h-10 px-4 py-2 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && isValidEmail(inviteEmail.trim())) {
                      handleInviteClient()
                    }
                  }}
                />
                {emailValidationError && (
                  <p className="text-sm text-red-600 mt-2">
                    {emailValidationError}
                  </p>
                )}
              </div>
              <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
                <Button 
                  variant="ghost" 
                  onClick={() => {
                    setInviteDialogOpen(false)
                    setInviteEmail('')
                    setEmailValidationError('')
                  }}
                  style={{ height: '40px' }}
                  className="cursor-pointer"
                  disabled={isInviting}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={handleInviteClient}
                  style={{ height: '40px' }}
                  className="cursor-pointer relative"
                  disabled={isInviting || !isValidEmail(inviteEmail.trim())}
                >
                  <span className={isInviting ? "invisible" : ""}>Invite</span>
                  {isInviting && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Spinner size={16} />
                    </div>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Delete Client Confirmation Dialog */}
          <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
            <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
              <DialogHeader className="space-y-0">
                <DialogTitle className="display-5-medium mb-0">
                  Delete {partnerName}?
                </DialogTitle>
              </DialogHeader>
              <DialogDescription 
                className="text-sm-regular mb-0"
              >
                This will permanently delete the client and all related data. It won&apos;t affect any live connections or shared workspaces.
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

          {/* Reconnect Dialog */}
          <Dialog open={reconnectDialogOpen} onOpenChange={setReconnectDialogOpen}>
            <DialogContent style={{ padding: '24px', maxWidth: '460px', height: 'auto', gap: '12px' }} className="[&>button]:hidden">
              <div className="flex flex-col h-full">
                <DialogTitle className="display-5-medium mb-3" style={{ color: 'var(--color-base-text-primary)' }}>
                  Reconnect to {partnerName}
                </DialogTitle>
                <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                  Use a connection code to reconnect your shared workspace
                </DialogDescription>
                <Form {...reconnectForm}>
                  <form onSubmit={reconnectForm.handleSubmit(handleReconnect)} className="space-y-5 flex-1 flex flex-col">
                    <div className="mt-5">
                      <FormField
                        control={reconnectForm.control}
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
                              {snapshot.partner.type === 'client' 
                                ? 'Ask your client to share the connection code in their admin settings'
                                : 'Ask your agency to share the connection code in their admin settings'}
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
                        onClick={() => {
                          setReconnectDialogOpen(false);
                          reconnectForm.reset();
                        }}
                        style={{ height: '40px' }}
                        className="cursor-pointer"
                        disabled={isReconnecting}
                      >
                        Cancel
                      </Button>
                      <Button 
                        type="submit"
                        style={{ height: '40px' }}
                        className="cursor-pointer relative"
                        disabled={isReconnecting}
                      >
                        <span className={isReconnecting ? "invisible" : ""}>Continue</span>
                        {isReconnecting && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Spinner size={16} />
                          </div>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  );
}


'use client'

import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/connection-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { InlineEdit } from '@/components/ui/inline-edit';
import { ImageUpload } from '@/components/ui/image-upload';
import { ArrowLeft, DotsThree, Link, PaperPlaneTilt, Trash, XCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { updateDraftClientOrganization, inviteClientToConnection, resendInviteEmail, cancelInvitation } from './actions';
import { deleteClient } from '@/features/clients/actions';
import { useConnection } from './ConnectionContext';
import type { ConnectionSnapshot } from './types';
import type { StatusVariant } from '@/components/ui/connection-badge';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/shadcn-io/spinner';

interface ConnectionHeaderProps {
  snapshot: ConnectionSnapshot;
}

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
  
  // Determine if name should be editable (draft connection, agency user, client partner)
  const isNameEditable = snapshot.connection.isDraft && 
                         snapshot.currentUserType === 'agency' && 
                         snapshot.partner.type === 'client';
  
  // Logo is editable under same conditions as name
  const isLogoEditable = isNameEditable;
  
  // Check if this is a draft connection
  const isDraft = snapshot.connection.isDraft && snapshot.partner.type === 'client';
  
  // Check if this is an invited connection (works for both client and agency partners)
  const isInvited = snapshot.connection.status === 'invited';
  
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
  
  // Handle delete draft
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

  const confirmDeleteClient = async () => {
    const clientOrgId = snapshot.partner.id;
    
    if (!clientOrgId) {
      toast.error('Unable to delete: Client ID not found');
      setDeleteDialogOpen(false);
      return;
    }

    // Show success toast immediately
    toast.success('Draft client deleted');
    
    // Close dialog
    setDeleteDialogOpen(false);
    
    // Navigate back to clients list
    router.push('/clients');
    
    // Delete in background
    try {
      const result = await deleteClient(clientOrgId, context);
      if (!result.success) {
        toast.error(result.error || 'Failed to delete draft client');
      }
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error('Failed to delete draft client');
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
          <StatusBadge 
            variant={snapshot.connection.status as StatusVariant}
            size="lg"
            showText={true}
          />
          
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
              <DropdownMenuItem>
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
              {isDraft && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleDeleteClick}
                    className="focus:bg-red-50"
                  >
                    <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                    <span style={{ color: 'var(--color-red-11)' }}>
                      Delete draft
                    </span>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          {isDraft && (
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm flex items-center gap-2"
              onClick={() => setInviteDialogOpen(true)}
            >
              Invite client
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
                Invite your client&apos;s primary contact to set up their own account and join your shared workspace.
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
                This will permanently delete the draft client and all related data. It won't affect any live clients or shared workspaces.
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
      </div>
    </div>
  );
}


import { useState, useRef, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ListRow } from '@/components/ui/list-row';
import { ProfileCard } from '@/components/ui/profile-card';
import { Eye, ArrowsClockwise, UserMinus, User, Users } from '@phosphor-icons/react/dist/ssr';
import { toast } from 'sonner';
import { handleContactSelect, handleUnassignContact, handleAgencyContactSelect, handleUnassignAgencyContact } from '../client-actions';
import { useConnection } from '../ConnectionContext';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function ContactsCard({ snapshot, context }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const { isDisconnected } = useConnection();
  const title = 'Contacts';
  const isAgency = context.variant === 'agency';
  
  // Determine if this is an internal connection (agency user editing internal client)
  const isInternal = snapshot.connection.isInternal && 
                  snapshot.currentUserType === 'agency' && 
                  snapshot.partner.type === 'client';
  
  // Determine if this is an invited connection (agency user viewing invited client)
  const isInvited = snapshot.connection.status === 'invited' && 
                    snapshot.currentUserType === 'agency' && 
                    snapshot.partner.type === 'client';
  
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [optimisticPrimaryContact, setOptimisticPrimaryContact] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  } | null | 'unassigning'>(null);
  const [optimisticAgencyContact, setOptimisticAgencyContact] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  } | null | 'unassigning'>(null);
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  } | null>(null);
  const listRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null);
  const agencyListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null);
  
  // Check if client primary contact exists (use optimistic state if available)
  const currentPrimaryContact = optimisticPrimaryContact === 'unassigning' ? null : (optimisticPrimaryContact || snapshot.connection.clientPrimaryContact);
  const hasPrimaryContact = !!currentPrimaryContact;
  
  // Check if agency primary contact exists (use optimistic state if available)
  const currentAgencyContact = optimisticAgencyContact === 'unassigning' ? null : (optimisticAgencyContact || snapshot.connection.agencyPrimaryContact);
  const hasAgencyContact = !!currentAgencyContact;
  
  // Clear optimistic state when server data changes
  useEffect(() => {
    if (optimisticPrimaryContact === 'unassigning' && !snapshot.connection.clientPrimaryContact) {
      // Optimistic unassign: server now has null, clear optimistic state
      setOptimisticPrimaryContact(null);
    } else if (optimisticPrimaryContact && optimisticPrimaryContact !== 'unassigning' && snapshot.connection.clientPrimaryContact) {
      // Optimistic assign: server now has a value, clear optimistic state
      setOptimisticPrimaryContact(null);
    }
    
    if (optimisticAgencyContact === 'unassigning' && !snapshot.connection.agencyPrimaryContact) {
      // Optimistic unassign: server now has null, clear optimistic state
      setOptimisticAgencyContact(null);
    } else if (optimisticAgencyContact && optimisticAgencyContact !== 'unassigning' && snapshot.connection.agencyPrimaryContact) {
      // Optimistic assign: server now has a value, clear optimistic state
      setOptimisticAgencyContact(null);
    }
  }, [snapshot.connection.clientPrimaryContact, snapshot.connection.agencyPrimaryContact, optimisticPrimaryContact, optimisticAgencyContact]);
  
  const handleContactClick = (contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    job_title?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }) => {
    setSelectedContact(contact);
    setProfileDialogOpen(true);
  };
  
  const onContactSelect = async (memberId: string) => {
    if (isDisconnected) return;
    
    // Find the selected member from combobox options
    const selectedMember = snapshot.clientMembers.find(member => member.id === memberId);
    if (selectedMember) {
      // Optimistically update UI immediately
      setOptimisticPrimaryContact({
        id: selectedMember.id,
        firstName: selectedMember.firstName,
        lastName: selectedMember.lastName,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl,
        jobTitle: selectedMember.jobTitle || undefined
      });
    }
    
    // Update database in background
    const result = await handleContactSelect(snapshot.connection.id, memberId);
    if (!result.success) {
      toast.error(result.error || 'Failed to assign primary contact');
    } else {
      toast.success('Primary contact assigned');
    }
  };
  
  const onUnassignContact = async () => {
    if (isDisconnected) return;
    
    // Optimistically clear UI immediately - this will show empty state
    setOptimisticPrimaryContact('unassigning');
    
    // Update database in background
    const result = await handleUnassignContact(snapshot.connection.id);
    if (!result.success) {
      toast.error(result.error || 'Failed to unassign primary contact');
    } else {
      toast.success('Primary contact unassigned');
    }
  };

  const triggerReassignCombobox = () => {
    listRowRef.current?.triggerCombobox();
  };
  
  const triggerAgencyReassignCombobox = () => {
    agencyListRowRef.current?.triggerCombobox();
  };
  
  const onAgencyContactSelect = async (memberId: string) => {
    if (isDisconnected) return;
    
    // Find the selected member from combobox options
    const selectedMember = snapshot.agencyMembers.find(member => member.id === memberId);
    if (selectedMember) {
      // Optimistically update UI immediately
      setOptimisticAgencyContact({
        id: selectedMember.id,
        firstName: selectedMember.firstName,
        lastName: selectedMember.lastName,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl,
        jobTitle: selectedMember.jobTitle || undefined
      });
    }
    
    // Update database in background
    const result = await handleAgencyContactSelect(snapshot.connection.id, memberId);
    if (!result.success) {
      toast.error(result.error || 'Failed to assign account manager');
    } else {
      toast.success('Account manager assigned');
    }
  };
  
  const onUnassignAgencyContact = async () => {
    if (isDisconnected) return;
    
    // Optimistically clear UI immediately - this will show empty state
    setOptimisticAgencyContact('unassigning');
    
    // Update database in background
    const result = await handleUnassignAgencyContact(snapshot.connection.id);
    if (!result.success) {
      toast.error(result.error || 'Failed to unassign account manager');
    } else {
      toast.success('Account manager unassigned');
    }
  };
  
  // Transform client members to combobox options
  const comboboxOptions = snapshot.clientMembers.map(member => ({
    value: member.id,
    label: `${member.firstName} ${member.lastName}`,
    avatar: member.avatarUrl,
    email: member.email
  }));
  
  // Transform agency members to combobox options
  const agencyComboboxOptions = snapshot.agencyMembers.map(member => ({
    value: member.id,
    label: `${member.firstName} ${member.lastName}`,
    avatar: member.avatarUrl,
    email: member.email
  }));

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </CardTitle>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className="text-xs border-0"
              style={{
                borderRadius: 'var(--radius-1-max, 3px)',
                backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                border: 'none',
                cursor: 'default'
              }}
            >
              {isAgency ? (
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              ) : (
                <Users size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              )}
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                {isAgency ? 'Client visible' : 'Collaborate'}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency 
              ? 'Visible in client portal'
              : 'Both you and your agency can manage this'}
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-5 mt-1">
        {/* Agency view: Primary Contact first, Account Manager second */}
        {/* Client view: Account Manager first, Primary Contact second */}
        {isAgency ? (
          <>
            {/* Primary Contact - Agency view */}
            <div>
              <p className="text-xs-medium text-tertiary">
                {snapshot.partner.name} (Primary Contact)
              </p>
              <div className="mt-3">
                {hasPrimaryContact ? (
                  <ListRow
                    ref={listRowRef}
                    avatar={true}
                    avatarSize={32}
                    avatarUrl={currentPrimaryContact!.avatarUrl}
                    text={`${currentPrimaryContact!.firstName} ${currentPrimaryContact!.lastName}`}
                    secondaryText={currentPrimaryContact!.jobTitle || 'No job title'}
                    iconButtonEnd={!isDisconnected}
                    onClick={() => handleContactClick({ 
                      id: currentPrimaryContact!.id,
                      first_name: currentPrimaryContact!.firstName, 
                      last_name: currentPrimaryContact!.lastName,
                      email: currentPrimaryContact!.email,
                      avatar_url: currentPrimaryContact!.avatarUrl,
                      job_title: currentPrimaryContact!.jobTitle,
                      organization: {
                        id: snapshot.partner.id,
                        name: snapshot.partner.name,
                        logo_url: snapshot.partner.logo
                      }
                    })}
                    dropdownItems={isDisconnected ? undefined : [
                      { label: 'Reassign', icon: <ArrowsClockwise size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: triggerReassignCombobox },
                      { label: 'Unassign', icon: <UserMinus size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: onUnassignContact }
                    ]}
                    comboboxOptions={isDisconnected ? undefined : comboboxOptions}
                    comboboxSelectedValue={currentPrimaryContact ? currentPrimaryContact.id : null}
                    onComboboxSelect={isDisconnected ? undefined : onContactSelect}
                    comboboxPlaceholder={isDisconnected ? undefined : "Search contacts..."}
                    nonInteractive={false}
                    className="min-h-[44px]"
                  />
                ) : isInvited && snapshot.connection.invitedEmail ? (
                  <ListRow
                    avatar={true}
                    avatarFallback={<User size={16} weight="fill" className="text-white" />}
                    text={snapshot.connection.invitedEmail}
                    textColor="var(--color-base-text-primary)"
                    secondaryText={false}
                    actions={false}
                    nonInteractive={true}
                    iconEnd={
                      <Badge
                        variant="outline"
                        className="text-xs border-0"
                        style={{
                          backgroundColor: "var(--color-semantic-info-3)",
                          borderRadius: "var(--radius-1-max, 3px)",
                          color: "var(--color-semantic-info-11)",
                          paddingTop: '2px',
                          paddingBottom: '2px',
                          paddingLeft: '6px',
                          paddingRight: '6px'
                        }}
                      >
                        Invited
                      </Badge>
                    }
                    className="min-h-[44px]"
                  />
                ) : (
                  <ListRow
                    avatar={true}
                    avatarFallback={<User size={16} weight="fill" className="text-white" />}
                    text={isDisconnected ? "Unassigned" : (isInternal ? "To be invited" : "Assign contact")}
                    textColor="var(--color-base-text-tertiary)"
                    secondaryText={false}
                    actions={false}
                    nonInteractive={isInternal || isDisconnected}
                    comboboxOptions={(isInternal || isDisconnected) ? undefined : comboboxOptions}
                    onComboboxSelect={(isInternal || isDisconnected) ? undefined : onContactSelect}
                    comboboxPlaceholder={(isInternal || isDisconnected) ? undefined : "Search contacts..."}
                    className="min-h-[44px]"
                  />
                )}
              </div>
            </div>
            {/* Account Manager - Agency view */}
            <div>
              <p className="text-xs-medium text-tertiary">
                {snapshot.agency.name} (Account Manager)
              </p>
              <div className="mt-3">
                {hasAgencyContact ? (
                  <ListRow
                    ref={agencyListRowRef}
                    avatar={true}
                    avatarSize={32}
                    avatarUrl={currentAgencyContact!.avatarUrl}
                    text={`${currentAgencyContact!.firstName} ${currentAgencyContact!.lastName}`}
                    secondaryText={currentAgencyContact!.jobTitle || 'No job title'}
                    iconButtonEnd={!isDisconnected}
                    onClick={() => handleContactClick({ 
                      id: currentAgencyContact!.id,
                      first_name: currentAgencyContact!.firstName, 
                      last_name: currentAgencyContact!.lastName,
                      email: currentAgencyContact!.email,
                      avatar_url: currentAgencyContact!.avatarUrl,
                      job_title: currentAgencyContact!.jobTitle,
                      organization: {
                        id: snapshot.agency.id,
                        name: snapshot.agency.name,
                        logo_url: snapshot.agency.logo
                      }
                    })}
                    dropdownItems={isDisconnected ? undefined : [
                      { label: 'Reassign', icon: <ArrowsClockwise size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: triggerAgencyReassignCombobox },
                      { label: 'Unassign', icon: <UserMinus size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: onUnassignAgencyContact }
                    ]}
                    comboboxOptions={isDisconnected ? undefined : agencyComboboxOptions}
                    comboboxSelectedValue={currentAgencyContact ? currentAgencyContact.id : null}
                    onComboboxSelect={isDisconnected ? undefined : onAgencyContactSelect}
                    comboboxPlaceholder={isDisconnected ? undefined : "Search contacts..."}
                    nonInteractive={false}
                    className="min-h-[44px]"
                  />
                ) : (
                  <ListRow
                    avatar={true}
                    avatarFallback={<User size={16} weight="fill" className="text-white" />}
                    text={isDisconnected ? "Unassigned" : "Assign contact"}
                    textColor="var(--color-base-text-tertiary)"
                    secondaryText={false}
                    actions={false}
                    comboboxOptions={isDisconnected ? undefined : agencyComboboxOptions}
                    onComboboxSelect={isDisconnected ? undefined : onAgencyContactSelect}
                    comboboxPlaceholder={isDisconnected ? undefined : "Search contacts..."}
                    nonInteractive={isDisconnected}
                    className="min-h-[44px]"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Account Manager - Client view (first) */}
            <div>
              <p className="text-xs-medium text-tertiary">
                {snapshot.partner.name} (Account Manager)
              </p>
              <div className="mt-3">
                {hasAgencyContact ? (
                  <ListRow
                    ref={agencyListRowRef}
                    avatar={true}
                    avatarSize={32}
                    avatarUrl={currentAgencyContact!.avatarUrl}
                    text={`${currentAgencyContact!.firstName} ${currentAgencyContact!.lastName}`}
                    secondaryText={currentAgencyContact!.jobTitle || 'No job title'}
                    iconButtonEnd={false}
                    onClick={() => handleContactClick({ 
                      id: currentAgencyContact!.id,
                      first_name: currentAgencyContact!.firstName, 
                      last_name: currentAgencyContact!.lastName,
                      email: currentAgencyContact!.email,
                      avatar_url: currentAgencyContact!.avatarUrl,
                      job_title: currentAgencyContact!.jobTitle,
                      organization: {
                        id: snapshot.partner.id,
                        name: snapshot.partner.name,
                        logo_url: snapshot.partner.logo
                      }
                    })}
                    className="min-h-[44px]"
                  />
                ) : (
                  <ListRow
                    avatar={true}
                    avatarFallback={<User size={16} weight="fill" className="text-white" />}
                    text="Unassigned"
                    textColor="var(--color-base-text-tertiary)"
                    secondaryText={false}
                    actions={false}
                    nonInteractive={true}
                    className="min-h-[44px]"
                  />
                )}
              </div>
            </div>
            {/* Primary Contact - Client view (second) */}
            <div>
              <p className="text-xs-medium text-tertiary">
                {context.organization.name} (Primary Contact)
              </p>
              <div className="mt-3">
                {hasPrimaryContact ? (
                  <ListRow
                    ref={listRowRef}
                    avatar={true}
                    avatarSize={32}
                    avatarUrl={currentPrimaryContact!.avatarUrl}
                    text={`${currentPrimaryContact!.firstName} ${currentPrimaryContact!.lastName}`}
                    secondaryText={currentPrimaryContact!.jobTitle || 'No job title'}
                    iconButtonEnd={!isDisconnected}
                    onClick={() => handleContactClick({ 
                      id: currentPrimaryContact!.id,
                      first_name: currentPrimaryContact!.firstName, 
                      last_name: currentPrimaryContact!.lastName,
                      email: currentPrimaryContact!.email,
                      avatar_url: currentPrimaryContact!.avatarUrl,
                      job_title: currentPrimaryContact!.jobTitle,
                      organization: {
                        id: context.organization.id,
                        name: context.organization.name,
                        logo_url: context.organization.logoUrl
                      }
                    })}
                    dropdownItems={isDisconnected ? undefined : [
                      { label: 'Reassign', icon: <ArrowsClockwise size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: triggerReassignCombobox },
                      { label: 'Unassign', icon: <UserMinus size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: onUnassignContact }
                    ]}
                    comboboxOptions={isDisconnected ? undefined : comboboxOptions}
                    comboboxSelectedValue={currentPrimaryContact ? currentPrimaryContact.id : null}
                    onComboboxSelect={isDisconnected ? undefined : onContactSelect}
                    comboboxPlaceholder={isDisconnected ? undefined : "Search contacts..."}
                    nonInteractive={false}
                    className="min-h-[44px]"
                  />
                ) : (
                  <ListRow
                    avatar={true}
                    avatarFallback={<User size={16} weight="fill" className="text-white" />}
                    text="Unassigned"
                    textColor="var(--color-base-text-tertiary)"
                    secondaryText={false}
                    actions={false}
                    comboboxOptions={isDisconnected ? undefined : comboboxOptions}
                    onComboboxSelect={isDisconnected ? undefined : onContactSelect}
                    comboboxPlaceholder={isDisconnected ? undefined : "Search contacts..."}
                    nonInteractive={isDisconnected}
                    className="min-h-[44px]"
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>
      
      {/* Profile Card Dialog */}
      {selectedContact && (
        <ProfileCard
          member={selectedContact}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false);
            setSelectedContact(null);
          }}
        />
      )}
    </Card>
  );
}


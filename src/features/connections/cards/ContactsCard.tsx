import { useState, useRef, useEffect } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ListRow } from '@/components/ui/list-row';
import { ProfileCard } from '@/components/ui/profile-card';
import { Eye, ArrowsClockwise, UserMinus } from '@phosphor-icons/react/dist/ssr';
import { handleContactSelect, handleUnassignContact, handleAgencyContactSelect, handleUnassignAgencyContact } from '../client-actions';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function ContactsCard({ snapshot }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const title = 'Contacts';
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
  const listRowRef = useRef<{ triggerCombobox: () => void }>(null);
  const agencyListRowRef = useRef<{ triggerCombobox: () => void }>(null);
  
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
  }, [snapshot.connection.clientPrimaryContact, snapshot.connection.agencyPrimaryContact]);
  
  const handleContactClick = (contact: {
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
  }) => {
    setSelectedContact(contact);
    setProfileDialogOpen(true);
  };
  
  const onContactSelect = async (memberId: string) => {
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
    await handleContactSelect(snapshot.connection.id, memberId);
  };
  
  const onUnassignContact = async () => {
    // Optimistically clear UI immediately - this will show empty state
    setOptimisticPrimaryContact('unassigning');
    
    // Update database in background
    await handleUnassignContact(snapshot.connection.id);
  };

  const triggerReassignCombobox = () => {
    listRowRef.current?.triggerCombobox();
  };
  
  const triggerAgencyReassignCombobox = () => {
    agencyListRowRef.current?.triggerCombobox();
  };
  
  const onAgencyContactSelect = async (memberId: string) => {
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
    await handleAgencyContactSelect(snapshot.connection.id, memberId);
  };
  
  const onUnassignAgencyContact = async () => {
    // Optimistically clear UI immediately - this will show empty state
    setOptimisticAgencyContact('unassigning');
    
    // Update database in background
    await handleUnassignAgencyContact(snapshot.connection.id);
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
        <Tooltip delayDuration={400}>
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
              <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Client visible</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Both you and your client can see this
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="flex flex-col gap-5">
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
                      iconEnd={true}
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
                      dropdownItems={[
                        { label: 'Reassign', icon: <ArrowsClockwise size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: triggerReassignCombobox },
                        { label: 'Unassign', icon: <UserMinus size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: onUnassignContact }
                      ]}
                      comboboxOptions={comboboxOptions}
                      onComboboxSelect={onContactSelect}
                      comboboxPlaceholder="Search contacts..."
                      className="min-h-[44px]"
                    />
                  ) : (
              <ListRow
                avatar={false}
                text="Assign contact"
                textColor="var(--color-base-text-tertiary)"
                secondaryText={false}
                actions={false}
                comboboxOptions={comboboxOptions}
                onComboboxSelect={onContactSelect}
                comboboxPlaceholder="Search contacts..."
                className="min-h-[44px]"
              />
            )}
          </div>
        </div>
        <div>
          <p className="text-xs-medium text-tertiary">
            {snapshot.currentUserType === 'client' ? snapshot.partner.name : snapshot.agency.name} (Account Manager)
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
                iconEnd={true}
                onClick={() => handleContactClick({ 
                  id: currentAgencyContact!.id,
                  first_name: currentAgencyContact!.firstName, 
                  last_name: currentAgencyContact!.lastName,
                  email: currentAgencyContact!.email,
                  avatar_url: currentAgencyContact!.avatarUrl,
                  job_title: currentAgencyContact!.jobTitle,
                  organization: {
                    id: snapshot.currentUserType === 'client' ? snapshot.partner.id : snapshot.agency.id,
                    name: snapshot.currentUserType === 'client' ? snapshot.partner.name : snapshot.agency.name,
                    logo_url: snapshot.currentUserType === 'client' ? snapshot.partner.logo : snapshot.agency.logo
                  }
                })}
                dropdownItems={[
                  { label: 'Reassign', icon: <ArrowsClockwise size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: triggerAgencyReassignCombobox },
                  { label: 'Unassign', icon: <UserMinus size={16} style={{ color: 'var(--color-base-text-primary)' }} />, onClick: onUnassignAgencyContact }
                ]}
                comboboxOptions={agencyComboboxOptions}
                onComboboxSelect={onAgencyContactSelect}
                comboboxPlaceholder="Search contacts..."
                className="min-h-[44px]"
              />
            ) : (
              <ListRow
                avatar={false}
                text="Assign contact"
                textColor="var(--color-base-text-tertiary)"
                secondaryText={false}
                actions={false}
                comboboxOptions={agencyComboboxOptions}
                onComboboxSelect={onAgencyContactSelect}
                comboboxPlaceholder="Search contacts..."
                className="min-h-[44px]"
              />
            )}
          </div>
        </div>
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


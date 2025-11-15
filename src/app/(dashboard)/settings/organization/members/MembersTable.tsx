"use client"

import { useState, useMemo, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { ListRow } from '@/components/ui/list-row'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MultiEmailInput } from '@/components/ui/multi-email-input'
import { Badge } from '@/components/ui/badge'
import { ProfileCard } from '@/components/ui/profile-card'
import { SearchInput } from '@/components/ui/search-input'
import { DotsThree, UserMinus, EnvelopeSimple, XCircle, Plus } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateMemberRole, removeMember, inviteMembers, resendInvitation, cancelInvitation, getOrganizationInvitations, getOrganizationMembers, OrganizationMember, OrganizationInvitation } from '../../actions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'

const PAGE_SIZE = 100

const roleOptions: ComboboxOption[] = [
  { value: "member", label: "Member" },
  { value: "owner", label: "Owner" }
]

// Member actions dropdown component
function MemberActionsDropdown({ 
  member, 
  isOwner, 
  isUpdating, 
  onRemoveMember 
}: { 
  member: OrganizationMember
  isOwner: boolean
  isUpdating: boolean
  onRemoveMember: (membershipId: string) => void
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`p-0 cursor-pointer transition-colors duration-75 ${
            isDropdownOpen 
              ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
              : 'hover:bg-[var(--color-interactive-surface-hover)]'
          }`}
          style={{ height: '32px', width: '32px' }}
          disabled={isOwner || isUpdating}
        >
          <DotsThree 
            size={16} 
            style={{ color: isOwner ? '#B5B7C4' : undefined }}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onRemoveMember(member.membership_id)}
          style={{ color: 'var(--color-red-11)' }}
        >
          <UserMinus 
            size={16} 
            style={{ color: 'var(--color-red-11)' }}
          />
          Remove member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// Invitation actions dropdown component
function InvitationActionsDropdown({ 
  invitation, 
  onResendInvite, 
  onCancelInvite 
}: { 
  invitation: OrganizationInvitation
  onResendInvite: (invitationId: string) => void
  onCancelInvite: (invitationId: string) => void
}) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={`p-0 cursor-pointer transition-colors duration-75 ${
            isDropdownOpen 
              ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
              : 'hover:bg-[var(--color-interactive-surface-hover)]'
          }`}
          style={{ height: '32px', width: '32px' }}
        >
          <DotsThree size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => onResendInvite(invitation.id)}
        >
          <EnvelopeSimple size={16} />
          Resend invite
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onCancelInvite(invitation.id)}
          style={{ color: 'var(--color-red-11)' }}
        >
          <XCircle 
            size={16} 
            style={{ color: 'var(--color-red-11)' }}
          />
          Cancel invite
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type UnifiedMemberItem = 
  | ({ type: 'member' } & OrganizationMember & { id: string })
  | ({ type: 'invitation' } & OrganizationInvitation & { id: string })

interface MembersTableProps {
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  organizationId: string
  currentUserRole: 'owner' | 'member'
  parentRef?: React.RefObject<HTMLDivElement | null>
  unfilteredTotalCount?: number
  isBootstrapping?: boolean
  onLoadMore?: (virtualRows: any[]) => void
  hasNextPage?: boolean
  isLoading?: boolean
  headerOffset?: number
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onInviteClick?: () => void
}

const MembersTable = forwardRef<{ openInviteDialog: () => void }, MembersTableProps>(function MembersTable({ 
  members, 
  invitations, 
  organizationId, 
  currentUserRole,
  parentRef,
  unfilteredTotalCount = 0,
  isBootstrapping = false,
  onLoadMore,
  hasNextPage = false,
  isLoading = false,
  headerOffset = 0,
  searchQuery: externalSearchQuery = '',
  onSearchChange,
  onInviteClick: externalOnInviteClick
}, ref) {
  const [internalSearchQuery, setInternalSearchQuery] = useState('')
  const searchQuery = externalSearchQuery || internalSearchQuery
  const setSearchQuery = onSearchChange || setInternalSearchQuery
  const [localMembers, setLocalMembers] = useState(members)
  const [localInvitations, setLocalInvitations] = useState(invitations)
  
  // Sync local state when props change (e.g., when new members/invitations are added)
  useEffect(() => {
    setLocalMembers(members)
  }, [members])
  
  useEffect(() => {
    setLocalInvitations(invitations)
  }, [invitations])
  
  // Server-side search is now handled by the API
  // Combine members and invitations into unified array
  // Members first (sorted alphabetically by name), then invitations (sorted alphabetically by email)
  // Prefix IDs to ensure uniqueness and prevent collisions
  const unifiedItems = useMemo<UnifiedMemberItem[]>(() => {
    // Sort members alphabetically by first_name + last_name
    const memberItems: UnifiedMemberItem[] = localMembers
      .map(member => ({
        type: 'member' as const,
        ...member,
        id: `member-${member.membership_id}` // Prefix to ensure uniqueness
      }))
      .sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
        return nameA.localeCompare(nameB)
      })
    
    // Sort invitations alphabetically by email
    const invitationItems: UnifiedMemberItem[] = localInvitations
      .map(invitation => ({
        type: 'invitation' as const,
        ...invitation,
        id: `invitation-${invitation.id}` // Prefix to ensure uniqueness
      }))
      .sort((a, b) => {
        return a.invited_email.toLowerCase().localeCompare(b.invited_email.toLowerCase())
      })
    
    // Members first, then invitations at the bottom
    return [...memberItems, ...invitationItems]
  }, [localMembers, localInvitations])
  
  const memberCount = unifiedItems.length
  
  // Determine if current user can manage roles (only owners can)
  const canManageRoles = currentUserRole === 'owner'
  
  // Guarded load more callback
  const guardedLoadMore = useCallback(
    (virtualRows: any[]) => {
      if (!hasNextPage || isLoading) return
      onLoadMore?.(virtualRows)
    },
    [hasNextPage, isLoading, onLoadMore],
  )
  
  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems } = useVirtualTable({
    items: unifiedItems,
    onLoadMore: guardedLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // Empty state logic: ONLY show empty state when no members exist at all
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0
  
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<{membershipId: string, memberName: string} | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{membershipId: string, memberName: string} | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [emailValidationError, setEmailValidationError] = useState<string>('')

  const handleInviteClick = () => {
    setInviteDialogOpen(true)
  }

  // Expose method to open invite dialog via ref
  useImperativeHandle(ref, () => ({
    openInviteDialog: () => {
      setInviteDialogOpen(true)
    }
  }))

  // Validate emails against existing invitations and active members
  const validateEmails = (emails: string[]) => {
    const existingInvitationEmails = localInvitations.map(inv => inv.invited_email.toLowerCase())
    const existingMemberEmails = localMembers.map(member => member.email.toLowerCase())
    
    const duplicateInvitations = emails.filter(email => 
      existingInvitationEmails.includes(email.toLowerCase())
    )
    
    const duplicateMembers = emails.filter(email => 
      existingMemberEmails.includes(email.toLowerCase())
    )
    
    if (duplicateInvitations.length > 0) {
      setEmailValidationError(`Already invited: ${duplicateInvitations.join(', ')}`)
      return false
    }
    
    if (duplicateMembers.length > 0) {
      setEmailValidationError(`Already a member: ${duplicateMembers.join(', ')}`)
      return false
    }
    
    setEmailValidationError('')
    return true
  }

  // Handle email changes (no real-time validation)
  const handleEmailChange = (emails: string[]) => {
    setInviteEmails(emails)
    // Clear any existing validation errors when user changes input
    setEmailValidationError('')
  }

  const handleRoleChange = async (membershipId: string, newRole: string) => {
    if (newRole === 'owner') {
      // Find the member being promoted to owner
      const member = localMembers.find(m => m.membership_id === membershipId)
      if (member) {
        setPendingTransfer({ membershipId, memberName: `${member.first_name} ${member.last_name}` })
        setTransferDialogOpen(true)
        return // Don't update yet, wait for confirmation
      }
    }
    
    setIsUpdating(true)
    try {
      const result = await updateMemberRole({
        membershipId,
        newRole,
        organizationId
      })
      
      if (result.ok) {
        // Update local state
        setLocalMembers(prev => {
          const updatedMembers = prev.map(member => {
            if (member.membership_id === membershipId) {
              return { ...member, effective_role: newRole }
            }
            // If assigning someone as Owner, make the current owner a Member
            if (newRole === 'owner' && member.effective_role === 'owner') {
              return { ...member, effective_role: 'member' }
            }
            return member
          })
          return updatedMembers
        })
        
        toast.success('Member role updated successfully')
      } else {
        toast.error(result.message || 'Failed to update member role')
      }
    } catch (error) {
      console.error('Error updating member role:', error)
      toast.error('Failed to update member role')
    } finally {
      setIsUpdating(false)
    }
  }

  const confirmOwnershipTransfer = async () => {
    if (pendingTransfer) {
      setIsUpdating(true)
      try {
        const result = await updateMemberRole({
          membershipId: pendingTransfer.membershipId,
          newRole: 'owner',
          organizationId
        })
        
        if (result.ok) {
        // Update local state
        setLocalMembers(prev => {
          const updatedMembers = prev.map(member => {
            if (member.membership_id === pendingTransfer.membershipId) {
              return { ...member, effective_role: 'owner' }
            }
            // Make the current owner a Member
            if (member.effective_role === 'owner') {
              return { ...member, effective_role: 'member' }
            }
            return member
          })
          return updatedMembers
        })
          
          toast.success(`Ownership transferred to ${pendingTransfer.memberName}`)
        } else {
          toast.error(result.message || 'Failed to transfer ownership')
        }
      } catch (error) {
        console.error('Error transferring ownership:', error)
        toast.error('Failed to transfer ownership')
      } finally {
        setIsUpdating(false)
      }
    }
    setTransferDialogOpen(false)
    setPendingTransfer(null)
  }

  const handleRemoveMember = (prefixedId: string) => {
    // Extract membership_id from prefixed ID
    const membershipId = prefixedId.startsWith('member-') 
      ? prefixedId.replace('member-', '')
      : prefixedId
    const member = localMembers.find(m => m.membership_id === membershipId)
    if (member) {
      setPendingRemove({ membershipId, memberName: `${member.first_name} ${member.last_name}` })
      setRemoveDialogOpen(true)
    }
  }

  const confirmRemoveMember = async () => {
    if (pendingRemove) {
      setIsUpdating(true)
      try {
        const result = await removeMember({
          membershipId: pendingRemove.membershipId,
          organizationId
        })
        
        if (result.ok) {
          // Refresh members data from server to get updated list
          try {
            const membersResult = await getOrganizationMembers(organizationId, { limit: PAGE_SIZE, offset: 0 })
            if (membersResult.ok) {
              setLocalMembers(membersResult.data || [])
            }
          } catch (error) {
            console.error('Failed to refresh members:', error)
            // Fallback to local state update
            setLocalMembers(prev => prev.filter(member => member.membership_id !== pendingRemove.membershipId))
          }
          toast.success(`${pendingRemove.memberName} has been removed`)
        } else {
          toast.error(result.message || 'Failed to remove member')
        }
      } catch (error) {
        console.error('Error removing member:', error)
        toast.error('Failed to remove member')
      } finally {
        setIsUpdating(false)
      }
    }
    setRemoveDialogOpen(false)
    setPendingRemove(null)
  }

  const handleResendInvite = async (prefixedId: string) => {
    // Extract invitation.id from prefixed ID
    const invitationId = prefixedId.startsWith('invitation-')
      ? prefixedId.replace('invitation-', '')
      : prefixedId
    try {
      const result = await resendInvitation({
        invitationId,
        organizationId
      })

      if (result.ok) {
        toast.success('Invitation resent successfully')
        // Update the local invitation with new expiry date
        setLocalInvitations(prev => 
          prev.map(invitation => 
            invitation.id === invitationId 
              ? { ...invitation, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
              : invitation
          )
        )
      } else {
        toast.error(result.message || 'Failed to resend invitation')
      }
    } catch (error) {
      console.error('Error resending invitation:', error)
      toast.error('Failed to resend invitation')
    }
  }

  const handleCancelInvite = async (prefixedId: string) => {
    // Extract invitation.id from prefixed ID
    const invitationId = prefixedId.startsWith('invitation-')
      ? prefixedId.replace('invitation-', '')
      : prefixedId
    
    // Find the invitation to restore if the request fails
    const invitationToRestore = localInvitations.find(inv => inv.id === invitationId)
    
    // Optimistically remove the invitation from local state
    setLocalInvitations(prev => prev.filter(invitation => invitation.id !== invitationId))
    
    try {
      const result = await cancelInvitation({
        invitationId,
        organizationId
      })

      if (result.ok) {
        toast.success('Invitation canceled successfully')
      } else {
        // Rollback: restore the invitation if the request failed
        if (invitationToRestore) {
          setLocalInvitations(prev => [...prev, invitationToRestore].sort((a, b) => 
            a.invited_email.toLowerCase().localeCompare(b.invited_email.toLowerCase())
          ))
        }
        toast.error(result.message || 'Failed to cancel invitation')
      }
    } catch (error) {
      // Rollback: restore the invitation if the request failed
      if (invitationToRestore) {
        setLocalInvitations(prev => [...prev, invitationToRestore].sort((a, b) => 
          a.invited_email.toLowerCase().localeCompare(b.invited_email.toLowerCase())
        ))
      }
      console.error('Error canceling invitation:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  const handleMemberClick = (member: OrganizationMember) => {
    setSelectedMember(member)
    setProfileDialogOpen(true)
  }

  const handleInviteEmails = async () => {
    if (inviteEmails.length === 0) {
      toast.error('Please enter at least one email address')
      return
    }

    // Validate emails before sending
    if (!validateEmails(inviteEmails)) {
      return
    }

    setIsInviting(true)
    try {
      const result = await inviteMembers({
        organizationId,
        emails: inviteEmails
      })

      if (result.ok) {
        toast.success(result.message || 'Invitations sent successfully')
        setInviteDialogOpen(false)
        setInviteEmails([])
        setEmailValidationError('')
        // Refresh invitations data from server
        try {
          const invitationsResult = await getOrganizationInvitations(organizationId, { limit: PAGE_SIZE, offset: 0 })
          if (invitationsResult.ok) {
            setLocalInvitations(invitationsResult.data || [])
          }
        } catch (error) {
          console.error('Failed to refresh invitations:', error)
        }
      } else {
        toast.error(result.message || 'Failed to send invitations')
      }
    } catch (error) {
      console.error('Error sending invitations:', error)
      toast.error('Failed to send invitations')
    } finally {
      setIsInviting(false)
    }
  }

  // Render function for virtual table rows
  const renderRow = (item: UnifiedMemberItem) => {
    if (item.type === 'member') {
      const member = item
      const fullName = `${member.first_name} ${member.last_name}`
      const isOwner = member.effective_role === 'owner'
      
      return (
        <>
          <TableCell className="w-[33.33%] py-0 pointer-events-auto">
            <ListRow
              avatar={true}
              avatarUrl={member.avatar_url}
              text={fullName}
              actions={false}
              variant="stacked"
              onClick={() => handleMemberClick(member)}
            />
          </TableCell>
          <TableCell className="w-[33.33%] py-0">
            <div className="flex items-center">
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                {member.email}
              </span>
            </div>
          </TableCell>
          <TableCell className="w-[33.33%] py-0 pointer-events-auto">
            <Combobox
              options={isOwner ? [{ value: "owner", label: "Owner" }] : roleOptions}
              value={member.effective_role}
              onValueChange={(value) => handleRoleChange(member.membership_id, value)}
              placeholder="Select role..."
              searchPlaceholder=""
              emptyText="No role found."
              readOnly={isOwner || isUpdating || !canManageRoles}
              className="w-full"
              style={{ 
                height: '32px',
                width: '100%',
                minWidth: '100%',
                maxWidth: '100%'
              }}
            />
          </TableCell>
          {canManageRoles && (
            <TableCell className="w-[44px] p-0 pointer-events-auto">
              <MemberActionsDropdown 
                member={member}
                isOwner={isOwner}
                isUpdating={isUpdating}
                onRemoveMember={() => handleRemoveMember(item.id)}
              />
            </TableCell>
          )}
        </>
      )
    } else {
      // Invitation
      const invitation = item
      return (
        <>
          <TableCell className="w-[33.33%] py-0">
            <ListRow
              avatar={true}
              text="—"
              actions={false}
              variant="stacked"
              className="pointer-events-none hover:bg-transparent cursor-default"
            />
          </TableCell>
          <TableCell className="w-[33.33%] py-0">
            <div className="flex items-center gap-3">
              <span className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                {invitation.invited_email}
              </span>
              <Badge 
                variant="outline" 
                className="text-xs border-0"
                style={{
                  borderRadius: 'var(--radius-1-max)',
                  backgroundColor: 'var(--color-semantic-info-3)',
                  color: 'var(--color-semantic-info-11)'
                }}
              >
                Invited
              </Badge>
            </div>
          </TableCell>
          <TableCell className="w-[33.33%] py-0 pointer-events-auto">
            <Combobox
              options={[{ value: "member", label: "Member" }]}
              value={invitation.role}
              onValueChange={() => {}} // Disabled for invitations
              placeholder="Select role..."
              searchPlaceholder=""
              emptyText="No role found."
              readOnly={true}
              className="w-full"
              style={{ 
                height: '32px',
                width: '100%',
                minWidth: '100%',
                maxWidth: '100%'
              }}
            />
          </TableCell>
          {canManageRoles && (
            <TableCell className="w-[44px] p-0 pointer-events-auto">
              <InvitationActionsDropdown 
                invitation={invitation}
                onResendInvite={() => handleResendInvite(item.id)}
                onCancelInvite={() => handleCancelInvite(item.id)}
              />
            </TableCell>
          )}
        </>
      )
    }
  }

  // Empty state component matching other tables
  const emptyState = isEmptyState ? (
    <TableRow 
      className="hover:bg-transparent"
      style={{ 
        backgroundColor: 'var(--color-base-surface-page-background)', 
        borderBottomColor: 'var(--color-neutral-5)',
        height: '100%'
      }}
    >
      <TableCell 
        colSpan={canManageRoles ? 4 : 3} 
        className="text-left" 
        style={{ height: 'calc(100vh - 352px)', minHeight: '400px', paddingLeft: '120px' }}
      >
        <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
          <div className="flex flex-col items-start gap-2">
            <h2 className="display-8-medium">Your team starts here</h2>
            <span className="text-sm-regular text-neutral-11">
              Invite team members to collaborate and manage your organization together.
            </span>
          </div>
          {canManageRoles && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
              onClick={handleInviteClick}
            >
              <Plus size={16} weight="regular" />
              Invite members
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  ) : null

  // Column layout matching header for proper alignment
  const columnLayout = useMemo(() => (
    <colgroup>
      <col className="w-[33.33%]" />
      <col className="w-[33.33%]" />
      <col className="w-[33.33%]" />
      {canManageRoles && <col className="w-[44px]" />}
    </colgroup>
  ), [canManageRoles])

  return (
    <div className="w-full min-w-0">
      {/* Table Header - Sticky */}
      {(unfilteredTotalCount > 0 || searchQuery.trim().length > 0) && (
        <div 
          className="sticky z-10 bg-[var(--color-base-surface-page-background)]"
          style={{ top: headerOffset }}
        >
          <Table className="table-fixed w-full border-collapse">
            {columnLayout}
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[33.33%] text-xs-medium text-[var(--color-base-text-tertiary)]">Name</TableHead>
                <TableHead className="w-[33.33%] text-xs-medium text-[var(--color-base-text-tertiary)]">Email</TableHead>
                <TableHead className="w-[33.33%] text-xs-medium text-[var(--color-base-text-tertiary)]">Role</TableHead>
                {canManageRoles && (
                  <TableHead className="w-[44px] p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
          </Table>
        </div>
      )}

      {/* Table Body - Virtualized Scrollable */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        {/* During initial bootstrap, suppress empty-state flash with skeleton block */}
        {isBootstrapping && unifiedItems.length === 0 ? (
          <div className="px-5 py-2">
            <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
          </div>
        ) : (
          <VirtualTableBody
            items={unifiedItems}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            emptyState={emptyState}
            renderRow={renderRow}
            rowClassName="hover:bg-transparent pointer-events-none"
            colGroup={columnLayout}
          />
        )}
      </div>

      {/* Ownership Transfer Dialog */}
      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Transfer ownership to {pendingTransfer?.memberName}?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            You&apos;ll be downgraded to a member and lose access to billing, user management, and ownership settings. Only the new owner can transfer it back.
          </DialogDescription>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setTransferDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmOwnershipTransfer}
              style={{ height: '40px' }}
              className="cursor-pointer relative"
              disabled={isUpdating}
            >
              <span className={isUpdating ? "invisible" : ""}>Transfer</span>
              {isUpdating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={16} />
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeDialogOpen} onOpenChange={setRemoveDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Remove {pendingRemove?.memberName}?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            This will permanently remove their account. They won&apos;t be able to sign in, but any work and activity will remain visible. If you invite them back, they&apos;ll need to sign up again.
          </DialogDescription>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setRemoveDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
              disabled={isUpdating}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmRemoveMember}
              style={{ height: '40px' }}
              className="cursor-pointer relative"
              disabled={isUpdating}
            >
              <span className={isUpdating ? "invisible" : ""}>Remove</span>
              {isUpdating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={16} />
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Members Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Invite members
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            Add team members to your agency account. They&apos;ll receive an email with a link to join.
          </DialogDescription>
          <div style={{ marginTop: '12px' }}>
            <MultiEmailInput
              placeholder="Enter email addresses..."
              onChange={handleEmailChange}
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
                setEmailValidationError('')
                setInviteEmails([])
              }}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleInviteEmails}
              style={{ height: '40px' }}
              className="cursor-pointer relative"
              disabled={isInviting}
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

      {/* Profile Card Dialog */}
      {selectedMember && (
        <ProfileCard
          member={selectedMember}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false)
            setSelectedMember(null)
          }}
        />
      )}
    </div>
  )
})

export default MembersTable

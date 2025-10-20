"use client"

import { useState } from 'react'
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
import { DotsThree, UserMinus, EnvelopeSimple, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateMemberRole, removeMember, inviteMembers, resendInvitation, cancelInvitation, getOrganizationInvitations, getOrganizationMembers, OrganizationMember, OrganizationInvitation } from '../../actions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

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

interface MembersTableProps {
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  organizationId: string
  currentUserRole: 'owner' | 'member'
}

export default function MembersTable({ members, invitations, organizationId, currentUserRole }: MembersTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [localMembers, setLocalMembers] = useState(members)
  const [localInvitations, setLocalInvitations] = useState(invitations)
  
  // Filter and sort members based on search query
  const filteredAndSortedMembers = localMembers
    .filter(member => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      const fullName = `${member.first_name} ${member.last_name}`.toLowerCase()
      return (
        fullName.includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.effective_role.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by name
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase()
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase()
      return nameA.localeCompare(nameB)
    })

  // Filter invitations based on search query
  const filteredInvitations = localInvitations
    .filter(invitation => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        invitation.invited_email.toLowerCase().includes(query) ||
        invitation.role.toLowerCase().includes(query) ||
        'invited'.includes(query)
      )
    })
    .sort((a, b) => {
      // Sort by email
      return a.invited_email.toLowerCase().localeCompare(b.invited_email.toLowerCase())
    })
  
  const memberCount = filteredAndSortedMembers.length + filteredInvitations.length
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

  // Determine if current user can manage roles (only owners can)
  const canManageRoles = currentUserRole === 'owner'

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

  const handleRemoveMember = (membershipId: string) => {
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
            const membersResult = await getOrganizationMembers(organizationId)
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


  const handleInviteClick = () => {
    setInviteDialogOpen(true)
  }

  const handleResendInvite = async (invitationId: string) => {
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

  const handleCancelInvite = async (invitationId: string) => {
    try {
      const result = await cancelInvitation({
        invitationId,
        organizationId
      })

      if (result.ok) {
        toast.success('Invitation canceled successfully')
        // Remove the invitation from the local state since it's now expired
        setLocalInvitations(prev => prev.filter(invitation => invitation.id !== invitationId))
      } else {
        toast.error(result.message || 'Failed to cancel invitation')
      }
    } catch (error) {
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
          const invitationsResult = await getOrganizationInvitations(organizationId)
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

  return (
    <div className="w-full">
      {/* Search section */}
      <div style={{ marginTop: '40px' }}>
        <div className="flex items-center justify-between w-full">
          <SearchInput
            placeholder="Search members"
            value={searchQuery}
            onChange={setSearchQuery}
            count={memberCount}
            countLabel={memberCount === 1 ? 'member' : 'members'}
          />
          {canManageRoles && (
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm"
              onClick={handleInviteClick}
            >
              Invite
            </Button>
          )}
        </div>
      </div>

      {/* Table section */}
      <div style={{ marginTop: '16px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33.33%' }}>Name</TableHead>
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33.33%' }}>Email</TableHead>
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33.33%' }}>Role</TableHead>
              {canManageRoles && <TableHead style={{ width: 'auto' }}></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMembers.map((member) => {
              const fullName = `${member.first_name} ${member.last_name}`
              const isOwner = member.effective_role === 'owner'
              
              return (
                <TableRow key={member.membership_id} style={{ height: '44px' }} className="[&>*]:h-[44px] hover:bg-transparent">
                  <TableCell className="py-0" style={{ width: '33.33%' }}>
                    <ListRow
                      avatar={true}
                      avatarUrl={member.avatar_url}
                      text={fullName}
                      actions={false}
                      variant="stacked"
                      onClick={() => handleMemberClick(member)}
                    />
                  </TableCell>
                  <TableCell className="py-0" style={{ width: '33.33%' }}>
                    <div className="flex items-center">
                      <span className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                        {member.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-0" style={{ width: '33.33%' }}>
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
                    <TableCell className="py-0" style={{ width: 'auto' }}>
                      <MemberActionsDropdown 
                        member={member}
                        isOwner={isOwner}
                        isUpdating={isUpdating}
                        onRemoveMember={handleRemoveMember}
                      />
                    </TableCell>
                  )}
                </TableRow>
              )
            })}
            
            {/* Invited members */}
            {filteredInvitations.map((invitation) => (
              <TableRow key={`invitation-${invitation.id}`} style={{ height: '44px' }} className="[&>*]:h-[44px] hover:bg-transparent">
                <TableCell className="py-0" style={{ width: '33.33%' }}>
                  <ListRow
                    avatar={true}
                    text="—"
                    actions={false}
                    variant="stacked"
                    className="pointer-events-none hover:bg-transparent cursor-default"
                  />
                </TableCell>
                <TableCell className="py-0" style={{ width: '33.33%' }}>
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
                <TableCell className="py-0" style={{ width: '33.33%' }}>
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
                  <TableCell className="py-0" style={{ width: 'auto' }}>
                    <InvitationActionsDropdown 
                      invitation={invitation}
                      onResendInvite={handleResendInvite}
                      onCancelInvite={handleCancelInvite}
                    />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
}

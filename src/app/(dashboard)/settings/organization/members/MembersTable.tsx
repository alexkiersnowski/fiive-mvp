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
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MagnifyingGlass, DotsThree, UserMinus, EnvelopeSimple, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateMemberRole, removeMember, OrganizationMember } from '../../actions'

const roleOptions: ComboboxOption[] = [
  { value: "member", label: "Member" },
  { value: "owner", label: "Owner" }
]

interface MembersTableProps {
  members: OrganizationMember[]
  organizationId: string
}

export default function MembersTable({ members, organizationId }: MembersTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [localMembers, setLocalMembers] = useState(members)
  
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
  
  const memberCount = filteredAndSortedMembers.length
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<{membershipId: string, memberName: string} | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{membershipId: string, memberName: string} | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<OrganizationMember | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

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
          // Update local state
          setLocalMembers(prev => prev.filter(member => member.membership_id !== pendingRemove.membershipId))
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

  const handleResendInvite = (memberId: string) => {
    // TODO: Implement resend invite logic
    console.log('Resending invite for member:', memberId)
    toast.success('Invitation resent')
  }

  const handleCancelInvite = (memberId: string) => {
    // TODO: Implement cancel invite logic
    console.log('Canceling invite for member:', memberId)
    // Remove the invited member from the list
    setLocalMembers(prev => prev.filter(member => member.id !== memberId))
    toast.success('Invitation cancelled')
  }

  const handleInviteClick = () => {
    setInviteDialogOpen(true)
  }

  const handleMemberClick = (member: OrganizationMember) => {
    setSelectedMember(member)
    setProfileDialogOpen(true)
  }

  const handleInviteEmails = () => {
    if (inviteEmails.length > 0) {
      // TODO: Implement actual invite logic
      // For now, just show success message
      const invitationCount = inviteEmails.length
      const message = invitationCount === 1 
        ? '1 invitation sent successfully' 
        : `${invitationCount} invitations sent successfully`
      
      toast.success(message)
    }
    setInviteDialogOpen(false)
    setInviteEmails([])
  }

  return (
    <div className="w-full">
      {/* Search section */}
      <div style={{ marginTop: '40px' }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Input 
                placeholder="Search members"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-[32px] px-4 py-2 text-sm pl-10"
                style={{ width: '360px' }}
              />
              <MagnifyingGlass 
                size={16} 
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
            </div>
            <span className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </span>
          </div>
          <Button
            variant="default"
            size="lg"
            className="cursor-pointer text-sm"
            onClick={handleInviteClick}
          >
            Invite
          </Button>
        </div>
      </div>

      {/* Table section */}
      <div style={{ marginTop: '16px' }}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33%' }}>Name</TableHead>
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33%' }}>Email</TableHead>
              <TableHead className="text-xs-medium" style={{ color: 'var(--color-base-text-tertiary)', width: '33%' }}>Role</TableHead>
              <TableHead style={{ width: 'auto' }}></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedMembers.map((member) => {
              const fullName = `${member.first_name} ${member.last_name}`
              const isOwner = member.effective_role === 'owner'
              
              return (
                <TableRow key={member.membership_id} style={{ height: '44px' }} className="[&>*]:h-[44px] hover:bg-transparent">
                  <TableCell className="py-0" style={{ width: '33.33%' }}>
                    <div 
                      className="flex items-center p-1 transition-all duration-75 cursor-pointer hover:bg-[var(--color-interactive-surface-hover)]"
                      style={{ borderRadius: 'calc(var(--radius) - 2px)' }}
                      onClick={() => handleMemberClick(member)}
                    >
                      {/* Avatar */}
                      <div className="flex-shrink-0 mr-3">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={member.avatar_url} alt={fullName} />
                          <AvatarFallback className="text-xs font-medium">
                            {member.first_name[0]}{member.last_name[0]}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      
                      {/* Name */}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
                          {fullName}
                        </span>
                      </div>
                    </div>
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
                      readOnly={isOwner || isUpdating}
                      className="w-full"
                      style={{ 
                        height: '32px',
                        width: '100%',
                        minWidth: '100%',
                        maxWidth: '100%'
                      }}
                    />
                  </TableCell>
                  <TableCell className="py-0" style={{ width: 'auto' }}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="p-0 cursor-pointer" 
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
                          onClick={() => handleRemoveMember(member.membership_id)}
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
                  </TableCell>
                </TableRow>
              )
            })}
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
              className="cursor-pointer"
              disabled={isUpdating}
            >
              {isUpdating ? 'Transferring...' : 'Transfer'}
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
            This will immediately revoke their access. They won&apos;t be able to sign in, but any work or activity will remain visible. You can re-invite them at any time.
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
              className="cursor-pointer"
              disabled={isUpdating}
            >
              {isUpdating ? 'Removing...' : 'Remove'}
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
              onChange={setInviteEmails}
            />
          </div>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setInviteDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleInviteEmails}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Invite
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

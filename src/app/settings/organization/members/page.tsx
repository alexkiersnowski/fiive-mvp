"use client"

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { ListRow } from '@/components/ui/list-row'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { MultiEmailInput } from '@/components/ui/multi-email-input'
import { Badge } from '@/components/ui/badge'
import { ProfileCard } from '@/components/ui/profile-card'
import { MagnifyingGlass, DotsThree, UserMinus, EnvelopeSimple, XCircle } from '@phosphor-icons/react'
import { toast } from 'sonner'

const roleOptions: ComboboxOption[] = [
  { value: "Member", label: "Member" },
  { value: "Owner", label: "Owner" }
]

const mockMembers = [
  { id: '1', name: 'Alex Carter', email: 'alex.carter@exastudio.com', role: 'Member', status: 'active' },
  { id: '2', name: 'Jess Harris', email: 'jess.harris@exastudio.com', role: 'Member', status: 'active' },
  { id: '3', name: 'Jon Davis', email: 'jon.davis@exastudio.com', role: 'Member', status: 'active' },
  { id: '4', name: 'Kai Navarro', email: 'kai.navarro@exastudio.com', role: 'Member', status: 'active' },
  { id: '5', name: 'Leo Silva', email: 'leo.silva@exastudio.com', role: 'Member', status: 'active' },
  { id: '6', name: 'Maya Brooks', email: 'maya.brooks@exastudio.com', role: 'Member', status: 'active' },
  { id: '7', name: 'Noah Gray', email: 'noah.gray@exastudio.com', role: 'Member', status: 'active' },
  { id: '8', name: 'Sienna Torres', email: 'sienna.torres@exastudio.com', role: 'Member', status: 'active' },
  { id: '9', name: 'Zen Rae', email: 'zen.rae@exastudio.com', role: 'Owner', status: 'active' }
]

export default function UserManagementPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [members, setMembers] = useState(mockMembers)
  
  // Filter and sort members based on search query
  const filteredAndSortedMembers = members
    .filter(member => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        member.name.toLowerCase().includes(query) ||
        member.email.toLowerCase().includes(query) ||
        member.role.toLowerCase().includes(query)
      )
    })
    .sort((a, b) => {
      // Sort active members by name, invited members by email
      if (a.status === 'invited' && b.status === 'invited') {
        return a.email.localeCompare(b.email)
      } else if (a.status === 'invited') {
        return a.email.localeCompare(b.name)
      } else if (b.status === 'invited') {
        return a.name.localeCompare(b.email)
      } else {
        return a.name.localeCompare(b.name)
      }
    })
  
  const memberCount = filteredAndSortedMembers.length
  const [transferDialogOpen, setTransferDialogOpen] = useState(false)
  const [pendingTransfer, setPendingTransfer] = useState<{memberId: string, memberName: string} | null>(null)
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<{memberId: string, memberName: string} | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmails, setInviteEmails] = useState<string[]>([])
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<{name: string, email: string, role: string} | null>(null)

  const handleRoleChange = (memberId: string, newRole: string) => {
    if (newRole === 'Owner') {
      // Find the member being promoted to owner
    const member = members.find(m => m.id === memberId)
      if (member) {
        setPendingTransfer({ memberId, memberName: member.name })
      setTransferDialogOpen(true)
        return // Don't update yet, wait for confirmation
      }
    }
    
    // For non-owner role changes, update immediately
    setMembers(prev => {
      const updatedMembers = prev.map(member => {
        if (member.id === memberId) {
          return { ...member, role: newRole }
        }
        // If assigning someone as Owner, make the current owner a Member
        if (newRole === 'Owner' && member.role === 'Owner') {
          return { ...member, role: 'Member' }
        }
        return member
      })
      return updatedMembers
    })
  }

  const confirmOwnershipTransfer = () => {
    if (pendingTransfer) {
      setMembers(prev => {
        const updatedMembers = prev.map(member => {
          if (member.id === pendingTransfer.memberId) {
            return { ...member, role: 'Owner' }
          }
          // Make the current owner a Member
          if (member.role === 'Owner') {
            return { ...member, role: 'Member' }
          }
          return member
        })
        return updatedMembers
      })
      
      // Show success toast with new owner's name
      toast.success(`Ownership transferred to ${pendingTransfer.memberName}`)
    }
    setTransferDialogOpen(false)
    setPendingTransfer(null)
  }

  const handleRemoveMember = (memberId: string) => {
    const member = members.find(m => m.id === memberId)
    if (member) {
      setPendingRemove({ memberId, memberName: member.name })
          setRemoveDialogOpen(true)
    }
  }

  const confirmRemoveMember = () => {
    if (pendingRemove) {
      setMembers(prev => prev.filter(member => member.id !== pendingRemove.memberId))
      
      // Show success toast with removed member's name
      toast.success(`${pendingRemove.memberName} has been removed`)
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
    setMembers(prev => prev.filter(member => member.id !== memberId))
    toast.success('Invitation cancelled')
  }

  const handleInviteClick = () => {
    setInviteDialogOpen(true)
  }

  const handleMemberClick = (member: {name: string, email: string, role: string}) => {
    setSelectedMember(member)
    setProfileDialogOpen(true)
  }

  const handleInviteEmails = () => {
    if (inviteEmails.length > 0) {
      // Add invited members to the table
      const newInvitedMembers = inviteEmails.map(email => ({
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        name: '—',
        email: email,
        role: 'Member',
        status: 'invited'
      }))
      
      setMembers(prev => [...prev, ...newInvitedMembers])
      
      // Show success toast with number of invitations
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
              {memberCount} members
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
            {filteredAndSortedMembers.map((member) => (
              <TableRow key={member.id} style={{ height: '44px' }} className="[&>*]:h-[44px] hover:bg-transparent">
                <TableCell className="py-0" style={{ width: '33.33%' }}>
                  <ListRow
                    avatar={true}
                    text={member.name}
                    onClick={() => handleMemberClick({name: member.name, email: member.email, role: member.role})}
                  />
                </TableCell>
                <TableCell className="py-0" style={{ width: '33.33%' }}>
                  <div className="flex items-center">
                    <span className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                      {member.email}
                    </span>
                    {member.status === 'invited' && (
                        <Badge 
                          variant="outline" 
                          className="text-xs-medium flex-shrink-0"
                        style={{
                          borderRadius: 'var(--radius-1-max, 3px)',
                          background: 'var(--color-semantic-info-alpha-3, rgba(0, 179, 238, 0.12))',
                          color: 'var(--color-semantic-info-alpha-11, #00749E)',
                          border: 'none',
                          marginLeft: '12px'
                        }}
                      >
                        Invited
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="py-0" style={{ width: '33.33%' }}>
                    <Combobox
                    options={member.role === 'Owner' ? [{ value: "Owner", label: "Owner" }] : roleOptions}
                      value={member.role}
                    onValueChange={(value) => handleRoleChange(member.id, value)}
                      placeholder="Select role..."
                      searchPlaceholder=""
                      emptyText="No role found."
                    readOnly={member.role === 'Owner' || member.status === 'invited'}
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
                        disabled={member.role === 'Owner'}
                      >
                        <DotsThree 
                          size={16} 
                          style={{ color: member.role === 'Owner' ? '#B5B7C4' : undefined }}
                        />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {member.status === 'invited' ? (
                        <>
                          <DropdownMenuItem onClick={() => handleResendInvite(member.id)}>
                            <EnvelopeSimple 
                              size={16} 
                              style={{ color: 'var(--color-base-icons-primary)' }}
                            />
                            Resend invite
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleCancelInvite(member.id)}
                            style={{ color: 'var(--color-red-11)' }}
                          >
                            <XCircle 
                              size={16} 
                              style={{ color: 'var(--color-red-11)' }}
                            />
                            Cancel invitation
                          </DropdownMenuItem>
                        </>
                      ) : (
                        <DropdownMenuItem
                          onClick={() => handleRemoveMember(member.id)}
                          style={{ color: 'var(--color-red-11)' }}
                        >
                          <UserMinus 
                            size={16} 
                            style={{ color: 'var(--color-red-11)' }}
                          />
                          Remove member
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
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
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmOwnershipTransfer}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Transfer
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
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmRemoveMember}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Remove
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
          user={{
            name: selectedMember.name,
            email: selectedMember.email
          }}
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

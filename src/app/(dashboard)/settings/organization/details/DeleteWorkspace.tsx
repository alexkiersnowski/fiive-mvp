"use client"

import * as React from "react"
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { deleteWorkspace } from '../../actions'

interface DeleteWorkspaceProps {
  canDeleteWorkspace: boolean
  organizationName: string
  organizationId: string
}

export default function DeleteWorkspace({ canDeleteWorkspace, organizationName, organizationId }: DeleteWorkspaceProps) {
  const router = useRouter()
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  const [deleteKeywordConfirmation, setDeleteKeywordConfirmation] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Check if both confirmations match (case-sensitive, trimmed)
  const isNameConfirmed = deleteConfirmation.trim() === organizationName.trim()
  const isKeywordConfirmed = deleteKeywordConfirmation.trim() === 'DELETE'
  const isDeleteConfirmed = isNameConfirmed && isKeywordConfirmed

  const handleDeleteWorkspace = async () => {
    // Validate both confirmations
    if (!isDeleteConfirmed) {
      return
    }

    setIsDeleting(true)

    try {
      const result = await deleteWorkspace({ organizationId })

      if (result.ok) {
        // Success - user will be signed out by the server action
        toast.success('Workspace deleted successfully')
        // Redirect to sign-in (user will be signed out)
        router.push('/signin')
      } else {
        // Error - show message and keep dialog open
        toast.error(result.message || 'Failed to delete workspace')
        setIsDeleting(false)
      }
    } catch (error) {
      console.error('Error deleting workspace:', error)
      toast.error('An unexpected error occurred. Please try again.')
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Delete Workspace Component */}
      {/* TODO: Re-enable delete workspace button after Stripe subscriptions + webhooks + cancellation logic are live */}
      <div style={{ marginTop: '80px', maxWidth: '552px' }}>
        <div 
          className="flex items-center p-4 gap-4"
          style={{
            borderRadius: 'var(--radius-4, 8px)',
            border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 47, 0.15))',
            background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))'
          }}
        >
          <div>
            <p className="text-xs-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '4px' }}>
              Delete workspace
            </p>
            {canDeleteWorkspace ? (
              <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
                Permanently delete this workspace and all associated data. This action cannot be undone.
              </p>
            ) : (
              <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
                To permanently delete this workspace and all associated data, please contact Fiive support.
              </p>
            )}
          </div>
          {canDeleteWorkspace && (
            <Button
              variant="outline"
              className="text-sm cursor-pointer"
              style={{
                borderColor: 'var(--color-semantic-destructive-border, #EF4444)',
                color: 'var(--color-semantic-destructive-text, #EF4444)',
                backgroundColor: 'transparent',
                height: '40px'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-semantic-destructive-surface-hover, #FEF2F2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
              }}
              onClick={() => setDeleteDialogOpen(true)}
            >
              Delete workspace
            </Button>
          )}
        </div>
      </div>

      {/* Delete Workspace Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Delete your workspace
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            This will permanently remove your workspace and all associated data. This action cannot be undone.
          </DialogDescription>
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div className="mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Confirm by typing &quot;{organizationName}&quot;
                </label>
              </div>
              <Input
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="h-10 px-4 py-2 text-sm"
                maxLength={255}
              />
            </div>
            <div>
              <div className="mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Confirm by typing &quot;DELETE&quot;
                </label>
              </div>
              <Input
                value={deleteKeywordConfirmation}
                onChange={(e) => setDeleteKeywordConfirmation(e.target.value)}
                className="h-10 px-4 py-2 text-sm"
                maxLength={10}
              />
            </div>
          </div>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => {
                setDeleteDialogOpen(false)
                setDeleteConfirmation('')
                setDeleteKeywordConfirmation('')
              }}
              style={{ height: '40px' }}
              className="cursor-pointer"
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteWorkspace}
              style={{ height: '40px' }}
              className="cursor-pointer relative"
              disabled={!isDeleteConfirmed || isDeleting}
            >
              <span className={isDeleting ? "invisible" : ""}>Delete</span>
              {isDeleting && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={16} />
                </div>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}


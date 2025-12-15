"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { requestEmailChange, deleteOwnAccount } from '../../actions'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'

type Props = {
  userId: string
  currentEmail: string // from auth.getUser() on server
  isOwner: boolean
}

const TTL_MINUTES = 60
const KEY = (uid: string) => `pending-email-change:${uid}`

type Pending = { email: string; ts: number }

const emailSchema = z.object({
  email: z.string().email("Please enter a valid email address")
})

type EmailFormData = z.infer<typeof emailSchema>

export default function AccessForm({ userId, currentEmail, isOwner }: Props) {
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  const [isDeleting, setIsDeleting] = React.useState(false)

  // Restore pending state on mount
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(userId))
      if (!raw) return
      const p = JSON.parse(raw) as Pending
      const ageMin = (Date.now() - p.ts) / 60000
      if (ageMin >= TTL_MINUTES || p.email === currentEmail) {
        localStorage.removeItem(KEY(userId))
      } else {
        setPendingEmail(p.email)
      }
    } catch {}
  }, [userId, currentEmail])

  // If server email changes (verification complete), clear pending
  React.useEffect(() => {
    setPendingEmail(prev => {
      if (prev && prev === currentEmail) {
        localStorage.removeItem(KEY(userId))
        return null
      }
      return prev
    })
  }, [currentEmail, userId])

  // Form defaults to pendingEmail (if any) else currentEmail
  const form = useForm<EmailFormData>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: pendingEmail ?? currentEmail },
    mode: "onSubmit",
  })

  // Keep input in sync if pending changes due to TTL clear or server flip
  React.useEffect(() => {
    form.reset({ email: pendingEmail ?? currentEmail })
  }, [pendingEmail, currentEmail, form])

  const watchedEmail = form.watch("email")?.trim()
  const isSameAsCurrent = watchedEmail === currentEmail
  const isSameAsPending = pendingEmail != null && watchedEmail === pendingEmail
  const isDeleteConfirmed = deleteConfirmation === currentEmail

  // Check if email is valid using Zod schema
  const emailValidation = emailSchema.safeParse({ email: watchedEmail || '' })
  const isEmailValid = emailValidation.success
  const isButtonActive = isEmailValid && !isSameAsCurrent && !isUpdating

  const primaryLabel = isSameAsPending ? "Resend" : "Update"

  const handleSubmit = async (values: { email: string }) => {
    // Allow resend if same as pending, or send if changed & not same as current
    if (isSameAsCurrent) return

    setIsUpdating(true)
    
    try {
      const result = await requestEmailChange({
        userId,
        email: values.email,
      })

      if (result.ok) {
        // Persist pending
        const payload: Pending = { email: values.email, ts: Date.now() }
        localStorage.setItem(KEY(userId), JSON.stringify(payload))
        setPendingEmail(values.email)
        // IMPORTANT: we DO NOT reset back to currentEmail — we keep showing the new one.
        // The switch to the new email happens automatically when auth updates (server).
        
        toast.success("Check your inbox to verify your new email")
      } else {
        if (result.fieldErrors?.email?.[0]) {
          form.setError("email", { message: result.fieldErrors.email[0] })
        } else if (result.message) {
          toast.error(result.message)
        }
      }
    } catch (error) {
      console.error('Error updating email:', error)
      toast.error("Failed to send verification email. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!isDeleteConfirmed) {
      return
    }

    setIsDeleting(true)
    
    try {
      const result = await deleteOwnAccount({ email: deleteConfirmation })
      
      if (result.ok) {
        // Close dialog and reset form
        setDeleteDialogOpen(false)
        setDeleteConfirmation('')
        
        // Show success message
        toast.success("Your account has been deleted successfully")
        
        // Redirect to signin page
        window.location.href = '/signin'
      } else {
        toast.error(result.message || "Failed to delete account. Please try again.")
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error("Failed to delete account. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Account access
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          Manage your access details
        </p>
      </div>

      {/* Form Content */}
      <div className="max-w-[552px] flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 296px)' }}>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
              {/* Email (Fully Editable) */}
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                      Email
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Enter your email address"
                        className="h-10 px-4 py-2 text-sm"
                        maxLength={255}
                        disabled={isUpdating}
                      />
                    </FormControl>
                    <div style={{ marginTop: '8px' }}>
                      <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
                        {pendingEmail && pendingEmail !== currentEmail
                          ? `We've sent an email to ${pendingEmail}. Your email will update after it's verified.`
                          : "This is your login email. We'll send all secure sign-in links to this address."
                        }
                      </p>
                    </div>
                  </FormItem>
                )}
              />

              {/* Save Button */}
              <div className="pt-4" style={{ marginBottom: '80px' }}>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    variant="default"
                    size="lg"
                    className="cursor-pointer text-sm relative"
                    disabled={!isButtonActive}
                  >
                    <span className={isUpdating ? "invisible" : ""}>{primaryLabel}</span>
                    {isUpdating && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Spinner size={16} />
                      </div>
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </div>

        {/* Delete Account Section */}
        <div 
          className="flex justify-between items-center p-4"
          style={{
            borderRadius: 'var(--radius-4, 8px)',
            border: '1px solid var(--color-neutral-alpha-6, rgba(0, 0, 47, 0.15))',
            background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))'
          }}
        >
          <div>
            <p className="text-xs-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '4px' }}>
              Delete account
            </p>
            <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
              {isOwner
                ? "You are the owner of this workspace. To delete your workspace and account, go to Plan & billing, or transfer ownership to another member."
                : "Permanently remove your personal account and access to Fiive. This cannot be undone."
              }
            </p>
          </div>
          {!isOwner && (
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
              Delete account
            </Button>
          )}
        </div>

        {/* Delete Account Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
            <DialogHeader className="space-y-0">
              <DialogTitle className="display-5-medium mb-0">
                Delete your account
              </DialogTitle>
            </DialogHeader>
            <DialogDescription 
              className="text-sm-regular mb-0"
            >
              This will permanently remove your personal account and access to Fiive. You&apos;ll lose access to all workspaces and shared content. This action cannot be undone.
            </DialogDescription>
            <div style={{ marginTop: '12px' }}>
              <div className="mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Confirm by typing your email
                </label>
              </div>
              <Input
                placeholder="Enter your email address"
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                className="h-10 px-4 py-2 text-sm"
                maxLength={255}
              />
            </div>
            <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
              <Button 
                variant="ghost" 
                onClick={() => {
                  setDeleteDialogOpen(false)
                  setDeleteConfirmation('')
                }}
                style={{ height: '40px' }}
                className="cursor-pointer"
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDeleteAccount}
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
      </div>
    </div>
  )
}

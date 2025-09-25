"use client"

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

const accessSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address"),
})

type AccessFormData = z.infer<typeof accessSchema>

export default function AccessPage() {
  const currentEmail = "zen.rae@exastudio.com" // This would come from auth/session in real app
  const [isUpdating, setIsUpdating] = useState(false)
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  
  const form = useForm<AccessFormData>({
    resolver: zodResolver(accessSchema),
    defaultValues: {
      email: currentEmail,
    },
  })

  const watchedEmail = form.watch("email")
  const isEmailChanged = watchedEmail !== currentEmail
  const isEmailValid = form.formState.isValid
  const isDeleteConfirmed = deleteConfirmation === currentEmail

  const handleSubmit = async (data: AccessFormData) => {
    setIsUpdating(true)
    
    try {
      // Simulate API call to send verification email
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Store the pending email
      setPendingEmail(data.email)
      
      // Reset form to show original email
      form.reset({ email: currentEmail })
      
      // Show toast notification
      toast.success("Check your inbox to verify your new email")
      
    } catch (error) {
      console.error('Error updating email:', error)
      toast.error("Failed to send verification email. Please try again.")
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsDeleting(true)
    
    try {
      // Simulate API call to delete account
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Close dialog and reset form
      setDeleteDialogOpen(false)
      setDeleteConfirmation('')
      
      // In a real app, this would:
      // 1. Delete the account from the backend
      // 2. Clear any local storage/session data
      // 3. Redirect to signup/login page
      console.log('Account deleted successfully - user would be logged out and redirected')
      
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error("Failed to delete account. Please try again.")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="max-w-[552px] flex flex-col justify-between" style={{ minHeight: 'calc(100vh - 290px)' }}>
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
                  />
                </FormControl>
                <div style={{ marginTop: '8px' }}>
                  <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
                    {pendingEmail 
                      ? `We've sent an email to ${pendingEmail}. Your email will update after it's verified.`
                      : "This is your login email. We'll send all secure sign-in links to this address."
                    }
                  </p>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Save Button */}
          <div className="pt-4" style={{ marginBottom: '80px' }}>
            <Button
              type="submit"
              variant="default"
              size="lg"
              className="cursor-pointer text-sm relative"
              disabled={!isEmailChanged || !isEmailValid || isUpdating}
            >
              <span className={isUpdating ? "invisible" : ""}>Save</span>
              {isUpdating && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Spinner size={16} />
                </div>
              )}
            </Button>
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
            Permanently remove your personal account and access to Fiive. This cannot be undone.
          </p>
        </div>
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
            This will permanently remove your personal account and access to Fiive. You'll lose access to all workspaces and shared content. This action cannot be undone.
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
  )
}
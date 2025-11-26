"use client"

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { ImageUpload } from '@/components/ui/image-upload'
import { ComboboxOption } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/connection-badge'
import type { StatusVariant } from '@/components/ui/connection-badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Spinner } from '@/components/ui/shadcn-io/spinner'
import { toast } from 'sonner'
import { disconnectConnection, reconnectConnection, inviteClientToConnection, cancelInvitation } from '@/features/connections/actions'

const reconnectSchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
})

const _agencyTypes: ComboboxOption[] = [
  { value: "Advertising Agency", label: "Advertising Agency" },
  { value: "Brand Agency", label: "Brand Agency" },
  { value: "Content & Social Media Agency", label: "Content & Social Media Agency" },
  { value: "Creative Agency", label: "Creative Agency" },
  { value: "Events Agency", label: "Events Agency" },
  { value: "Marketing Agency", label: "Marketing Agency" },
  { value: "Media Agency", label: "Media Agency" },
  { value: "Performance Marketing Agency", label: "Performance Marketing Agency" },
  { value: "PR & Communications Agency", label: "PR & Communications Agency" },
  { value: "SEO Agency", label: "SEO Agency" },
  { value: "Web & Digital Agency", label: "Web & Digital Agency" },
]

const _industryTypes: ComboboxOption[] = [
  { value: "Education & Training", label: "Education & Training" },
  { value: "Finance & Insurance", label: "Finance & Insurance" },
  { value: "Healthcare & Wellness", label: "Healthcare & Wellness" },
  { value: "Manufacturing & Industrial", label: "Manufacturing & Industrial" },
  { value: "Media & Entertainment", label: "Media & Entertainment" },
  { value: "Non-Profit, Public Sector & Government", label: "Non-Profit, Public Sector & Government" },
  { value: "Real Estate & Construction", label: "Real Estate & Construction" },
  { value: "Retail & E-Commerce", label: "Retail & E-Commerce" },
  { value: "Sports & Fitness", label: "Sports & Fitness" },
  { value: "Technology & Software", label: "Technology & Software" },
  { value: "Travel, Leisure & Hospitality", label: "Travel, Leisure & Hospitality" },
]

interface ConnectionSettingsFormProps {
  partnerOrganization: {
    id: string
    name: string
    logo?: string
    description?: string
    website?: string
    industry?: string
    connectionCode?: string
    type: 'agency' | 'client'
  }
  connectionStatus: string
  connectionId: string
}

export default function ConnectionSettingsForm({ partnerOrganization, connectionStatus, connectionId }: ConnectionSettingsFormProps) {
  const router = useRouter()
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [emailValidationError, setEmailValidationError] = useState<string>('')
  const [isInviting, setIsInviting] = useState(false)
  const [disconnectDialogOpen, setDisconnectDialogOpen] = useState(false)
  const [disconnectConfirmation, setDisconnectConfirmation] = useState('')
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isCanceling, setIsCanceling] = useState(false)
  const [reconnectDialogOpen, setReconnectDialogOpen] = useState(false)
  const [isReconnecting, setIsReconnecting] = useState(false)

  const reconnectForm = useForm<{ connectionCode: string }>({
    resolver: zodResolver(reconnectSchema),
    defaultValues: {
      connectionCode: ""
    },
    mode: "onSubmit",
  })

  // Determine if partner is an agency or client
  const isAgency = partnerOrganization.type === 'agency'

  // Display website URL without protocol (clean, modern look)
  const displayWebsite = (url: string | undefined): string => {
    if (!url) return ''
    
    let cleanDomain = url
    
    // Remove protocol
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. for display
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    return cleanDomain
  }

  const readOnlyStyle = {
    backgroundColor: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))',
    borderColor: 'var(--color-neutral-4)',
    color: 'var(--color-base-text-primary)',
    cursor: 'default',
    outline: 'none',
    boxShadow: 'none'
  } as React.CSSProperties

  const handleReadOnlyFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.outline = 'none'
    e.target.style.boxShadow = 'none'
    e.target.style.borderColor = 'var(--color-neutral-4)'
  }

  // Validate email format
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email.trim())
  }

  // Handle invite client
  const handleInviteClient = async () => {
    const trimmedEmail = inviteEmail.trim()
    
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
        connectionId,
        email: trimmedEmail
      })

      if (result.success) {
        toast.success('Client invitation sent')
        setInviteDialogOpen(false)
        setInviteEmail('')
        setEmailValidationError('')
        router.refresh()
      } else {
        setEmailValidationError(result.error || 'Failed to send invitation')
      }
    } catch (error) {
      console.error('Error inviting client:', error)
      setEmailValidationError('Failed to send invitation')
    } finally {
      setIsInviting(false)
    }
  }

  // Check if disconnect confirmation matches partner organization name
  const isDisconnectConfirmed = disconnectConfirmation.trim() === partnerOrganization.name.trim()

  // Handle disconnect
  const handleDisconnect = async () => {
    if (!isDisconnectConfirmed) {
      return
    }

    setIsDisconnecting(true)
    try {
      const result = await disconnectConnection({ connectionId })

      if (result.success) {
        toast.success('Connection disconnected')
        setDisconnectDialogOpen(false)
        setDisconnectConfirmation('')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to disconnect connection')
      }
    } catch (error) {
      console.error('Error disconnecting connection:', error)
      toast.error('Failed to disconnect connection')
    } finally {
      setIsDisconnecting(false)
    }
  }

  // Handle cancel invite
  const handleCancelInvite = async () => {
    setIsCanceling(true)
    try {
      const result = await cancelInvitation({ connectionId })

      if (result.success) {
        toast.success('Invitation canceled')
        router.refresh()
      } else {
        toast.error(result.error || 'Failed to cancel invitation')
      }
    } catch (error) {
      console.error('Error canceling invitation:', error)
      toast.error('Failed to cancel invitation')
    } finally {
      setIsCanceling(false)
    }
  }

  // Handle reconnect
  const handleReconnect = async (data: { connectionCode: string }) => {
    // Validate connection code matches partner organization's connection code
    if (data.connectionCode.trim() !== partnerOrganization.connectionCode) {
      reconnectForm.setError('connectionCode', {
        message: 'Invalid code. Please check and try again.'
      })
      return
    }

    setIsReconnecting(true)
    try {
      const result = await reconnectConnection({ 
        connectionId,
        connectionCode: data.connectionCode.trim()
      })

      if (result.success) {
        toast.success('Connection reconnected')
        setReconnectDialogOpen(false)
        reconnectForm.reset()
        router.refresh()
      } else {
        // If connection code was valid but update failed (e.g., RLS), close modal and show toast
        // Otherwise, show error in form field
        const isPermissionError = result.error?.includes('permission') || result.error?.includes('blocked')
        if (isPermissionError) {
          toast.error(result.error || 'Failed to reconnect connection')
          setReconnectDialogOpen(false)
          reconnectForm.reset()
        } else {
          reconnectForm.setError('connectionCode', {
            message: result.error || 'Invalid code. Please check and try again.'
          })
        }
      }
    } catch (error) {
      console.error('Error reconnecting connection:', error)
      reconnectForm.setError('connectionCode', {
        message: 'Failed to reconnect connection'
      })
    } finally {
      setIsReconnecting(false)
    }
  }

  // Get action config based on connection status
  const getActionConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          title: 'Disconnect from client',
          description: 'This will freeze the workspace. You\'ll still have access, but can\'t collaborate until reconnected.',
          buttonText: 'Disconnect',
          buttonVariant: 'outline' as const,
          buttonStyle: {
            borderColor: 'var(--color-semantic-destructive-border, #EF4444)',
            color: 'var(--color-semantic-destructive-text, #EF4444)',
            backgroundColor: 'transparent',
            height: '40px'
          },
          onButtonClick: () => setDisconnectDialogOpen(true),
          dialogOpen: disconnectDialogOpen,
          setDialogOpen: setDisconnectDialogOpen,
          onConfirm: handleDisconnect,
          isProcessing: isDisconnecting,
          dialogTitle: `Disconnect from ${partnerOrganization.name}?`,
          dialogDescription: 'You\'ll still have access to this workspace, but collaboration will be disabled until reconnected. You can reconnect anytime with your client\'s connection code.'
        }
      case 'invited':
        return {
          title: 'Cancel invite',
          description: 'This will cancel the pending invitation. The workspace will remain internal to your agency.',
          buttonText: 'Cancel invite',
          buttonVariant: 'outline' as const,
          buttonStyle: {
            borderColor: 'var(--color-semantic-destructive-border, #EF4444)',
            color: 'var(--color-semantic-destructive-text, #EF4444)',
            backgroundColor: 'transparent',
            height: '40px'
          },
          onButtonClick: handleCancelInvite,
          isProcessing: isCanceling,
          noDialog: true
        }
      case 'internal':
        return {
          title: 'Invite client',
          description: 'Invite your client\'s primary contact to set up their account and connect to your workspace',
          buttonText: 'Invite',
          buttonVariant: 'default' as const,
          buttonStyle: {
            height: '40px'
          },
          onButtonClick: () => setInviteDialogOpen(true),
          dialogOpen: inviteDialogOpen,
          setDialogOpen: setInviteDialogOpen,
          onConfirm: handleInviteClient,
          isProcessing: isInviting,
          dialogTitle: 'Invite client',
          dialogDescription: 'Invite your client\'s primary contact to set up their account and connect to your workspace',
          isInviteDialog: true
        }
      case 'disconnected':
        return {
          title: 'Reconnect to client',
          description: 'This workspace is read-only. To resume collaboration, reconnect using your client\'s connection code.',
          buttonText: 'Reconnect',
          buttonVariant: 'default' as const,
          buttonStyle: {
            height: '40px'
          },
          onButtonClick: () => setReconnectDialogOpen(true),
          dialogOpen: reconnectDialogOpen,
          setDialogOpen: setReconnectDialogOpen,
          isProcessing: isReconnecting,
          dialogTitle: `Reconnect to ${partnerOrganization.name}`,
          dialogDescription: 'Use a connection code to reconnect your shared workspace',
          isReconnectDialog: true
        }
      default:
        return null
    }
  }

  const actionConfig = getActionConfig()

  return (
    <div className="max-w-[552px] space-y-6">
      {/* Logo */}
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Logo
        </label>
        <div className="flex items-center">
          <ImageUpload
            initialLogoUrl={partnerOrganization.logo}
            readOnly={true}
          />
          {connectionStatus === 'internal' ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div>
                  <StatusBadge 
                    variant={connectionStatus as StatusVariant}
                    size="lg"
                    showText={true}
                    showTooltip={false}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                <p>Agency-only until connected</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <StatusBadge 
              variant={connectionStatus as StatusVariant}
              size="lg"
              showText={true}
            />
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Name
        </label>
        <Input
          value={partnerOrganization.name || ""}
          placeholder={isAgency ? "E.g. exa. studio" : "E.g. Acme Corp"}
          className="h-10 px-4 py-2 text-sm"
          readOnly={true}
          style={readOnlyStyle}
          onFocus={handleReadOnlyFocus}
        />
      </div>

      {/* About */}
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          About
        </label>
        <Textarea
          value={partnerOrganization.description || ""}
          placeholder="No description added"
          className="h-[120px] resize-none"
          readOnly={true}
          style={readOnlyStyle}
          onFocus={handleReadOnlyFocus}
        />
      </div>

      {/* Agency Type / Industry */}
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          {isAgency ? 'Agency type' : 'Industry'}
        </label>
        <Input
          value={partnerOrganization.industry || ""}
          placeholder="No industry selected"
          className="h-10 px-4 py-2 text-sm"
          readOnly={true}
          style={readOnlyStyle}
          onFocus={handleReadOnlyFocus}
        />
      </div>

      {/* Website */}
      <div>
        <label className="text-sm font-medium block mb-2" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Website
        </label>
        <Input
          value={displayWebsite(partnerOrganization.website)}
          placeholder="No website added"
          className="h-10 px-4 py-2 text-sm"
          readOnly={true}
          style={readOnlyStyle}
          onFocus={handleReadOnlyFocus}
        />
      </div>

      {/* Connection Action Section */}
      {actionConfig && (
        <div 
          className="flex justify-between items-center p-4 gap-4"
          style={{
            borderRadius: 'var(--radius-4, 8px)',
            border: '1px solid var(--color-neutral-alpha-6, rgba(0, 0, 47, 0.15))',
            background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))'
          }}
        >
          <div>
            <p className="text-xs-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '4px' }}>
              {actionConfig.title}
            </p>
            <p className="text-xs-regular" style={{ color: 'var(--color-base-text-tertiary, rgba(3, 9, 26, 0.56))' }}>
              {actionConfig.description}
            </p>
          </div>
          <Button
            variant={actionConfig.buttonVariant}
            className="text-sm cursor-pointer relative"
            style={actionConfig.buttonStyle}
            onMouseEnter={actionConfig.buttonVariant === 'outline' ? (e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-semantic-destructive-surface-hover, #FEF2F2)'
            } : undefined}
            onMouseLeave={actionConfig.buttonVariant === 'outline' ? (e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
            } : undefined}
            onClick={actionConfig.onButtonClick}
            disabled={actionConfig.isProcessing}
          >
            <span className={actionConfig.isProcessing ? "invisible" : ""}>{actionConfig.buttonText}</span>
            {actionConfig.isProcessing && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Spinner size={16} />
              </div>
            )}
          </Button>
        </div>
      )}

      {/* Invite Client Dialog */}
      {actionConfig?.isInviteDialog && (
        <Dialog open={actionConfig.dialogOpen} onOpenChange={actionConfig.setDialogOpen}>
          <DialogContent style={{ padding: '24px', width: '440px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
            <DialogHeader className="space-y-0">
              <DialogTitle className="display-5-medium mb-0">
                {actionConfig.dialogTitle}
              </DialogTitle>
            </DialogHeader>
            <DialogDescription 
              className="text-sm-regular mb-0"
            >
              {actionConfig.dialogDescription}
            </DialogDescription>
            <div style={{ marginTop: '12px' }}>
              <Input
                type="email"
                placeholder="Email address"
                value={inviteEmail}
                onChange={(e) => {
                  setInviteEmail(e.target.value)
                  setEmailValidationError('')
                }}
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
                  actionConfig.setDialogOpen(false)
                  setInviteEmail('')
                  setEmailValidationError('')
                }}
                style={{ height: '40px' }}
                className="cursor-pointer"
                disabled={actionConfig.isProcessing}
              >
                Cancel
              </Button>
              <Button 
                onClick={actionConfig.onConfirm}
                style={{ height: '40px' }}
                className="cursor-pointer relative"
                disabled={actionConfig.isProcessing || !isValidEmail(inviteEmail.trim())}
              >
                <span className={actionConfig.isProcessing ? "invisible" : ""}>Invite</span>
                {actionConfig.isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size={16} />
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Disconnect Dialog */}
      {actionConfig && !actionConfig.isInviteDialog && connectionStatus === 'connected' && (
        <Dialog open={actionConfig.dialogOpen} onOpenChange={(open) => {
          actionConfig.setDialogOpen?.(open)
          if (!open) {
            setDisconnectConfirmation('')
          }
        }}>
          <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
            <DialogHeader className="space-y-0">
              <DialogTitle className="display-5-medium mb-0">
                {actionConfig.dialogTitle}
              </DialogTitle>
            </DialogHeader>
            <DialogDescription 
              className="text-sm-regular mb-0"
            >
              {actionConfig.dialogDescription}
            </DialogDescription>
            <div style={{ marginTop: '12px' }}>
              <div className="mb-2">
                <label className="text-sm font-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
                  Please type &quot;{partnerOrganization.name}&quot;
                </label>
              </div>
              <Input
                value={disconnectConfirmation}
                onChange={(e) => setDisconnectConfirmation(e.target.value)}
                className="h-10 px-4 py-2 text-sm"
                maxLength={255}
              />
            </div>
            <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
              <Button 
                variant="ghost" 
                onClick={() => {
                  actionConfig.setDialogOpen?.(false)
                  setDisconnectConfirmation('')
                }}
                style={{ height: '40px' }}
                className="cursor-pointer"
                disabled={actionConfig.isProcessing}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={handleDisconnect}
                style={{ height: '40px' }}
                className="cursor-pointer relative"
                disabled={!isDisconnectConfirmed || actionConfig.isProcessing}
              >
                <span className={actionConfig.isProcessing ? "invisible" : ""}>Disconnect</span>
                {actionConfig.isProcessing && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size={16} />
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}


      {/* Reconnect Dialog */}
      {actionConfig && !actionConfig.isInviteDialog && connectionStatus === 'disconnected' && actionConfig.isReconnectDialog && (
        <Dialog open={actionConfig.dialogOpen} onOpenChange={actionConfig.setDialogOpen}>
          <DialogContent style={{ padding: '24px', maxWidth: '460px', height: 'auto', gap: '12px' }} className="[&>button]:hidden" showCloseButton={false}>
            <div className="flex flex-col h-full">
              <DialogTitle className="display-5-medium mb-3" style={{ color: 'var(--color-base-text-primary)' }}>
                {actionConfig.dialogTitle}
              </DialogTitle>
              <DialogDescription className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                {actionConfig.dialogDescription}
              </DialogDescription>
              <Form {...reconnectForm}>
                <form onSubmit={reconnectForm.handleSubmit(handleReconnect)} className="space-y-5 flex-1 flex flex-col">
                  <div className="mt-5">
                    <FormField
                      control={reconnectForm.control}
                      name="connectionCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm font-medium">Connection code</FormLabel>
                          <FormControl>
                            <Input
                              {...field}
                              placeholder="xxxx-xxxx-xxxx-xxxx-xxxx"
                              className="h-10 px-4 py-2 text-sm"
                            />
                          </FormControl>
                          <p className="text-xs text-muted-foreground mt-1">
                            Ask your client to share the connection code in their admin settings
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-3 pt-2 mt-auto">
                    <Button 
                      type="button"
                      variant="ghost" 
                      onClick={() => {
                        actionConfig.setDialogOpen?.(false)
                        reconnectForm.reset()
                      }}
                      style={{ height: '40px' }}
                      className="cursor-pointer"
                      disabled={actionConfig.isProcessing}
                    >
                      Cancel
                    </Button>
                    <Button 
                      type="submit"
                      style={{ height: '40px' }}
                      className="cursor-pointer relative"
                      disabled={actionConfig.isProcessing}
                    >
                      <span className={actionConfig.isProcessing ? "invisible" : ""}>Continue</span>
                      {actionConfig.isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Spinner size={16} />
                        </div>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}


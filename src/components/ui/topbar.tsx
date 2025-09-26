"use client"

import { useState, memo, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BrandLink from './brand-link'
import AvatarButton from './avatar-button'
import { Avatar, AvatarFallback, AvatarImage } from './avatar'
import { Button } from './button'
import { Question, Gear, UserPlus, UserGear, SignOut, BookOpen } from '@phosphor-icons/react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from './dropdown-menu'
import { signOut } from '@/app/(dashboard)/settings/actions'
import { toast } from 'sonner'

interface TopbarProps {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
  }
  profile: {
    id: string
    email: string
    firstName: string
    lastName: string
    avatarUrl?: string
  }
  organization: {
    id: string
    name: string
    logoUrl?: string
    type: string
    memberCount: number
  }
}

const Topbar = memo(function Topbar({ user, profile, organization }: TopbarProps) {
  const router = useRouter()
  const [isHelpDropdownOpen, setIsHelpDropdownOpen] = useState(false)
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  // Memoize computed values to prevent recalculation on every render
  const userInitials = useMemo(() => {
    const firstName = profile?.firstName || ''
    const lastName = profile?.lastName || ''
    return `${firstName.charAt(0)}${lastName.charAt(0)}`
  }, [profile?.firstName, profile?.lastName])

  const organizationInitial = useMemo(() => {
    return organization?.name?.charAt(0).toUpperCase() || 'O'
  }, [organization?.name])

  const handleHelpDropdownChange = useCallback((open: boolean) => {
    setIsHelpDropdownOpen(open)
  }, [])

  const handleWorkspaceDropdownChange = useCallback((open: boolean) => {
    setIsWorkspaceDropdownOpen(open)
  }, [])

  const handleUserDropdownChange = useCallback((open: boolean) => {
    setIsUserDropdownOpen(open)
  }, [])

  const handleSignOut = useCallback(async () => {
    if (isSigningOut) return
    
    setIsSigningOut(true)
    try {
      const result = await signOut()
      if (result.ok) {
        router.push('/signin')
      } else {
        toast.error(result.message || 'Failed to sign out')
      }
    } catch (error) {
      console.error('Sign out error:', error)
      toast.error('Failed to sign out. Please try again.')
    } finally {
      setIsSigningOut(false)
    }
  }, [isSigningOut, router])
  return (
    <div className="w-full bg-neutral-2 border-b border-neutral-alpha-4 py-1 px-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          {/* Workspace avatar */}
          <DropdownMenu modal={false} open={isWorkspaceDropdownOpen} onOpenChange={handleWorkspaceDropdownChange}>
            <Tooltip open={isWorkspaceDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div className="h-10 w-10 inline-block">
                    <AvatarButton 
                      src={organization?.logoUrl || ""}
                      alt={organization?.name || 'Organization'}
                      fallback={organizationInitial} 
                      variant="workspace"
                      isActive={isWorkspaceDropdownOpen}
                    />
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={8}>
                {organization?.name || 'Organization'}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-64">
              {/* Avatar preview with metadata */}
              <div className="flex items-center gap-3 py-3 px-2">
                <Avatar className="h-10 w-10 rounded-sm">
                  <AvatarImage 
                    src={organization?.logoUrl || ""} 
                    alt={organization?.name || 'Organization'} 
                  />
                  <AvatarFallback className="bg-neutral-9 text-white text-sm-regular rounded-sm">
                    {organizationInitial}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{organization?.name || 'Organization'}</span>
                  <span className="text-xs text-muted-foreground">
                    {organization?.memberCount || 0} {organization?.memberCount === 1 ? 'member' : 'members'}
                  </span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/organization/details" className="flex items-center w-full">
                  <Gear size={16} style={{ color: 'inherit' }} />
                  Agency admin
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings/organization/members" className="flex items-center w-full">
                  <UserPlus size={16} style={{ color: 'inherit' }} />
                  User management
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Logo and app name area */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <BrandLink href="/home" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Home
            </TooltipContent>
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          {/* User actions area */}
          <DropdownMenu open={isHelpDropdownOpen} onOpenChange={handleHelpDropdownChange} modal={false}>
            <Tooltip open={isHelpDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={`h-10 w-10 cursor-pointer transition-all duration-75 rounded-md ${
                        isHelpDropdownOpen 
                          ? 'bg-interactive-surface-hover pointer-events-none' 
                          : 'hover:bg-interactive-surface-hover'
                      }`}
                    >
                      <Question className="w-[18px] h-[18px] fill-base-icons-primary" />
                    </Button>
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                Help & support
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-60">
              {/* Section 1: Help & support */}
              <div className="p-3">
                <div className="text-sm font-normal text-muted-foreground mb-2">Help & support</div>
                <div className="rounded-md p-3 border border-neutral-alpha-5">
                  <div className="text-sm font-normal text-gray-900 mb-1">support@fiive.co</div>
                  <div className="text-xs text-gray-600">We&apos;re here for support, questions, or anything else</div>
                </div>
              </div>
              
              {/* Section 2: Explore further */}
              <div className="px-3 pb-3">
                <div className="text-sm font-normal text-muted-foreground mb-2">Explore further</div>
                <DropdownMenuItem>
                  <BookOpen size={16} className="text-inherit" />
                  Release notes
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu modal={false} open={isUserDropdownOpen} onOpenChange={handleUserDropdownChange}>
            <Tooltip open={isUserDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div className="h-10 w-10 inline-block">
                    <AvatarButton 
                      src={profile?.avatarUrl || ""}
                      alt={`${profile?.firstName || ''} ${profile?.lastName || ''}`}
                      fallback={userInitials} 
                      isActive={isUserDropdownOpen}
                    />
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={8}>
                {profile?.firstName || ''} {profile?.lastName || ''}
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              {/* User avatar preview with metadata */}
              <div className="flex items-center gap-3 py-3 px-2">
                <Avatar className="h-10 w-10 rounded-full">
                  <AvatarImage src={profile?.avatarUrl || ""} alt={`${profile?.firstName || ''} ${profile?.lastName || ''}`} />
                  <AvatarFallback 
                    className="bg-neutral-9 text-sm-regular rounded-full"
                    style={{ color: 'var(--color-base-text-inverse)' }}
                  >
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{profile?.firstName || ''} {profile?.lastName || ''}</span>
                  <span className="text-xs text-muted-foreground">{user?.email || ''}</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/account/profile" className="flex items-center w-full">
                  <UserGear size={16} className="text-inherit" />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} disabled={isSigningOut}>
                <SignOut size={16} className="text-inherit" />
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
})

export default Topbar

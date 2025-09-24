"use client"

import { useState, memo, useCallback } from 'react'
import Link from 'next/link'
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

const Topbar = memo(function Topbar() {
  const [isHelpDropdownOpen, setIsHelpDropdownOpen] = useState(false)
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false)
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  const handleHelpDropdownChange = useCallback((open: boolean) => {
    setIsHelpDropdownOpen(open)
  }, [])

  const handleWorkspaceDropdownChange = useCallback((open: boolean) => {
    setIsWorkspaceDropdownOpen(open)
  }, [])

  const handleUserDropdownChange = useCallback((open: boolean) => {
    setIsUserDropdownOpen(open)
  }, [])
  return (
    <div className="w-full" style={{ 
      backgroundColor: 'var(--color-neutral-2)',
      borderBottom: '1px solid var(--color-neutral-alpha-4)',
      paddingTop: 'var(--spacing-1)', 
      paddingBottom: 'var(--spacing-1)',
      paddingLeft: 'var(--spacing-3)',
      paddingRight: 'var(--spacing-3)'
    }}>
      {/* Topbar content will go here */}
      <div className="flex items-center justify-between">
        <div className="flex items-center" style={{ gap: '20px' }}>
          {/* Workspace avatar */}
          <DropdownMenu modal={false} open={isWorkspaceDropdownOpen} onOpenChange={handleWorkspaceDropdownChange}>
            <Tooltip open={isWorkspaceDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div>
                    <AvatarButton 
                      fallback="E" 
                      variant="workspace"
                      isActive={isWorkspaceDropdownOpen}
                    />
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="start" sideOffset={8}>
                Exa. Studio
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="start" className="w-64">
              {/* Avatar preview with metadata */}
              <div className="flex items-center gap-3 py-3 px-2">
                <Avatar className="h-10 w-10" style={{ borderRadius: 'var(--spacing-1)' }}>
                  <AvatarImage src="" alt="Exa. Studio" />
                  <AvatarFallback 
                    className="bg-[var(--color-neutral-9)] !text-white text-sm-regular"
                    style={{ borderRadius: 'var(--spacing-1)' }}
                  >
                    E
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">exa. studio</span>
                  <span className="text-xs text-muted-foreground">55 members</span>
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
        <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
          {/* User actions area */}
          <DropdownMenu open={isHelpDropdownOpen} onOpenChange={handleHelpDropdownChange} modal={false}>
            <Tooltip open={isHelpDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div>
                    <Button 
                      variant="ghost"
                      size="icon"
                      className={`h-10 w-10 cursor-pointer transition-all duration-75 ${isHelpDropdownOpen ? 'bg-[var(--color-interactive-surface-hover)]' : 'hover:bg-[var(--color-interactive-surface-hover)]'}`}
                      style={{ 
                        borderRadius: '6px',
                        ...(isHelpDropdownOpen && { 
                          backgroundColor: 'var(--color-interactive-surface-hover)',
                          pointerEvents: 'none'
                        })
                      }}
                    >
                      <Question style={{ width: 18, height: 18, fill: 'var(--color-base-icons-primary)' }} />
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
                <div 
                  className="rounded-md p-3"
                  style={{
                    border: '1px solid var(--color-neutral-alpha-5, rgba(0, 9, 50, 0.12))'
                  }}
                >
                  <div className="text-sm font-normal text-gray-900 mb-1">support@fiive.co</div>
                  <div className="text-xs text-gray-600">We&apos;re here for support, questions, or anything else</div>
                </div>
              </div>
              
              {/* Section 2: Explore further */}
              <div className="px-3 pb-3">
                <div className="text-sm font-normal text-muted-foreground mb-2">Explore further</div>
                <DropdownMenuItem>
                  <BookOpen size={16} style={{ color: 'inherit' }} />
                  Release notes
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu modal={false} open={isUserDropdownOpen} onOpenChange={handleUserDropdownChange}>
            <Tooltip open={isUserDropdownOpen ? false : undefined}>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <div>
                    <AvatarButton 
                      fallback="ZR" 
                      isActive={isUserDropdownOpen}
                    />
                  </div>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={8}>
                Zen Rae
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-64">
              {/* User avatar preview with metadata */}
              <div className="flex items-center gap-3 py-3 px-2">
                <Avatar className="h-10 w-10 rounded-full">
                  <AvatarImage src="" alt="Zen Rae" />
                  <AvatarFallback 
                    className="bg-[var(--color-neutral-9)] !text-white text-sm-regular rounded-full"
                  >
                    ZR
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Zen Rae</span>
                  <span className="text-xs text-muted-foreground">zen.rae@exastudios.com</span>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/settings/account/profile" className="flex items-center w-full">
                  <UserGear size={16} style={{ color: 'inherit' }} />
                  Account settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <SignOut size={16} style={{ color: 'inherit' }} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
})

export default Topbar

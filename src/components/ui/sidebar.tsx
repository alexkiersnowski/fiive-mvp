"use client"

import NavItem from './nav-item'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'
import { Badge } from './badge'
import { SquaresFour, ChatCentered, CheckCircle, StarFour, CaretLeft, CaretRight, ArrowLeft, ArrowRight, CreditCard, BuildingOffice, UsersThree, User, Shield, Link } from '@phosphor-icons/react'
import { useState, useEffect, memo, useCallback, useMemo, useRef } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { useRouter } from 'next/navigation'
import NextLink from 'next/link'
import { buildNav } from '@/lib/mode/buildNav'
import type { Capabilities } from '@/lib/mode/types'

interface SidebarProps {
  className?: string
  selectedItem?: string
  isCollapsed?: boolean
  onToggleCollapse?: () => void
  variant?: 'primary' | 'secondary'
  showBackButton?: boolean
  backHref?: string
  backLabel?: string
  showTitle?: boolean
  title?: string
  pathname?: string
  disableTextAnimation?: boolean
  currentUserRole?: 'owner' | 'member'
  capabilities?: Capabilities
  billingStatus?: string
  navItems?: Array<{
    href: string
    label: string
    icon: React.ReactNode
    isSelected?: boolean
  }>
}

const SidebarComponent = memo(function SidebarComponent({ 
  className = '', 
  selectedItem, 
  isCollapsed = false, 
  onToggleCollapse,
  variant = 'primary',
  showBackButton = false,
  backHref = '/home',
  backLabel = 'Back',
  showTitle = false,
  title = '',
  pathname = '',
  disableTextAnimation = false,
  currentUserRole = 'member',
  capabilities,
  billingStatus,
  navItems
}: SidebarProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [showAlert, setShowAlert] = useState(!isCollapsed)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true)
  }, [])
  
  const handleMouseLeave = useCallback(() => {
    setIsHovered(false)
  }, [])

  const handleToggleCollapse = useCallback(() => {
    // Only hide button when collapsing, not when expanding
    if (!isCollapsed) {
      // We're collapsing - hide button immediately
      setIsHovered(false)
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      
      // Additional safety: ensure button stays hidden after collapse
      timeoutRef.current = setTimeout(() => {
        setIsHovered(false)
        timeoutRef.current = null
      }, 100)
    }
    
    // Call the parent toggle function
    onToggleCollapse?.()
  }, [onToggleCollapse, isCollapsed])

  useEffect(() => {
    if (isCollapsed) {
      // Hide alert immediately when collapsing
      setShowAlert(false)
    } else {
      // Show alert with 50ms delay when expanding
      const timer = setTimeout(() => {
        setShowAlert(true)
      }, 50)
      
      return () => clearTimeout(timer)
    }
  }, [isCollapsed])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  // Memoize navigation items to prevent recreation on every render
  const defaultNavItems = useMemo(() => {
    if (!capabilities) {
      // Fallback to basic nav if capabilities not available
      return [
        { href: '/home', label: 'Home', icon: <SquaresFour size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'home' },
        { href: '/requests', label: 'Requests', icon: <ChatCentered size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'requests' },
        { href: '/tasks', label: 'Tasks', icon: <CheckCircle size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'tasks' }
      ];
    }
    
    // Build nav from capabilities
    return buildNav(capabilities, selectedItem).map(item => {
      const IconComponent = item.icon;
      return {
        ...item,
        icon: <IconComponent size={18} className="fill-base-icons-primary" />
      };
    });
  }, [selectedItem, capabilities])

  // Account settings navigation items
  const accountNavItems = useMemo(() => [
    { href: '/settings/account/profile', label: 'Profile', icon: <User size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'profile' },
    { href: '/settings/account/access', label: 'Account access', icon: <Shield size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'access' }
  ], [selectedItem])

  // Organization settings navigation items  
  const organizationNavItems = useMemo(() => {
    const detailsLabel = capabilities?.canSeeClients ? 'Agency details' : 'Company details'
    const baseItems = [
      { href: '/settings/organization/details', label: detailsLabel, icon: <BuildingOffice size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'details' },
      { href: '/settings/organization/members', label: 'User management', icon: <UsersThree size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'members' }
    ]
    
    // Only show billing for owners
    if (currentUserRole === 'owner') {
      baseItems.push({ href: '/settings/organization/billing', label: 'Plan & billing', icon: <CreditCard size={18} className="fill-base-icons-primary" />, isSelected: selectedItem === 'billing' })
    }
    
    return baseItems
  }, [selectedItem, currentUserRole, capabilities?.canSeeClients])

  // Connection settings navigation items
  const connectionSettingsNavItems = useMemo(() => [
    { href: pathname, label: 'Connection settings', icon: <Link size={18} className="fill-base-icons-primary" />, isSelected: true }
  ], [pathname])

  // Determine which secondary nav items to show based on current path
  const secondaryNavItems = useMemo(() => {
    // Check if we're on a connection settings page
    const connectionSettingsMatch = pathname.match(/^\/(clients|agencies)\/([^/]+)\/settings$/)
    if (connectionSettingsMatch) {
      return connectionSettingsNavItems
    }
    if (pathname.startsWith('/settings/account')) return accountNavItems
    if (pathname.startsWith('/settings/organization')) return organizationNavItems
    return organizationNavItems // Default fallback
  }, [pathname, accountNavItems, organizationNavItems, connectionSettingsNavItems])

  // Check if we're on a connection settings page
  const isConnectionSettingsPage = useMemo(() => {
    return /^\/(clients|agencies)\/([^/]+)\/settings$/.test(pathname)
  }, [pathname])

  // Determine connection settings context
  const connectionSettingsContext = useMemo(() => {
    if (!isConnectionSettingsPage) return null
    const match = pathname.match(/^\/(clients|agencies)\/([^/]+)\/settings$/)
    if (!match) return null
    const baseRoute = match[1] // 'clients' or 'agencies'
    const connectionId = match[2]
    return {
      baseRoute,
      connectionId,
      // If baseRoute is 'clients', we're in agency context viewing client
      // If baseRoute is 'agencies', we're in client context viewing agency
      title: baseRoute === 'clients' ? 'Client settings' : 'Agency settings',
      backHref: `/${baseRoute}/${connectionId}/overview`,
      backLabel: 'Back'
    }
  }, [pathname, isConnectionSettingsPage])

  const currentNavItems = navItems || (variant === 'secondary' ? secondaryNavItems : defaultNavItems)
  const isSecondary = variant === 'secondary' || isConnectionSettingsPage

  // Memoize the founding member alert component
  const foundingMemberAlert = useMemo(() => {
    const isFree = billingStatus === 'free'
    
    return (
      <Alert className="flex flex-col gap-1 rounded-md bg-neutral-alpha-2 border-neutral-alpha-4 p-3">
        {isFree ? (
          <>
            <Badge 
              variant="secondary" 
              className="self-start flex items-center gap-1 bg-orange-3 font-medium text-xs tracking-wide"
              style={{ color: 'var(--color-orange-11)' }}
            >
              <StarFour 
                size={12} 
                weight="fill"
                style={{ fill: 'var(--color-orange-11)' }}
              />
              Early access
            </Badge>
            <AlertDescription className="text-xs-regular px-1.5 mt-2" style={{ color: 'var(--color-base-text-secondary)' }}>
              You&apos;re exploring Fiive. Be one of the first 100.
            </AlertDescription>
            <NextLink href="/settings/organization/billing">
              <Button
                variant="ghost"
                size="sm"
                className="self-start h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75"
                style={{ marginLeft: '-4px' }}
              >
                <span className="mr-1">Get early access</span>
                <ArrowRight size={16} weight="regular" />
              </Button>
            </NextLink>
          </>
        ) : (
          <>
            <Badge 
              variant="secondary" 
              className="self-start flex items-center gap-1 bg-orange-3 font-medium text-xs tracking-wide"
              style={{ color: 'var(--color-orange-11)' }}
            >
              <StarFour 
                size={12} 
                weight="fill"
                style={{ fill: 'var(--color-orange-11)' }}
              />
              Founding member
            </Badge>
            <AlertDescription className="text-xs-regular px-1.5 mt-1" style={{ color: 'var(--color-base-text-secondary)' }}>
              You&apos;re one of the Founding 100 defining the future of Fiive
            </AlertDescription>
            <Button
              variant="ghost"
              size="sm"
              className="self-start h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75"
              style={{ marginLeft: '-4px' }}
              onClick={() => window.location.href = 'mailto:support@fiive.co'}
            >
              <span className="mr-1">Share feedback</span>
              <ArrowRight size={16} weight="regular" />
            </Button>
          </>
        )}
      </Alert>
    )
  }, [billingStatus])

  return (
    <div 
      className="relative"
      onMouseEnter={!isSecondary ? handleMouseEnter : undefined}
      onMouseLeave={!isSecondary ? handleMouseLeave : undefined}
    >
      <aside
        className={`flex flex-col h-full border-r border-neutral-alpha-4 bg-neutral-2 py-5 px-3 ${isSecondary ? 'w-60' : ''} ${className}`}
        role="navigation"
        aria-label={isSecondary ? 'Settings navigation' : 'Main navigation'}
      >
        {/* Back button for secondary variant */}
        {isSecondary && (showBackButton || isConnectionSettingsPage) && (
          <div className="mb-5">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75"
              onClick={() => router.push(isConnectionSettingsPage && connectionSettingsContext ? connectionSettingsContext.backHref : backHref)}
            >
              <ArrowLeft size={16} weight="regular" />
              <span className="ml-1">{isConnectionSettingsPage && connectionSettingsContext ? connectionSettingsContext.backLabel : backLabel}</span>
            </Button>
          </div>
        )}

        {/* Title for secondary variant */}
        {isSecondary && (showTitle || isConnectionSettingsPage) && (
          <div className="mb-5 px-2">
            <h2 className="text-md-medium" style={{ color: 'var(--color-base-text-primary)' }}>
              {isConnectionSettingsPage && connectionSettingsContext ? connectionSettingsContext.title : title}
            </h2>
          </div>
        )}

        <nav className="flex-1">
          <div className="flex flex-col gap-1">
            {currentNavItems.map((item, index) => (
              <NavItem 
                key={index}
                href={item.href} 
                isSelected={item.isSelected} 
                icon={item.icon} 
                isCollapsed={isCollapsed}
                disableTextAnimation={disableTextAnimation}
              >
                {item.label}
              </NavItem>
            ))}
          </div>
        </nav>
        
        {/* Footer content for both variants */}
        {isSecondary ? (
          // Always show full alert for secondary variant (no collapse functionality)
          <div>
            {foundingMemberAlert}
          </div>
        ) : isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="rounded-lg bg-orange-3 border-none p-0 flex items-center justify-center cursor-pointer transition-colors duration-200"
                style={{ 
                  width: '34px', 
                  height: '34px',
                  '--hover-bg': '#FFE9DD'
                } as React.CSSProperties & { '--hover-bg': string }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#FFE9DD'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-orange-3)'
                }}
                onClick={() => {
                  const isFree = billingStatus === 'free'
                  if (isFree) {
                    router.push('/settings/organization/billing')
                  } else {
                    window.location.href = 'mailto:support@fiive.co'
                  }
                }}
                aria-label={billingStatus === 'free' ? 'Early access' : 'Founding 50 feedback'}
              >
                <StarFour 
                  size={18} 
                  weight="fill"
                  className="fill-orange-11"
                />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {billingStatus === 'free' ? 'Early access' : 'Founding 50 feedback'}
            </TooltipContent>
          </Tooltip>
        ) : (
          <div
            className={`transition-opacity duration-100 ${showAlert ? 'opacity-100' : 'opacity-0'}`}
          >
            {foundingMemberAlert}
          </div>
        )}
      </aside>
      
      {/* Floating collapse button only for primary variant */}
      {!isSecondary && onToggleCollapse && (
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-2 -right-3 w-6 h-6 rounded-full bg-neutral-2 border border-neutral-alpha-4 z-10 flex items-center justify-center hover:bg-gray-200 cursor-pointer transition-opacity ${isCollapsed ? 'duration-0' : 'duration-150'} ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          style={{ color: 'var(--color-base-text-secondary)', width: '24px', height: '24px' }}
          onClick={handleToggleCollapse}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? (
            <CaretRight size={12} />
          ) : (
            <CaretLeft size={12} />
          )}
        </Button>
      )}
    </div>
  )
})

export default SidebarComponent

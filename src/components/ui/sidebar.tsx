"use client"

import NavItem from './nav-item'
import { Button } from './button'
import { Alert, AlertDescription } from './alert'
import { Badge } from './badge'
import { SquaresFour, Users, ChatCentered, CheckCircle, StarFour, CaretLeft, CaretRight, ArrowLeft, Gear, CreditCard, BuildingOffice, UsersThree } from '@phosphor-icons/react'
import { useState, useEffect, memo, useCallback } from 'react'
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip'
import { useRouter } from 'next/navigation'

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
  navItems
}: SidebarProps) {
  const router = useRouter()
  const [isHovered, setIsHovered] = useState(false)
  const [showAlert, setShowAlert] = useState(!isCollapsed)

  const handleMouseEnter = useCallback(() => setIsHovered(true), [])
  const handleMouseLeave = useCallback(() => setIsHovered(false), [])

  useEffect(() => {
    if (isCollapsed) {
      // Hide alert immediately when collapsing
      setShowAlert(false)
      // Reset hover state when collapsing to hide the button
      setIsHovered(false)
    } else {
      // Show alert with 50ms delay when expanding
      const timer = setTimeout(() => {
        setShowAlert(true)
      }, 50)
      
      return () => clearTimeout(timer)
    }
  }, [isCollapsed])

  // Default navigation items for primary variant
  const defaultNavItems = [
    { href: '/home', label: 'Home', icon: <SquaresFour size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'home' },
    { href: '/clients', label: 'Clients', icon: <Users size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'clients' },
    { href: '/requests', label: 'Requests', icon: <ChatCentered size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'requests' },
    { href: '/tasks', label: 'Tasks', icon: <CheckCircle size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'tasks' }
  ]

  // Default navigation items for secondary variant
  const secondaryNavItems = [
    { href: '/settings/organization/details', label: 'Agency details', icon: <BuildingOffice size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'details' },
    { href: '/settings/organization/members', label: 'User management', icon: <UsersThree size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'members' },
    { href: '/settings/organization/billing', label: 'Billing & subscription', icon: <CreditCard size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'billing' }
  ]

  const currentNavItems = navItems || (variant === 'secondary' ? secondaryNavItems : defaultNavItems)
  const isSecondary = variant === 'secondary'

  return (
    <div 
      style={{ position: 'relative' }}
      onMouseEnter={!isSecondary ? handleMouseEnter : undefined}
      onMouseLeave={!isSecondary ? handleMouseLeave : undefined}
    >
      <aside
        className={`flex flex-col ${className}`}
        style={{
          height: '100%',
          borderRight: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
          background: 'var(--color-neutral-2, #F9F9FB)',
          padding: `var(--spacing-5, 24px) var(--spacing-3, 12px)`,
          width: isSecondary ? '240px' : undefined
        }}
      >
        {/* Back button for secondary variant */}
        {isSecondary && showBackButton && (
          <div style={{ marginBottom: 'var(--spacing-5, 24px)' }}>
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-[var(--color-interactive-surface-hover)] transition-all duration-75"
              onClick={() => router.push(backHref)}
            >
              <ArrowLeft size={16} weight="regular" />
              <span className="ml-1">{backLabel}</span>
            </Button>
          </div>
        )}

        {/* Title for secondary variant */}
        {isSecondary && showTitle && title && (
          <div style={{ marginBottom: 'var(--spacing-5, 24px)', paddingLeft: 'var(--spacing-2, 8px)', paddingRight: 'var(--spacing-2, 8px)' }}>
            <h2 
              className="text-md-medium"
              style={{
                color: 'var(--color-base-text-primary, #1C2024)',
                fontFamily: 'var(--font-family-text, Inter)',
                fontSize: 'var(--font-size-3, 16px)',
                fontStyle: 'normal',
                fontWeight: 'var(--font-weight-medium, 500)',
                lineHeight: 'var(--line-height-3, 24px)',
                letterSpacing: 'var(--letter-spacing-3, 0)'
              }}
            >
              {title}
            </h2>
          </div>
        )}

        <nav className="flex-1">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1, 4px)' }}>
            {currentNavItems.map((item, index) => (
              <NavItem 
                key={index}
                href={item.href} 
                isSelected={item.isSelected} 
                icon={item.icon} 
                isCollapsed={isCollapsed}
              >
                {item.label}
              </NavItem>
            ))}
          </div>
        </nav>
        
        {/* Footer content for both variants */}
        {(
          <>
            {isSecondary ? (
              // Always show full alert for secondary variant (no collapse functionality)
              <div>
                <Alert 
                  className="flex flex-col gap-2"
                  style={{
                    borderRadius: 'var(--radius-3, 6px)',
                    background: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))',
                    borderColor: 'var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
                    padding: '12px'
                  }}
                >
                <Badge 
                  variant="secondary" 
                  className="self-start flex items-center gap-1"
                  style={{
                    background: 'var(--color-orange-3, #FFF1EA)',
                    color: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))',
                    font: '500 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  <StarFour 
                    size={12} 
                    weight="fill"
                    style={{ 
                      fill: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))' 
                    }} 
                  />
                  Founding member
                </Badge>
                <AlertDescription
                  className="text-xs-regular"
                  style={{
                    color: 'var(--color-base-text-primary, #1C2024)',
                    font: '400 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  You&apos;re one of the Founding 50 defining the future of Fiive
                </AlertDescription>
                <Button 
                  variant="link" 
                  className="self-start p-0 h-auto underline cursor-pointer"
                  style={{
                    color: 'var(--color-base-text-primary, #1C2024)',
                    font: '400 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  Share feedback
                </Button>
                </Alert>
              </div>
            ) : isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: 'var(--color-orange-3, #FFF1EA)',
                      border: 'none',
                      padding: '0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.setProperty('background-color', '#FFDCCB', 'important')
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.setProperty('background-color', 'var(--color-orange-3, #FFF1EA)', 'important')
                    }}
                  >
                    <StarFour 
                      size={18} 
                      weight="fill"
                      style={{ 
                        fill: 'var(--color-orange-11, #BA5100)' 
                      }} 
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  Founding 50 feedback
                </TooltipContent>
              </Tooltip>
            ) : (
              <div
                style={{
                  opacity: showAlert ? 1 : 0,
                  transition: showAlert ? 'opacity 0.1s ease-in-out' : 'none'
                }}
              >
                <Alert 
                  className="flex flex-col gap-2"
                  style={{
                    borderRadius: 'var(--radius-3, 6px)',
                    background: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))',
                    borderColor: 'var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
                    padding: '12px'
                  }}
                >
                <Badge 
                  variant="secondary" 
                  className="self-start flex items-center gap-1"
                  style={{
                    background: 'var(--color-orange-3, #FFF1EA)',
                    color: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))',
                    font: '500 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  <StarFour 
                    size={12} 
                    weight="fill"
                    style={{ 
                      fill: 'var(--color-orange-alpha-11, rgba(204, 78, 0, 0.77))' 
                    }} 
                  />
                  Founding member
                </Badge>
                <AlertDescription
                  className="text-xs-regular"
                  style={{
                    color: 'var(--color-base-text-primary, #1C2024)',
                    font: '400 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  You&apos;re one of the Founding 50 defining the future of Fiive
                </AlertDescription>
                <Button 
                  variant="link" 
                  className="self-start p-0 h-auto underline cursor-pointer"
                  style={{
                    color: 'var(--color-base-text-primary, #1C2024)',
                    font: '400 0.75rem/1rem Inter, sans-serif',
                    letterSpacing: '0.0025rem'
                  }}
                >
                  Share feedback
                </Button>
                </Alert>
              </div>
            )}
          </>
        )}
      </aside>
      
      {/* Floating collapse button only for primary variant */}
      {!isSecondary && onToggleCollapse && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className={`absolute top-6 -right-3 w-6 h-6 rounded-full hover:!bg-[#EAEAEF] cursor-pointer transition-opacity duration-150 ${isHovered ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
              style={{
                position: 'absolute',
                top: '4px',
                right: '-12px',
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                background: 'var(--color-neutral-2, #F9F9FB)',
                border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
                color: 'var(--color-base-text-secondary, #000714bd)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              onClick={onToggleCollapse}
            >
              {isCollapsed ? (
                <CaretRight style={{ width: '14px', height: '14px' }} />
              ) : (
                <CaretLeft style={{ width: '14px', height: '14px' }} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
})

export default SidebarComponent

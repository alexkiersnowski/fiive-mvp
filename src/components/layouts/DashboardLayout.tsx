"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'
import { PastDueBanner } from '@/components/ui/past-due-banner'
import { MemberLimitModal } from '@/components/ui/member-limit-modal'
import { EnhancedModeContext } from '@/lib/mode/getActiveContext'
import { toast } from 'sonner'

interface DashboardLayoutProps {
  data: EnhancedModeContext
  context: EnhancedModeContext
  children: React.ReactNode
  initialIsCollapsed: boolean
}

export default function DashboardLayout({ data, context, children, initialIsCollapsed }: DashboardLayoutProps) {
  const pathname = usePathname()
  // Primary nav selection should stick to top-level sections
  // e.g. /clients/[id]/requests should still select 'clients'
  // For settings pages, extract the specific page identifier (e.g., 'profile', 'access', 'details', 'members', 'billing')
  const selectedItem =
    pathname.startsWith('/clients') ? 'clients' :
    pathname.startsWith('/agencies') ? 'agencies' :
    pathname.startsWith('/settings') ? (pathname.split('/').pop() || 'settings') :
    pathname.startsWith('/home') ? 'home' :
    pathname.split('/')[1] || 'home'
  const [isCollapsed, setIsCollapsed] = useState(initialIsCollapsed)
  const mainRef = useRef<HTMLDivElement>(null)
  // Check if we're on a detail page (should use card variant, not full-width)
  // Matches detail pages: requests/projects/tasks under clients/agencies
  const isDetailPage = /^\/(clients|agencies)\/[^/]+\/(requests|projects|tasks)\/[^/]+$/.test(pathname)
  // Check if we're on a connection settings page
  const isConnectionSettingsPage = /^\/(clients|agencies)\/[^/]+\/settings$/.test(pathname)
  // Exclude connection settings pages from full-width check
  const isFullWidthPage = !isDetailPage && !isConnectionSettingsPage && (['/home', '/clients', '/agencies', '/requests', '/tasks'].includes(pathname) || pathname.startsWith('/clients/') || pathname.startsWith('/agencies/') || pathname.startsWith('/requests/') || pathname.startsWith('/tasks/'))
  const isSettingsPage = pathname.startsWith('/settings') || isConnectionSettingsPage
  const isMembersPage = pathname === '/settings/organization/members'
  const sidebarVariant = isSettingsPage ? 'secondary' : 'primary'
  
  // Track previous variant to detect context switches
  const prevIsSettingsRef = useRef(isSettingsPage)
  const isSameVariant = prevIsSettingsRef.current === isSettingsPage
  
  useEffect(() => {
    prevIsSettingsRef.current = isSettingsPage
  }, [isSettingsPage])
  
  // Derived values - don't override the persisted state
  const effectiveIsCollapsed = isSettingsPage ? false : isCollapsed
  
  const handleToggle = () => {
    const next = !isCollapsed
    setIsCollapsed(next)
    document.cookie = `sidebar=${next ? "collapsed" : "expanded"};path=/;max-age=31536000`
  }
  
  // Get settings section title
  const getSettingsTitle = () => {
    if (pathname.startsWith('/settings/account')) return 'Account settings'
    if (pathname.startsWith('/settings/organization')) {
      return context.variant === 'agency' ? 'Agency details' : 'Company details'
    }
    return 'Settings'
  }

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  }, [pathname])
  
  // Determine sidebar width based on variant and collapse state
  // Connection settings pages should always show full sidebar (like settings pages)
  const sidebarWidth = (isSettingsPage || isConnectionSettingsPage) ? '240px' : (effectiveIsCollapsed ? '60px' : '240px')
  
  // Check if we should show the past due banner
  // Only show to organization owners (same restriction as billing settings)
  const showPastDueBanner = context.organization.billing_status === 'past_due' && data.currentUserRole === 'owner'
  
  // Check if user is restricted due to member limit
  const isRestricted = context.isRestricted || false
  
  // Handle portal session creation
  const handleManagePayment = async () => {
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create portal session')
      }

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      toast.error('Failed to open payment portal. Please try again.')
    }
  }
  
  // Desktop-only layout: Designed for screens ≥1024px
  // Screens smaller than 1024px will show horizontal scrollbars
  return (
    <div 
      className="h-screen" 
      style={{ 
        backgroundColor: 'var(--color-neutral-2)',
        display: 'grid',
        gridTemplateRows: showPastDueBanner ? 'auto auto 1fr' : 'auto 1fr',
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        transition: isSameVariant ? `grid-template-columns ${isCollapsed ? '0.15s' : '0.1s'} ease-in-out` : 'none',
        minWidth: '1024px'
      }}
    >
      {showPastDueBanner && (
        <div style={{ gridColumn: '1 / -1' }}>
          <PastDueBanner onManagePayment={handleManagePayment} />
        </div>
      )}
      <div style={{ gridColumn: '1 / -1' }}>
        <Topbar 
          user={data.user}
          profile={data.user}
          organization={data.organization}
          variant={context.variant}
        />
      </div>
      <SidebarComponent 
        selectedItem={selectedItem} 
        isCollapsed={effectiveIsCollapsed}
        onToggleCollapse={handleToggle}
        variant={sidebarVariant}
        showBackButton={isSettingsPage}
        backHref="/home"
        backLabel="Back to dashboard"
        showTitle={isSettingsPage}
        title={isSettingsPage ? getSettingsTitle() : ''}
        pathname={pathname}
        disableTextAnimation={!isSameVariant}
        currentUserRole={data.currentUserRole}
        capabilities={context.capabilities}
        billingStatus={context.organization.billing_status}
      />
      <main
        ref={mainRef}
        style={{ 
        overflow: 'auto',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: isFullWidthPage ? '0' : '16px 16px 24px 16px',
        position: 'relative'
      }}>
        <div 
          style={{
            minHeight: '100%',
            height: isFullWidthPage ? 'auto' : '100%',
            borderRadius: isFullWidthPage ? '0' : 'var(--radius-6, 16px)',
            border: isFullWidthPage ? 'none' : '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
            background: isFullWidthPage ? 'transparent' : 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
            padding: isFullWidthPage ? '0' : ((isSettingsPage || isConnectionSettingsPage) ? (isMembersPage ? '0 64px 40px 64px' : '40px 64px 40px 64px') : isDetailPage ? '24px 32px 0px 32px' : '24px 32px 0px 32px'),
            overflow: isFullWidthPage ? 'visible' : ((isSettingsPage || isConnectionSettingsPage) ? 'auto' : 'hidden'),
            display: isFullWidthPage ? 'block' : 'flex',
            flexDirection: 'column',
            pointerEvents: isRestricted ? 'none' : 'auto',
            opacity: isRestricted ? 0.5 : 1
          }}
        >
          {children}
        </div>
      </main>
      
      {/* Member Limit Modal - blocks access when user is restricted */}
      {isRestricted && (
        <MemberLimitModal 
          open={true}
          ownerName={data.organization.ownerName}
          ownerEmail={data.organization.ownerEmail}
        />
      )}
    </div>
  )
}

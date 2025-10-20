"use client"

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'
import { EnhancedModeContext } from '@/lib/mode/getActiveContext'

interface DashboardLayoutProps {
  data: EnhancedModeContext
  context: EnhancedModeContext
  children: React.ReactNode
  initialIsCollapsed: boolean
}

export default function DashboardLayout({ data, context, children, initialIsCollapsed }: DashboardLayoutProps) {
  const pathname = usePathname()
  const selectedItem = pathname.split('/').pop() || 'home'
  const [isCollapsed, setIsCollapsed] = useState(initialIsCollapsed)
  const isFullWidthPage = ['/home', '/clients', '/agencies'].includes(pathname)
  const isSettingsPage = pathname.startsWith('/settings')
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
  
  // Determine sidebar width based on variant and collapse state
  const sidebarWidth = isSettingsPage ? '240px' : (effectiveIsCollapsed ? '60px' : '240px')
  
  return (
    <div 
      className="h-screen" 
      style={{ 
        backgroundColor: 'var(--color-neutral-2)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: `${sidebarWidth} 1fr`,
        transition: isSameVariant ? `grid-template-columns ${isCollapsed ? '0.15s' : '0.1s'} ease-in-out` : 'none'
      }}
    >
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
      />
      <main style={{ 
        padding: isFullWidthPage ? '0' : '16px 16px 24px 16px',
        overflow: 'auto'
      }}>
        <div 
          style={{
            borderRadius: isFullWidthPage ? '0' : 'var(--radius-6, 16px)',
            border: isFullWidthPage ? 'none' : '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
            background: isFullWidthPage ? 'transparent' : 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
            padding: isFullWidthPage ? '0' : (isSettingsPage ? '40px 64px 40px 64px' : '16px'),
            height: '100%',
            overflow: isSettingsPage ? 'auto' : 'visible'
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

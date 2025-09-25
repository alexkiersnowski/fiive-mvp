"use client"

import { useState, memo } from 'react'
import { usePathname } from 'next/navigation'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'
import { DashboardData } from '@/lib/dashboard-data'

interface DashboardLayoutProps {
  data: DashboardData
  children: React.ReactNode
}

export default function DashboardLayout({ data, children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const selectedItem = pathname.split('/').pop() || 'home'
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isHomePage = pathname === '/home'
  const isSettingsPage = pathname.startsWith('/settings')
  const sidebarVariant = isSettingsPage ? 'secondary' : 'primary'
  
  // Get settings section title
  const getSettingsTitle = () => {
    if (pathname.startsWith('/settings/account')) return 'Account settings'
    if (pathname.startsWith('/settings/organization')) return 'Organization settings'
    return 'Settings'
  }
  
  return (
    <div 
      className="h-screen" 
      style={{ 
        backgroundColor: 'var(--color-neutral-2)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: isCollapsed ? '60px 1fr' : '240px 1fr',
        transition: `grid-template-columns ${isCollapsed ? '0.15s' : '0.1s'} ease-in-out`
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Topbar 
          user={data.user}
          profile={data.user}
          organization={data.organization}
        />
      </div>
      <SidebarComponent 
        selectedItem={selectedItem} 
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
        variant={sidebarVariant}
        showBackButton={isSettingsPage}
        backHref="/home"
        backLabel="Back to dashboard"
        showTitle={isSettingsPage}
        title={isSettingsPage ? getSettingsTitle() : ''}
        pathname={pathname}
      />
      <main style={{ 
        padding: isHomePage ? '0' : '16px 16px 24px 16px',
        overflow: 'hidden'
      }}>
        <div 
          style={{
            borderRadius: isHomePage ? '0' : 'var(--radius-6, 16px)',
            border: isHomePage ? 'none' : '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
            background: isHomePage ? 'transparent' : 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
            padding: isHomePage ? '0' : (isSettingsPage ? '40px 64px 24px 64px' : '16px'),
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

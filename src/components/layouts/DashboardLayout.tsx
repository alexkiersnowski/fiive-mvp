"use client"

import { useState, memo } from 'react'
import { usePathname } from 'next/navigation'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
}

const DashboardLayout = memo(function DashboardLayout({ children }: DashboardLayoutProps) {
  const pathname = usePathname()
  const selectedItem = pathname.split('/').pop() || 'home'
  const [isCollapsed, setIsCollapsed] = useState(false)
  const isHomePage = pathname === '/home'
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
        <Topbar />
      </div>
      <SidebarComponent 
        selectedItem={selectedItem} 
        isCollapsed={isCollapsed}
        onToggleCollapse={() => setIsCollapsed(!isCollapsed)}
      />
      <main style={{ padding: isHomePage ? '0' : '16px 16px 24px 16px' }}>
        <div 
          style={{
            borderRadius: isHomePage ? '0' : 'var(--radius-6, 16px)',
            border: isHomePage ? 'none' : '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
            background: isHomePage ? 'transparent' : 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
            padding: isHomePage ? '0' : '16px',
            height: '100%'
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
})

export default DashboardLayout

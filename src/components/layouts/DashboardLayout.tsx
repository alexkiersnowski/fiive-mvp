"use client"

import { useState } from 'react'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'

interface DashboardLayoutProps {
  children: React.ReactNode
  selectedItem?: string
}

export default function DashboardLayout({ children, selectedItem }: DashboardLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  return (
    <div 
      className="h-screen" 
      style={{ 
        backgroundColor: 'var(--color-neutral-2)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: isCollapsed ? '60px 1fr' : '240px 1fr',
        transition: 'grid-template-columns 0.2s ease-in-out'
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
      <main style={{ padding: '16px 16px 24px 16px' }}>
        <div 
          style={{
            borderRadius: 'var(--radius-6, 16px)',
            border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
            background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
            padding: '16px',
            height: '100%'
          }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}

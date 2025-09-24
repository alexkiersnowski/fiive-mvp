'use client'

import { useEffect } from 'react'
import DashboardLayout from '@/components/layouts/DashboardLayout'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  useEffect(() => {
    // Precompile all dashboard pages in development
    if (process.env.NODE_ENV === 'development') {
      const pages = ['/home', '/tasks', '/requests', '/connected']
      pages.forEach(page => {
        // Use fetch to trigger compilation without navigation
        fetch(page, { method: 'HEAD' }).catch(() => {
          // Ignore errors - we just want to trigger compilation
        })
      })
    }
  }, [])

  return (
    <DashboardLayout>
      {children}
    </DashboardLayout>
  )
}

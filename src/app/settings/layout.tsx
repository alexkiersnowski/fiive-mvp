'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { User, Shield } from '@phosphor-icons/react'
import Topbar from '@/components/ui/topbar'
import SidebarComponent from '@/components/ui/sidebar'

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const selectedItem = pathname.split('/').pop() || 'details'
  
  // Determine which section we're in
  const getSectionInfo = () => {
    const segments = pathname.split('/').filter(Boolean)
    if (segments.length >= 2) {
      const section = segments[1] // organization or account
      return {
        section,
        title: section === 'account' ? 'Account settings' : 'Agency admin'
      }
    }
    return { section: 'organization', title: 'Agency admin' }
  }
  
  // Generate page title and description based on current route
  const getPageInfo = () => {
    const segments = pathname.split('/').filter(Boolean)
    console.log('Pathname:', pathname)
    console.log('Segments:', segments)
    
    if (segments.length >= 3) {
      const page = segments[0] // settings
      const section = segments[1] // organization or account
      const subsection = segments[2] // details, members, billing, profile, access
      
      console.log('Page:', page, 'Section:', section, 'Subsection:', subsection)
      
      const titleMap: Record<string, Record<string, string>> = {
        organization: {
          details: 'Agency details',
          members: 'User management',
          billing: 'Billing & subscription'
        },
        account: {
          profile: 'Profile',
          access: 'Account access'
        }
      }
      
              const descriptionMap: Record<string, Record<string, string>> = {
                organization: {
                  details: 'Manage your agency details, this is how your agency will be seen by clients',
                  members: 'Manage your team members and system owner',
                  billing: 'Manage your subscription and billing details'
                },
        account: {
          profile: 'What your clients and team see when they work with you',
          access: 'Manage your access details'
        }
      }
      
      const title = titleMap[section]?.[subsection] || 'Settings'
      const description = descriptionMap[section]?.[subsection] || ''
      
      console.log('Generated title:', title)
      console.log('Generated description:', description)
      
      return { title, description }
    }
    return { title: 'Settings', description: '' }
  }

  useEffect(() => {
    // Precompile all settings pages in development
    if (process.env.NODE_ENV === 'development') {
      const pages = [
        '/settings/organization/details',
        '/settings/organization/members', 
        '/settings/organization/billing',
        '/settings/account/profile',
        '/settings/account/access'
      ]
      pages.forEach(page => {
        // Use fetch to trigger compilation without navigation
        fetch(page, { method: 'HEAD' }).catch(() => {
          // Ignore errors - we just want to trigger compilation
        })
      })
    }
  }, [])

  return (
    <div 
      className="h-screen" 
      style={{ 
        backgroundColor: 'var(--color-neutral-2)',
        display: 'grid',
        gridTemplateRows: 'auto 1fr',
        gridTemplateColumns: '240px 1fr'
      }}
    >
      <div style={{ gridColumn: '1 / -1' }}>
        <Topbar />
      </div>
              <SidebarComponent 
                variant="secondary"
                selectedItem={selectedItem}
                showBackButton={true}
                backHref="/home"
                backLabel="Back"
                showTitle={true}
                title={getSectionInfo().title}
                navItems={getSectionInfo().section === 'account' ? [
                  { href: '/settings/account/profile', label: 'Profile', icon: <User size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'profile' },
                  { href: '/settings/account/access', label: 'Account access', icon: <Shield size={18} style={{ fill: 'var(--color-base-icons-primary, #1C2024)' }} />, isSelected: selectedItem === 'access' }
                ] : undefined}
              />
              <main style={{ padding: '16px 16px 24px 16px', overflow: 'hidden' }}>
                <div 
                  style={{
                    borderRadius: 'var(--radius-6, 16px)',
                    border: '1px solid var(--color-neutral-alpha-4, rgba(0, 0, 45, 0.09))',
                    background: 'var(--color-base-panel-default, rgba(255, 255, 255, 0.80))',
                    padding: '40px 64px',
                    height: '100%',
                    overflow: 'auto'
                  }}
                >
          <div className="mb-10">
            <h1 className="display-9-medium mb-3" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>{getPageInfo().title}</h1>
            <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              {getPageInfo().description}
            </p>
          </div>
          {children}
        </div>
      </main>
    </div>
  )
}

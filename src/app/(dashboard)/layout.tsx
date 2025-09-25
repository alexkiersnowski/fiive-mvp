import { getDashboardData } from '@/lib/supabase/dashboard-data'
import { redirect } from 'next/navigation'
import DashboardLayoutClient from '@/components/layouts/DashboardLayoutClient'
import { UserProvider } from '@/lib/contexts/UserContext'
import QueryProvider from '@/lib/providers/query-provider'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getDashboardData()
  
  if (!data) {
    redirect('/signin')
  }

  return (
    <QueryProvider>
      <UserProvider>
        <DashboardLayoutClient 
          user={data.user}
          profile={data.user}
          organization={data.organization}
        >
          {children}
        </DashboardLayoutClient>
      </UserProvider>
    </QueryProvider>
  )
}

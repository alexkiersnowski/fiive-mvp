import { getDashboardData } from '@/lib/supabase/dashboard-data'
import { redirect } from 'next/navigation'
import DashboardLayoutClient from '@/components/layouts/DashboardLayoutClient'

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
    <DashboardLayoutClient 
      user={data.user}
      profile={data.user}
      organization={data.organization}
    >
      {children}
    </DashboardLayoutClient>
  )
}

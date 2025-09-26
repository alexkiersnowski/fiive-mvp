import { getDashboardData } from '@/lib/dashboard-data'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import DashboardLayout from '@/components/layouts/DashboardLayout'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getDashboardData()
  
  if (!data) {
    redirect('/signin')
  }

  // Read sidebar state from cookie
  const cookieStore = await cookies()
  const c = cookieStore.get("sidebar")?.value
  const initialIsCollapsed = c === "collapsed"

  return (
    <DashboardLayout 
      data={data}
      initialIsCollapsed={initialIsCollapsed}
    >
      {children}
    </DashboardLayout>
  )
}

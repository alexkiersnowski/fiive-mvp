import { getDashboardData } from '@/lib/dashboard-data'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import DashboardLayout from '@/components/layouts/DashboardLayout'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const data = await getDashboardData()
  const context = await getActiveContext()
  
  if (!data || !context) {
    redirect('/signin')
  }

  // Read sidebar state from cookie
  const cookieStore = await cookies()
  const c = cookieStore.get("sidebar")?.value
  const initialIsCollapsed = c === "collapsed"

  return (
    <DashboardLayout 
      data={data}
      context={context}
      initialIsCollapsed={initialIsCollapsed}
    >
      {children}
    </DashboardLayout>
  )
}

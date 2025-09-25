import { getDashboardData } from '@/lib/dashboard-data'
import { redirect } from 'next/navigation'
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

  return (
    <DashboardLayout data={data}>
      {children}
    </DashboardLayout>
  )
}

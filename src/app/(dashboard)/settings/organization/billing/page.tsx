import { getDashboardData } from '@/lib/dashboard-data'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { redirect } from 'next/navigation'
import BillingContent from './BillingContent'

export default async function BillingPage() {
  // Check if user is authenticated and get their role
  const data = await getDashboardData()
  const context = await getActiveContext()
  
  if (!data || !context) {
    redirect('/signin')
  }
  
  // Redirect members to home page
  if (data.currentUserRole === 'member') {
    redirect('/home')
  }

  return <BillingContent variant={context.variant} />
}

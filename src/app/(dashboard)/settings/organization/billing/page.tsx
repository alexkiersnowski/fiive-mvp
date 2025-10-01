import { getActiveContext } from '@/lib/mode/getActiveContext'
import { redirect } from 'next/navigation'
import BillingContent from './BillingContent'

export default async function BillingPage() {
  // Check if user is authenticated and get their role
  const context = await getActiveContext()
  
  if (!context) {
    redirect('/signin')
  }
  
  // Redirect members to home page
  if (context.currentUserRole === 'member') {
    redirect('/home')
  }

  return <BillingContent variant={context.variant} />
}

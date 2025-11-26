import { getActiveContext } from '@/lib/mode/getActiveContext'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import BillingContent from './BillingContent'

/**
 * Check if an organization has any real connections (non-draft status)
 * Real connections are those with status: 'invited', 'connected', or 'disconnected'
 */
const hasRealConnections = cache(async (
  orgId: string,
  variant: 'agency' | 'client'
): Promise<boolean> => {
  const supabase = await createClient()
  
  try {
    let query = supabase
      .from('connections')
      .select('id')
      .in('connection_status', ['invited', 'connected', 'disconnected'])
      .limit(1)
    
    if (variant === 'agency') {
      query = query.eq('agency_id', orgId)
    } else {
      query = query.eq('client_id', orgId)
    }
    
    const { data, error } = await query
    
    if (error) {
      console.error('Error checking for real connections:', error)
      // Default to showing "contact support" message for safety
      return true
    }
    
    // Return true if any real connections exist
    return (data?.length ?? 0) > 0
  } catch (error) {
    console.error('Unexpected error checking for real connections:', error)
    // Default to showing "contact support" message for safety
    return true
  }
})

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

  // Check if organization has real connections
  const canDeleteWorkspace = !(await hasRealConnections(context.orgId, context.variant))

  return <BillingContent variant={context.variant} canDeleteWorkspace={canDeleteWorkspace} organizationName={context.organization.name} />
}

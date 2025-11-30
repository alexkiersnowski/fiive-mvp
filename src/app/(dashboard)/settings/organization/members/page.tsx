import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getOrganizationMembers, getOrganizationInvitations } from '../../actions'
import { checkMemberLimit } from '@/lib/paywall/checkMemberLimit'
import MembersContent from './MembersContent'

// Cache for 30 seconds to improve performance while keeping data reasonably fresh
export const revalidate = 30

export default async function UserManagementPage() {
  const context = await getActiveContext()
  
  if (!context) {
    return null // Layout will handle redirect
  }

  // Use organization data from enhanced context
  const organization = context.organization
  const currentUserRole = context.currentUserRole

  // Check if organization data is missing
  if (!organization || !organization.id) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
            User management
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
            Manage your team and system owner
          </p>
        </div>
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--color-base-text-secondary)' }}>
            Unable to load organization data. Please try again.
          </p>
        </div>
      </div>
    )
  }

  // Prefetch member limit check in parallel with data fetches for optimal performance
  // Only check for agencies (clients have no limits)
  const billingStatus = organization.billing_status || 'free'
  const organizationType = (organization.type || 'agency') as 'agency' | 'client'
  
  // Run all fetches in parallel - member limit check uses fast count queries (head: true, no data transfer)
  const [membersResult, invitationsResult, memberLimitCheckResult] = await Promise.allSettled([
    getOrganizationMembers(organization.id),
    getOrganizationInvitations(organization.id),
    // Only run check for free agencies (skip for clients/paid agencies to avoid unnecessary query)
    organizationType === 'agency' && billingStatus === 'free'
      ? checkMemberLimit({
          organizationId: organization.id,
          billingStatus,
          organizationType,
        })
      : Promise.resolve({ allowed: true }), // Resolve immediately for clients/paid agencies
  ])
  
  // Handle members result
  const members = membersResult.status === 'fulfilled' && membersResult.value.ok 
    ? membersResult.value.data || []
    : []
  const membersHasNextPage = membersResult.status === 'fulfilled' && membersResult.value.ok
    ? (membersResult.value.hasNextPage || false)
    : false
  
  if (membersResult.status === 'rejected') {
    console.error('Error fetching members:', membersResult.reason)
  } else if (membersResult.status === 'fulfilled' && !membersResult.value.ok) {
    console.error('Error fetching members:', membersResult.value.message)
  }

  // Handle invitations result
  const invitations = invitationsResult.status === 'fulfilled' && invitationsResult.value.ok 
    ? invitationsResult.value.data || []
    : []
  const invitationsHasNextPage = invitationsResult.status === 'fulfilled' && invitationsResult.value.ok
    ? (invitationsResult.value.hasNextPage || false)
    : false
  
  if (invitationsResult.status === 'rejected') {
    console.error('Error fetching invitations:', invitationsResult.reason)
  } else if (invitationsResult.status === 'fulfilled' && !invitationsResult.value.ok) {
    console.error('Error fetching invitations:', invitationsResult.value.message)
  }

  // Calculate initialHasNextPage - true if either has more pages
  const initialHasNextPage = membersHasNextPage || invitationsHasNextPage

  // Extract canInviteMembers from prefetched check result
  const canInviteMembers = memberLimitCheckResult.status === 'fulfilled' 
    ? memberLimitCheckResult.value.allowed 
    : true // Default to true on error (fail open)

  // If both fail, show error
  if (members.length === 0 && invitations.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
            User management
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
            Manage your team and system owner
          </p>
        </div>
        <div className="text-center py-8">
          <p className="text-sm" style={{ color: 'var(--color-base-text-secondary)' }}>
            Unable to load data. Please try again.
          </p>
        </div>
      </div>
    )
  }

  return (
    <MembersContent
      members={members}
      invitations={invitations}
      organizationId={organization.id}
      currentUserRole={currentUserRole}
      unfilteredTotalCount={members.length + invitations.length}
      initialHasNextPage={initialHasNextPage}
      billingStatus={billingStatus}
      organizationType={organizationType}
      canInviteMembers={canInviteMembers}
    />
  )
}

import { createClient } from '@/lib/supabase/server'
import { getOrganizationMembers, getOrganizationInvitations } from '../../actions'
import MembersTable from './MembersTable'

// Force fresh data on every request to ensure updated data is shown immediately
export const revalidate = 0

export default async function UserManagementPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null // Layout will handle redirect
  }

  // Get user's organization with owner_id to determine user's role - RLS policies will filter to accessible organizations
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id, 
      name,
      owner_id
    `)
    .single()

  if (orgError || !organization) {
    console.error('Error fetching organization:', orgError)
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

  // Fetch organization members and invitations with proper error handling
  const [membersResult, invitationsResult] = await Promise.allSettled([
    getOrganizationMembers(organization.id),
    getOrganizationInvitations(organization.id)
  ])
  
  // Handle members result
  const members = membersResult.status === 'fulfilled' && membersResult.value.ok 
    ? membersResult.value.data || []
    : []
  
  if (membersResult.status === 'rejected') {
    console.error('Error fetching members:', membersResult.reason)
  } else if (membersResult.status === 'fulfilled' && !membersResult.value.ok) {
    console.error('Error fetching members:', membersResult.value.message)
  }

  // Handle invitations result
  const invitations = invitationsResult.status === 'fulfilled' && invitationsResult.value.ok 
    ? invitationsResult.value.data || []
    : []
  
  if (invitationsResult.status === 'rejected') {
    console.error('Error fetching invitations:', invitationsResult.reason)
  } else if (invitationsResult.status === 'fulfilled' && !invitationsResult.value.ok) {
    console.error('Error fetching invitations:', invitationsResult.value.message)
  }

  // Determine current user's role
  const currentUserRole = organization.owner_id === user.id ? 'owner' : 'member'

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
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          User management
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          {currentUserRole === 'owner' 
            ? 'Manage your team and system owner'
            : 'Your team and system owner'
          }
        </p>
      </div>

      <MembersTable
        members={members}
        invitations={invitations}
        organizationId={organization.id}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}

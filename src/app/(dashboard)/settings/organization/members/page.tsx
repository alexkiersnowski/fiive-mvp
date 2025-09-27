import { createClient } from '@/lib/supabase/server'
import { getOrganizationMembers } from '../../actions'
import MembersTable from './MembersTable'

// Force fresh data on every request to ensure updated data is shown immediately
export const revalidate = 0

export default async function UserManagementPage() {
  const supabase = await createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    return null // Layout will handle redirect
  }

  // Get user's organization through memberships table
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id, 
      name, 
      memberships!inner(user_id)
    `)
    .eq("memberships.user_id", user.id)
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

  // Fetch organization members
  const membersResult = await getOrganizationMembers(organization.id)
  
  if (!membersResult.ok) {
    console.error('Error fetching members:', membersResult.message)
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
            Unable to load members. Please try again.
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
          Manage your team and system owner
        </p>
      </div>

      <MembersTable
        members={membersResult.data || []}
        organizationId={organization.id}
      />
    </div>
  )
}

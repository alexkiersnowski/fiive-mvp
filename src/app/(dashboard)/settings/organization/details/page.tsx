import { createClient } from '@/lib/supabase/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import DetailsForm from './DetailsForm'

// Force fresh data on every request to ensure updated data is shown immediately
export const revalidate = 0

export default async function OrganizationDetailsPage() {
  const supabase = await createClient()
  const context = await getActiveContext()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user || !context) {
    return null // Layout will handle redirect
  }

  // Get user's organization with owner_id to determine user's role - RLS policies will filter to accessible organizations
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select(`
      id, 
      name, 
      website, 
      description, 
      industry, 
      currency_code, 
      logo_url, 
      connection_code,
      owner_id
    `)
    .single()

  if (orgError) {
    console.error('Error fetching organization:', orgError)
    // Render empty form or error state
  }

  // Determine current user's role
  const currentUserRole = organization?.owner_id === user.id ? 'owner' : 'member'

  // Contextual copy based on organization type
  const isAgency = context.variant === 'agency'
  const pageTitle = isAgency ? 'Agency details' : 'Company details'
  const pageDescription = isAgency 
    ? (currentUserRole === 'owner' 
        ? 'Manage how your agency will be seen by clients'
        : 'How your agency will be seen by clients'
      )
    : (currentUserRole === 'owner'
        ? 'Manage how your company will be seen by agencies'
        : 'How your company will be seen by agencies'
      )

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          {pageTitle}
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          {pageDescription}
        </p>
      </div>

      <DetailsForm
        initialValues={{
          name: organization?.name ?? "",
          website: organization?.website ?? "",
          description: organization?.description ?? "",
          industry: organization?.industry ?? "",
          currency_code: organization?.currency_code ?? "",
          logo_url: organization?.logo_url ?? "",
        }}
        connectionCode={organization?.connection_code ?? ""}
        organizationId={organization?.id ?? ""}
        currentUserRole={currentUserRole}
        variant={context.variant}
      />
    </div>
  )
}
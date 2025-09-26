import { createClient } from '@/lib/supabase/server'
import DetailsForm from './DetailsForm'

// Force fresh data on every request to ensure updated data is shown immediately
export const revalidate = 0

export default async function OrganizationDetailsPage() {
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
      website, 
      description, 
      industry, 
      currency_code, 
      logo_url, 
      connection_code,
      memberships!inner(user_id)
    `)
    .eq("memberships.user_id", user.id)
    .single()

  if (orgError) {
    console.error('Error fetching organization:', orgError)
    // Render empty form or error state
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          Agency details
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          Manage how your agency will be seen by clients
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
      />
    </div>
  )
}
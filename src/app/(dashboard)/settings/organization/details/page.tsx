import { getActiveContext } from '@/lib/mode/getActiveContext'
import DetailsForm from './DetailsForm'

// Force fresh data on every request to ensure updated data is shown immediately
export const revalidate = 0

export default async function OrganizationDetailsPage() {
  const context = await getActiveContext()
  
  if (!context) {
    return null // Layout will handle redirect
  }

  // Use organization data from enhanced context
  const organization = context.organization
  const currentUserRole = context.currentUserRole

  // Debug: Log organization data to see what we're getting
  console.log('Organization data:', organization)
  console.log('Context variant:', context.variant)
  console.log('Current user role:', currentUserRole)

  // Check if organization data is missing
  if (!organization || !organization.id) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
            Organization Details
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
            Unable to load organization data. Please try again.
          </p>
        </div>
      </div>
    )
  }

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
          name: organization.name ?? "",
          website: organization.website ?? "",
          description: organization.description ?? "",
          industry: organization.industry ?? "",
          currency_code: organization.currencyCode ?? "",
          logo_url: organization.logoUrl ?? "",
        }}
        connectionCode={organization.connectionCode ?? ""}
        organizationId={organization.id}
        currentUserRole={currentUserRole}
        variant={context.variant}
      />
    </div>
  )
}
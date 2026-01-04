import type { Metadata } from 'next';
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { createClient } from '@/lib/supabase/server'
import { cache } from 'react'
import DetailsForm from './DetailsForm'
import DeleteWorkspace from './DeleteWorkspace'

export const metadata: Metadata = {
  title: 'Fiive | Organization Settings',
};

// Cache for 30 seconds to improve performance while keeping data reasonably fresh
export const revalidate = 30

/**
 * Check if an organization has any real connections (non-internal status)
 * Real connections are those with status: 'invited', 'connected', or 'disconnected'
 * Only 'internal' connections are excluded - they don't block workspace deletion
 * 
 * Optimized to use indexes:
 * - idx_connections_agency_id for agency lookups
 * - idx_connections_client_id and idx_connections_client_status for client lookups
 */
const hasRealConnections = cache(async (
  orgId: string,
  variant: 'agency' | 'client'
): Promise<boolean> => {
  const supabase = await createClient()
  
  try {
    // Optimized query: use count with head:true for fastest possible check
    // No data transfer - just returns count, PostgreSQL can optimize this better
    // Indexes will be used automatically:
    // - For agencies: idx_connections_agency_id
    // - For clients: idx_connections_client_status (composite index covers both filters)
    let query = supabase
      .from('connections')
      .select('id', { count: 'exact', head: true })
      .in('connection_status', ['invited', 'connected', 'disconnected'])
    
    if (variant === 'agency') {
      query = query.eq('agency_id', orgId)
    } else {
      query = query.eq('client_id', orgId)
    }
    
    const { count, error } = await query
    
    if (error) {
      console.error('Error checking for real connections:', error)
      // Default to showing "contact support" message for safety
      return true
    }
    
    // Return true if any real connections exist
    return (count ?? 0) > 0
  } catch (error) {
    console.error('Unexpected error checking for real connections:', error)
    // Default to showing "contact support" message for safety
    return true
  }
})

export default async function OrganizationDetailsPage() {
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

  // Check if organization has real connections (invited, connected, or disconnected)
  // Internal connections don't count as "real" connections
  const hasRealConnectionsResult = await hasRealConnections(context.orgId, context.variant)
  
  // Can delete workspace only if:
  // 1. No real connections exist (only internal or no connections)
  // 2. billing_status is 'free'
  // 3. No Stripe subscription ID exists (indicates actual subscription was created)
  const canDeleteWorkspace = 
    !hasRealConnectionsResult && 
    organization.billing_status === 'free' &&
    !organization.stripeSubscriptionId

  return (
    <div className="space-y-6">
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

      {/* Delete Workspace Section */}
      {currentUserRole === 'owner' && (
        <DeleteWorkspace 
          canDeleteWorkspace={canDeleteWorkspace}
          organizationName={organization.name}
          organizationId={organization.id}
        />
      )}
    </div>
  )
}
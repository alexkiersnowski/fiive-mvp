import { getActiveContext } from '@/lib/mode/getActiveContext'
import { getConnectionSnapshot } from '@/features/connections/server'
import { notFound } from 'next/navigation'
import ConnectionSettingsForm from '@/features/connections/settings/ConnectionSettingsForm'

// Cache for 30 seconds to improve performance while keeping data reasonably fresh
export const revalidate = 30

interface ClientConnectionSettingsPageProps {
  params: Promise<{ connectionId: string }>
}

export default async function ClientConnectionSettingsPage({ params }: ClientConnectionSettingsPageProps) {
  const context = await getActiveContext()
  
  if (!context) {
    notFound()
  }

  // Only agencies can view client connections
  if (context.variant !== 'agency') {
    notFound()
  }

  const resolvedParams = await params
  const connectionId = resolvedParams.connectionId

  // Fetch connection snapshot
  const snapshot = await getConnectionSnapshot(context, connectionId)

  if (!snapshot) {
    notFound()
  }

  // Extract partner organization data
  const partnerOrganization = {
    id: snapshot.partner.id,
    name: snapshot.partner.name,
    logo: snapshot.partner.logo,
    description: snapshot.partner.description,
    website: snapshot.partner.website,
    industry: snapshot.partner.industry,
    connectionCode: snapshot.partner.connectionCode,
    type: snapshot.partner.type
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
          Connection settings
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
          Manage your connection settings with your client
        </p>
      </div>

      <ConnectionSettingsForm 
        partnerOrganization={partnerOrganization}
        connectionStatus={snapshot.connection.status}
        connectionId={connectionId}
      />
    </div>
  )
}


import { RequestDetailContent } from '@/features/connections/requests/RequestDetailContent'
import { getRequestById, getAgencyMembersForConnection, getConnectionPartnerName } from '@/features/connections/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { notFound } from 'next/navigation'

export default async function AgencyRequestDetailPage({ 
  params 
}: { 
  params: Promise<{ connectionId: string; requestId: string }> 
}) {
  const { connectionId, requestId } = await params
  
  // Fetch request data, agency members, and context in parallel
  const [request, agencyMembers, context] = await Promise.all([
    getRequestById(requestId, connectionId),
    getAgencyMembersForConnection(connectionId),
    getActiveContext()
  ])
  
  if (!context) {
    notFound()
  }
  
  // Fetch partner name for breadcrumbs
  const partnerName = await getConnectionPartnerName(connectionId, context)
  
  if (!request) {
    notFound()
  }
  
  return (
    <RequestDetailContent 
      requestId={request.id}
      title={request.title}
      description={request.description}
      client={request.client}
      submittedBy={request.submittedBy}
      assignee={request.assignee}
      agencyMembers={agencyMembers}
      type={request.type}
      status={request.status}
      createdAt={request.createdAt}
      mode="page"
      createdByOrgId={request.createdByOrgId}
      currentOrgId={context.organization.id}
      connectionId={connectionId}
      partnerName={partnerName || undefined}
    />
  )
}


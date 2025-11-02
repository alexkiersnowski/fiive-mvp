import { RequestDetailContent } from '@/features/connections/requests/RequestDetailContent'
import { getRequestById, getAgencyMembersForConnection, getConnectionPartnerName, getCommentsForRequest } from '@/features/connections/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { notFound } from 'next/navigation'

export default async function ClientRequestDetailPage({ 
  params 
}: { 
  params: Promise<{ connectionId: string; requestId: string }> 
}) {
  const { connectionId, requestId } = await params
  
  // Fetch request data, comments, agency members, and context in parallel
  const [request, comments, agencyMembers, context] = await Promise.all([
    getRequestById(requestId, connectionId),
    getCommentsForRequest(requestId),
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
      agency={request.agency}
      submittedBy={request.submittedBy}
      assignee={request.assignee}
      agencyMembers={agencyMembers}
      type={request.type}
      status={request.status}
      createdAt={request.createdAt}
      mode="page"
      createdByOrgId={request.createdByOrgId}
      createdByOrgType={request.createdByOrgType}
      currentOrgId={context.organization.id}
      connectionId={connectionId}
      partnerName={partnerName || undefined}
      variant={context.variant}
      activeUser={context.user ? {
        id: context.user.id,
        firstName: context.user.firstName,
        lastName: context.user.lastName,
        avatarUrl: context.user.avatarUrl
      } : undefined}
      initialComments={comments}
    />
  )
}


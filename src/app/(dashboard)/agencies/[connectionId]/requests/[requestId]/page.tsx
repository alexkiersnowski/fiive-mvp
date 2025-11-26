import { RequestDetailContent } from '@/features/connections/requests/RequestDetailContent'
import { getRequestById, getAgencyMembersForConnection, getConnectionPartnerName, getCommentsForRequest, getProjectsForConnection, getConnectionStatus } from '@/features/connections/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { notFound } from 'next/navigation'

export default async function AgencyRequestDetailPage({ 
  params 
}: { 
  params: Promise<{ connectionId: string; requestId: string }> 
}) {
  const { connectionId, requestId } = await params
  
  // Fetch request data, comments, agency members, projects, context, and connection status in parallel
  const [request, comments, agencyMembers, projectsData, context] = await Promise.all([
    getRequestById(requestId, connectionId),
    getCommentsForRequest(requestId),
    getAgencyMembersForConnection(connectionId),
    getProjectsForConnection(connectionId, { limit: 1000, offset: 0 }),
    getActiveContext()
  ])
  
  // Get connection status to determine if disconnected
  const connectionStatus = context ? await getConnectionStatus(connectionId, context) : null
  const isDisconnected = connectionStatus === 'disconnected'
  
  if (!context) {
    notFound()
  }
  
  // Fetch partner name for breadcrumbs
  const partnerName = await getConnectionPartnerName(connectionId, context)
  
  if (!request) {
    notFound()
  }
  
  // Transform projects to the format expected by RequestDetailContent
  const projects = projectsData.projects.map(p => ({ id: p.id, name: p.title }))
  
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
      projects={projects}
      project={request.project}
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
      isDisconnected={isDisconnected}
    />
  )
}


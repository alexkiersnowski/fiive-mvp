import { ProjectDetailContent } from '@/features/connections/projects/ProjectDetailContent'
import { getProjectById, getAgencyMembersForConnection, getConnectionPartnerName, getCommentsForProject } from '@/features/connections/server'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { notFound } from 'next/navigation'

export default async function ClientProjectDetailPage({ 
  params 
}: { 
  params: Promise<{ connectionId: string; projectId: string }> 
}) {
  const { connectionId, projectId } = await params
  
  // Fetch project data, comments, agency members, and context in parallel
  const [project, comments, agencyMembers, context] = await Promise.all([
    getProjectById(projectId, connectionId),
    getCommentsForProject(projectId),
    getAgencyMembersForConnection(connectionId),
    getActiveContext()
  ])
  
  if (!context) {
    notFound()
  }
  
  // Fetch partner name for breadcrumbs
  const partnerName = await getConnectionPartnerName(connectionId, context)
  
  if (!project) {
    notFound()
  }
  
  return (
    <ProjectDetailContent 
      projectId={project.id}
      title={project.title}
      description={project.description}
      client={project.client}
      agency={project.agency}
      submittedBy={project.submittedBy}
      assignee={project.assignee}
      agencyMembers={agencyMembers}
      type={project.type}
      status={project.status}
      startDate={project.startDate}
      endDate={project.endDate}
      createdAt={project.createdAt}
      requestsCount={project.requestsCount}
      tasksCount={project.tasksCount}
      mode="page"
      createdByOrgId={project.createdByOrgId}
      createdByOrgType={project.createdByOrgType}
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


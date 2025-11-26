import { TaskDetailContent } from '@/features/connections/tasks/TaskDetailContent'
import { getTaskById, getConnectionMembers, getConnectionPartnerName, getCommentsForTask, getProjectsForConnection, getConnectionStatus } from '@/features/connections/server'
import { sortMembersWithActiveFirst } from '@/features/connections/utils/memberSorting'
import { getActiveContext } from '@/lib/mode/getActiveContext'
import { notFound } from 'next/navigation'

export default async function ClientTaskDetailPage({ 
  params 
}: { 
  params: Promise<{ connectionId: string; taskId: string }> 
}) {
  const { connectionId, taskId } = await params
  
  // Fetch task data, comments, agency members, projects, and context in parallel
  const [task, comments, memberData, projectsData, context] = await Promise.all([
    getTaskById(taskId, connectionId),
    getCommentsForTask(taskId),
    getConnectionMembers(connectionId),
    getProjectsForConnection(connectionId, { limit: 1000, offset: 0 }),
    getActiveContext()
  ])
  if (!context) {
    notFound()
  }

  const combinedMembers = [...memberData.agencyMembers]
  for (const member of memberData.clientMembers) {
    if (!combinedMembers.some(existing => existing.id === member.id)) {
      combinedMembers.push(member)
    }
  }

  const assignableMembers = sortMembersWithActiveFirst(combinedMembers, context.user?.id)
  
  // Fetch partner name for breadcrumbs
  const partnerName = await getConnectionPartnerName(connectionId, context)
  
  // Get connection status to determine if disconnected
  const connectionStatus = await getConnectionStatus(connectionId, context)
  const isDisconnected = connectionStatus === 'disconnected'
  
  if (!task) {
    notFound()
  }
  
  // Transform projects to the format expected by TaskDetailContent
  const projects = projectsData.projects.map(p => ({ id: p.id, name: p.title }))
  
  return (
    <TaskDetailContent 
      taskId={task.id}
      title={task.title}
      description={task.description}
      client={task.client}
      agency={task.agency}
      submittedBy={task.submittedBy}
      assignee={task.assignee}
      agencyMembers={assignableMembers}
      projects={projects}
      project={task.project}
      status={task.status}
      dueDate={task.dueDate}
      dueDateRaw={task.dueDateRaw}
      createdAt={task.createdAt}
      mode="page"
      createdByOrgId={task.createdByOrgId}
      createdByOrgType={task.createdByOrgType}
      clientVisible={task.clientVisible}
      clientVisibilityLocked={task.clientVisibilityLocked}
      sourceRequestId={task.sourceRequestId ?? null}
      linkedRequest={task.linkedRequest ?? null}
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


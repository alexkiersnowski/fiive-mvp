"use client"

import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalTaskRow } from './GlobalTaskRow'
import type { Task } from './types'
import type { TaskStatus } from './taskGrouping'
import type { InlineEditRef } from '@/components/ui/inline-edit'

interface TaskBlockProps {
  status: TaskStatus
  clientId: string
  clientName?: string
  clientLogoUrl?: string
  agencyId?: string
  agencyName?: string
  agencyLogoUrl?: string
  tasks: Task[]
  isExpanded: boolean
  onToggle: () => void
  isAgency: boolean
  isFirstClient?: boolean
  getComboboxOptionsForTask: (connectionId: string) => Array<{
    value: string
    label: string
    avatar?: string
    email: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  getClientEditableMembersForTask: (connectionId: string) => {
    idSet: Set<string>
    options: Array<{
      value: string
      label: string
      avatar?: string
      email: string
    }>
  }
  membersByConnection?: Record<string, Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>>
  statusInlineRefs: React.MutableRefObject<Record<string, InlineEditRef | null>>
  onStatusChange: (taskId: string, newStatus: string) => void
  onAssigneeSelect: (taskId: string, memberId: string, connectionId: string) => void
  onClearAssignee: (taskId: string) => void
  onRowClick: (taskId: string) => void
  onCopyLink: (taskId: string, connectionId: string) => void
  onDeleteTask: (taskId: string) => void
  onContactClick: (contact: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string
    job_title?: string
    organization: {
      id: string
      name: string
      logo_url?: string
    }
  }) => void
  openActionsDropdown: string | null
  setOpenActionsDropdown: (taskId: string | null) => void
  baseRoute: string
}

/**
 * Task Block Component
 * Renders a client header + all tasks for that client
 * Tasks are NOT virtualized - rendered directly
 */
export function TaskBlock({
  status,
  clientId,
  clientName,
  clientLogoUrl,
  agencyId,
  agencyName,
  agencyLogoUrl,
  tasks,
  isExpanded,
  onToggle,
  isAgency,
  isFirstClient,
  getComboboxOptionsForTask,
  getClientEditableMembersForTask,
  membersByConnection,
  statusInlineRefs,
  onStatusChange,
  onAssigneeSelect,
  onClearAssignee,
  onRowClick,
  onCopyLink,
  onDeleteTask,
  onContactClick,
  openActionsDropdown,
  setOpenActionsDropdown,
  baseRoute
}: TaskBlockProps) {
  return (
    <div>
      {/* Client Header */}
      <ClientGroupHeader
        clientId={clientId}
        clientName={clientName}
        clientLogoUrl={clientLogoUrl}
        agencyId={agencyId}
        agencyName={agencyName}
        agencyLogoUrl={agencyLogoUrl}
        count={tasks.length}
        isCollapsed={!isExpanded}
        onToggle={onToggle}
        isAgency={isAgency}
      />
      
      {/* Tasks - rendered directly when expanded (NOT virtualized) */}
      {isExpanded && tasks.map((task) => {
        const clientEditableMembers = getClientEditableMembersForTask(task.connectionId)
        return (
          <GlobalTaskRow
            key={task.id}
            task={task}
            isAgency={isAgency}
            clientEditableMembers={clientEditableMembers}
            comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
            membersByConnection={membersByConnection || {}}
            statusInlineRefs={statusInlineRefs}
            onStatusChange={onStatusChange}
            onAssigneeSelect={onAssigneeSelect}
            onClearAssignee={onClearAssignee}
            onRowClick={onRowClick}
            onCopyLink={onCopyLink}
            onDeleteTask={onDeleteTask}
            onContactClick={onContactClick}
            openActionsDropdown={openActionsDropdown}
            setOpenActionsDropdown={setOpenActionsDropdown}
            baseRoute={baseRoute}
          />
        )
      })}
    </div>
  )
}








"use client"

import { useState, memo } from 'react'
import { TaskGroupHeader } from './TaskGroupHeader'
import { VirtualizedTaskList } from './VirtualizedTaskList'
import { TaskRow } from './TaskRow'
import type { Task, TaskWithUiId, TaskStatus } from '../server'
import type { InlineEditRef } from '@/components/ui/inline-edit'

interface StatusSectionProps {
  status: TaskStatus
  tasks: Task[] // All tasks for this status (fetched upfront)
  count: number
  // NO isExpanded prop - StatusSection owns this internally
  // NO onToggle prop - StatusSection handles toggle internally
  onDrop?: (taskId: string, newStatus: TaskStatus) => void // Cross-status drop handler
  isAgency: boolean
  isDisconnected: boolean
  clientEditableMembers: {
    idSet: Set<string>
    options: Array<{
      value: string
      label: string
      avatar?: string
      email: string
    }>
  }
  comboboxOptions: Array<{
    value: string
    label: string
    avatar?: string
    email: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  agencyMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  agencyOrganization?: {
    id: string
    name: string
    logoUrl?: string
  }
  statusInlineRefs: React.MutableRefObject<Record<string, InlineEditRef | null>>
  onStatusChange: (taskId: string, newStatus: string) => void
  onAssigneeSelect: (taskId: string, memberId: string) => void
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
  setOpenActionsDropdown: (id: string | null) => void
  baseRoute: string
  // Drag & drop props
  draggedTaskId: string | null
  onDragStart: (taskId: string, e: React.MouseEvent) => void
  canDragTask: (task: Task) => boolean
  isDraggingActive: boolean
  hoveredGroupStatus: TaskStatus | null
  parentRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * StatusSection - Owns expanded state, dropzone, and empty state for a status group
 * 
 * Responsibilities:
 * - Own expanded state internally (uses useState)
 * - Own empty state rendering
 * - Own dropzone (renders in TaskGroupHeader)
 * - Own drop handling (calls onDrop when task dropped on this status)
 * - Conditionally renders VirtualizedTaskList when expanded
 * - No pagination (all data provided upfront)
 */
function StatusSectionComponent({
  status,
  tasks,
  count,
  onDrop,
  isAgency,
  isDisconnected,
  clientEditableMembers,
  comboboxOptions,
  agencyMembers,
  agencyOrganization,
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
  baseRoute,
  draggedTaskId,
  onDragStart,
  canDragTask,
  isDraggingActive,
  hoveredGroupStatus,
  parentRef
}: StatusSectionProps) {
  // StatusSection owns expanded state internally
  // Default: expanded for all statuses except 'done'
  const [isExpanded, setIsExpanded] = useState(status !== 'done')

  const handleToggle = () => {
    setIsExpanded(prev => !prev)
  }

  // Check if this is the first group (In progress is always first)
  const isFirstGroup = status === 'in_progress'

  // Check if this status section is being hovered during drag
  const isDragHovered = hoveredGroupStatus === status && draggedTaskId !== null

  // Render header + list when expanded, header only when collapsed
  // Wrap entire section in div with data-status-section for drag-and-drop detection
  return (
    <div data-status-section={status}>
      <TaskGroupHeader
        status={status}
        count={count}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        isAgency={isAgency}
        isDragHovered={isDragHovered}
        isFirstGroup={isFirstGroup}
        isDraggingActive={isDraggingActive}
      />
      {isExpanded && tasks.length > 0 && (
        <VirtualizedTaskList
          tasks={tasks}
          parentRef={parentRef}
          renderRow={(task, index) => {
            const isDragging = draggedTaskId === task.id
            // Use stable UI identity to prevent remount on temp→real transition
            const uiId = (task as TaskWithUiId)._uiId || task.id
            return (
              <TaskRow
                key={uiId}
                task={task}
                isAgency={isAgency}
                isDisconnected={isDisconnected}
                clientEditableMembers={clientEditableMembers}
                comboboxOptions={comboboxOptions}
                agencyMembers={agencyMembers}
                agencyOrganization={agencyOrganization}
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
                isDragging={isDragging}
                onDragStart={onDragStart}
                canDrag={canDragTask(task)}
                isDraggingActive={isDraggingActive}
              />
            )
          }}
        />
      )}
    </div>
  )
}

// Memoize StatusSection to prevent unnecessary re-renders
export const StatusSection = memo(StatusSectionComponent)

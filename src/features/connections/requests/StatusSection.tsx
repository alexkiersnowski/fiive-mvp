"use client"

import { useState, memo } from 'react'
import { RequestGroupHeader } from './RequestGroupHeader'
import { VirtualizedRequestList } from './VirtualizedRequestList'
import { RequestRow } from './RequestRow'
import type { Request } from '../server'
import type { RequestStatus } from './requestSort'
import type { InlineEditRef } from '@/components/ui/inline-edit'

interface StatusSectionProps {
  status: RequestStatus
  requests: Request[] // All requests for this status (fetched upfront)
  count: number
  // NO isExpanded prop - StatusSection owns this internally
  // NO onToggle prop - StatusSection handles toggle internally
  onDrop?: (requestId: string, newStatus: RequestStatus) => void // Cross-status drop handler
  isAgency: boolean
  isDisconnected: boolean
  comboboxOptions: Array<{
    value: string
    label: string
    avatar?: string
    email: string
  }>
  agencyMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  agencyOrganization?: {
    id: string
    name: string
    logoUrl?: string
  }
  statusInlineRefs: React.MutableRefObject<Record<string, InlineEditRef | null>>
  onStatusChange: (requestId: string, newStatus: string) => void
  onAssigneeSelect: (requestId: string, memberId: string) => void
  onClearAssignee: (requestId: string) => void
  onRowClick: (requestId: string) => void
  onCopyLink: (requestId: string, connectionId: string) => void
  onDeleteRequest: (requestId: string) => void
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
  currentOrgId: string
  onConvertToTask?: (request: Request) => void
  // Drag & drop props
  draggedRequestId: string | null
  onDragStart: (requestId: string, e: React.MouseEvent) => void
  canDragRequest: (request: Request) => boolean
  isDraggingActive: boolean
  hoveredGroupStatus: RequestStatus | null
  parentRef?: React.RefObject<HTMLDivElement | null>
}

/**
 * StatusSection - Owns expanded state, dropzone, and empty state for a status group
 * 
 * Responsibilities:
 * - Own expanded state internally (uses useState)
 * - Own empty state rendering
 * - Own dropzone (renders in RequestGroupHeader)
 * - Own drop handling (calls onDrop when request dropped on this status)
 * - Conditionally renders VirtualizedRequestList when expanded
 * - No pagination (all data provided upfront)
 */
function StatusSectionComponent({
  status,
  requests,
  count,
  onDrop,
  isAgency,
  isDisconnected,
  comboboxOptions,
  agencyMembers,
  agencyOrganization,
  statusInlineRefs,
  onStatusChange,
  onAssigneeSelect,
  onClearAssignee,
  onRowClick,
  onCopyLink,
  onDeleteRequest,
  onContactClick,
  openActionsDropdown,
  setOpenActionsDropdown,
  baseRoute,
  currentOrgId,
  onConvertToTask,
  draggedRequestId,
  onDragStart,
  canDragRequest,
  isDraggingActive,
  hoveredGroupStatus,
  parentRef
}: StatusSectionProps) {
  // StatusSection owns expanded state internally
  // Default: expanded for all statuses except 'closed' and 'canceled'
  const [isExpanded, setIsExpanded] = useState(status !== 'closed' && status !== 'canceled')

  const handleToggle = () => {
    setIsExpanded(prev => !prev)
  }

  // Check if this is the first group (new is always first)
  const isFirstGroup = status === 'new'

  // Check if this status section is being hovered during drag
  const isDragHovered = hoveredGroupStatus === status && draggedRequestId !== null

  // Render header + list when expanded, header only when collapsed
  // Wrap entire section in div with data-status-section for drag-and-drop detection
  return (
    <div data-status-section={status}>
      <RequestGroupHeader
        status={status}
        count={count}
        isExpanded={isExpanded}
        onToggle={handleToggle}
        isAgency={isAgency}
        isDragHovered={isDragHovered}
        isFirstGroup={isFirstGroup}
        isDraggingActive={isDraggingActive}
      />
      {isExpanded && requests.length > 0 && (
        <VirtualizedRequestList
          requests={requests}
          parentRef={parentRef}
          renderRow={(request, index) => {
            const isDragging = draggedRequestId === request.id
            return (
              <RequestRow
                key={request.id}
                request={request}
                isAgency={isAgency}
                isDisconnected={isDisconnected}
                comboboxOptions={comboboxOptions}
                agencyMembers={agencyMembers}
                agencyOrganization={agencyOrganization}
                statusInlineRefs={statusInlineRefs}
                onStatusChange={onStatusChange}
                onAssigneeSelect={onAssigneeSelect}
                onClearAssignee={onClearAssignee}
                onRowClick={onRowClick}
                onCopyLink={onCopyLink}
                onDeleteRequest={onDeleteRequest}
                onContactClick={onContactClick}
                openActionsDropdown={openActionsDropdown}
                setOpenActionsDropdown={setOpenActionsDropdown}
                baseRoute={baseRoute}
                currentOrgId={currentOrgId}
                onConvertToTask={onConvertToTask}
                isDragging={isDragging}
                onDragStart={onDragStart}
                canDrag={canDragRequest(request)}
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

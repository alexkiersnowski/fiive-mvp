"use client"

import { useRef, useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User } from '@phosphor-icons/react'
import type { Request } from '../server'
import { DragHandleIcon } from '../tasks/DragHandleIcon'
import { formatRequestDate } from '../formatters'

interface RequestRowProps {
  request: Request
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
  isDragging?: boolean
  onDragStart?: (requestId: string, e: React.MouseEvent) => void
  canDrag?: boolean
  isGhost?: boolean
  isDraggingActive?: boolean
}

function RequestRowComponent({
  request,
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
  baseRoute: _baseRoute,
  currentOrgId,
  onConvertToTask,
  isDragging = false,
  onDragStart,
  canDrag = false,
  isGhost = false,
  isDraggingActive = false
}: RequestRowProps) {
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [isAssigneeUnassigned] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)

  const handleMouseDown = (e: React.MouseEvent) => {
    // Only start drag if user can drag and not clicking on interactive elements
    if (!canDrag || !onDragStart) return
    
    // Don't start drag if clicking on buttons, dropdowns, or interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('[role="combobox"]') ||
      target.closest('[role="menu"]') ||
      target.closest('[role="menuitem"]') ||
      target.closest('.inline-edit-popover')
    ) {
      return
    }
    
    // Prevent Safari text selection immediately (Safari-specific, Chrome ignores this)
    // We'll clean this up in the drag hook's useEffect
    const preventSelectStart = (e: Event) => {
      e.preventDefault()
    }
    document.addEventListener('selectstart', preventSelectStart, { passive: false })
    
    onDragStart(request.id, e)
  }

  return (
    <div
      ref={rowRef}
      className={`group grid items-center h-[44px] border-b border-[var(--color-neutral-4)] ${isDraggingActive ? '' : 'hover:bg-[var(--color-interactive-surface-hover)]'} transition-colors duration-75 w-full ${
        isGhost ? '' : 'cursor-pointer'
      }`}
      style={{
        gridTemplateColumns: isAgency 
          ? '44px 4fr 3fr 3fr 3fr 3fr 44px'
          : '44px 4fr 3fr 3fr 3fr 3fr 44px',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
        minWidth: 0,
        opacity: isDragging ? 0.5 : 1,
        userSelect: isDragging ? 'none' : 'auto',
        pointerEvents: isGhost ? 'none' : 'auto'
      }}
      onClick={isGhost ? undefined : () => onRowClick(request.id)}
      onMouseDown={isGhost ? undefined : handleMouseDown}
      draggable={false}
      data-request-id={request.id}
      data-request-status={request.status}
    >
      {/* Drag Handle Icon - 44px cell */}
      {canDrag && (
      <div className={`opacity-0 ${isDraggingActive ? '' : 'group-hover:opacity-100'} transition-opacity duration-75`}>
        <DragHandleIcon />
      </div>
      )}
      {!canDrag && <div></div>}

      {/* Title */}
      <div className="min-w-0 truncate py-0 px-3">
        <span className="text-sm-regular">{request.title}</span>
      </div>

      {/* Status */}
      <div 
        className="min-w-0 py-0 px-3"
        onClick={(isAgency && !isDisconnected) ? (e) => e.stopPropagation() : undefined}
        onMouseDown={(isAgency && !isDisconnected) ? (e) => e.stopPropagation() : undefined}
      >
        {isAgency && !isDisconnected ? (
          <InlineEdit
            ref={(instance) => {
              statusInlineRefs.current[request.id] = instance
            }}
            type="badge"
            value={request.status}
            options={[
              { value: 'new', label: 'New' },
              { value: 'in_review', label: 'In review' },
              { value: 'accepted', label: 'Accepted' },
              { value: 'canceled', label: 'Canceled' },
              { value: 'closed', label: 'Closed' },
            ]}
            onSave={(newStatus) => {
              statusInlineRefs.current[request.id]?.closePopover()
              onStatusChange(request.id, newStatus)
            }}
            badgeComponent="request"
            disablePopoverAnimation
            disableHoverTransition
            className="truncate h-6 rounded-[8px]"
          />
        ) : (
          <RequestBadge 
            variant={request.status as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'} 
            size="sm" 
            showText={true}
            customLabel={request.status === 'new' && !isAgency ? 'Submitted' : undefined}
            className="inline-flex"
          />
        )}
      </div>

      {isAgency ? (
        <>
          {/* Assignee */}
          <div 
            className="min-w-0 py-0 px-3"
            onClick={isDisconnected ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ListRow
              ref={assigneeListRowRef}
              avatar={true}
              avatarUrl={!isAssigneeUnassigned && request.assignee ? request.assignee.avatarUrl : undefined}
              avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
              text={!request.assignee ? "Unassigned" : request.assignee.name}
              textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
              variant="stacked"
              className="min-w-0 min-h-[32px]"
              comboboxSelectedValue={request.assignee?.id ?? null}
              onClick={() => {
                // Assignee click handled by combobox
              }}
              comboboxOptions={isDisconnected ? undefined : comboboxOptions}
              onComboboxSelect={isDisconnected ? undefined : (memberId) => onAssigneeSelect(request.id, memberId)}
              comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
              comboboxWidth={isDisconnected ? undefined : "240px"}
              clearable={isDisconnected ? false : !!request.assignee}
              onClear={isDisconnected ? undefined : () => onClearAssignee(request.id)}
              nonInteractive={isDisconnected}
            />
          </div>

          {/* Project */}
          <div className="min-w-0 py-0 px-3">
            {request.project ? (
              <Badge variant="neutral" className="text-xs">
                <span className="truncate">{request.project.name}</span>
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-xs">
                <span className="truncate">General request</span>
              </Badge>
            )}
          </div>
        </>
      ) : (
        <>
          {/* Owner (Assignee) */}
          <div 
            className="min-w-0 py-0 px-3"
            onClick={request.assignee && !isDisconnected ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <ListRow
              avatar={true}
              avatarUrl={request.assignee ? request.assignee.avatarUrl : undefined}
              avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
              text={!request.assignee ? "Unassigned" : request.assignee.name}
              textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
              variant="stacked"
              className="min-w-0"
              comboboxSelectedValue={request.assignee?.id ?? null}
              nonInteractive={isDisconnected || !request.assignee}
              onClick={request.assignee && !isDisconnected ? () => {
                const nameParts = request.assignee!.name.split(' ')
                const assigneeMember = agencyMembers.find(member => member.id === request.assignee!.id)
                onContactClick({
                  id: request.assignee!.id,
                  first_name: nameParts[0] || '',
                  last_name: nameParts.slice(1).join(' ') || '',
                  email: request.assignee!.email,
                  avatar_url: request.assignee!.avatarUrl || '',
                  job_title: assigneeMember?.jobTitle,
                  organization: {
                    id: agencyOrganization?.id || '',
                    name: agencyOrganization?.name || '',
                    logo_url: agencyOrganization?.logoUrl || ''
                  }
                })
              } : undefined}
            />
          </div>

          {/* Project */}
          <div className="min-w-0 py-0 px-3">
            {request.project ? (
              <Badge variant="neutral" className="text-xs">
                <span className="truncate">{request.project.name}</span>
              </Badge>
            ) : (
              <Badge variant="neutral" className="text-xs">
                <span className="truncate">General request</span>
              </Badge>
            )}
          </div>
        </>
      )}

      {/* Created */}
      <div className="min-w-0 truncate py-0 px-3">
        <span className="text-sm-regular">
          {/* Format ISO timestamps (from optimistic entries), display formatted dates as-is (from server) */}
          {request.createdAt.includes('T') || request.createdAt.includes('Z') 
            ? formatRequestDate(request.createdAt) 
            : request.createdAt}
        </span>
      </div>

      {/* Actions */}
      <div 
        className="flex items-center justify-center h-full p-0"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu modal={false} open={openActionsDropdown === request.id} onOpenChange={(open) => setOpenActionsDropdown(open ? request.id : null)}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                openActionsDropdown === request.id
                  ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]'
                  : 'hover:bg-[var(--color-interactive-surface-hover)]'
              }`}
            >
              <DotsThree size={16} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[200px]">
            <DropdownMenuItem onClick={() => {
              setOpenActionsDropdown(null)
              onRowClick(request.id)
            }}>
              <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
              View details
            </DropdownMenuItem>
            {!isDisconnected && isAgency && onConvertToTask && (
              <DropdownMenuItem
                onClick={() => {
                  setOpenActionsDropdown(null)
                  onConvertToTask(request)
                }}
              >
                <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                Convert to task
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => {
              setOpenActionsDropdown(null)
              onCopyLink(request.id, request.connectionId)
            }}>
              <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
              Copy link
            </DropdownMenuItem>
            {!isDisconnected && request.createdByOrgId === currentOrgId && (
              <>
                <div className="border-t border-[var(--color-neutral-6)] my-1" />
                <DropdownMenuItem 
                  onClick={() => {
                    onDeleteRequest(request.id)
                    setOpenActionsDropdown(null)
                  }}
                  style={{ color: 'var(--color-red-11)' }}
                >
                  <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                  Delete request
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Memoize RequestRow to prevent unnecessary re-renders during drag operations
export const RequestRow = memo(RequestRowComponent)


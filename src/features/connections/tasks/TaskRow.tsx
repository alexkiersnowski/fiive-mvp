"use client"

import { useRef, useState, memo } from 'react'
import { Button } from '@/components/ui/button'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { TaskBadge } from '@/components/ui/task-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DotsThree, MagnifyingGlass, LinkSimple, Trash, User, Eye, EyeSlash } from '@phosphor-icons/react'
import type { Task } from '../server'
import { DragHandleIcon } from './DragHandleIcon'

interface TaskRowProps {
  task: Task
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
  isDragging?: boolean
  onDragStart?: (taskId: string, e: React.MouseEvent) => void
  canDrag?: boolean
  isGhost?: boolean
  isDraggingActive?: boolean
}

function TaskRowComponent({
  task,
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
  baseRoute: _baseRoute,
  isDragging = false,
  onDragStart,
  canDrag = false,
  isGhost = false,
  isDraggingActive = false
}: TaskRowProps) {
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
    
    onDragStart(task.id, e)
  }

  // Calculate if status can be edited (used for conditional event handling and rendering)
  const canEditStatus = !isDisconnected && (isAgency || (task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false))

  return (
    <div
      ref={rowRef}
      className={`group grid items-center h-[44px] border-b border-[var(--color-neutral-4)] ${isDraggingActive ? '' : 'hover:bg-[var(--color-interactive-surface-hover)]'} transition-colors duration-75 w-full ${
        isGhost ? '' : 'cursor-pointer'
      }`}
      style={{
        gridTemplateColumns: isAgency 
          ? '44px 4fr 3fr 3fr 3fr 3fr 44px 44px'
          : '44px 4fr 3fr 3fr 3fr 3fr 44px',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
        minWidth: 0,
        opacity: isDragging ? 0.5 : 1,
        userSelect: isDragging ? 'none' : 'auto',
        pointerEvents: isGhost ? 'none' : 'auto'
      }}
      onClick={isGhost ? undefined : () => onRowClick(task.id)}
      onMouseDown={isGhost ? undefined : handleMouseDown}
      draggable={false}
      data-task-id={task.id}
      data-task-status={task.status}
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
        <span className="text-sm-regular">{task.title}</span>
      </div>

      {/* Status */}
      <div 
        className="min-w-0 py-0"
        style={canEditStatus ? { paddingLeft: '4px', paddingRight: '4px' } : { paddingLeft: '8px', paddingRight: '4px' }}
        onClick={canEditStatus ? (e) => e.stopPropagation() : undefined}
        onMouseDown={canEditStatus ? (e) => e.stopPropagation() : undefined}
      >
        {canEditStatus ? (
          <InlineEdit
            ref={(instance) => {
              statusInlineRefs.current[task.id] = instance
            }}
            type="badge"
            value={task.status}
            options={[
              { value: 'to_do', label: 'To do' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'on_hold', label: 'On hold' },
              { value: 'done', label: 'Done' },
            ]}
            onSave={(newStatus) => {
              statusInlineRefs.current[task.id]?.closePopover()
              onStatusChange(task.id, newStatus)
            }}
            badgeComponent="task"
            disablePopoverAnimation
            disableHoverTransition
            className="truncate h-6 rounded-[8px]"
          />
        ) : (
          <TaskBadge 
            variant={task.status as 'to_do' | 'in_progress' | 'on_hold' | 'done'} 
            size="sm" 
            showText={true}
            className="inline-flex"
          />
        )}
      </div>

      {/* Assignee */}
      <div 
        className="min-w-0 py-0 px-3"
        onClick={isDisconnected ? undefined : (e: React.MouseEvent) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {isAgency ? (
          <ListRow
            ref={assigneeListRowRef}
            avatar={true}
            avatarUrl={!isAssigneeUnassigned && task.assignee ? task.assignee.avatarUrl : undefined}
            avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
            text={!task.assignee ? "Unassigned" : task.assignee.name}
            textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
            variant="stacked"
            className="min-w-0 min-h-[32px]"
            comboboxSelectedValue={task.assignee?.id ?? null}
            onClick={() => {
              // Assignee click handled by combobox
            }}
            comboboxOptions={isDisconnected ? undefined : comboboxOptions}
            onComboboxSelect={isDisconnected ? undefined : (memberId) => onAssigneeSelect(task.id, memberId)}
            comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
            comboboxWidth={isDisconnected ? undefined : "280px"}
            clearable={isDisconnected ? false : !!task.assignee}
            onClear={isDisconnected ? undefined : () => onClearAssignee(task.id)}
            nonInteractive={isDisconnected}
          />
        ) : (
          (() => {
            const clientHasOptions = clientEditableMembers.options.length > 0
            const assigneeIsClientMember = task.assignee ? clientEditableMembers.idSet.has(task.assignee.id) : false

            if (clientHasOptions && (assigneeIsClientMember || !task.assignee)) {
              return (
                <ListRow
                  avatar={true}
                  avatarUrl={!isAssigneeUnassigned && task.assignee ? task.assignee.avatarUrl : undefined}
                  avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                  text={!task.assignee ? "Unassigned" : task.assignee.name}
                  textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                  variant="stacked"
                  className="min-w-0 min-h-[32px]"
                  comboboxSelectedValue={task.assignee?.id ?? null}
                  comboboxOptions={isDisconnected ? undefined : clientEditableMembers.options}
                  onComboboxSelect={isDisconnected ? undefined : (memberId) => onAssigneeSelect(task.id, memberId)}
                  comboboxPlaceholder={isDisconnected ? undefined : "Search members..."}
                  comboboxWidth={isDisconnected ? undefined : "280px"}
                  clearable={false}
                  nonInteractive={isDisconnected}
                />
              )
            }

            return (
              <ListRow
                avatar={true}
                avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
                avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                text={!task.assignee ? "Unassigned" : task.assignee.name}
                textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                variant="stacked"
                className="min-w-0"
                comboboxSelectedValue={task.assignee?.id ?? null}
                nonInteractive={isDisconnected || !task.assignee}
                onClick={task.assignee && !isDisconnected ? () => {
                  const nameParts = task.assignee!.name.split(' ')
                  const assigneeMember = agencyMembers.find(member => member.id === task.assignee!.id)
                  onContactClick({
                    id: task.assignee!.id,
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    email: task.assignee!.email,
                    avatar_url: task.assignee!.avatarUrl || '',
                    job_title: assigneeMember?.jobTitle,
                    organization: {
                      id: agencyOrganization?.id || '',
                      name: agencyOrganization?.name || '',
                      logo_url: agencyOrganization?.logoUrl || ''
                    }
                  })
                } : undefined}
              />
            )
          })()
        )}
      </div>

      {/* Due Date */}
      <div className="min-w-0 truncate py-0 px-3">
        <span 
          className="text-sm-regular" 
          style={task.dueDate ? undefined : { color: 'var(--color-base-text-tertiary)' }}
        >
          {task.dueDate || "No due date"}
        </span>
      </div>

      {/* Project */}
      <div className="min-w-0 py-0 px-3">
        {task.project && (
          <Badge variant="neutral" className="text-xs">
            <span className="truncate">{task.project.name}</span>
          </Badge>
        )}
      </div>

      {/* Visibility (Agency only) */}
      {isAgency && (
        <div className="flex items-center justify-center h-full p-0">
          {task.clientVisible ? (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div>
                  <Eye size={16} weight="fill" style={{ color: 'var(--color-neutral-11)' }} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                <p>Visible to client</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <div>
                  <EyeSlash size={16} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                <p>Not visible to client</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {/* Actions */}
      <div 
        className="flex items-center justify-center h-full p-0"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu modal={false} open={openActionsDropdown === task.id} onOpenChange={(open) => setOpenActionsDropdown(open ? task.id : null)}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                openActionsDropdown === task.id
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
              onRowClick(task.id)
            }}>
              <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              setOpenActionsDropdown(null)
              onCopyLink(task.id, task.connectionId)
            }}>
              <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
              Copy link
            </DropdownMenuItem>
            {!isDisconnected && isAgency && (
              <>
                <div className="border-t border-[var(--color-neutral-6)] my-1" />
                <DropdownMenuItem 
                  onClick={() => {
                    onDeleteTask(task.id)
                    setOpenActionsDropdown(null)
                  }}
                  style={{ color: 'var(--color-red-11)' }}
                >
                  <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                  Delete task
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

// Memoize TaskRow to prevent unnecessary re-renders during drag operations
export const TaskRow = memo(TaskRowComponent)


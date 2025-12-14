"use client"

import { Button } from '@/components/ui/button'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { TaskBadge } from '@/components/ui/task-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DotsThree, MagnifyingGlass, LinkSimple, Trash, User } from '@phosphor-icons/react'
import type { Task } from './types'

interface GlobalTaskRowProps {
  task: Task
  isAgency: boolean
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
  membersByConnection: Record<string, Array<{
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
  setOpenActionsDropdown: (id: string | null) => void
  baseRoute: string
}

export function GlobalTaskRow({
  task,
  isAgency,
  clientEditableMembers: _clientEditableMembers,
  comboboxOptions: _comboboxOptions,
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
  baseRoute: _baseRoute
}: GlobalTaskRowProps) {
  // Get combobox options for this task's connection
  const getComboboxOptionsForTask = (connectionId: string) => {
    const members = membersByConnection[connectionId] || []
    return members.map(member => ({
      value: member.id,
      label: `${member.firstName} ${member.lastName}`,
      avatar: member.avatarUrl,
      email: member.email,
      orgName: member.orgName,
      orgType: member.orgType
    }))
  }

  // Get client editable members for this task's connection
  const getClientEditableMembersForTask = (connectionId: string) => {
    const members = membersByConnection[connectionId] || []
    const idSet = new Set<string>()
    const options = members
      .filter(member => member.orgType === 'client')
      .map(member => {
        if (member.id) {
          idSet.add(member.id)
        }
        const fullName = `${member.firstName} ${member.lastName}`.trim()
        return {
          value: member.id,
          label: fullName || member.email,
          avatar: member.avatarUrl,
          email: member.email
        }
      })
    return { idSet, options }
  }

  const clientEditableMembersForTask = getClientEditableMembersForTask(task.connectionId)
  const canEditStatus = isAgency || (task.assignee ? clientEditableMembersForTask.idSet.has(task.assignee.id) : false)

  return (
    <div
      className="group grid items-center h-[44px] border-b border-[var(--color-neutral-4)] hover:bg-[var(--color-interactive-surface-hover)] transition-colors duration-75 w-full cursor-pointer"
      style={{
        gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
        minWidth: 0
      }}
      onClick={() => onRowClick(task.id)}
      data-task-id={task.id}
      data-task-status={task.status}
    >
      {/* Empty drag handle cell - 44px */}
      <div></div>

      {/* Title */}
      <div className="min-w-0 truncate py-0 px-3">
        <span className="text-sm-regular">{task.title}</span>
      </div>

      {/* Status */}
      <div 
        className="min-w-0 py-0 px-3"
        onClick={canEditStatus ? (e) => e.stopPropagation() : undefined}
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
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {isAgency ? (
          <ListRow
            avatar={true}
            avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
            avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
            text={!task.assignee ? "Unassigned" : task.assignee.name}
            textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
            variant="stacked"
            className="min-w-0 min-h-[32px]"
            comboboxSelectedValue={task.assignee?.id ?? null}
            comboboxOptions={getComboboxOptionsForTask(task.connectionId)}
            onComboboxSelect={(memberId) => onAssigneeSelect(task.id, memberId, task.connectionId)}
            comboboxPlaceholder="Search members..."
            comboboxWidth="240px"
            clearable={!!task.assignee}
            onClear={() => onClearAssignee(task.id)}
          />
        ) : (
          (() => {
            const clientHasOptions = clientEditableMembersForTask.options.length > 0
            const assigneeIsClientMember = task.assignee ? clientEditableMembersForTask.idSet.has(task.assignee.id) : false

            if (clientHasOptions && (assigneeIsClientMember || !task.assignee)) {
              return (
                <ListRow
                  avatar={true}
                  avatarUrl={task.assignee ? task.assignee.avatarUrl : undefined}
                  avatarFallback={!task.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                  text={!task.assignee ? "Unassigned" : task.assignee.name}
                  textColor={!task.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                  variant="stacked"
                  className="min-w-0 min-h-[32px]"
                  comboboxSelectedValue={task.assignee?.id ?? null}
                  comboboxOptions={clientEditableMembersForTask.options}
                  onComboboxSelect={(memberId) => onAssigneeSelect(task.id, memberId, task.connectionId)}
                  comboboxPlaceholder="Search members..."
                  comboboxWidth="240px"
                  clearable={false}
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
                nonInteractive={!task.assignee}
                onClick={task.assignee ? () => {
                  const nameParts = task.assignee!.name.split(' ')
                  const members = membersByConnection[task.connectionId] || []
                  const assigneeMember = members.find(member => member.id === task.assignee!.id)
                  onContactClick({
                    id: task.assignee!.id,
                    first_name: nameParts[0] || '',
                    last_name: nameParts.slice(1).join(' ') || '',
                    email: task.assignee!.email,
                    avatar_url: task.assignee!.avatarUrl || '',
                    job_title: assigneeMember?.jobTitle,
                    organization: {
                      id: task.agency?.id || '',
                      name: task.agency?.name || '',
                      logo_url: task.agency?.logoUrl || ''
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

      {/* Actions */}
      <div 
        className="flex items-center justify-center h-full p-0"
        onClick={(e) => e.stopPropagation()}
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
            {isAgency && (
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


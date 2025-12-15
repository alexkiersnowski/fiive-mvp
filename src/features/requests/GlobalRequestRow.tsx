"use client"

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit, type InlineEditRef } from '@/components/ui/inline-edit'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User } from '@phosphor-icons/react'
import { formatRequestDateFullMonth } from '@/features/connections/formatters'
import type { Request } from './types'

interface GlobalRequestRowProps {
  request: Request
  isAgency: boolean
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
  currentOrgId: string
  onConvertToTask?: (request: Request) => void
}

export function GlobalRequestRow({
  request,
  isAgency,
  comboboxOptions,
  agencyMembers,
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
  currentOrgId,
  onConvertToTask
}: GlobalRequestRowProps) {
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)

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
      onClick={() => onRowClick(request.id)}
      data-request-id={request.id}
      data-request-status={request.status}
    >
      {/* Empty drag handle cell - 44px */}
      <div></div>

      {/* Title */}
      <div className="min-w-0 truncate py-0 px-3">
        <span className="text-sm-regular">{request.title}</span>
      </div>

      {/* Status */}
      <div 
        className="min-w-0 py-0 px-3"
        onClick={(e) => e.stopPropagation()}
      >
        {isAgency ? (
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
            customLabel={request.status === 'new' ? 'Submitted' : undefined}
            className="inline-flex"
          />
        )}
      </div>

      {isAgency ? (
        <>
          {/* Assignee */}
          <div 
            className="min-w-0 py-0 px-3"
            onClick={(e: React.MouseEvent) => e.stopPropagation()}
          >
            <ListRow
              ref={assigneeListRowRef}
              avatar={true}
              avatarUrl={request.assignee ? request.assignee.avatarUrl : undefined}
              avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
              text={!request.assignee ? "Unassigned" : request.assignee.name}
              textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
              variant="stacked"
              className="min-w-0 min-h-[32px]"
              comboboxSelectedValue={request.assignee?.id ?? null}
              onClick={() => {
                // Assignee click handled by combobox
              }}
              comboboxOptions={comboboxOptions}
              onComboboxSelect={(memberId) => onAssigneeSelect(request.id, memberId)}
              comboboxPlaceholder="Search members..."
              comboboxWidth="240px"
              clearable={!!request.assignee}
              onClear={() => onClearAssignee(request.id)}
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
            onClick={request.assignee ? (e: React.MouseEvent) => e.stopPropagation() : undefined}
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
              nonInteractive={!request.assignee}
              onClick={request.assignee ? () => {
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
                    id: request.agency?.id || '',
                    name: request.agency?.name || '',
                    logo_url: request.agency?.logoUrl || ''
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
            ? formatRequestDateFullMonth(request.createdAt) 
            : request.createdAt}
        </span>
      </div>

      {/* Actions */}
      <div 
        className="flex items-center justify-center h-full p-0"
        onClick={(e) => e.stopPropagation()}
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
            {isAgency && onConvertToTask && (
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
            {request.createdByOrgId === currentOrgId && (
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


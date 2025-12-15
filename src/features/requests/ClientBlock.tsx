"use client"

import { ClientGroupHeader } from './ClientGroupHeader'
import { GlobalRequestRow } from './GlobalRequestRow'
import type { Request } from './types'
import type { RequestStatus } from './requestGrouping'
import type { InlineEditRef } from '@/components/ui/inline-edit'

interface ClientBlockProps {
  status: RequestStatus
  clientId?: string
  clientName?: string
  clientLogoUrl?: string
  agencyId?: string
  agencyName?: string
  agencyLogoUrl?: string
  requests: Request[]
  isExpanded: boolean
  onToggle: () => void
  isAgency: boolean
  isFirstClient?: boolean
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
  setOpenActionsDropdown: (requestId: string | null) => void
  currentOrgId: string
  onConvertToTask?: (request: Request) => void
}

/**
 * Client Block Component
 * Renders a client header + all requests for that client
 * Requests are NOT virtualized - rendered directly
 */
export function ClientBlock({
  status,
  clientId,
  clientName,
  clientLogoUrl,
  agencyId,
  agencyName,
  agencyLogoUrl,
  requests,
  isExpanded,
  onToggle,
  isAgency,
  isFirstClient,
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
}: ClientBlockProps) {
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
        count={requests.length}
        isCollapsed={!isExpanded}
        onToggle={onToggle}
        isAgency={isAgency}
      />
      
      {/* Requests - rendered directly when expanded (NOT virtualized) */}
      {isExpanded && requests.map((request) => (
        <GlobalRequestRow
          key={request.id}
          request={request}
          isAgency={isAgency}
          comboboxOptions={comboboxOptions}
          agencyMembers={agencyMembers}
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
          currentOrgId={currentOrgId}
          onConvertToTask={onConvertToTask}
        />
      ))}
    </div>
  )
}








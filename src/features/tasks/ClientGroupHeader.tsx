"use client"

import { CaretDown } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ClientGroupHeaderProps {
  clientId: string
  clientName?: string
  clientLogoUrl?: string
  agencyId?: string
  agencyName?: string
  agencyLogoUrl?: string
  count: number
  isExpanded: boolean
  onToggle: () => void
  isAgency: boolean
  isFirstClient?: boolean
}

export function ClientGroupHeader({ 
  clientId, 
  clientName, 
  clientLogoUrl,
  agencyId,
  agencyName,
  agencyLogoUrl,
  count, 
  isExpanded, 
  onToggle, 
  isAgency,
  isFirstClient = false 
}: ClientGroupHeaderProps) {
  // For agency view: display client_id, client name, client logo (from connection)
  // For client view: display agency_id, agency name, agency logo (from connection)
  const displayName = isAgency ? (clientName || 'Unknown') : (agencyName || 'Unknown')
  const displayLogoUrl = isAgency ? clientLogoUrl : agencyLogoUrl
  // groupId is client_id for agency view, agency_id for client view
  const displayId = isAgency ? clientId : (agencyId || clientId)

  return (
    <div
      className={`border-b border-[var(--color-neutral-4)] h-[44px] grid items-center cursor-pointer transition-colors duration-75 w-full hover:bg-[var(--color-interactive-surface-hover)]`}
      style={{
        gridTemplateColumns: isAgency 
          ? '44px 4fr 3fr 3fr 3fr 3fr 44px 44px'
          : '44px 4fr 3fr 3fr 3fr 3fr 44px',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
      }}
      onClick={onToggle}
      data-client-group-id={displayId}
    >
      {/* Expand/Collapse Icon - 44px cell */}
      <div className="flex items-center justify-center h-full">
        <CaretDown
          size={12}
          weight="fill"
          style={{
            color: 'var(--color-base-text-tertiary)',
            transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 0.2s ease'
          }}
        />
      </div>
      
      {/* Group Logo, Name and Count - spans first content column */}
      <div className="flex items-center gap-3 min-w-0 px-3">
        <Avatar className="w-5 h-5 flex-shrink-0">
          <AvatarImage src={displayLogoUrl} alt={displayName} />
          <AvatarFallback 
            className="text-[10px] font-medium text-white"
            style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
          >
            {displayName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm-regular text-[var(--color-base-text-primary)] truncate">
          {displayName}
        </span>
        <span className="text-xs-regular text-[var(--color-base-text-tertiary)]">
          {count} {count === 1 ? 'task' : 'tasks'}
        </span>
      </div>
      
      {/* Empty cells to match grid structure */}
      <div className="px-3"></div>
      <div className="px-3"></div>
      <div className="px-3"></div>
      <div className="px-3"></div>
      {isAgency && <div></div>}
      <div></div>
    </div>
  )
}


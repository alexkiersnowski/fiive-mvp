"use client"

import { CaretDown } from '@phosphor-icons/react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

interface ClientGroupHeaderProps {
  clientId: string
  clientName: string
  clientLogoUrl?: string
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
  count, 
  isExpanded, 
  onToggle, 
  isAgency,
  isFirstClient = false 
}: ClientGroupHeaderProps) {
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
      data-client-group-id={clientId}
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
      
      {/* Client Logo, Name and Count - spans first content column */}
      <div className="flex items-center gap-3 min-w-0 px-3">
        <Avatar className="w-5 h-5 flex-shrink-0">
          <AvatarImage src={clientLogoUrl} alt={clientName} />
          <AvatarFallback 
            className="text-[10px] font-medium text-white"
            style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
          >
            {clientName.charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm-regular text-[var(--color-base-text-primary)] truncate">
          {clientName}
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


"use client"

import { CaretDown } from '@phosphor-icons/react'
import { RequestBadge } from '@/components/ui/request-badge'
import type { RequestStatus } from './requestGrouping'

interface StatusGroupHeaderProps {
  status: RequestStatus
  count: number
  isExpanded: boolean
  onToggle: () => void
  isAgency: boolean
  isFirstGroup?: boolean
}

const statusLabels: Record<RequestStatus, string> = {
  new: 'New',
  in_review: 'In review',
  accepted: 'Accepted',
  closed: 'Closed',
  canceled: 'Canceled'
}

export function StatusGroupHeader({ status, count, isExpanded, onToggle, isAgency, isFirstGroup = false }: StatusGroupHeaderProps) {
  return (
    <div
      className={`bg-[var(--color-neutral-2)] border-b border-[var(--color-neutral-4)] h-[44px] grid items-center cursor-pointer transition-colors duration-75 w-full hover:bg-[var(--color-interactive-surface-hover)]`}
      style={{
        gridTemplateColumns: '44px 4fr 3fr 3fr 3fr 3fr 44px',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
      }}
      onClick={onToggle}
      data-group-status={status}
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
      
      {/* Badge and Count - spans first content column */}
      <div className="flex items-center gap-3 min-w-0 px-3">
        <RequestBadge
          variant={status}
          size="sm"
          showText={true}
          customLabel={status === 'new' && !isAgency ? 'Submitted' : undefined}
          className="flex-shrink-0"
        />
        <span className="text-xs-regular text-[var(--color-base-text-tertiary)]">
          {count} {count === 1 ? 'request' : 'requests'}
        </span>
      </div>
      
      {/* Empty cells to match grid structure */}
      <div className="px-3"></div>
      <div className="px-3"></div>
      <div className="px-3"></div>
      <div className="px-3"></div>
      <div></div>
    </div>
  )
}


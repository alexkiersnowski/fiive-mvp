'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from '@phosphor-icons/react/ssr'

interface RequestsHeaderProps {
  onNewRequest: () => void
  newRequestsCount?: number
}

export function RequestsHeader({ onNewRequest, newRequestsCount }: RequestsHeaderProps) {
  return (
    <div className="flex flex-col gap-5 pb-5" style={{ marginTop: '24px' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
            Requests
          </h1>
          {typeof newRequestsCount === 'number' && newRequestsCount > 0 && (
            <Badge variant="neutral" className="text-xs mt-2">
              {newRequestsCount} new
            </Badge>
          )}
        </div>
        <Button
          variant="default"
          size="lg"
          className="cursor-pointer text-sm flex items-center gap-2"
          onClick={onNewRequest}
        >
          <Plus size={16} />
          New request
        </Button>
      </div>
    </div>
  )
}


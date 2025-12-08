"use client"

import { DotsSixVertical } from '@phosphor-icons/react'

export function DragHandleIcon() {
  return (
    <div className="flex items-center justify-center h-full">
      <div 
        className="flex items-center justify-center"
        style={{
          padding: '4px 1px',
          backgroundColor: 'var(--color-neutral-3)',
          borderRadius: 'var(--radius-1-max, 3px)'
        }}
      >
        <DotsSixVertical
          size={12}
          weight="bold"
          style={{
            color: 'var(--color-base-text-primary)'
          }}
        />
      </div>
    </div>
  )
}


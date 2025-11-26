'use client'

import { Button } from '@/components/ui/button'
import { Plus } from '@phosphor-icons/react/ssr'

interface TasksHeaderProps {
  onNewTask: () => void
  isAgency?: boolean
}

export function TasksHeader({ onNewTask, isAgency = false }: TasksHeaderProps) {
  return (
    <div className="flex flex-col gap-5 pb-5" style={{ marginTop: '24px' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
            Tasks
          </h1>
        </div>
        {isAgency && (
          <Button
            variant="default"
            size="lg"
            className="cursor-pointer text-sm flex items-center gap-2"
            onClick={onNewTask}
          >
            <Plus size={16} />
            New task
          </Button>
        )}
      </div>
    </div>
  )
}


import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight, LockSimple } from '@phosphor-icons/react/dist/ssr';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function TasksCard({ snapshot, context }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Tasks' : 'Tasks';
  const description = isAgency 
    ? 'No tasks yet. Add client tasks and manage their visibility.'
    : 'No tasks yet. Your agency manages all tasks. Submit a request to kick things off or share what you need next.';
  const buttonText = isAgency ? 'Add task' : 'View all tasks';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </CardTitle>
        {isAgency && (
          <Tooltip delayDuration={400}>
            <TooltipTrigger asChild>
              <Badge 
                variant="outline" 
                className="text-xs border-0"
                style={{
                  borderRadius: 'var(--radius-1-max, 3px)',
                  backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                  border: 'none',
                  cursor: 'default'
                }}
              >
                <LockSimple size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Agency managed</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Only your agency can edit this
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <p className="text-xs-regular text-tertiary">
        {description}
      </p>
      <div className="mt-auto flex justify-end">
        {isAgency ? (
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
          >
            <Plus size={16} weight="regular" />
            {buttonText}
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75 mt-1 ml-auto"
          >
            <span className="mr-1">{buttonText}</span>
            <ArrowRight size={16} weight="regular" />
          </Button>
        )}
      </div>
    </Card>
  );
}


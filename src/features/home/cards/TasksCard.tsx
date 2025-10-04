import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function TasksCard({ snapshot, context }: StatsCardProps) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Tasks' : 'Tasks';
  const description = isAgency 
    ? 'No tasks yet. Start adding action items for your team or clients and choose which tasks are visible to clients.'
    : 'No tasks yet. Your agency manages all tasks. Submit a request to kick things off or share what you need next.';
  const buttonText = isAgency ? 'Add task' : 'View all tasks';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
        {title}
      </CardTitle>
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

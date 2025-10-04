import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../../types';

export default function TasksDueCard({ snapshot, context }: StatsCardProps) {
  const { tasks } = snapshot;
  
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Tasks due soon' : 'Tasks assigned';
  const buttonText = isAgency ? 'Tasks' : 'Tasks';

  return (
    <Card className="w-full pt-5 pb-[18px] px-5 flex flex-col gap-3">
      <CardTitle className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>{title}</CardTitle>
      <div className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>{tasks.dueSoonCount}</div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75 mt-1 ml-auto"
      >
        <span className="mr-1">{buttonText}</span>
        <ArrowRight size={16} weight="regular" />
      </Button>
    </Card>
  );
}


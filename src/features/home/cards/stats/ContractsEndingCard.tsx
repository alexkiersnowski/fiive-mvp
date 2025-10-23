import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowRight, Info } from '@phosphor-icons/react/dist/ssr';
import Link from 'next/link';
import type { StatsCardProps } from '../../types';

export default function ContractsEndingCard({ snapshot, context }: StatsCardProps) {
  const { contracts } = snapshot;
  
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Contracts ending soon' : 'Requests in review';
  const buttonText = isAgency ? 'Clients' : 'Requests';

  return (
    <Card className="w-full pt-5 pb-[18px] px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>{title}</CardTitle>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <div>
              <Info size={14} weight="regular" style={{ color: 'var(--color-base-text-tertiary)' }} />
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Contracts ending within the next 90 days
          </TooltipContent>
        </Tooltip>
      </div>
      <div className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>{contracts.endingSoonCount}</div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75 mt-1 ml-auto"
        asChild
      >
        <Link href="/clients?sort=contract-end-soonest">
          <span className="mr-1">{buttonText}</span>
          <ArrowRight size={16} weight="regular" />
        </Link>
      </Button>
    </Card>
  );
}

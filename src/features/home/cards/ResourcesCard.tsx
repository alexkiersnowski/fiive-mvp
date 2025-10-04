import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function ResourcesCard({ snapshot, context }: StatsCardProps) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Agency resources' : 'Company resources';
  const description = isAgency 
    ? 'No links yet. Add links to documents, dashboards, or folders relevant to your agency.'
    : 'No links yet. Add links to documents, dashboards, or folders relevant to your company.';
  const buttonText = isAgency ? 'Add link' : 'Add link';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </CardTitle>
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
              <EyeSlash size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Internal only</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Only your team can see this
          </TooltipContent>
        </Tooltip>
      </div>
      <p className="text-xs-regular text-tertiary">
        {description}
      </p>
      <div className="mt-auto flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 shadow-none cursor-pointer transition-all duration-75"
        >
          <Plus size={16} weight="regular" />
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}

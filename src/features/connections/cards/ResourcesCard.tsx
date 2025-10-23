import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Plus, Eye } from '@phosphor-icons/react/dist/ssr';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function ResourcesCard({ snapshot, context }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const isAgency = context.variant === 'agency';
  const title = 'Resources';
  const description = isAgency 
    ? 'No resources added. Add links to documents, dashboards, or folders relevant to this client.'
    : '';
  const buttonText = 'Add link';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
            {title}
          </CardTitle>
          {!isAgency && (
            <p className="text-sm-regular text-tertiary mt-1">
              Links to resources shared by your agency
            </p>
          )}
        </div>
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
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Agency managed</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Managed by your agency
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {description && (
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
      {isAgency && (
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
      )}
    </Card>
  );
}

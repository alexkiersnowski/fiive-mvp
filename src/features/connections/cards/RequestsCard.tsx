import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Plus, Eye, PencilSimple, Users } from '@phosphor-icons/react/dist/ssr';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function RequestsCard({ snapshot, context }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Requests' : 'Requests';
  
  // Check if there are any requests (this would be from actual data when implemented)
  const hasRequests = false; // TODO: Replace with actual request count from snapshot
  
  const description = isAgency 
    ? 'No requests yet. Your client can submit requests, or you can add one for them.'
    : 'Ask questions, share updates, or request new work from your agency.';
  const buttonText = isAgency ? 'Add request' : 'Submit request';

  return (
    <Card className="w-full h-full min-h-[306px] pt-5 pb-6 px-5 flex flex-col gap-3"> {/* Temporary min-height until we get actual data to place into card */}
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </CardTitle>
        <Tooltip delayDuration={250}>
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
              {isAgency ? (
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              ) : (
                <Users size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              )}
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                {isAgency ? 'Client visible' : 'Collaborate'}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency 
              ? 'Both you and your client can see this' 
              : 'Both you and your agency can manage this'}
          </TooltipContent>
        </Tooltip>
      </div>
      {description && (
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
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


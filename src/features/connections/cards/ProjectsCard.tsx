import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Plus, Eye, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { ConnectionSnapshot } from '../types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export default function ProjectsCard({ snapshot, context }: { snapshot: ConnectionSnapshot; context: EnhancedModeContext }) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Projects' : 'Projects';
  const description = isAgency 
    ? 'No projects yet. Projects give you and your client a shared view of work. Link tasks and requests to projects, track budgets, and mark progress.'
    : '';
  const buttonText = isAgency ? 'Add project' : 'View all projects';

  return (
    <Card className="w-full h-full min-h-[306px] pt-5 pb-6 px-5 flex flex-col gap-3"> {/* Temporary min-height until we get actual data to place into card */}
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
            {title}
          </CardTitle>
          {!isAgency && (
            <p className="text-sm-regular text-tertiary mt-1">
              Created by your agency and shared with your team
            </p>
          )}
        </div>
        {isAgency && (
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
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Client visible</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Your client can see this. Only your agency can edit.
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      {description && (
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
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

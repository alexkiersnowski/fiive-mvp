import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function HealthCard({ snapshot, context }: StatsCardProps) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Client health' : 'Projects';
  const description = isAgency 
    ? 'No clients yet. Add clients to start tracking their health and project status.'
    : 'No projects yet. Your agency manages projects. Add an agency to start collaborating on projects.';
  const buttonText = isAgency ? 'Add client' : 'Add agency';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
        {title}
      </CardTitle>
      
      {isAgency ? (
        /* Agency: Health Status Rows */
        <div className="flex flex-col gap-4">
          {/* Healthy */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-1">Healthy</span>
              <span className="text-sm-regular text-primary flex-1">0</span>
            </div>
          </div>
          
          {/* At Risk */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-1">At risk</span>
              <span className="text-sm-regular text-primary flex-1">0</span>
            </div>
          </div>
          
          {/* Critical */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-1">Critical</span>
              <span className="text-sm-regular text-primary flex-1">0</span>
            </div>
          </div>
          
          {/* Unassigned */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-1">Unassigned</span>
              <span className="text-sm-regular text-primary flex-1">0</span>
            </div>
          </div>
        </div>
      ) : (
        /* Client: Simple Description */
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
      
      {/* Button */}
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

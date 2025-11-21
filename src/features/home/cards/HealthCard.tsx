"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { Plus, ArrowRight, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function HealthCard({ snapshot, context }: StatsCardProps) {
  const router = useRouter();
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Client health' : 'Projects';
  const description = isAgency 
    ? 'No clients yet. Add clients to start tracking their health and project status.'
    : 'No projects yet. Your agency manages projects. Add an agency to start collaborating on projects.';
  
  // Check if user has any connections (agencies have clients, clients have agencies)
  const hasConnections = snapshot.clients.total > 0;

  const handleAgencyClick = (connectionId: string) => {
    console.log('Navigating to connection:', connectionId);
    if (!connectionId) {
      console.error('Connection ID is undefined or empty');
      return;
    }
    router.push(`/agencies/${connectionId}/overview`);
  };

  return (
    <Card className={`w-full h-full pt-5 px-5 flex flex-col gap-3 ${hasConnections ? 'pb-5' : 'pb-6'}`}>
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
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>Not client visible</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            Only your agency can see this
          </TooltipContent>
        </Tooltip>
      </div>
      
      {isAgency ? (
        /* Agency: Health Status Rows */
        <div className="flex flex-col gap-4 mt-3">
          {/* Healthy */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-[2]">Healthy</span>
              <span className="text-sm-regular text-primary flex-1">{snapshot.health.healthy}</span>
            </div>
          </div>
          
          {/* At Risk */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-[2]">At risk</span>
              <span className="text-sm-regular text-primary flex-1">{snapshot.health.atRisk}</span>
            </div>
          </div>
          
          {/* Critical */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-[2]">Critical</span>
              <span className="text-sm-regular text-primary flex-1">{snapshot.health.critical}</span>
            </div>
          </div>
          
          {/* Unassigned */}
          <div className="flex items-center gap-4">
            <div className="w-2 h-2 rounded-full bg-gray-500 flex-shrink-0"></div>
            <div className="flex-1 flex items-center gap-4">
              <span className="text-sm-regular text-primary flex-[2]">Unassigned</span>
              <span className="text-sm-regular text-primary flex-1">{snapshot.health.unassigned}</span>
            </div>
          </div>
        </div>
      ) : (
        /* Client: Agency Preview List */
        snapshot.agencies.length > 0 ? (
          <div className="flex flex-col gap-4 mt-3">
            {snapshot.agencies.map((agency) => (
              <div key={agency.id} className="flex items-center gap-4">
                <div className="flex-[2] min-w-0">
                  <ListRow
                    avatar={true}
                    avatarUrl={agency.logo}
                    text={agency.name}
                    actions={false}
                    iconButtonEnd={false}
                    dropdownItems={undefined}
                    variant="stacked"
                    onClick={() => handleAgencyClick(agency.connectionId)}
                  />
                </div>
                <div className="flex-[1] min-w-0 flex justify-start">
                  <span className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>
                    {agency.projectCount}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty state description */
          <p className="text-xs-regular text-tertiary">
            {description}
          </p>
        )
      )}
      
      {/* Button */}
      <div className="mt-auto flex justify-end">
        {hasConnections ? (
          /* Ghost button with nav when there are connections */
          <Link href={isAgency ? '/clients' : '/agencies'} className="ml-auto">
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75"
            >
              <span className="mr-1">{isAgency ? 'View all clients' : 'View all agencies'}</span>
              <ArrowRight size={16} weight="regular" />
            </Button>
          </Link>
        ) : (
          /* Outline button to add when no connections */
          <Button 
            variant="outline" 
            size="sm" 
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
          >
            <Plus size={16} weight="regular" />
            {isAgency ? 'Add client' : 'Add agency'}
          </Button>
        )}
      </div>
    </Card>
  );
}

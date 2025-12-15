"use client"

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ListRow } from '@/components/ui/list-row';
import { ArrowRight, EyeSlash } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function AgencyProjects({ snapshot, context: _context }: StatsCardProps) {
  const router = useRouter();
  const title = 'Live projects';
  const description = 'Projects are created by your agency, giving you a shared view of work and progress.';

  const handleAgencyClick = (connectionId: string) => {
    console.log('Navigating to connection:', connectionId);
    if (!connectionId) {
      console.error('Connection ID is undefined or empty');
      return;
    }
    router.push(`/agencies/${connectionId}/overview`);
  };

  return (
    <Card className="w-full h-full pt-5 px-5 flex flex-col gap-3 pb-5">
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
      
      {snapshot.agencies.length > 0 ? (
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
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}
      
      {/* Button */}
      <div className="mt-auto flex justify-end">
        <Link href="/agencies" className="ml-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75"
          >
            <span className="mr-1">View all agencies</span>
            <ArrowRight size={16} weight="regular" />
          </Button>
        </Link>
      </div>
    </Card>
  );
}


import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { StatusBadge, StatusVariant } from '@/components/ui/connection-badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { User } from '@phosphor-icons/react';

interface AgencyCardProps {
  agencyName: string;
  agencyType?: string;
  avatarUrl?: string;
  avatarFallback?: string;
  status?: StatusVariant;
  accountManager?: {
    name: string;
    avatarUrl?: string;
  };
}

export function AgencyCard({ 
  agencyName, 
  agencyType,
  avatarUrl, 
  avatarFallback,
  status,
  accountManager
}: AgencyCardProps) {
  return (
    <Card 
      className="relative h-45 cursor-pointer transition-colors duration-75"
      style={{
        backgroundColor: 'var(--color-base-surface-page-background)'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-neutral-3)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--color-base-surface-page-background)';
      }}
    >
      <CardContent className="py-5 px-5 h-full">
        {/* Connection Badge - Top Right */}
        {status && (
          <div className="absolute top-5 right-5">
            <StatusBadge variant={status} showText={true} />
          </div>
        )}
        
        <div className="flex items-center justify-between h-full gap-5">
          <div className="flex items-center gap-5 flex-1 min-w-0">
            <Avatar className="h-12 w-12 flex-shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={agencyName} />}
              <AvatarFallback 
                className="text-white font-medium"
                style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
              >
                {avatarFallback || agencyName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0 flex-1">
              <h3 className="display-5-medium text-base-text-primary line-clamp-2" title={agencyName}>
                {agencyName}
              </h3>
              {agencyType && (
                <p className="text-sm-regular text-base-text-secondary line-clamp-2" title={agencyType}>
                  {agencyType}
                </p>
              )}
            </div>
          </div>
          {accountManager && (
            <div className="flex-shrink-0">
              {accountManager.name === 'Unassigned' ? (
                <Tooltip delayDuration={400}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center p-1" style={{ borderRadius: 'calc(var(--radius) - 2px)' }}>
                      <div className="flex-shrink-0 mr-3">
                        <div 
                          className="rounded-full flex items-center justify-center"
                          style={{ 
                            width: '24px', 
                            height: '24px',
                            background: 'var(--color-neutral-9, #8B8D98)'
                          }}
                        >
                          <User size={16} weight="fill" className="text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col">
                        <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
                          {accountManager.name}
                        </span>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={8}>
                    <p>Agency Account Manager</p>
                  </TooltipContent>
                </Tooltip>
              ) : (
                <ListRow
                  avatar={true}
                  avatarUrl={accountManager.avatarUrl}
                  text={accountManager.name}
                  actions={false}
                  variant="stacked"
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { StatusBadge, StatusVariant } from '@/components/ui/connection-badge';

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
            <StatusBadge variant={status} />
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
              <ListRow
                avatar={true}
                avatarUrl={accountManager.avatarUrl}
                text={accountManager.name}
                actions={false}
                variant="stacked"
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

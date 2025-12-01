import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ListRow } from '@/components/ui/list-row';
import { StatusBadge, StatusVariant } from '@/components/ui/connection-badge';
import { ProfileCard } from '@/components/ui/profile-card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { User, DotsThree, XCircle } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { cancelAgencyInvitation } from './actions';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

interface AgencyCardProps {
  agencyId: string;
  connectionId: string;
  agencyName: string;
  agencyType?: string;
  avatarUrl?: string;
  avatarFallback?: string;
  status?: StatusVariant;
  invitedEmail?: string;
  accountManager?: {
    id: string;
    name: string;
    avatarUrl?: string;
    email?: string;
    jobTitle?: string;
  };
  context: EnhancedModeContext;
  onAgencyDeleted?: () => void;
}

export function AgencyCard({ 
  agencyId,
  connectionId,
  agencyName, 
  agencyType,
  avatarUrl, 
  avatarFallback,
  status,
  invitedEmail,
  accountManager,
  context,
  onAgencyDeleted
}: AgencyCardProps) {
  const router = useRouter();
  const [selectedAccountManager, setSelectedAccountManager] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    job_title?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  } | null>(null);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  
  const isAccessible = status === 'connected' || status === 'disconnected';
  const isInvited = status === 'invited';
  
  const handleCardClick = () => {
    if (isAccessible) {
      router.push(`/agencies/${connectionId}/overview`);
    }
  };

  const handleAccountManagerClick = () => {
    if (accountManager && accountManager.id) {
      // Split the name into first and last name
      const nameParts = accountManager.name.split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';
      
      setSelectedAccountManager({
        id: accountManager.id,
        first_name: firstName,
        last_name: lastName,
        email: accountManager.email || '',
        avatar_url: accountManager.avatarUrl,
        job_title: accountManager.jobTitle,
        organization: {
          id: agencyId,
          name: agencyName,
          logo_url: avatarUrl
        }
      });
      setProfileDialogOpen(true);
    }
  };

  const handleCancelClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    setIsCanceling(true);
    
    try {
      const result = await cancelAgencyInvitation({
        connectionId,
        agencyId
      }, context);

      if (result.success) {
        toast.success('Invitation canceled');
        onAgencyDeleted?.();
      } else {
        toast.error(result.error || 'Failed to cancel invitation');
      }
    } catch (error) {
      console.error('Error canceling invitation:', error);
      toast.error('Failed to cancel invitation');
    } finally {
      setIsCanceling(false);
    }
  };

  return (
    <>
      <Card 
        className={`relative h-45 transition-colors duration-75 ${isAccessible ? 'cursor-pointer' : ''}`}
        style={{
          backgroundColor: 'var(--color-base-surface-page-background)',
          pointerEvents: (isAccessible || isInvited) ? 'auto' : 'none'
        }}
        onMouseEnter={isAccessible ? (e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-neutral-3)';
        } : undefined}
        onMouseLeave={isAccessible ? (e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-base-surface-page-background)';
        } : undefined}
        onClick={isAccessible ? handleCardClick : undefined}
      >
      <CardContent className="py-5 px-5 h-full">
        {/* Connection Badge and Actions - Top Right */}
        {status && (
          <div className="absolute top-5 right-5 flex items-center gap-2">
            <StatusBadge variant={status} showText={true} />
            {isInvited && (
              <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`p-0 cursor-pointer transition-colors duration-75 ${
                      isDropdownOpen 
                        ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
                        : 'hover:bg-[var(--color-interactive-surface-hover)]'
                    }`}
                    style={{ height: '24px', width: '24px' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DotsThree size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleCancelClick}
                    disabled={isCanceling}
                    className="focus:bg-red-50"
                  >
                    <XCircle size={16} style={{ color: 'var(--color-red-11)' }} />
                    <span style={{ color: 'var(--color-red-11)' }}>
                      {isCanceling ? 'Canceling...' : 'Cancel invitation'}
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
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
              {isInvited ? (
                <p className="text-sm-regular line-clamp-2" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  Awaiting agency set up…
                </p>
              ) : agencyType && (
                <p className="text-sm-regular text-base-text-secondary line-clamp-2" title={agencyType}>
                  {agencyType}
                </p>
              )}
            </div>
          </div>
          {isInvited && invitedEmail ? (
            <div className="flex-shrink-0 min-w-0 w-1/3">
              <ListRow
                avatar={true}
                avatarUrl={undefined}
                avatarFallback={<User size={16} weight="fill" className="text-white" />}
                text={invitedEmail}
                textColor="var(--color-base-text-tertiary)"
                actions={false}
                iconButtonEnd={false}
                dropdownItems={undefined}
                variant="stacked"
                nonInteractive={true}
              />
            </div>
          ) : accountManager && (
            <div className="flex-shrink-0 min-w-0 w-1/3">
              {accountManager.name === 'Unassigned' ? (
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
              ) : (
                <ListRow
                  avatar={true}
                  avatarUrl={accountManager.avatarUrl}
                  text={accountManager.name}
                  actions={false}
                  iconButtonEnd={false}
                  dropdownItems={undefined}
                  variant="stacked"
                  onClick={handleAccountManagerClick}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>
      </Card>
      
      {/* Profile Card Modal */}
      {selectedAccountManager && (
        <ProfileCard
          member={selectedAccountManager}
          isOpen={profileDialogOpen}
          onClose={() => setProfileDialogOpen(false)}
        />
      )}
    </>
  );
}

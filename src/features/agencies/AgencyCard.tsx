import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { StatusBadge, StatusVariant } from '@/components/ui/connection-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { DotsThree, XCircle, Link } from '@phosphor-icons/react';
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
  projectCount?: number;
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
  projectCount = 0,
  context,
  onAgencyDeleted
}: AgencyCardProps) {
  const router = useRouter();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  
  const isAccessible = status === 'connected' || status === 'disconnected';
  const isInvited = status === 'invited';
  
  const handleCardClick = () => {
    if (isAccessible) {
      router.push(`/agencies/${connectionId}/overview`);
    }
  };

  const handleConnectionSettingsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDropdownOpen(false);
    router.push(`/agencies/${connectionId}/settings`);
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
                {isAccessible && (
                  <DropdownMenuItem onClick={handleConnectionSettingsClick}>
                    <Link size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                    Connection settings
                  </DropdownMenuItem>
                )}
                {isInvited && (
                  <>
                    {isAccessible && <DropdownMenuSeparator />}
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
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
          <div className="flex-shrink-0 min-w-0 w-1/3 flex items-center gap-4">
            <p className="text-sm-regular text-secondary truncate">Live projects</p>
            <p className="text-sm-regular text-secondary truncate">{projectCount}</p>
          </div>
        </div>
      </CardContent>
      </Card>
    </>
  );
}

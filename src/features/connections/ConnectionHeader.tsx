'use client'

import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/connection-badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ArrowLeft, DotsThree, Link } from '@phosphor-icons/react';
import { useRouter } from 'next/navigation';
import type { ConnectionSnapshot } from './types';
import type { StatusVariant } from '@/components/ui/connection-badge';

interface ConnectionHeaderProps {
  snapshot: ConnectionSnapshot;
}

export function ConnectionHeader({ snapshot }: ConnectionHeaderProps) {
  const router = useRouter();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Determine back link and label based on partner type
  const backHref = snapshot.partner.type === 'client' ? '/clients' : '/agencies';
  const backLabel = snapshot.partner.type === 'client' ? 'All clients' : 'All agencies';

  return (
    <div>
      {/* Back button */}
      <div className="mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75"
          onClick={() => router.push(backHref)}
        >
          <ArrowLeft size={16} weight="regular" />
          <span className="ml-1">{backLabel}</span>
        </Button>
      </div>

      {/* Avatar, Title, Status Badge, and Settings */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-5">
          <Avatar className="h-15 w-15">
            <AvatarImage src={snapshot.partner.logo} alt={snapshot.partner.name} />
            <AvatarFallback 
              className="text-white font-medium text-lg"
              style={{ background: 'var(--color-neutral-9, #8B8D98)' }}
            >
              {snapshot.partner.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
            {snapshot.partner.name}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <StatusBadge 
            variant={snapshot.connection.status as StatusVariant}
            size="lg"
            showText={true}
          />
          
          <DropdownMenu modal={false} open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className={`cursor-pointer shadow-none transition-all duration-75 ${
                  isSettingsOpen 
                    ? 'bg-interactive-surface-hover hover:bg-interactive-surface-hover' 
                    : 'hover:bg-interactive-surface-hover'
                }`}
                style={{ height: '32px', width: '32px' }}
              >
                <DotsThree size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>
                <Link size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                Connection settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}


'use client'

import { useState } from 'react';
import { useConnection } from '../ConnectionContext';
import { Card } from '@/components/ui/card';
import RequestsTable from '../requests/RequestsTable';

export function RequestsPage() {
  const { snapshot, context } = useConnection();
  
  // Get user avatar from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex-1">
        {/* Requests Table */}
        <RequestsTable
          userAvatar={userAvatar}
          userInitials={userInitials}
        />
      </div>
    </Card>
  );
}


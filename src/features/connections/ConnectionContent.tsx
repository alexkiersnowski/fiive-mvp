'use client'

import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

interface ConnectionContentProps {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
}

export function ConnectionContent({ snapshot, context }: ConnectionContentProps) {
  const isAgencyView = context.variant === 'agency';
  const isClientView = context.variant === 'client';

  return (
    <div>
      {/* Cards will go here */}
    </div>
  );
}


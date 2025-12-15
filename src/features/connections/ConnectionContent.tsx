'use client'

import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

interface ConnectionContentProps {
  snapshot: ConnectionSnapshot;
  context: EnhancedModeContext;
}

export function ConnectionContent({ snapshot: _snapshot, context }: ConnectionContentProps) {
  const _isAgencyView = context.variant === 'agency';
  const _isClientView = context.variant === 'client';

  return (
    <div>
      {/* Cards will go here */}
    </div>
  );
}


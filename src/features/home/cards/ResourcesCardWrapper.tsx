'use client';

import ResourcesCardClient from './ResourcesCardClient';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

interface ResourcesCardWrapperProps {
  context: EnhancedModeContext;
  initialResources: Array<{
    id: string;
    url: string;
    label: string | null;
    createdAt: string | null;
  }>;
}

export function ResourcesCardWrapper({ 
  context, 
  initialResources 
}: ResourcesCardWrapperProps) {
  return (
    <ResourcesCardClient 
      context={context}
      initialResources={initialResources}
    />
  );
}


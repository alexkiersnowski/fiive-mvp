'use client';

import { useConnection } from '../ConnectionContext';
import ResourcesCardClient from './ResourcesCardClient';

interface ResourcesCardWrapperProps {
  connectionId: string;
  initialResources: any[];
}

export function ResourcesCardWrapper({ 
  connectionId, 
  initialResources 
}: ResourcesCardWrapperProps) {
  const { snapshot, context } = useConnection();

  if (!snapshot) {
    return null;
  }

  return (
    <ResourcesCardClient 
      snapshot={snapshot} 
      context={context}
      initialResources={initialResources}
    />
  );
}


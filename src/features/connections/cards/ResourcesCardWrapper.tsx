'use client';

import { useConnection } from '../ConnectionContext';
import ResourcesCardClient from './ResourcesCardClient';

type ConnectionResource = {
  id: string;
  url: string;
  label: string | null;
  clientVisible: boolean;
  createdAt: string | null;
};

interface ResourcesCardWrapperProps {
  connectionId: string;
  initialResources: ConnectionResource[];
}

export function ResourcesCardWrapper({ 
  connectionId: _connectionId, 
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


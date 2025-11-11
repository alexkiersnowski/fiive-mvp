import { getActiveContext } from '@/lib/mode/getActiveContext';
import { getConnectionResources } from '../server';
import { ResourcesCardWrapper } from './ResourcesCardWrapper';

interface ResourcesCardProps {
  connectionId: string;
}

export default async function ResourcesCard({ connectionId }: ResourcesCardProps) {
  const context = await getActiveContext();
  
  if (!context) {
    return null;
  }

  // Fetch resources server-side (snapshot comes from ConnectionContext in client component)
  const initialResources = await getConnectionResources(connectionId, context);

  return (
    <ResourcesCardWrapper 
      connectionId={connectionId}
      initialResources={initialResources}
    />
  );
}

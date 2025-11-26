import { getOrganizationResources } from '../server';
import { ResourcesCardWrapper } from './ResourcesCardWrapper';
import type { StatsCardProps } from '../types';

export default async function ResourcesCard({ snapshot: _snapshot, context }: StatsCardProps) {
  // Fetch resources server-side
  const initialResources = await getOrganizationResources(context);

  return (
    <ResourcesCardWrapper 
      context={context}
      initialResources={initialResources}
    />
  );
}

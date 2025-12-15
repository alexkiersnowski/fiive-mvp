import { Card } from '@/components/ui/card';
import { getProjectsForConnection, getAgencyMembersForConnection } from '../server';
import ProjectsPageClient from './ProjectsPageClient';

interface ProjectsPageProps {
  connectionId: string
}

// Server component that fetches all projects upfront (no pagination, no filters)
export async function ProjectsPage({ connectionId }: ProjectsPageProps) {
  const [projectsData, agencyMembers] = await Promise.all([
    getProjectsForConnection(connectionId, { limit: 10000, offset: 0 }),
    getAgencyMembersForConnection(connectionId)
  ]);

  return (
    <Card className="w-full gap-0 h-full">
      <ProjectsPageClient 
        connectionId={connectionId} 
        initialProjects={projectsData.projects} 
        initialTotalCount={projectsData.totalCount}
        agencyMembers={agencyMembers} 
      />
    </Card>
  );
}

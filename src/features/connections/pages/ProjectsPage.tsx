import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getProjectsForConnection, getAgencyMembersForConnection } from '../server';
import ProjectsPageClient from './ProjectsPageClient';
import { PAGE_SIZE } from '../constants';

interface ProjectsPageProps {
  connectionId: string
}

// Server component that fetches data from Supabase (mock data for now)
export async function ProjectsPage({ connectionId }: ProjectsPageProps) {
  const [projectsData, agencyMembers] = await Promise.all([
    getProjectsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0 }),
    getAgencyMembersForConnection(connectionId)
  ]);

  return (
    <Card className="w-full gap-0 h-full">
      <ErrorBoundary>
        <ProjectsPageClient 
          connectionId={connectionId} 
          initialProjects={projectsData.projects} 
          initialTotalCount={projectsData.totalCount}
          agencyMembers={agencyMembers} 
        />
      </ErrorBoundary>
    </Card>
  );
}

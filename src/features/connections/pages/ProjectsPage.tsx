import { Card } from '@/components/ui/card';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { getProjectsForConnection, getAgencyMembersForConnection } from '../server';
import ProjectsPageClient from './ProjectsPageClient';
import { PAGE_SIZE } from '../constants';

interface ProjectsPageProps {
  connectionId: string
  searchParams?: { sort?: string }
}

// Server component that fetches data from Supabase (mock data for now)
export async function ProjectsPage({ connectionId, searchParams }: ProjectsPageProps) {
  // Validate sort value against allowed values
  const validSorts = ['newest_first', 'project_asc', 'project_desc', 'end_date_asc']
  const sort = searchParams?.sort && validSorts.includes(searchParams.sort) 
    ? searchParams.sort 
    : 'newest_first'
  
  const [projectsData, agencyMembers] = await Promise.all([
    getProjectsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0, sort }),
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

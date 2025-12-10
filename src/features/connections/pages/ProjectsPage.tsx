import { Card } from '@/components/ui/card';
import { getProjectsForConnection, getAgencyMembersForConnection } from '../server';
import ProjectsPageClient from './ProjectsPageClient';
import { PAGE_SIZE } from '../constants';

interface ProjectsPageProps {
  connectionId: string
  searchParams?: { sort?: string; search?: string }
}

// Server component that fetches data from Supabase (mock data for now)
export async function ProjectsPage({ connectionId, searchParams }: ProjectsPageProps) {
  // Validate sort value against allowed values
  const validSorts = ['project_asc', 'end_date_asc']
  const sort = searchParams?.sort && validSorts.includes(searchParams.sort) 
    ? searchParams.sort 
    : 'project_asc'
  
  // Get search query from URL params
  const searchQuery = searchParams?.search || undefined
  
  const [projectsData, agencyMembers] = await Promise.all([
    getProjectsForConnection(connectionId, { limit: PAGE_SIZE, offset: 0, sort, searchQuery }),
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

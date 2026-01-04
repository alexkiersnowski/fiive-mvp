import {
  getProjectsForConnection,
  getAgencyMembersForConnection,
  type Project,
} from '../server';
import ProjectsCardClient from './ProjectsCardClient';

interface ProjectsCardProps {
  connectionId: string;
  fetchProjects?: (connectionId: string) => Promise<Project[]>;
  projects?: Project[]; // Optional: if provided, use these projects instead of fetching
}

async function defaultFetchProjects(connectionId: string) {
  const { projects } = await getProjectsForConnection(connectionId, { limit: 5, offset: 0 });
  return projects;
}

export default async function ProjectsCard({
  connectionId,
  fetchProjects = defaultFetchProjects,
  projects: providedProjects,
}: ProjectsCardProps) {
  // Use provided projects if available, otherwise fetch (optimization: share projects across cards)
  const projectsPromise = providedProjects 
    ? Promise.resolve(providedProjects)
    : fetchProjects(connectionId);

  const [projects, agencyMembers] = await Promise.all([
    projectsPromise,
    getAgencyMembersForConnection(connectionId),
  ]);

  // Filter to only show live projects (planned, active, on_hold)
  // Exclude completed and canceled projects
  const liveProjects = projects.filter(
    (project) => project.status === 'planned' || project.status === 'active' || project.status === 'on_hold'
  );

  // Split into displayed (first 4) and prefetched (5th)
  const displayedProjects = liveProjects.slice(0, 4);
  const prefetchedNextProject = liveProjects[4] || null;

  return (
    <ProjectsCardClient
      connectionId={connectionId}
      projects={displayedProjects}
      prefetchedNextProject={prefetchedNextProject}
      agencyMembers={agencyMembers}
    />
  );
}

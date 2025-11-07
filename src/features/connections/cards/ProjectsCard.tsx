import {
  getProjectsForConnection,
  getAgencyMembersForConnection,
  type Project,
} from '../server';
import ProjectsCardClient from './ProjectsCardClient';

interface ProjectsCardProps {
  connectionId: string;
  fetchProjects?: (connectionId: string) => Promise<Project[]>;
}

async function defaultFetchProjects(connectionId: string) {
  const { projects } = await getProjectsForConnection(connectionId, { limit: 4, offset: 0 });
  return projects;
}

export default async function ProjectsCard({
  connectionId,
  fetchProjects = defaultFetchProjects,
}: ProjectsCardProps) {
  const [projects, agencyMembers] = await Promise.all([
    fetchProjects(connectionId),
    getAgencyMembersForConnection(connectionId),
  ]);

  return (
    <ProjectsCardClient
      connectionId={connectionId}
      projects={projects.slice(0, 4)}
      agencyMembers={agencyMembers}
    />
  );
}

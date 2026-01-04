import {
  getRecentRequestsForConnection,
  getRequestsByIds,
  getCommentsForRequests,
  getProjectOptionsForConnection,
  type RecentRequestSummary,
  type Comment as RequestComment,
  type Project,
  type Request,
} from '../server';
import RequestsCardClient from './RequestsCardClient';

type ProjectOption = {
  id: string;
  name: string;
};

interface RequestsCardProps {
  connectionId: string;
  fetchRecentRequests?: (connectionId: string) => Promise<RecentRequestSummary[]>;
  projects?: ProjectOption[]; // Optional: if provided, skip fetching projects
}

async function defaultFetchRecentRequests(connectionId: string) {
  return getRecentRequestsForConnection(connectionId, { limit: 5 });
}

type PrefetchedComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
  text: string;
};

type PrefetchedRequest = {
  id: string;
  title: string;
  createdAt: string | null;
  detail: {
    requestId: string;
    title: string;
    description: string;
    client?: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    agency?: {
      id: string;
      name: string;
      logoUrl?: string;
    };
    submittedBy?: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    };
    assignee?: {
      id: string;
      name: string;
      email: string;
      avatarUrl?: string;
    } | null;
    project?: {
      id: string;
      name: string;
    } | null;
    status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed';
    createdAt?: string;
    createdByOrgId?: string;
    createdByOrgType?: 'agency' | 'client';
  };
  comments: PrefetchedComment[];
};

export default async function RequestsCard({
  connectionId,
  fetchRecentRequests = defaultFetchRecentRequests,
  projects: providedProjects,
}: RequestsCardProps) {
  const recentRequests = await fetchRecentRequests(connectionId);

  const requestIds = recentRequests.map((request) => request.id);

  const commentsPromise: Promise<Record<string, RequestComment[]>> = requestIds.length > 0
    ? getCommentsForRequests(requestIds)
    : Promise.resolve({});

  // Fetch projects only if not provided (optimization: share projects across cards)
  // Use lightweight getProjectOptionsForConnection instead of full project fetch
  const projectsPromise = providedProjects 
    ? Promise.resolve({ 
        projects: providedProjects.map(p => ({ 
          id: p.id, 
          title: p.name, 
          requestsCount: 0, 
          tasksCount: 0 
        } as Pick<Project, 'id' | 'title' | 'requestsCount' | 'tasksCount'>)), 
        totalCount: providedProjects.length 
      })
    : getProjectOptionsForConnection(connectionId).then(options => ({
        projects: options.map(p => ({
          id: p.id,
          title: p.name,
          requestsCount: 0,
          tasksCount: 0
        } as Pick<Project, 'id' | 'title' | 'requestsCount' | 'tasksCount'>)),
        totalCount: options.length
      }));

  const [requestDetails, commentsRecord, projectsResult] = await Promise.all([
    requestIds.length > 0 ? getRequestsByIds(connectionId, requestIds) : Promise.resolve([]),
    commentsPromise,
    projectsPromise,
  ]);

  const detailMap = new Map<string, Request>();
  requestDetails.forEach((detail) => {
    if (detail) {
      detailMap.set(detail.id, detail);
    }
  });

  const filteredSummaries = recentRequests.filter((summary) => detailMap.has(summary.id));

  const prefetchedRequests: PrefetchedRequest[] = filteredSummaries.map((summary) => {
    const detail = detailMap.get(summary.id)!;
    const rawComments = commentsRecord[summary.id] ?? [];

    const serializedComments: PrefetchedComment[] = rawComments.map((comment) => ({
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar,
      createdAt: comment.createdAt instanceof Date
        ? comment.createdAt.toISOString()
        : new Date(comment.createdAt).toISOString(),
      text: comment.text,
    }));

    return {
      id: detail.id,
      title: detail.title,
      createdAt: detail.createdAt,
      detail: {
        requestId: detail.id,
        title: detail.title,
        description: detail.description,
        client: detail.client,
        agency: detail.agency,
        submittedBy: detail.submittedBy,
        assignee: detail.assignee,
        project: detail.project,
        status: detail.status,
        createdAt: detail.createdAt,
        createdByOrgId: detail.createdByOrgId,
        createdByOrgType: detail.createdByOrgType,
      },
      comments: serializedComments,
    };
  });

  // Sort by status priority (new > in_review > accepted), then by created_at descending
  const statusPriority: Record<string, number> = {
    'new': 0,
    'in_review': 1,
    'accepted': 2
  };

  const sortedRequests = prefetchedRequests.sort((a, b) => {
    // First sort by status priority
    const aStatus = a.detail.status ?? '';
    const bStatus = b.detail.status ?? '';
    const statusDiff = (statusPriority[aStatus] ?? 999) - (statusPriority[bStatus] ?? 999);
    if (statusDiff !== 0) return statusDiff;
    
    // Then by created_at descending (newest first within same status)
    const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return bTime - aTime;
  });

  // Take top 5 after sorting, then split into displayed (first 4) and prefetched (5th)
  const topRequests = sortedRequests.slice(0, 5);
  const displayedRequests = topRequests.slice(0, 4);
  const prefetchedNextRequest = topRequests[4] || null;

  const projectOptions: ProjectOption[] = projectsResult.projects.map((project) => ({
    id: project.id,
    name: project.title || 'Untitled project',
  }));

  return (
    <RequestsCardClient
      connectionId={connectionId}
      requests={displayedRequests}
      prefetchedNextRequest={prefetchedNextRequest}
      projects={projectOptions}
    />
  );
}


import {
  getRecentRequestsForConnection,
  getRequestById,
  getCommentsForRequests,
  getProjectsForConnection,
  type RecentRequestSummary,
  type Comment as RequestComment,
} from '../server';
import RequestsCardClient from './RequestsCardClient';

interface RequestsCardProps {
  connectionId: string;
  fetchRecentRequests?: (connectionId: string) => Promise<RecentRequestSummary[]>;
}

async function defaultFetchRecentRequests(connectionId: string) {
  return getRecentRequestsForConnection(connectionId, { limit: 4 });
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
    status?: 'new' | 'in_review' | 'accepted' | 'canceled';
    createdAt?: string;
    createdByOrgId?: string;
    createdByOrgType?: 'agency' | 'client';
  };
  comments: PrefetchedComment[];
};

type ProjectOption = {
  id: string;
  name: string;
};

export default async function RequestsCard({
  connectionId,
  fetchRecentRequests = defaultFetchRecentRequests,
}: RequestsCardProps) {
  const recentRequests = await fetchRecentRequests(connectionId);

  const requestIds = recentRequests.map((request) => request.id);

  const commentsPromise: Promise<Record<string, RequestComment[]>> = requestIds.length > 0
    ? getCommentsForRequests(requestIds)
    : Promise.resolve({});

  const [requestDetails, commentsRecord, projectsResult] = await Promise.all([
    Promise.all(requestIds.map((requestId) => getRequestById(requestId, connectionId))),
    commentsPromise,
    getProjectsForConnection(connectionId, { limit: 1000, offset: 0 }),
  ]);

  const detailMap = new Map<string, Awaited<ReturnType<typeof getRequestById>>>();
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

  const projectOptions: ProjectOption[] = projectsResult.projects.map((project) => ({
    id: project.id,
    name: project.title || 'Untitled project',
  }));

  return (
    <RequestsCardClient
      connectionId={connectionId}
      requests={prefetchedRequests}
      projects={projectOptions}
    />
  );
}


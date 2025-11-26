"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Card, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { ListRow } from '@/components/ui/list-row';
import { ChatCentered, Plus, Eye, Users, ArrowRight } from '@phosphor-icons/react/dist/ssr';
import { toast } from 'sonner';

import { useConnection } from '../ConnectionContext';
import { RequestDetailModal } from '../requests/RequestDetailModal';
import { NewRequestModal } from '../requests/NewRequestModal';
import { ConvertToTaskModal, type ConvertToTaskModalValues } from '../tasks/ConvertToTaskModal';
import { convertRequestToTask } from '../tasks/actions';
import { fetchRequestById } from '../requests/actions';
import type { Request } from '../server';

type PrefetchedComment = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: string;
  text: string;
};

type CommentItem = {
  id: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  createdAt: Date;
  text: string;
};

type ProjectOption = {
  id: string;
  name: string;
};

type RequestDetailPayload = {
  requestId: string;
  title: string;
  description: string;
  client?: { id: string; name: string; logoUrl?: string };
  agency?: { id: string; name: string; logoUrl?: string };
  submittedBy?: { id: string; name: string; email: string; avatarUrl?: string };
  assignee?: { id: string; name: string; email: string; avatarUrl?: string } | null;
  project?: { id: string; name: string } | null;
  status?: 'new' | 'in_review' | 'accepted' | 'canceled';
  createdAt?: string;
  createdByOrgId?: string;
  createdByOrgType?: 'agency' | 'client';
};

type PrefetchedRequest = {
  id: string;
  title: string;
  createdAt: string | null;
  detail: RequestDetailPayload;
  comments: PrefetchedComment[];
};

interface RequestsCardClientProps {
  connectionId: string;
  requests: PrefetchedRequest[];
  projects: ProjectOption[];
}

const formatRequestDate = (isoDate: string | null | undefined) => {
  if (!isoDate) return '';

  const parsedDate = new Date(isoDate);
  if (Number.isNaN(parsedDate.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(parsedDate);
};

export function RequestsCardClient({ connectionId, requests, projects }: RequestsCardClientProps) {
  const { snapshot, context, setNewRequestsCount } = useConnection();
  const router = useRouter();
  const pathname = usePathname();

  const [prefetchedRequests, setPrefetchedRequests] = useState<PrefetchedRequest[]>(requests);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<RequestDetailPayload | null>(null);
  const [selectedComments, setSelectedComments] = useState<CommentItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [convertRequest, setConvertRequest] = useState<RequestDetailPayload | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    setPrefetchedRequests(requests);
  }, [requests]);

  const isAgency = context.variant === 'agency';
  const title = 'Requests';
  const buttonText = isAgency ? 'Add request' : 'Submit request';
  const linkText = 'View all requests';
  const description = isAgency
    ? 'Clients can submit requests from their portal, or you can add one for them.'
    : 'Ask questions, share updates, or request new work from your agency.';

  const hasRequests = prefetchedRequests.length > 0;

  const baseRoute = useMemo(() => {
    if (pathname) {
      const [, segment] = pathname.split('/');
      if (segment === 'clients' || segment === 'agencies') {
        return segment;
      }
    }
    return context.variant === 'agency' ? 'agencies' : 'clients';
  }, [pathname, context.variant]);

  const handleRowClick = useCallback(async (requestId: string) => {
    const target = prefetchedRequests.find((item) => item.id === requestId);
    if (!target) {
      toast.error('Unable to load request details.');
      return;
    }

    setSelectedRequestId(requestId);
    setSelectedRequest(target.detail);
    setSelectedComments(
      target.comments.map((comment) => ({
        ...comment,
        createdAt: new Date(comment.createdAt),
      }))
    );
    setIsModalOpen(true);
  }, [prefetchedRequests]);

  const handleRequestUpdate = useCallback((requestId: string, updates: {
    title?: string;
    description?: string;
    status?: 'new' | 'in_review' | 'accepted' | 'canceled';
    assignee?: Request['assignee'];
    project?: { id: string; name: string } | null;
  }) => {
    let previousStatus: 'new' | 'in_review' | 'accepted' | 'canceled' | undefined;

    setPrefetchedRequests((prev) => prev.map((item) => {
      if (item.id !== requestId) {
        return item;
      }

      previousStatus = item.detail.status;

      const nextDetail: RequestDetailPayload = {
        ...item.detail,
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.description !== undefined ? { description: updates.description } : {}),
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.assignee !== undefined ? { assignee: updates.assignee } : {}),
        ...(updates.project !== undefined ? { project: updates.project ?? null } : {}),
      };

      return {
        ...item,
        title: updates.title ?? item.title,
        detail: nextDetail,
      };
    }));

    if (context.variant === 'agency' && updates.status && previousStatus) {
      const wasNew = previousStatus === 'new';
      const isNowNew = updates.status === 'new';

      if (!wasNew && isNowNew) {
        setNewRequestsCount((prev) => (prev || 0) + 1);
      } else if (wasNew && !isNowNew) {
        setNewRequestsCount((prev) => Math.max(0, (prev || 0) - 1));
      }
    }

    setSelectedRequest((prev) => (
      prev && prev.requestId === requestId
        ? { ...prev, ...updates }
        : prev
    ));
  }, [context.variant, setNewRequestsCount]);

  const handleRequestDeleted = useCallback((requestId: string) => {
    let wasNew = false;

    setPrefetchedRequests((prev) => prev.filter((item) => {
      if (item.id === requestId) {
        wasNew = item.detail.status === 'new';
      }
      return item.id !== requestId;
    }));

    if (context.variant === 'agency' && wasNew) {
      setNewRequestsCount((prev) => Math.max(0, (prev || 0) - 1));
    }

    if (selectedRequestId === requestId) {
      setSelectedRequestId(null);
      setSelectedRequest(null);
      setSelectedComments([]);
      setIsModalOpen(false);
    }
  }, [context.variant, selectedRequestId, setNewRequestsCount]);

  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    // allow modal exit animation before clearing data
    setTimeout(() => {
      setSelectedRequestId(null);
      setSelectedRequest(null);
      setSelectedComments([]);
    }, 300);
  }, []);

  const handleConvertModalClose = useCallback(() => {
    setIsConvertModalOpen(false);
    setTimeout(() => {
      setConvertRequest(null);
    }, 300);
  }, []);

  const handleRequestConvertToTask = useCallback((request: RequestDetailPayload) => {
    setConvertRequest({
      ...request,
      description: request.description ?? '',
    });
    setIsConvertModalOpen(true);
  }, []);

  const handleConvertSubmit = useCallback(async (values: ConvertToTaskModalValues) => {
    const { requestId, title, description, status, project, assignee, dueDateRaw, clientVisible } = values;
    if (!requestId) {
      toast.error('Request unavailable for conversion');
      return;
    }
    try {
      await convertRequestToTask(requestId, {
        connectionId,
        title,
        description,
        status,
        projectId: project?.id ?? null,
        assigneeUserId: assignee?.id ?? null,
        dueDateRaw,
        clientVisible,
      });

      toast.success('Task created from request');
      handleConvertModalClose();
      handleRequestUpdate(requestId, { status: 'accepted' });
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to convert request to task:', error);
      }
      toast.error('Failed to convert request');
    }
  }, [convertRequest, connectionId, handleConvertModalClose, handleRequestUpdate, router]);

  const handleModalExpand = useCallback(() => {
    if (!selectedRequestId) {
      return;
    }
    router.push(`/${baseRoute}/${connectionId}/requests/${selectedRequestId}`);
  }, [baseRoute, connectionId, router, selectedRequestId]);

  const handleCommentsUpdate = useCallback((comments: CommentItem[]) => {
    if (!selectedRequestId) {
      return;
    }

    const serialized = comments.map((comment) => ({
      id: comment.id,
      userId: comment.userId,
      userName: comment.userName,
      userAvatar: comment.userAvatar,
      createdAt: comment.createdAt.toISOString(),
      text: comment.text,
    }));

    setPrefetchedRequests((prev) => prev.map((item) => (
      item.id === selectedRequestId
        ? { ...item, comments: serialized }
        : item
    )));

    setSelectedComments(comments);
  }, [selectedRequestId]);

  const mapRequestToPrefetched = useCallback((request: Request): PrefetchedRequest => ({
    id: request.id,
    title: request.title,
    createdAt: request.createdAt,
    detail: {
      requestId: request.id,
      title: request.title,
      description: request.description,
      client: request.client,
      agency: request.agency,
      submittedBy: request.submittedBy,
      assignee: request.assignee,
      project: request.project,
      status: request.status,
      createdAt: request.createdAt,
      createdByOrgId: request.createdByOrgId,
      createdByOrgType: request.createdByOrgType,
    },
    comments: [],
  }), []);

  const handleNewRequestOptimistic = useCallback((payload: {
    tempId: string;
    title: string;
    description: string;
    projectId: string | null;
    projectName?: string | null;
    assigneeUserId: string | null;
  }) => {
    const isoNow = new Date().toISOString();
    const displayDate = formatRequestDate(isoNow) || isoNow;

    const assigneeMember = payload.assigneeUserId
      ? snapshot.agencyMembers?.find((member) => member.id === payload.assigneeUserId)
      : undefined;

    const optimisticEntry: PrefetchedRequest = {
      id: payload.tempId,
      title: payload.title,
      createdAt: displayDate,
      detail: {
        requestId: payload.tempId,
        title: payload.title,
        description: payload.description || '',
        client: {
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo || undefined,
        },
        agency: {
          id: snapshot.agency.id,
          name: snapshot.agency.name,
          logoUrl: snapshot.agency.logo || undefined,
        },
        submittedBy: {
          id: context.user.id,
          name: `${context.user.firstName} ${context.user.lastName}`.trim() || 'You',
          email: context.user.email,
          avatarUrl: context.user.avatarUrl,
        },
        assignee: assigneeMember
          ? {
              id: assigneeMember.id,
              name: `${assigneeMember.firstName} ${assigneeMember.lastName}`,
              email: assigneeMember.email,
              avatarUrl: assigneeMember.avatarUrl,
            }
          : null,
        project: payload.projectId && payload.projectName
          ? { id: payload.projectId, name: payload.projectName }
          : null,
        status: 'new',
        createdAt: displayDate,
        createdByOrgId: context.organization.id,
        createdByOrgType: context.variant === 'agency' ? 'agency' : 'client',
      },
      comments: [],
    };

    setPrefetchedRequests((prev) => {
      const next = [optimisticEntry, ...prev.filter((item) => item.id !== payload.tempId)];
      return next.slice(0, 4);
    });

    if (context.variant === 'agency') {
      setNewRequestsCount((prev) => (prev || 0) + 1);
    }
  }, [context.organization.id, context.user, context.variant, setNewRequestsCount, snapshot.agency, snapshot.agencyMembers, snapshot.partner]);

  const handleNewRequestCreated = useCallback(async ({ requestId, tempId }: { requestId: string; tempId?: string }) => {
    try {
      const fetched = await fetchRequestById(connectionId, requestId);
      if (!fetched) {
        return;
      }

      const mapped = mapRequestToPrefetched(fetched);

      setPrefetchedRequests((prev) => {
        const filtered = prev.filter((item) => item.id !== tempId && item.id !== mapped.id);
        const next = [mapped, ...filtered];
        return next.slice(0, 4);
      });

      if (!tempId && context.variant === 'agency' && fetched.status === 'new') {
        setNewRequestsCount((prev) => (prev || 0) + 1);
      }
    } catch (error) {
      console.error('Failed to reconcile new request:', error);
    }
  }, [connectionId, context.variant, mapRequestToPrefetched, setNewRequestsCount]);

  const handleNewRequestButtonClick = useCallback(() => {
    setIsNewModalOpen(true);
  }, []);

  const handleNewRequestModalClose = useCallback(() => {
    setIsNewModalOpen(false);
  }, []);

  return (
    <Card className="w-full h-full min-h-[306px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
          {title}
        </CardTitle>
        <Tooltip delayDuration={250}>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className="text-xs border-0"
              style={{
                borderRadius: 'var(--radius-1-max, 3px)',
                backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                border: 'none',
                cursor: 'default',
              }}
            >
              {isAgency ? (
                <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              ) : (
                <Users size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
              )}
              <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                {isAgency ? 'Client visible' : 'Collaborate'}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={8}>
            {isAgency
              ? 'Visible in client portal'
              : 'Both you and your agency can manage this'}
          </TooltipContent>
        </Tooltip>
      </div>

      {hasRequests ? (
        <div className="flex flex-col gap-3 mt-1">
          {prefetchedRequests.map((request) => (
            <ListRow
              key={request.id}
              iconStart={
                <ChatCentered
                  size={16}
                  weight="regular"
                  style={{ color: 'var(--color-interactive-neutral-default)' }}
                />
              }
              text={request.title}
              secondaryText={formatRequestDate(request.createdAt) || undefined}
              layout="inline"
              secondaryTextWidth="44px"
              className="px-2 cursor-pointer"
              onClick={() => handleRowClick(request.id)}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs-regular text-tertiary">
          {description}
        </p>
      )}

      <div className="mt-auto flex justify-end">
        {hasRequests ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75 mt-1"
            onClick={() => router.push(`/${baseRoute}/${connectionId}/requests`)}
          >
            <span className="mr-1">{linkText}</span>
            <ArrowRight size={16} weight="regular" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-6 shadow-none cursor-pointer transition-all duration-75"
            onClick={handleNewRequestButtonClick}
          >
            <Plus size={16} weight="regular" />
            {buttonText}
          </Button>
        )}
      </div>

      <RequestDetailModal
        requestData={selectedRequest}
        agencyMembers={snapshot.agencyMembers ?? []}
        projects={projects}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleModalExpand}
        onRequestUpdate={handleRequestUpdate}
        onConvertToTask={(request) => {
          if (!request) {
            return;
          }
          handleRequestConvertToTask({
            requestId: request.requestId,
            title: request.title,
            description: request.description || '',
            client: request.client,
            agency: request.agency,
            submittedBy: request.submittedBy,
            assignee: request.assignee ?? null,
            project: request.project ?? null,
            status: request.status,
            createdAt: request.createdAt,
            createdByOrgId: request.createdByOrgId,
            createdByOrgType: request.createdByOrgType,
          });
        }}
        onRequestDeleted={handleRequestDeleted}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
        activeUser={{
          id: context.user.id,
          firstName: context.user.firstName,
          lastName: context.user.lastName,
          avatarUrl: context.user.avatarUrl,
        }}
        initialComments={selectedComments}
        onCommentsUpdate={handleCommentsUpdate}
      />

      <ConvertToTaskModal
        isOpen={isConvertModalOpen}
        onClose={handleConvertModalClose}
        onSubmit={handleConvertSubmit}
        connectionId={connectionId}
        request={convertRequest}
        agencyMembers={snapshot.agencyMembers ?? []}
        projects={projects}
        variant={context.variant}
      />

      <NewRequestModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo || undefined,
        }}
        agencyMembers={snapshot.agencyMembers ?? []}
        isOpen={isNewModalOpen}
        onClose={handleNewRequestModalClose}
        onRequestOptimistic={handleNewRequestOptimistic}
        onRequestCreated={handleNewRequestCreated}
        connectionId={connectionId}
        currentOrgId={context.organization.id}
        variant={context.variant}
      />
    </Card>
  );
}

export default RequestsCardClient;


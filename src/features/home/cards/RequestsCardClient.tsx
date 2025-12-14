"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RequestBadge } from "@/components/ui/request-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RequestDetailModal } from "@/features/connections/requests/RequestDetailModal";
import { ConvertToTaskModal, type ConvertToTaskModalValues } from "@/features/connections/tasks/ConvertToTaskModal";
import { PaywallModal } from "@/components/ui/paywall-modal";
import { convertRequestToTask } from "@/features/connections/tasks/actions";
import { fetchRequestByIdGlobal, fetchCommentsForRequestGlobal, fetchRequestsSnapshot } from "@/features/requests/actions";
import { toast } from "sonner";
import type { Request } from "@/features/requests/types";
import type { StatsCardProps } from "../types";
import type { Comment } from "@/features/connections/server";
import { dispatchRequestStatusChanged, dispatchRequestDeleted } from "./stats/NewRequestsCard";
import { dispatchRequestInReviewStatusChanged, dispatchRequestInReviewDeleted } from "./stats/RequestsInReviewCard";
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers';
import { formatRequestDateFullMonth } from '@/features/connections/formatters';

interface RequestsCardClientProps extends StatsCardProps {
  requests: Request[];
  prefetchedNextRequest?: Request | null;
  agencyMembers?: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
  }>;
  initialComments?: Record<string, Comment[]>;
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
}

export default function RequestsCardClient({
  requests,
  prefetchedNextRequest = null,
  snapshot: _snapshot,
  context,
  agencyMembers = [],
  initialComments = {},
  allowedConnectionIds = null,
}: RequestsCardClientProps) {
  const router = useRouter();
  const isAgency = context.variant === "agency";
  const title = "Requests";
  const description = isAgency
    ? "Clients can submit requests from their portal, or you can add one for them."
    : "Ask questions, share updates, or request new work from your agency.";
  const linkText = "View all requests";

  // Local state for requests (to allow optimistic updates)
  const [localRequests, setLocalRequests] = useState<Request[]>(requests);
  // Store prefetched next request for instant replacement on delete
  const [prefetchedRequest, setPrefetchedRequest] = useState<Request | null>(prefetchedNextRequest);

  const hasRequests = localRequests.length > 0;

  // Modal state
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  // Initialize comments with prefetched data
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments);
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false);
  
  // Convert to task modal state
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertRequest, setConvertRequest] = useState<{
    requestId: string;
    title: string;
    description: string;
    client?: { id: string; name: string; logoUrl?: string };
    agency?: { id: string; name: string; logoUrl?: string };
    submittedBy?: { id: string; name: string; email: string; avatarUrl?: string };
    assignee?: { id: string; name: string; email: string; avatarUrl?: string } | null;
    project?: { id: string; name: string } | null;
    createdAt?: string;
    createdByOrgId?: string;
    createdByOrgType?: 'agency' | 'client';
  } | null>(null);
  const [convertConnectionId, setConvertConnectionId] = useState<string | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [members, setMembers] = useState<Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    avatarUrl?: string;
    jobTitle?: string;
    orgId?: string;
    orgName?: string;
    orgType?: 'agency' | 'client';
  }>>(agencyMembers);

  // Sync local requests when props change
  useEffect(() => {
    setLocalRequests(requests);
  }, [requests]);

  // Sync prefetched request when prop changes
  useEffect(() => {
    setPrefetchedRequest(prefetchedNextRequest);
  }, [prefetchedNextRequest]);

  // Sync comments when initialComments prop changes (when snapshot changes, card re-fetches comments)
  useEffect(() => {
    setCommentsByRequest(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  const handleRowClick = useCallback(async (requestId: string) => {
    // Try to get request from local state first
    const localRequest = localRequests.find(r => r.id === requestId);
    
    if (!localRequest) {
      // If not in local state, fetch from server (will trigger paywall check)
      await runWithPaywallCheck(
        async () => {
          const request = await fetchRequestByIdGlobal(requestId, context);
          if (!request) {
            throw new Error('Request not found');
          }
          return request;
        },
        (request) => {
          setSelectedRequest(request);
          setIsRequestDetailModalOpen(true);
          
          // Use prefetched comments if available, otherwise fetch
          if (commentsByRequest[requestId]) {
            // Comments already available, no need to fetch
          } else {
            // Fetch comments if not prefetched
            fetchCommentsForRequestGlobal(requestId).then(comments => {
              setCommentsByRequest(prev => ({
                ...prev,
                [requestId]: comments
              }));
            }).catch(error => {
              console.error('Error fetching comments:', error);
            });
          }
        },
        () => {
          setIsPaywallModalOpen(true);
        }
      );
      return;
    }

    // Check paywall client-side using prefetched allowedConnectionIds
    const billingStatus = context.organization.billing_status || 'free';
    if (context.variant === 'agency' && billingStatus === 'free' && allowedConnectionIds != null) {
      if (!allowedConnectionIds.includes(localRequest.connectionId)) {
        // Restricted connection - show paywall immediately
        setIsPaywallModalOpen(true);
        return;
      }
    }

    // Allowed - open modal instantly with local data
    setSelectedRequest(localRequest);
    setIsRequestDetailModalOpen(true);
    
    // Use prefetched comments if available, otherwise fetch
    if (commentsByRequest[requestId]) {
      // Comments already available, no need to fetch
    } else {
      // Fetch comments if not prefetched
      fetchCommentsForRequestGlobal(requestId).then(comments => {
        setCommentsByRequest(prev => ({
          ...prev,
          [requestId]: comments
        }));
      }).catch(error => {
        console.error('Error fetching comments:', error);
      });
    }
  }, [localRequests, context, commentsByRequest, allowedConnectionIds]);

  const handleRequestDetailModalClose = useCallback(() => {
    setIsRequestDetailModalOpen(false);
    // Allow modal exit animation before clearing data
    setTimeout(() => {
      setSelectedRequest(null);
    }, 300);
  }, []);

  const handleExpandRequest = useCallback(() => {
    if (selectedRequest && selectedRequest.connectionId) {
      // Determine baseRoute based on context variant
      // Agencies view clients, clients view agencies
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedRequest.connectionId}/requests/${selectedRequest.id}`;
      window.location.href = url;
    }
  }, [selectedRequest, context.variant]);

  const handleRequestUpdate = useCallback((requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee']; project?: { id: string; name: string } | null }) => {
    // Find the original request to check status change
    const originalRequest = localRequests.find(r => r.id === requestId);
    const oldStatus = originalRequest?.status;
    const newStatus = updates.status;

    // Optimistic update - update both the table and modal
    setLocalRequests(prev => prev.map(r => 
      r.id === requestId 
        ? { ...r, ...updates }
        : r
    ));
    // Also update selectedRequest if it's the current one
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
    }

    // Emit event if status changed and it affects 'new' count
    if (oldStatus && newStatus && oldStatus !== newStatus) {
      dispatchRequestStatusChanged({
        requestId,
        oldStatus,
        newStatus,
      });
      // Also emit event if status changed affects 'in_review' count
      dispatchRequestInReviewStatusChanged({
        requestId,
        oldStatus,
        newStatus,
      });
    }
  }, [selectedRequest, localRequests]);

  const handleRequestConvertToTask = useCallback((request: Request) => {
    if (!request.connectionId) {
      toast.error('Unable to convert request: connection not found');
      return;
    }
    
    // Set the request data and connection ID
    // The RequestDetailModal already handles closing itself with a 175ms delay
    // before calling onConvertToTask, so this will be called after it starts closing
    setConvertConnectionId(request.connectionId);
    setConvertRequest({
      requestId: request.id,
      title: request.title,
      description: request.description || '',
      client: request.client,
      agency: request.agency,
      submittedBy: request.submittedBy,
      assignee: request.assignee ?? null,
      project: request.project ?? null,
      createdAt: request.createdAt,
      createdByOrgId: request.createdByOrgId,
      createdByOrgType: request.createdByOrgType,
    });
    
    // Include the request's project in the initial projects array to prevent flicker
    // ConvertToTaskModal will fetch the full projects list in the background
    if (request.project) {
      setProjects([{ id: request.project.id, name: request.project.name }]);
    } else {
      setProjects([]);
    }
    
    // Open the convert modal immediately (matching connections implementation)
    // ConvertToTaskModal will handle fetching projects/members if needed
    setIsConvertModalOpen(true);
    
    // Fetch projects and members in the background (ConvertToTaskModal also does this, but we do it here too for members)
    Promise.all([
      import('@/features/connections/tasks/actions').then(m => m.fetchProjectsForConnection(request.connectionId)),
      import('@/features/connections/tasks/actions').then(m => m.fetchMembersForConnection(request.connectionId)),
    ]).then(([projectsData, membersData]) => {
      // Update projects list (ensuring request's project is included)
      const mappedProjects = projectsData.map(p => ({ id: p.id, name: p.name }));
      if (request.project) {
        const hasProject = mappedProjects.some(p => p.id === request.project!.id);
        if (!hasProject) {
          mappedProjects.unshift({ id: request.project.id, name: request.project.name });
        }
      }
      setProjects(mappedProjects);
      
      // Combine agency and client members, deduplicate by id
      const combined = [...membersData.agencyMembers, ...membersData.clientMembers];
      const dedupedMap = new Map<string, typeof combined[0]>();
      combined.forEach(member => {
        if (!dedupedMap.has(member.id)) {
          dedupedMap.set(member.id, member);
        }
      });
      setMembers(Array.from(dedupedMap.values()));
    }).catch(error => {
      console.error('Error fetching projects/members for convert modal:', error);
    });
  }, []);

  const handleConvertModalClose = useCallback(() => {
    setIsConvertModalOpen(false);
    setTimeout(() => {
      setConvertRequest(null);
      setConvertConnectionId(null);
    }, 300);
  }, []);

  const handleConvertSubmit = useCallback(async (values: ConvertToTaskModalValues) => {
    if (!convertRequest?.requestId || !convertConnectionId) {
      toast.error('Request unavailable for conversion');
      return;
    }
    
    setIsConverting(true);
    try {
      const result = await convertRequestToTask(convertRequest.requestId, {
        connectionId: convertConnectionId,
        title: values.title,
        description: values.description,
        status: values.status,
        projectId: values.project?.id ?? null,
        assigneeUserId: values.assignee?.id ?? null,
        dueDateRaw: values.dueDateRaw,
        clientVisible: values.clientVisible,
      });

      toast.success('Task created from request');
      handleConvertModalClose();
      handleRequestUpdate(convertRequest.requestId, { status: 'accepted' });
      
      // Dispatch taskCreated event for TasksCardClient to handle optimistically
      window.dispatchEvent(new CustomEvent('taskCreated', {
        detail: {
          taskId: result.taskId,
          connectionId: convertConnectionId,
          title: values.title,
          description: values.description,
          status: values.status,
          project: values.project,
          assignee: values.assignee,
          dueDateRaw: values.dueDateRaw,
          clientVisible: values.clientVisible,
          client: convertRequest.client,
          agency: convertRequest.agency,
        }
      }));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to convert request to task:', error);
      }
      toast.error('Failed to convert request');
    } finally {
      setIsConverting(false);
    }
  }, [convertRequest, convertConnectionId, handleConvertModalClose, handleRequestUpdate]);

  const handleRequestDeleted = useCallback(async (requestId: string) => {
    // Store the deleted request for potential rollback
    const deletedRequest = localRequests.find(r => r.id === requestId);
    const deletedIndex = localRequests.findIndex(r => r.id === requestId);
    const deletedStatus = deletedRequest?.status;
    
    // Emit event if deleted request had status 'new'
    if (deletedStatus === 'new') {
      dispatchRequestDeleted({
        requestId,
        status: deletedStatus,
      });
    }
    
    // Emit event if deleted request had status 'in_review'
    if (deletedStatus === 'in_review') {
      dispatchRequestInReviewDeleted({
        requestId,
        status: deletedStatus,
      });
    }
    
    // Optimistically remove request from table immediately
    setLocalRequests(prev => prev.filter(r => r.id !== requestId));
    
    // Close modal immediately
    setIsRequestDetailModalOpen(false);
    setSelectedRequest(null);
    
    // Instantly display prefetched next request if available
    let nextRequest: Request | null = null;
    if (prefetchedRequest) {
      nextRequest = prefetchedRequest;
      setLocalRequests(prev => {
        // Only add if we don't already have it (avoid duplicates)
        if (!prev.find(r => r.id === nextRequest!.id)) {
          return [...prev, nextRequest!];
        }
        return prev;
      });
      // Clear the prefetched request since we've used it
      setPrefetchedRequest(null);
      
      // Prefetch the next request (6th one) for future deletions
      // Fetch starting from cursor 5 with limit 1
      fetchRequestsSnapshot(context, {
        limit: 1,
        cursor: '5',
      }).then(nextSnapshot => {
        if (nextSnapshot.requests.length > 0) {
          const newPrefetched = nextSnapshot.requests[0];
          setPrefetchedRequest(newPrefetched);
          
          // Prefetch comments for the new prefetched request
          fetchCommentsForRequestGlobal(newPrefetched.id).then(comments => {
            setCommentsByRequest(prev => ({
              ...prev,
              [newPrefetched.id]: comments
            }));
          }).catch(error => {
            console.error('Error fetching comments for prefetched request:', error);
          });
        }
      }).catch(error => {
        console.error('Error prefetching next request:', error);
      });
    }
    
    // Delete from database in the background
    try {
      const { deleteRequest } = await import('@/features/connections/requests/actions');
      await deleteRequest(requestId);
      
      // Show success toast after server confirms
      toast.success('Request deleted');
    } catch (error) {
      // Revert optimistic updates on error
      if (deletedRequest) {
        setLocalRequests(prev => {
          // Remove the optimistically added next request if it was added
          const withoutNext = nextRequest 
            ? prev.filter(r => r.id !== nextRequest!.id)
            : prev;
          // Insert deleted request back in the same position
          if (deletedIndex >= 0 && deletedIndex < withoutNext.length) {
            return [...withoutNext.slice(0, deletedIndex), deletedRequest, ...withoutNext.slice(deletedIndex)];
          } else {
            return [...withoutNext, deletedRequest];
          }
        });
        
        // Restore prefetched request if we used it
        if (nextRequest && prefetchedRequest) {
          setPrefetchedRequest(prefetchedRequest);
        }
        
        // Remove comments for next request if they were added
        if (nextRequest) {
          setCommentsByRequest(prev => {
            const { [nextRequest!.id]: _, ...rest } = prev;
            return rest;
          });
        }
      }
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    }
  }, [localRequests, prefetchedRequest, context]);

  return (
    <Card className="w-full h-full min-h-[370px] pt-5 pb-6 px-5 flex flex-col gap-3">
      <CardTitle className="text-xl-medium" style={{ color: "var(--color-base-text-primary)" }}>
        {title}
      </CardTitle>

      {hasRequests ? (
        <div className="mt-1">
          <Table className="table-fixed w-full border-collapse">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[40%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Title
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Status
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  {isAgency ? "Client" : "Agency"}
                </TableHead>
                <TableHead className="w-[20%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                  Created
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {localRequests.map((request) => (
                <TableRow
                  key={request.id}
                  tabIndex={0}
                  className="cursor-pointer transition-colors duration-75 hover:bg-[var(--color-interactive-surface-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-interactive-border-focus)]"
                  onClick={() => handleRowClick(request.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleRowClick(request.id);
                    }
                  }}
                >
                  <TableCell className="w-[40%] py-2">
                    <span
                      className="text-sm-regular truncate"
                      style={{ color: "var(--color-base-text-primary)" }}
                    >
                      {request.title?.trim() || "Untitled request"}
                    </span>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <RequestBadge
                      variant={request.status}
                      size="sm"
                      showText
                      customLabel={request.status === "new" && !isAgency ? "Submitted" : undefined}
                      className="inline-flex"
                    />
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <div className="flex items-center gap-2">
                      {isAgency ? (
                        <>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={request.client.logoUrl} alt={request.client.name} />
                            <AvatarFallback
                              className="text-[10px] font-medium text-white"
                              style={{ background: "var(--color-neutral-9, #8B8D98)" }}
                            >
                              {request.client.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm-regular truncate"
                            style={{ color: "var(--color-base-text-primary)" }}
                          >
                            {request.client.name}
                          </span>
                        </>
                      ) : (
                        <>
                          <Avatar className="w-5 h-5">
                            <AvatarImage src={request.agency?.logoUrl} alt={request.agency?.name || ""} />
                            <AvatarFallback
                              className="text-[10px] font-medium text-white"
                              style={{ background: "var(--color-neutral-9, #8B8D98)" }}
                            >
                              {request.agency?.name?.charAt(0).toUpperCase() || "A"}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            className="text-sm-regular truncate"
                            style={{ color: "var(--color-base-text-primary)" }}
                          >
                            {request.agency?.name || "Unknown"}
                          </span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-[20%] py-2">
                    <span
                      className="text-sm-regular"
                      style={{ color: "var(--color-base-text-primary)" }}
                    >
                      {formatRequestDateFullMonth(request.createdAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-xs-regular text-tertiary">{description}</p>
      )}

      <div className="mt-auto flex justify-end">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 text-xs-regular cursor-pointer hover:bg-interactive-surface-hover transition-all duration-75 mt-1"
          onClick={() => router.push("/requests")}
        >
          <span className="mr-1">{linkText}</span>
          <ArrowRight size={16} weight="regular" />
        </Button>
      </div>

      {/* Request Detail Modal */}
      {selectedRequest && (
        <RequestDetailModal
          requestData={{
            requestId: selectedRequest.id,
            title: selectedRequest.title,
            description: selectedRequest.description,
            client: selectedRequest.client,
            agency: selectedRequest.agency,
            submittedBy: selectedRequest.submittedBy,
            assignee: selectedRequest.assignee,
            project: selectedRequest.project,
            status: selectedRequest.status,
            createdAt: selectedRequest.createdAt,
            createdByOrgId: selectedRequest.createdByOrgId,
            createdByOrgType: selectedRequest.createdByOrgType,
          }}
          agencyMembers={agencyMembers}
          projects={[]} // Projects not needed for card view
          isOpen={isRequestDetailModalOpen}
          onClose={handleRequestDetailModalClose}
          onExpand={handleExpandRequest}
          onRequestUpdate={(requestId, updates) => {
            handleRequestUpdate(requestId, updates);
          }}
          onRequestDeleted={handleRequestDeleted}
          onConvertToTask={(request) => {
            if (!request) return;
            const fullRequest = localRequests.find(r => r.id === request.requestId);
            if (fullRequest) {
              handleRequestConvertToTask(fullRequest);
            }
          }}
          connectionId={selectedRequest.connectionId}
          currentOrgId={context.orgId}
          variant={context.variant}
          activeUser={context.user ? {
            id: context.user.id,
            firstName: context.user.firstName,
            lastName: context.user.lastName,
            avatarUrl: context.user.avatarUrl,
          } : undefined}
          initialComments={commentsByRequest[selectedRequest.id] || []}
          onCommentsUpdate={(comments) => {
            setCommentsByRequest(prev => ({
              ...prev,
              [selectedRequest.id]: comments
            }));
          }}
          isGlobalView={true}
        />
      )}

      {/* Convert to Task Modal */}
      {convertRequest && convertConnectionId && (
        <ConvertToTaskModal
          isOpen={isConvertModalOpen}
          onClose={handleConvertModalClose}
          onSubmit={handleConvertSubmit}
          isSubmitting={isConverting}
          connectionId={convertConnectionId}
          request={convertRequest}
          agencyMembers={members}
          projects={projects}
          variant={context.variant}
        />
      )}

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </Card>
  );
}


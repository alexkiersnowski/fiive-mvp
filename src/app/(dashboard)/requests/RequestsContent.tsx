'use client'

import { useState, useCallback, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import RequestsTable from '@/features/requests/RequestsTable';
import { RequestsHeader } from '@/features/requests/RequestsHeader';
import { RequestDetailModal } from '@/features/connections/requests/RequestDetailModal';
import { NewRequestModal } from '@/features/connections/requests/NewRequestModal';
import { fetchMoreRequests, fetchRequestByIdGlobal, fetchCommentsForRequestGlobal } from '@/features/requests/actions';
import { fetchProjectsForConnection } from '@/features/connections/requests/actions';
import { ConvertToTaskModal, type ConvertToTaskModalValues } from '@/features/connections/tasks/ConvertToTaskModal';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { runWithPaywallCheck } from '@/lib/tasks-requests-helpers';
import { convertRequestToTask } from '@/features/connections/tasks/actions';
import type { RequestsSnapshot, Request } from '@/features/requests/types';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { Comment } from '@/features/connections/server';

interface RequestsContentProps {
  snapshot: RequestsSnapshot;
  context: EnhancedModeContext;
  initialSearchValue?: string;
  initialSortValue?: string;
  initialComments?: Record<string, Comment[]>;
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>;
  connections?: Array<{
    id: string
    name: string
    logoUrl?: string
  }>;
  newRequestsCount?: number;
  allowedConnectionIds?: string[] | null; // Array of allowed connection IDs (null = no limit for paid plans)
}

export function RequestsContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialSortValue = 'created',
  initialComments = {},
  agencyMembers = [],
  connections = [],
  newRequestsCount,
  allowedConnectionIds = null
}: RequestsContentProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rootRef = useRef<HTMLDivElement>(null);
  const parentRef = useRef<HTMLDivElement | null>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);
  const [headerOffset, setHeaderOffset] = useState(0);
  // Read assigned filter from URL params (same pattern as connection-specific RequestsPageClient)
  const initiallyAssigned = (() => {
    try { return searchParams.get('assigned') === 'me' } catch { return false }
  })()
  const [assignedToMe, setAssignedToMe] = useState(initiallyAssigned);
  
  const [requests, setRequests] = useState<Request[]>(snapshot.requests);
  const [totalCount, setTotalCount] = useState(snapshot.total);
  const [unfilteredTotalCount, setUnfilteredTotalCount] = useState(snapshot.unfilteredTotalCount);
  const [cursor, setCursor] = useState<string | null>(snapshot.cursor || null);
  const [hasNextPage, setHasNextPage] = useState(snapshot.hasNextPage);
  const [searchValue, setSearchValue] = useState(initialSearchValue);
  const [debouncedSearchValue, setDebouncedSearchValue] = useState(initialSearchValue);
  const [sortValue, setSortValue] = useState(initialSortValue || 'created');
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingServerResults, setIsFetchingServerResults] = useState(false);
  const [, startTransition] = useTransition();
  
  // Modal state
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Convert to task modal state
  const [convertRequest, setConvertRequest] = useState<Request | null>(null);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [projectsForConvert, setProjectsForConvert] = useState<Array<{ id: string; name: string }>>([]);
  const [membersForConvert, setMembersForConvert] = useState<Array<{
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
  
  // Comments map keyed by requestId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments);
  
  // Paywall modal state
  const [isPaywallModalOpen, setIsPaywallModalOpen] = useState(false);

  // Sort options - different for agency vs client views
  const sortOptions = context.variant === 'agency'
    ? [
        { value: 'created', label: 'Created (newest first)', buttonLabel: 'Created' },
        { value: 'client_asc', label: 'Client (A-Z)', buttonLabel: 'Client (A-Z)' },
        { value: 'client_desc', label: 'Client (Z-A)', buttonLabel: 'Client (Z-A)' }
      ]
    : [
        { value: 'created', label: 'Created (newest first)', buttonLabel: 'Created' },
        { value: 'agency_asc', label: 'Agency (A-Z)', buttonLabel: 'Agency (A-Z)' },
        { value: 'agency_desc', label: 'Agency (Z-A)', buttonLabel: 'Agency (Z-A)' }
      ];

  // Sync local state with server snapshot when props change
  useEffect(() => {
    // Use transition for smooth updates (prevents flicker)
    startTransition(() => {
      setRequests(snapshot.requests);
      setTotalCount(snapshot.total);
      setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
      setCursor(snapshot.cursor || null);
      setHasNextPage(snapshot.hasNextPage);
      setIsFetchingServerResults(false);
    });
  }, [snapshot, startTransition]);

  // Sync comments when initialComments prop changes (when snapshot changes, page re-fetches comments)
  useEffect(() => {
    setCommentsByRequest(prev => ({
      ...prev,
      ...initialComments
    }));
  }, [initialComments]);

  // Debounce server fetch (150ms - reduced from 300ms for faster response)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 150);

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Trigger server fetch when debounced search, sort, or assignedToMe changes (for complete results)
  useEffect(() => {
    const currentSearchParam = searchParams.get('search') || '';
    const currentSortParam = searchParams.get('sort') || 'created';
    const currentAssignedParam = searchParams.get('assigned') === 'me';
    
    if (debouncedSearchValue !== currentSearchParam || sortValue !== currentSortParam || assignedToMe !== currentAssignedParam) {
      setIsFetchingServerResults(true);
      const params = new URLSearchParams(searchParams.toString());
      if (debouncedSearchValue.trim()) {
        params.set('search', debouncedSearchValue.trim());
      } else {
        params.delete('search');
      }
      params.set('sort', sortValue);
      if (assignedToMe) {
        params.set('assigned', 'me');
      } else {
        params.delete('assigned');
      }
      router.push(`/requests?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearchValue, sortValue, assignedToMe, router, searchParams]);

  // Display: Use server results directly (no optimistic filtering)
  const displayedRequests = requests;
  const displayedTotal = totalCount;

  // Track header height for sticky table offset
  useEffect(() => {
    if (!headerWrapperRef.current) return;
    const node = headerWrapperRef.current;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderOffset(entry.contentRect.height);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const loadMore = useCallback(async () => {
    if (!hasNextPage || isLoading || !cursor) return;
    
    setIsLoading(true);
    try {
      const snapshot = await fetchMoreRequests(context, {
        cursor,
        search: debouncedSearchValue,
        sort: sortValue,
        limit: 50,
        assignedToUserId: assignedToMe && context.variant === 'agency' ? context.user?.id : undefined,
        createdByUserId: assignedToMe && context.variant === 'client' ? context.user?.id : undefined
      });
      
      startTransition(() => {
        // Merge new requests with existing ones
        setRequests(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRequests = snapshot.requests.filter(r => !existingIds.has(r.id));
          return [...prev, ...newRequests];
        });
        setTotalCount(snapshot.total);
        setUnfilteredTotalCount(snapshot.unfilteredTotalCount);
        setCursor(snapshot.cursor || null);
        setHasNextPage(snapshot.hasNextPage);
      });
    } catch (error) {
      console.error('Error loading more requests:', error);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [hasNextPage, isLoading, cursor, context, debouncedSearchValue, sortValue, assignedToMe, startTransition]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
    // Debounced server fetch handled by useEffect
  }, []);

  const handleSortChange = useCallback((newSortValue: string) => {
    setSortValue(newSortValue);
    // Server fetch handled by useEffect
  }, []);

  const handleNewRequest = useCallback(() => {
    setIsNewRequestModalOpen(true);
  }, []);

  const handleNewRequestModalClose = useCallback(() => {
    setIsNewRequestModalOpen(false);
    setSelectedConnectionId(null);
    setProjectsForConnection([]);
  }, []);

  const handleConnectionSelect = useCallback(async (connectionId: string) => {
    setSelectedConnectionId(connectionId);
    // Fetch projects for the selected connection
    try {
      const projects = await fetchProjectsForConnection(connectionId);
      setProjectsForConnection(projects);
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjectsForConnection([]);
    }
  }, []);

  const handleRequestOptimistic = useCallback((payload: {
    tempId: string
    title: string
    description: string
    projectId: string | null
    projectName?: string | null
    assigneeUserId: string | null
  }) => {
    if (!selectedConnectionId) return;
    
    // Find the selected connection
    const selectedConnection = connections.find(c => c.id === selectedConnectionId);
    if (!selectedConnection) return;

    // Find an existing request for this connection to reuse its client/agency structure
    // This ensures we use the exact same client ID that the server uses, preventing duplicate subgroups
    const existingRequest = requests.find(r => r.connectionId === selectedConnectionId);
    
    // Create optimistic request
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    // Determine client and agency based on variant
    // Agency view: selectedConnection is a client, current org is agency
    // Client view: selectedConnection is an agency, current org is client
    const isAgency = context.variant === 'agency';
    
    // Reuse client/agency from existing request if available to ensure exact ID match
    // Otherwise fall back to constructing from connection/context
    const client = existingRequest?.client || (isAgency 
      ? {
          id: selectedConnection.id,
          name: selectedConnection.name,
          logoUrl: selectedConnection.logoUrl,
        }
      : {
          id: context.organization.id,
          name: context.organization.name || '',
          logoUrl: context.organization.logoUrl,
        });
    
    const agency = existingRequest?.agency || (isAgency
      ? {
          id: context.organization.id,
          name: context.organization.name || '',
          logoUrl: context.organization.logoUrl,
        }
      : {
          id: selectedConnection.id,
          name: selectedConnection.name,
          logoUrl: selectedConnection.logoUrl,
        });
    
    const optimisticRequest: Request = {
      id: payload.tempId,
      connectionId: selectedConnectionId,
      title: payload.title,
      description: payload.description,
      status: 'new',
      project: payload.projectId && payload.projectName ? { id: payload.projectId, name: payload.projectName } : null,
      submittedBy: {
        id: context.user?.id || '',
        name: `${context.user?.firstName || ''} ${context.user?.lastName || ''}`.trim() || 'You',
        email: context.user?.email || '',
        avatarUrl: context.user?.avatarUrl || undefined,
        jobTitle: context.user?.jobTitle || undefined,
        orgId: context.organization.id,
        orgName: context.organization.name || '',
        orgLogo: undefined,
      },
      assignee: null,
      client,
      agency,
      createdAt: today,
      createdByOrgId: context.organization.id,
      createdByOrgType: context.variant,
    };

    setRequests(prev => [optimisticRequest, ...prev]);
    setTotalCount(prev => prev + 1);
    setUnfilteredTotalCount(prev => prev + 1);
  }, [selectedConnectionId, connections, context, requests]);

  const handleRequestCreated = useCallback(async ({ requestId, tempId }: { requestId: string; tempId?: string }) => {
    if (!selectedConnectionId) return;
    
    try {
      // Use connectionId directly and skip cache for immediate post-insert fetch
      const request = await fetchRequestByIdGlobal(requestId, context, selectedConnectionId, true);
      if (!request) {
        console.error('Failed to fetch newly created request');
        return;
      }
      
      // Replace temp row if present; otherwise prepend and increment count
      setRequests(prev => {
        const without = prev.filter(r => r.id !== tempId && r.id !== request.id);
        const next = [request, ...without];
        return next;
      });
      
      // Update selectedRequest if it matches tempId (using functional update to avoid stale closure)
      if (tempId) {
        setSelectedRequest(prev => {
          if (prev?.id === tempId) {
            return request;
          }
          return prev;
        });
      }
      
      // Fetch comments for the new request
      try {
        const comments = await fetchCommentsForRequestGlobal(requestId);
        // Update comments map for the new request
        setCommentsByRequest(prev => ({
          ...prev,
          [requestId]: comments
        }));
      } catch (error) {
        console.error('Error fetching comments:', error);
      }
    } catch (error) {
      console.error('Failed to fetch newly created request:', error);
    }
  }, [selectedConnectionId, context]);

  const handleRequestClick = useCallback(async (requestId: string) => {
    // Try to get request from local state first
    const localRequest = requests.find(r => r.id === requestId);
    
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
  }, [requests, context, commentsByRequest, allowedConnectionIds]);
  
  const handleRequestDetailModalClose = useCallback(() => {
    setIsRequestDetailModalOpen(false);
    // Allow modal exit animation before clearing data
    setTimeout(() => {
      setSelectedRequest(null);
    }, 300);
  }, []);
  
  const handleExpandRequest = useCallback(() => {
    if (selectedRequest && selectedRequest.connectionId) {
      // Check if this is a tempId (starts with 'temp-')
      // If so, prevent navigation and show a message
      if (selectedRequest.id.startsWith('temp-')) {
        toast.error('Please wait for the request to finish creating');
        return;
      }
      
      // Determine baseRoute based on context variant
      // Agencies view clients, clients view agencies
      const baseRoute = context.variant === 'agency' ? 'clients' : 'agencies';
      const url = `/${baseRoute}/${selectedRequest.connectionId}/requests/${selectedRequest.id}`;
      window.location.href = url;
    }
  }, [selectedRequest, context.variant]);

  const handleRequestUpdate = useCallback((requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'; assignee?: Request['assignee']; project?: { id: string; name: string } | null }) => {
    // Optimistic update
    setRequests(prev => prev.map(r => 
      r.id === requestId 
        ? { ...r, ...updates }
        : r
    ));
    // Also update selectedRequest if it's the current one
    if (selectedRequest && selectedRequest.id === requestId) {
      setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedRequest]);

  const handleRequestDeleted = useCallback(async (requestId: string) => {
    // Store the deleted request and its index for potential rollback
    const deletedIndex = requests.findIndex(r => r.id === requestId);
    const deletedRequest = deletedIndex >= 0 ? requests[deletedIndex] : null;
    
    // Optimistically remove request immediately (no flicker)
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setTotalCount(prev => Math.max(0, prev - 1));
    setUnfilteredTotalCount(prev => Math.max(0, prev - 1));
    
    // Also close modal if this request is currently selected
    if (selectedRequest?.id === requestId) {
      setIsRequestDetailModalOpen(false);
      setSelectedRequest(null);
    }
    
    try {
      const { deleteRequest } = await import('@/features/connections/requests/actions');
      await deleteRequest(requestId);
      // Only show success toast after server confirms
      toast.success('Request deleted');
    } catch (error) {
      // Revert optimistic update on error
      if (deletedRequest && deletedIndex >= 0) {
        setRequests(prev => {
          // Insert back in the same position
          return [...prev.slice(0, deletedIndex), deletedRequest, ...prev.slice(deletedIndex)];
        });
        setTotalCount(prev => prev + 1);
        setUnfilteredTotalCount(prev => prev + 1);
      }
      console.error('Error deleting request:', error);
      toast.error('Failed to delete request');
    }
  }, [requests, selectedRequest]);

  const handleConvertModalClose = useCallback(() => {
    setIsConvertModalOpen(false);
    setTimeout(() => {
      setConvertRequest(null);
      setProjectsForConvert([]);
      setMembersForConvert(agencyMembers);
    }, 300);
  }, [agencyMembers]);

  const handleRequestConvertToTask = useCallback((request: Request) => {
    setConvertRequest(request);
    
    // Include the request's project in the initial projects array to prevent flicker
    // ConvertToTaskModal will fetch the full projects list in the background
    if (request.project) {
      setProjectsForConvert([{ id: request.project.id, name: request.project.name }]);
    } else {
      setProjectsForConvert([]);
    }
    
    // Set initial members from agencyMembers prop
    setMembersForConvert(agencyMembers);
    
    // Open the convert modal immediately (matching home page implementation)
    // ConvertToTaskModal will handle fetching projects/members if needed
    setIsConvertModalOpen(true);
    
    // Fetch projects and members in the background
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
      setProjectsForConvert(mappedProjects);
      
      // Combine agency and client members, deduplicate by id
      const combined = [...membersData.agencyMembers, ...membersData.clientMembers];
      const dedupedMap = new Map<string, typeof combined[0]>();
      combined.forEach(member => {
        if (!dedupedMap.has(member.id)) {
          dedupedMap.set(member.id, member);
        }
      });
      setMembersForConvert(Array.from(dedupedMap.values()));
    }).catch(error => {
      console.error('Error fetching projects/members for convert modal:', error);
    });
  }, [agencyMembers]);

  const handleConvertSubmit = useCallback(async (values: ConvertToTaskModalValues) => {
    if (!convertRequest) {
      toast.error('Request unavailable for conversion');
      return;
    }

    setIsConverting(true);
    
    try {
      await convertRequestToTask(values.requestId, {
        connectionId: convertRequest.connectionId,
        title: values.title,
        description: values.description,
        status: values.status,
        projectId: values.project?.id ?? null,
        assigneeUserId: values.assignee?.id ?? null,
        dueDateRaw: values.dueDateRaw,
        clientVisible: values.clientVisible,
      });

      toast.success('Task created from request');
      handleRequestUpdate(values.requestId, { status: 'accepted' });
      handleConvertModalClose();
    } catch (error) {
      console.error('Failed to convert request to task:', error);
      toast.error('Failed to convert request');
    } finally {
      setIsConverting(false);
    }
  }, [convertRequest, handleRequestUpdate, handleConvertModalClose]);

  const handleToggleAssignedToMe = useCallback(() => {
    setAssignedToMe(prev => !prev);
    // URL update will trigger server fetch via useEffect
  }, []);

  // Get user avatar and initials from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = (context.user?.firstName?.[0] || '') + (context.user?.lastName?.[0] || '') || 'U';
  const isAgency = context.variant === 'agency';

  return (
    <div ref={rootRef} className="flex flex-col" style={{ padding: '0 16px 24px 24px' }}>
      <div
        ref={headerWrapperRef}
        className="sticky z-20"
        style={{
          top: 0,
          backgroundColor: 'var(--color-neutral-2)',
          backdropFilter: 'saturate(180%) blur(12px)',
        }}
      >
        <RequestsHeader
          onNewRequest={handleNewRequest}
          newRequestsCount={newRequestsCount}
          isAgency={isAgency}
        />
      </div>

      <div ref={parentRef}>
        <RequestsTable
          requests={displayedRequests}
          isBootstrapping={isFetchingServerResults && displayedRequests.length === 0}
          unfilteredTotalCount={unfilteredTotalCount}
          onLoadMore={loadMore}
          onNewRequest={handleNewRequest}
          onRequestClick={handleRequestClick}
          onRequestUpdate={handleRequestUpdate}
          onRequestDeleted={handleRequestDeleted}
          parentRef={parentRef}
          headerOffset={headerOffset}
          currentOrgId={context.orgId}
          totalCount={displayedTotal}
          assignedToMe={assignedToMe}
          onToggleAssignedToMe={handleToggleAssignedToMe}
          userAvatar={userAvatar}
          userInitials={userInitials}
          isAgency={isAgency}
          agencyMembers={agencyMembers}
          onSearchChange={handleSearchChange}
          sortOptions={sortOptions}
          sortValue={sortValue}
          onSortChange={handleSortChange}
          onConvertToTask={handleRequestConvertToTask}
          allowedConnectionIds={allowedConnectionIds}
        />
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
          projects={[]} // TODO: Fetch projects for global requests
          isOpen={isRequestDetailModalOpen}
          onClose={handleRequestDetailModalClose}
          onExpand={handleExpandRequest}
          onRequestUpdate={(requestId, updates) => {
            handleRequestUpdate(requestId, updates);
            // Also update selectedRequest if it's the current one
            if (selectedRequest && selectedRequest.id === requestId) {
              setSelectedRequest(prev => prev ? { ...prev, ...updates } : null);
            }
          }}
          onRequestDeleted={handleRequestDeleted}
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
          isDisconnected={false}
          isGlobalView={true}
          onConvertToTask={(request) => {
            if (!request || !selectedRequest) return
            // RequestDetailModal already handles closing with animation and 175ms delay
            // before calling this callback, so we can open convert modal immediately
            handleRequestConvertToTask(selectedRequest)
          }}
        />
      )}

      {/* Convert to Task Modal */}
      {convertRequest && (
        <ConvertToTaskModal
          isOpen={isConvertModalOpen}
          onClose={handleConvertModalClose}
          onSubmit={handleConvertSubmit}
          isSubmitting={isConverting}
          connectionId={convertRequest.connectionId}
          variant={context.variant}
          request={{
            requestId: convertRequest.id,
            title: convertRequest.title,
            description: convertRequest.description ?? '',
            client: convertRequest.client,
            agency: convertRequest.agency,
            submittedBy: convertRequest.submittedBy
              ? {
                  id: convertRequest.submittedBy.id,
                  name: convertRequest.submittedBy.name,
                  email: convertRequest.submittedBy.email,
                  avatarUrl: convertRequest.submittedBy.avatarUrl,
                }
              : undefined,
            assignee: convertRequest.assignee
              ? {
                  id: convertRequest.assignee.id,
                  name: convertRequest.assignee.name,
                  email: convertRequest.assignee.email,
                  avatarUrl: convertRequest.assignee.avatarUrl,
                }
              : null,
            project: convertRequest.project,
            createdAt: convertRequest.createdAt,
            createdByOrgId: convertRequest.createdByOrgId,
            createdByOrgType: convertRequest.createdByOrgType,
          }}
          agencyMembers={membersForConvert}
          projects={projectsForConvert}
        />
      )}

      {/* New Request Modal - Global Mode */}
      <NewRequestModal
        connections={connections}
        agencyMembers={agencyMembers}
        projects={projectsForConnection}
        isOpen={isNewRequestModalOpen}
        onClose={handleNewRequestModalClose}
        onRequestOptimistic={handleRequestOptimistic}
        onRequestCreated={handleRequestCreated}
        connectionId={selectedConnectionId || undefined}
        currentOrgId={context.orgId}
        variant={context.variant}
        isGlobal={true}
        onConnectionSelect={handleConnectionSelect}
      />

      {/* Paywall Modal */}
      <PaywallModal 
        open={isPaywallModalOpen} 
        onOpenChange={setIsPaywallModalOpen} 
      />
    </div>
  );
}


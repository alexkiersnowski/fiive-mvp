'use client'

import { useState, useCallback, useEffect, useRef, useMemo, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import RequestsTable from '@/features/requests/RequestsTable';
import { RequestsHeader } from '@/features/requests/RequestsHeader';
import { RequestDetailModal } from '@/features/connections/requests/RequestDetailModal';
import { NewRequestModal } from '@/features/connections/requests/NewRequestModal';
import { fetchMoreRequests, refreshRequestsData, fetchRequestByIdGlobal, fetchCommentsForRequestGlobal } from '@/features/requests/actions';
import { createRequest } from '@/features/connections/requests/actions';
import { fetchProjectsForConnection } from '@/features/connections/requests/actions';
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
}

export function RequestsContent({ 
  snapshot, 
  context, 
  initialSearchValue = '', 
  initialSortValue = 'created',
  initialComments = {},
  agencyMembers = [],
  connections = [],
  newRequestsCount
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
  const [isPending, startTransition] = useTransition();
  
  // Modal state
  const [isRequestDetailModalOpen, setIsRequestDetailModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [isNewRequestModalOpen, setIsNewRequestModalOpen] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [projectsForConnection, setProjectsForConnection] = useState<Array<{ id: string; name: string }>>([]);
  
  // Comments map keyed by requestId for instant lookup
  // Initialize with server-fetched comments for instant availability
  const [commentsByRequest, setCommentsByRequest] = useState<Record<string, Comment[]>>(initialComments);

  // Sort options
  const sortOptions = [
    { value: 'created', label: 'Created (newest first)', buttonLabel: 'Created' },
    { value: 'client_asc', label: 'Client (A-Z)', buttonLabel: 'Client (A-Z)' },
    { value: 'client_desc', label: 'Client (Z-A)', buttonLabel: 'Client (Z-A)' }
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

    // Create optimistic request
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      client: {
        id: selectedConnection.id,
        name: selectedConnection.name,
        logoUrl: selectedConnection.logoUrl,
      },
      createdAt: today,
      createdByOrgId: context.organization.id,
      createdByOrgType: context.variant,
    };

    setRequests(prev => [optimisticRequest, ...prev]);
    setTotalCount(prev => prev + 1);
    setUnfilteredTotalCount(prev => prev + 1);
  }, [selectedConnectionId, connections, context]);

  const handleRequestCreated = useCallback(async ({ requestId, tempId }: { requestId: string; tempId?: string }) => {
    if (!selectedConnectionId) return;
    
    try {
      const request = await fetchRequestByIdGlobal(requestId, context);
      if (!request) return;
      
      // Replace temp row if present; otherwise prepend and increment count
      setRequests(prev => {
        const hadTemp = tempId ? prev.some(r => r.id === tempId) : false;
        const without = prev.filter(r => r.id !== tempId && r.id !== request.id);
        const next = [request, ...without];
        return next;
      });
      
      // Update selectedRequest if it's currently showing the tempId
      if (tempId && selectedRequest?.id === tempId) {
        setSelectedRequest(request);
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
  }, [selectedConnectionId, context, selectedRequest]);

  const handleRequestClick = useCallback(async (requestId: string) => {
    // Try to get request from local state first
    const localRequest = requests.find(r => r.id === requestId);
    
    if (localRequest) {
      // Use local request data
      setSelectedRequest(localRequest);
      setIsRequestDetailModalOpen(true);
      
      // Use prefetched comments if available, otherwise fetch
      if (commentsByRequest[requestId]) {
        // Comments already available, no need to fetch
      } else {
        // Fetch comments if not prefetched
        try {
          const comments = await fetchCommentsForRequestGlobal(requestId);
          setCommentsByRequest(prev => ({
            ...prev,
            [requestId]: comments
          }));
        } catch (error) {
          console.error('Error fetching comments:', error);
        }
      }
    } else {
      // Fetch request if not in local state
      try {
        const request = await fetchRequestByIdGlobal(requestId, context);
        if (request) {
          setSelectedRequest(request);
          setIsRequestDetailModalOpen(true);
          
          // Use prefetched comments if available, otherwise fetch
          if (commentsByRequest[requestId]) {
            // Comments already available, no need to fetch
          } else {
            // Fetch comments if not prefetched
            const comments = await fetchCommentsForRequestGlobal(requestId);
            setCommentsByRequest(prev => ({
              ...prev,
              [requestId]: comments
            }));
          }
        } else {
          toast.error('Request not found');
        }
      } catch (error) {
        console.error('Error fetching request:', error);
        toast.error('Failed to load request');
      }
    }
  }, [requests, context, commentsByRequest]);
  
  const handleRequestDetailModalClose = useCallback(() => {
    setIsRequestDetailModalOpen(false);
    setSelectedRequest(null);
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
      router.push(`/${baseRoute}/${selectedRequest.connectionId}/requests/${selectedRequest.id}`);
    }
  }, [selectedRequest, router, context.variant]);

  const handleRequestUpdate = useCallback((requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any; project?: { id: string; name: string } | null }) => {
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
    
    // Show success toast immediately
    toast.success('Request deleted');
    
    // Delete in background - real-time subscription will handle UI updates
    // No server refresh needed to avoid flicker
    try {
      const { deleteRequest } = await import('@/features/connections/requests/actions');
      await deleteRequest(requestId);
      // Real-time subscription will handle UI updates, no manual refresh needed
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
    </div>
  );
}


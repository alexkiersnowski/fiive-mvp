'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import RequestsTable from '../requests/RequestsTable';
import { RequestDetailModal } from '../requests/RequestDetailModal'
import { NewRequestModal } from '../requests/NewRequestModal'
import type { Request } from '../server';

interface RequestsPageClientProps {
  connectionId: string
  initialRequests: Request[]
  agencyMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
}

// Client component wrapper that handles all client-side interactivity
export default function RequestsPageClient({ connectionId, initialRequests, agencyMembers }: RequestsPageClientProps) {
  const { snapshot, context } = useConnection();
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar and organization from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';
  const currentOrgId = context.organization.id;

  // Local state for requests (for optimistic updates)
  const [requests, setRequests] = useState<Request[]>(initialRequests)
  
  // Handle optimistic deletion from query params (when navigating from detail page)
  useEffect(() => {
    const deletedRequestId = searchParams.get('deleted')
    if (deletedRequestId) {
      // Optimistically remove the deleted request
      setRequests(prev => prev.filter(r => r.id !== deletedRequestId))
      
      // Clean up the query param
      const newSearchParams = new URLSearchParams(searchParams.toString())
      newSearchParams.delete('deleted')
      const newUrl = `${pathname}${newSearchParams.toString() ? `?${newSearchParams.toString()}` : ''}`
      router.replace(newUrl, { scroll: false })
    }
  }, [searchParams, pathname, router])

  // Local state for modal (like ProfileCard pattern)
  const [selectedRequest, setSelectedRequest] = useState<{
    requestId: string
    title: string
    description: string
    client?: {
      id: string
      name: string
      logoUrl?: string
    }
    submittedBy?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    }
    assignee?: {
      id: string
      name: string
      email: string
      avatarUrl?: string
    } | null
    type?: string | null
    status?: 'new' | 'in_review' | 'accepted' | 'canceled'
    createdAt?: string
    createdByOrgId?: string
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)

  function getRequestById(requestId: string) {
    return requests.find(r => r.id === requestId)
  }

  function handleRequestUpdate(requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled' }) {
    // Update requests list optimistically
    setRequests(prevRequests =>
      prevRequests.map(req =>
        req.id === requestId
          ? { ...req, ...updates }
          : req
      )
    )

    // Also update selectedRequest if it's the current one
    setSelectedRequest(prev => 
      prev && prev.requestId === requestId
        ? { ...prev, ...updates }
        : prev
    )
  }

  function handleRowClick(requestId: string) {
    const request = getRequestById(requestId)
    if (request) {
      setSelectedRequest({
        requestId: request.id,
        title: request.title,
        description: request.description,
        client: request.client,
        submittedBy: request.submittedBy,
        assignee: request.assignee,
        type: request.type,
        status: request.status,
        createdAt: request.createdAt,
        createdByOrgId: request.createdByOrgId
      })
      setIsModalOpen(true)
    }
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedRequest(null)
    }, 300)
  }

  function handleNewRequest() {
    setIsNewModalOpen(true)
  }
  
  function handleNewModalClose() {
    setIsNewModalOpen(false)
  }

  function handleExpand() {
    // Navigate to full page
    if (selectedRequest && selectedRequest.requestId !== 'new') {
      router.push(`/${baseRoute}/${connectionId}/requests/${selectedRequest.requestId}`)
    }
  }

  async function handleRequestCreated(optimisticRequest: {
    title: string
    description: string
    type: string | null
    assigneeUserId: string | null
  }) {
    // Optimistically add the new request to the table immediately
    const optimisticRequestData: Request = {
      id: `temp-${Date.now()}`, // Temporary ID until we get the real one
      connectionId: connectionId,
      title: optimisticRequest.title,
      description: optimisticRequest.description,
      type: optimisticRequest.type || 'general',
      status: 'new',
      assignee: optimisticRequest.assigneeUserId 
        ? agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId) 
          ? {
              id: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.id,
              name: `${agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.firstName} ${agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.lastName}`,
              email: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.email,
              avatarUrl: agencyMembers.find(m => m.id === optimisticRequest.assigneeUserId)!.avatarUrl
            }
          : null
        : null,
      client: {
        id: snapshot.partner.id,
        name: snapshot.partner.name,
        logoUrl: snapshot.partner.logo
      },
      submittedBy: {
        id: context.user?.id || '',
        name: `${context.user?.firstName || ''} ${context.user?.lastName || ''}`,
        email: context.user?.email || '',
        avatarUrl: context.user?.avatarUrl,
        jobTitle: context.user?.jobTitle,
        orgId: context.organization.id,
        orgName: context.organization.name,
        orgLogo: context.organization.logoUrl
      },
      createdAt: (() => {
        const date = new Date();
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
      })(),
      createdByOrgId: currentOrgId
    }

    // Add optimistic request to the top of the list
    setRequests(prevRequests => [optimisticRequestData, ...prevRequests])

    // Fetch real data from server in the background
    try {
      const { fetchRequestsForConnection } = await import('../requests/actions')
      const freshRequests = await fetchRequestsForConnection(connectionId)
      setRequests(freshRequests)
    } catch (error) {
      console.error('Failed to refresh requests:', error)
      // Fallback to router.refresh if fetch fails
      router.refresh()
    }
  }

  return (
    <>
      {/* Requests Table */}
      <RequestsTable
        userAvatar={userAvatar}
        userInitials={userInitials}
        onRequestClick={handleRowClick}
        onNewRequest={handleNewRequest}
        requests={requests}
        agencyMembers={agencyMembers}
        onRequestUpdate={handleRequestUpdate}
        currentOrgId={currentOrgId}
      />

      {/* Request Detail Modal - For existing requests */}
      <RequestDetailModal
        requestData={selectedRequest}
        agencyMembers={agencyMembers}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
        onRequestUpdate={handleRequestUpdate}
        onRequestDeleted={(requestId) => {
          // Optimistically remove request from table
          setRequests(prev => prev.filter(r => r.id !== requestId))
        }}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
      />
      
      {/* New Request Modal - For creating new requests */}
      <NewRequestModal
        client={{
          id: snapshot.partner.id,
          name: snapshot.partner.name,
          logoUrl: snapshot.partner.logo
        }}
        agencyMembers={agencyMembers}
        isOpen={isNewModalOpen}
        onClose={handleNewModalClose}
        onRequestCreated={handleRequestCreated}
        connectionId={connectionId}
        currentOrgId={currentOrgId}
      />
    </>
  );
}


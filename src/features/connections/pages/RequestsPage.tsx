'use client'

import { useState } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { useConnection } from '../ConnectionContext';
import { Card } from '@/components/ui/card';
import RequestsTable from '../requests/RequestsTable';
import { RequestDetailModal } from '../requests/RequestDetailModal'

// Temporary mock data
function getMockRequest(requestId: string) {
  return {
    requestId,
    title: 'Update homepage hero for the summer campaign',
    description: 'We need to update the homepage hero section to reflect our new summer campaign. Please refresh all visual elements including the background images, CTAs, and messaging to align with the summer theme.',
  }
}

export function RequestsPage() {
  const { snapshot, context } = useConnection();
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const connectionId = params.connectionId as string
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  // Get user avatar from context
  const userAvatar = context.user?.avatarUrl || '';
  const userInitials = context.user?.firstName?.[0] + context.user?.lastName?.[0] || 'U';

  // Local state for modal (like ProfileCard pattern)
  const [selectedRequest, setSelectedRequest] = useState<{
    requestId: string
    title: string
    description: string
  } | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  function handleRowClick(requestId: string) {
    // Set state = instant open
    setSelectedRequest(getMockRequest(requestId))
    setIsModalOpen(true)
  }

  function handleModalClose() {
    // Close modal first, then clear data after animation completes
    setIsModalOpen(false)
    // Small delay to let animation finish
    setTimeout(() => {
      setSelectedRequest(null)
    }, 300)
  }

  function handleExpand() {
    // Navigate to full page
    if (selectedRequest) {
      router.push(`/${baseRoute}/${connectionId}/requests/${selectedRequest.requestId}`)
    }
  }

  return (
    <>
      <Card className="w-full gap-0">
        {/* Requests Table */}
        <RequestsTable
          userAvatar={userAvatar}
          userInitials={userInitials}
          onRequestClick={handleRowClick}
        />
      </Card>

      {/* Modal */}
      <RequestDetailModal
        requestData={selectedRequest}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onExpand={handleExpand}
      />
    </>
  );
}

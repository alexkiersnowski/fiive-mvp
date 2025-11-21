'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { StatsCardProps } from '../../types'
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext'

// Custom event types for cross-component communication
const REQUEST_STATUS_CHANGED_EVENT = 'request-status-changed'
const REQUEST_DELETED_EVENT = 'request-deleted'
const REQUEST_CREATED_EVENT = 'request-created'

interface RequestStatusChangedEventDetail {
  requestId: string
  oldStatus: 'new' | 'in_review' | 'accepted' | 'canceled'
  newStatus: 'new' | 'in_review' | 'accepted' | 'canceled'
}

interface RequestDeletedEventDetail {
  requestId: string
  status: 'new' | 'in_review' | 'accepted' | 'canceled'
}

interface RequestCreatedEventDetail {
  requestId: string
  status: 'new' | 'in_review' | 'accepted' | 'canceled'
}

// Server component wrapper - passes initial count to client component
export default function NewRequestsCard({ snapshot, context }: StatsCardProps) {
  const initialCount = snapshot.requests.newCount
  return <NewRequestsCardClient initialCount={initialCount} context={context} />
}

// Client component that manages state and real-time sync
interface NewRequestsCardClientProps {
  initialCount: number
  context: EnhancedModeContext
}

function NewRequestsCardClient({ initialCount, context }: NewRequestsCardClientProps) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null)
  const connectionIdsRef = useRef<string[]>([])
  const pendingOptimisticUpdatesRef = useRef<Set<string>>(new Set())
  
  const isAgency = context.variant === 'agency'
  const title = isAgency ? 'New requests' : 'Requests submitted'
  const buttonText = isAgency ? 'Requests' : 'Requests'

  // Track optimistic updates to avoid double-counting with real-time events
  const applyOptimisticUpdate = useCallback((requestId: string, delta: number) => {
    if (pendingOptimisticUpdatesRef.current.has(requestId)) {
      return // Already processed
    }
    pendingOptimisticUpdatesRef.current.add(requestId)
    setCount(prev => Math.max(0, prev + delta))
    
    // Clear after a delay to allow real-time event to reconcile
    setTimeout(() => {
      pendingOptimisticUpdatesRef.current.delete(requestId)
    }, 2000)
  }, [])

  // Listen for custom events from RequestsCardClient
  useEffect(() => {
    const handleStatusChanged = (event: CustomEvent<RequestStatusChangedEventDetail>) => {
      const { oldStatus, newStatus } = event.detail
      
      // Only update if status changed to/from 'new'
      if (oldStatus === 'new' && newStatus !== 'new') {
        // Status changed from 'new' to something else - decrement
        applyOptimisticUpdate(event.detail.requestId, -1)
      } else if (oldStatus !== 'new' && newStatus === 'new') {
        // Status changed to 'new' - increment
        applyOptimisticUpdate(event.detail.requestId, 1)
      }
    }

    const handleDeleted = (event: CustomEvent<RequestDeletedEventDetail>) => {
      const { status } = event.detail
      
      // Only decrement if deleted request had status 'new'
      if (status === 'new') {
        applyOptimisticUpdate(event.detail.requestId, -1)
      }
    }

    const handleCreated = (event: CustomEvent<RequestCreatedEventDetail>) => {
      const { status } = event.detail
      
      // Only increment if new request has status 'new'
      if (status === 'new') {
        applyOptimisticUpdate(event.detail.requestId, 1)
      }
    }

    // Use window.addEventListener for custom events
    window.addEventListener(REQUEST_STATUS_CHANGED_EVENT as any, handleStatusChanged as EventListener)
    window.addEventListener(REQUEST_DELETED_EVENT as any, handleDeleted as EventListener)
    window.addEventListener(REQUEST_CREATED_EVENT as any, handleCreated as EventListener)

    return () => {
      window.removeEventListener(REQUEST_STATUS_CHANGED_EVENT as any, handleStatusChanged as EventListener)
      window.removeEventListener(REQUEST_DELETED_EVENT as any, handleDeleted as EventListener)
      window.removeEventListener(REQUEST_CREATED_EVENT as any, handleCreated as EventListener)
    }
  }, [applyOptimisticUpdate])

  // Fetch connection IDs and set up real-time subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabaseRef.current = supabase

    // Fetch connection IDs for this organization
    const fetchConnectionIds = async () => {
      const connectionQuery = context.variant === 'agency'
        ? supabase
            .from('connections')
            .select('id')
            .eq('agency_id', context.orgId)
        : supabase
            .from('connections')
            .select('id')
            .eq('client_id', context.orgId)

      const { data: connections, error } = await connectionQuery

      if (error || !connections) {
        console.error('Error fetching connections for real-time subscription:', error)
        return []
      }

      return connections.map(c => c.id)
    }

    const setupSubscription = async () => {
      const ids = await fetchConnectionIds()
      connectionIdsRef.current = ids

      if (ids.length === 0) {
        return // No connections, nothing to subscribe to
      }

      // Create a set for fast lookup
      const connectionIdsSet = new Set(ids)

      // Helper function to check if request belongs to our connections
      const belongsToOurConnections = (connectionId: string) => {
        return connectionIdsSet.has(connectionId)
      }

      // Create channel for all connections
      // Note: We subscribe to all requests and filter client-side since Supabase real-time
      // doesn't support 'in' filters directly. This is efficient since we only process
      // events for requests that match our connection IDs.
      const channel = supabase
        .channel('new-requests-count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'requests',
          },
          (payload: any) => {
            const newRequest = payload?.new
            if (!newRequest || newRequest.deleted_at) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newRequest.connection_id)) return

            // Only count if status is 'new'
            if (newRequest.status === 'new') {
              const requestId = newRequest.id
              // Check if this was already handled optimistically
              if (!pendingOptimisticUpdatesRef.current.has(requestId)) {
                setCount(prev => prev + 1)
              } else {
                // Already handled optimistically, just clear the pending flag
                pendingOptimisticUpdatesRef.current.delete(requestId)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'requests',
          },
          (payload: any) => {
            const oldRequest = payload?.old
            const newRequest = payload?.new

            if (!oldRequest || !newRequest) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newRequest.connection_id)) return

            // Handle soft delete
            if (newRequest.deleted_at && !oldRequest.deleted_at) {
              // Request was deleted
              if (oldRequest.status === 'new') {
                const requestId = newRequest.id
                if (!pendingOptimisticUpdatesRef.current.has(requestId)) {
                  setCount(prev => Math.max(0, prev - 1))
                } else {
                  pendingOptimisticUpdatesRef.current.delete(requestId)
                }
              }
              return
            }

            // Handle status changes
            const oldStatus = oldRequest.status
            const newStatus = newRequest.status

            if (oldStatus === newStatus) return // No status change

            const requestId = newRequest.id

            // Status changed from 'new' to something else
            if (oldStatus === 'new' && newStatus !== 'new') {
              if (!pendingOptimisticUpdatesRef.current.has(requestId)) {
                setCount(prev => Math.max(0, prev - 1))
              } else {
                pendingOptimisticUpdatesRef.current.delete(requestId)
              }
            }
            // Status changed to 'new'
            else if (oldStatus !== 'new' && newStatus === 'new') {
              if (!pendingOptimisticUpdatesRef.current.has(requestId)) {
                setCount(prev => prev + 1)
              } else {
                pendingOptimisticUpdatesRef.current.delete(requestId)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'requests',
          },
          (payload: any) => {
            const deletedRequest = payload?.old
            if (!deletedRequest) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(deletedRequest.connection_id)) return

            // Only decrement if deleted request had status 'new'
            if (deletedRequest.status === 'new') {
              const requestId = deletedRequest.id
              if (!pendingOptimisticUpdatesRef.current.has(requestId)) {
                setCount(prev => Math.max(0, prev - 1))
              } else {
                pendingOptimisticUpdatesRef.current.delete(requestId)
              }
            }
          }
        )
        .subscribe()

      channelRef.current = channel
    }

    setupSubscription()

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [context.orgId, context.variant])

  // Note: Initial count comes from server snapshot, and real-time subscription handles all updates
  // No need to sync with server function here since real-time events are the source of truth

  return (
    <Card className="w-full pt-5 pb-[18px] px-5 flex flex-col gap-3">
      <CardTitle className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>{title}</CardTitle>
      <div className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>{count}</div>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75 mt-1 ml-auto"
        onClick={() => router.push('/requests')}
      >
        <span className="mr-1">{buttonText}</span>
        <ArrowRight size={16} weight="regular" />
      </Button>
    </Card>
  )
}

// Export event dispatcher utilities for use in RequestsCardClient
export function dispatchRequestStatusChanged(detail: RequestStatusChangedEventDetail) {
  window.dispatchEvent(new CustomEvent(REQUEST_STATUS_CHANGED_EVENT, { detail }))
}

export function dispatchRequestDeleted(detail: RequestDeletedEventDetail) {
  window.dispatchEvent(new CustomEvent(REQUEST_DELETED_EVENT, { detail }))
}

export function dispatchRequestCreated(detail: RequestCreatedEventDetail) {
  window.dispatchEvent(new CustomEvent(REQUEST_CREATED_EVENT, { detail }))
}

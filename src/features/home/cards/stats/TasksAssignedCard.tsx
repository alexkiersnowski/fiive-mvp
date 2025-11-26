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
const TASK_ASSIGNED_CHANGED_EVENT = 'task-assigned-changed'
const TASK_ASSIGNED_DELETED_EVENT = 'task-assigned-deleted'
const TASK_ASSIGNED_CREATED_EVENT = 'task-assigned-created'

interface TaskAssignedChangedEventDetail {
  taskId: string
  oldAssigneeUserId: string | null
  newAssigneeUserId: string | null
  oldCompletedAt: string | null
  newCompletedAt: string | null
}

interface TaskAssignedDeletedEventDetail {
  taskId: string
  assigneeUserId: string | null
  completedAt: string | null
}

interface TaskAssignedCreatedEventDetail {
  taskId: string
  assigneeUserId: string | null
  completedAt: string | null
}

// Helper function to check if a task is assigned to a client org member and is active
// Returns true if: assigneeUserId is in clientOrgUserIds AND completedAt IS NULL
function isTaskAssignedToClientOrg(
  assigneeUserId: string | null,
  completedAt: string | null,
  clientOrgUserIds: Set<string>
): boolean {
  if (!assigneeUserId || completedAt !== null) {
    return false
  }
  return clientOrgUserIds.has(assigneeUserId)
}

// Server component wrapper - passes initial count to client component
export default function TasksAssignedCard({ snapshot, context }: StatsCardProps) {
  const initialCount = snapshot.tasks.assignedCount
  return <TasksAssignedCardClient initialCount={initialCount} context={context} />
}

// Client component that manages state and real-time sync
interface TasksAssignedCardClientProps {
  initialCount: number
  context: EnhancedModeContext
}

function TasksAssignedCardClient({ initialCount, context }: TasksAssignedCardClientProps) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null)
  const connectionIdsRef = useRef<string[]>([])
  const clientOrgUserIdsRef = useRef<Set<string>>(new Set())
  const pendingOptimisticUpdatesRef = useRef<Set<string>>(new Set())
  
  const title = 'Tasks assigned'
  const buttonText = 'Tasks'

  // Track optimistic updates to avoid double-counting with real-time events
  const applyOptimisticUpdate = useCallback((taskId: string, delta: number) => {
    if (pendingOptimisticUpdatesRef.current.has(taskId)) {
      return // Already processed
    }
    pendingOptimisticUpdatesRef.current.add(taskId)
    setCount(prev => Math.max(0, prev + delta))
    
    // Clear after a delay to allow real-time event to reconcile
    setTimeout(() => {
      pendingOptimisticUpdatesRef.current.delete(taskId)
    }, 2000)
  }, [])

  // Listen for custom events from TasksCardClient and TasksTable
  useEffect(() => {
    const handleAssignedChanged = (event: CustomEvent<TaskAssignedChangedEventDetail>) => {
      const { oldAssigneeUserId, newAssigneeUserId, oldCompletedAt, newCompletedAt } = event.detail
      
      const wasAssigned = isTaskAssignedToClientOrg(oldAssigneeUserId, oldCompletedAt, clientOrgUserIdsRef.current)
      const isAssigned = isTaskAssignedToClientOrg(newAssigneeUserId, newCompletedAt, clientOrgUserIdsRef.current)
      
      if (wasAssigned && !isAssigned) {
        // Task was assigned but no longer is - decrement
        applyOptimisticUpdate(event.detail.taskId, -1)
      } else if (!wasAssigned && isAssigned) {
        // Task became assigned - increment
        applyOptimisticUpdate(event.detail.taskId, 1)
      }
    }

    const handleDeleted = (event: CustomEvent<TaskAssignedDeletedEventDetail>) => {
      const { assigneeUserId, completedAt } = event.detail
      
      // Only decrement if deleted task was assigned to client org member and active
      if (isTaskAssignedToClientOrg(assigneeUserId, completedAt, clientOrgUserIdsRef.current)) {
        applyOptimisticUpdate(event.detail.taskId, -1)
      }
    }

    const handleCreated = (event: CustomEvent<TaskAssignedCreatedEventDetail>) => {
      const { assigneeUserId, completedAt } = event.detail
      
      // Only increment if new task is assigned to client org member and active
      if (isTaskAssignedToClientOrg(assigneeUserId, completedAt, clientOrgUserIdsRef.current)) {
        applyOptimisticUpdate(event.detail.taskId, 1)
      }
    }

    // Use window.addEventListener for custom events
    window.addEventListener(TASK_ASSIGNED_CHANGED_EVENT as any, handleAssignedChanged as EventListener)
    window.addEventListener(TASK_ASSIGNED_DELETED_EVENT as any, handleDeleted as EventListener)
    window.addEventListener(TASK_ASSIGNED_CREATED_EVENT as any, handleCreated as EventListener)

    return () => {
      window.removeEventListener(TASK_ASSIGNED_CHANGED_EVENT as any, handleAssignedChanged as EventListener)
      window.removeEventListener(TASK_ASSIGNED_DELETED_EVENT as any, handleDeleted as EventListener)
      window.removeEventListener(TASK_ASSIGNED_CREATED_EVENT as any, handleCreated as EventListener)
    }
  }, [applyOptimisticUpdate])

  // Fetch connection IDs and client org user IDs, then set up real-time subscription
  useEffect(() => {
    const supabase = createSupabaseBrowserClient()
    supabaseRef.current = supabase

    // Fetch connection IDs for this organization (client-side)
    const fetchConnectionIds = async () => {
      const { data: connections, error } = await supabase
        .from('connections')
        .select('id')
        .eq('client_id', context.orgId)

      if (error || !connections) {
        console.error('Error fetching connections for real-time subscription:', error)
        return []
      }

      return connections.map(c => c.id)
    }

    // Fetch client org user IDs
    const fetchClientOrgUserIds = async () => {
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('user_id')
        .eq('org_id', context.orgId)

      if (error || !memberships) {
        console.error('Error fetching client organization members:', error)
        return new Set<string>()
      }

      return new Set(memberships.map(m => m.user_id))
    }

    const setupSubscription = async () => {
      const [ids, userIds] = await Promise.all([
        fetchConnectionIds(),
        fetchClientOrgUserIds()
      ])
      
      connectionIdsRef.current = ids
      clientOrgUserIdsRef.current = userIds

      if (ids.length === 0 || userIds.size === 0) {
        return // No connections or no members, nothing to subscribe to
      }

      // Create a set for fast lookup
      const connectionIdsSet = new Set(ids)

      // Helper function to check if task belongs to our connections
      const belongsToOurConnections = (connectionId: string) => {
        return connectionIdsSet.has(connectionId)
      }

      // Helper function to check if task is assigned to client org member and active
      const checkIfAssigned = (assigneeUserId: string | null, completedAt: string | null) => {
        return isTaskAssignedToClientOrg(assigneeUserId, completedAt, clientOrgUserIdsRef.current)
      }

      // Create channel for all connections
      // Note: We subscribe to all tasks and filter client-side since Supabase real-time
      // doesn't support 'in' filters directly. This is efficient since we only process
      // events for tasks that match our connection IDs.
      const channel = supabase
        .channel('tasks-assigned-count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tasks',
          },
          (payload: any) => {
            const newTask = payload?.new
            if (!newTask || newTask.deleted_at) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newTask.connection_id)) return

            // Only count if task is assigned to client org member and active
            if (checkIfAssigned(newTask.assignee_user_id, newTask.completed_at)) {
              const taskId = newTask.id
              // Check if this was already handled optimistically
              if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                setCount(prev => prev + 1)
              } else {
                // Already handled optimistically, just clear the pending flag
                pendingOptimisticUpdatesRef.current.delete(taskId)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'tasks',
          },
          (payload: any) => {
            const oldTask = payload?.old
            const newTask = payload?.new

            if (!oldTask || !newTask) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newTask.connection_id)) return

            // Handle soft delete
            if (newTask.deleted_at && !oldTask.deleted_at) {
              // Task was deleted
              if (checkIfAssigned(oldTask.assignee_user_id, oldTask.completed_at)) {
                const taskId = newTask.id
                if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                  setCount(prev => Math.max(0, prev - 1))
                } else {
                  pendingOptimisticUpdatesRef.current.delete(taskId)
                }
              }
              return
            }

            // Check if assignee or completed_at changed
            const oldAssigneeUserId = oldTask.assignee_user_id
            const newAssigneeUserId = newTask.assignee_user_id
            const oldCompletedAt = oldTask.completed_at
            const newCompletedAt = newTask.completed_at

            const wasAssigned = checkIfAssigned(oldAssigneeUserId, oldCompletedAt)
            const isAssigned = checkIfAssigned(newAssigneeUserId, newCompletedAt)

            if (wasAssigned === isAssigned) return // No change in assigned status

            const taskId = newTask.id

            // Task was assigned but no longer is
            if (wasAssigned && !isAssigned) {
              if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                setCount(prev => Math.max(0, prev - 1))
              } else {
                pendingOptimisticUpdatesRef.current.delete(taskId)
              }
            }
            // Task became assigned
            else if (!wasAssigned && isAssigned) {
              if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                setCount(prev => prev + 1)
              } else {
                pendingOptimisticUpdatesRef.current.delete(taskId)
              }
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'tasks',
          },
          (payload: any) => {
            const deletedTask = payload?.old
            if (!deletedTask) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(deletedTask.connection_id)) return

            // Only decrement if deleted task was assigned to client org member and active
            if (checkIfAssigned(deletedTask.assignee_user_id, deletedTask.completed_at)) {
              const taskId = deletedTask.id
              if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                setCount(prev => Math.max(0, prev - 1))
              } else {
                pendingOptimisticUpdatesRef.current.delete(taskId)
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
        onClick={() => router.push('/tasks')}
      >
        <span className="mr-1">{buttonText}</span>
        <ArrowRight size={16} weight="regular" />
      </Button>
    </Card>
  )
}

// Export event dispatcher utilities for use in TasksCardClient and TasksTable
export function dispatchTaskAssignedChanged(detail: TaskAssignedChangedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_ASSIGNED_CHANGED_EVENT, { detail }))
}

export function dispatchTaskAssignedDeleted(detail: TaskAssignedDeletedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_ASSIGNED_DELETED_EVENT, { detail }))
}

export function dispatchTaskAssignedCreated(detail: TaskAssignedCreatedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_ASSIGNED_CREATED_EVENT, { detail }))
}


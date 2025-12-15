'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowRight, Info } from '@phosphor-icons/react/dist/ssr'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { StatsCardProps } from '../../types'
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// Custom event types for cross-component communication
const TASK_DUE_DATE_CHANGED_EVENT = 'task-due-date-changed'
const TASK_STATUS_CHANGED_EVENT = 'task-status-changed'
const TASK_DELETED_EVENT = 'task-deleted'
const TASK_CREATED_EVENT = 'task-created'

interface TaskDueDateChangedEventDetail {
  taskId: string
  oldDueDate: string | null
  newDueDate: string | null
  oldStatus: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  newStatus: 'to_do' | 'in_progress' | 'on_hold' | 'done'
}

interface TaskStatusChangedEventDetail {
  taskId: string
  oldStatus: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  newStatus: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  dueDate: string | null
}

interface TaskDeletedEventDetail {
  taskId: string
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  dueDate: string | null
}

interface TaskCreatedEventDetail {
  taskId: string
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done'
  dueDate: string | null
}

// Helper function to check if a task is "due soon"
// Rules: status != 'done', due_date IS NOT NULL, due_date >= today, due_date <= today + 7 days
function isTaskDueSoon(dueDate: string | null, status: 'to_do' | 'in_progress' | 'on_hold' | 'done'): boolean {
  if (status === 'done' || !dueDate) {
    return false
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(today.getDate() + 7)
  sevenDaysFromNow.setHours(23, 59, 59, 999)

  const taskDueDate = new Date(dueDate)
  taskDueDate.setHours(0, 0, 0, 0)

  return taskDueDate >= today && taskDueDate <= sevenDaysFromNow
}

// Server component wrapper - passes initial count to client component
export default function TasksDueCard({ snapshot, context }: StatsCardProps) {
  const initialCount = snapshot.tasks.dueSoonCount
  return <TasksDueCardClient initialCount={initialCount} context={context} />
}

// Client component that manages state and real-time sync
interface TasksDueCardClientProps {
  initialCount: number
  context: EnhancedModeContext
}

function TasksDueCardClient({ initialCount, context }: TasksDueCardClientProps) {
  const router = useRouter()
  const [count, setCount] = useState(initialCount)
  const supabaseRef = useRef<ReturnType<typeof createSupabaseBrowserClient> | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null>(null)
  const connectionIdsRef = useRef<string[]>([])
  const pendingOptimisticUpdatesRef = useRef<Set<string>>(new Set())
  
  const isAgency = context.variant === 'agency'
  const title = isAgency ? 'Tasks due soon' : 'Tasks assigned'
  const buttonText = isAgency ? 'Tasks' : 'Tasks'

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

  // Listen for custom events from TasksCardClient
  useEffect(() => {
    const handleDueDateChanged = (event: CustomEvent<TaskDueDateChangedEventDetail>) => {
      const { oldDueDate, newDueDate, oldStatus, newStatus } = event.detail
      
      const wasDueSoon = isTaskDueSoon(oldDueDate, oldStatus)
      const isDueSoon = isTaskDueSoon(newDueDate, newStatus)
      
      if (wasDueSoon && !isDueSoon) {
        // Task was due soon but no longer is - decrement
        applyOptimisticUpdate(event.detail.taskId, -1)
      } else if (!wasDueSoon && isDueSoon) {
        // Task became due soon - increment
        applyOptimisticUpdate(event.detail.taskId, 1)
      }
    }

    const handleStatusChanged = (event: CustomEvent<TaskStatusChangedEventDetail>) => {
      const { oldStatus, newStatus, dueDate } = event.detail
      
      // Only update if status changed to/from 'done' (affects due soon eligibility)
      if (oldStatus === 'done' && newStatus !== 'done') {
        // Status changed from 'done' to something else - check if due soon
        if (isTaskDueSoon(dueDate, newStatus)) {
          applyOptimisticUpdate(event.detail.taskId, 1)
        }
      } else if (oldStatus !== 'done' && newStatus === 'done') {
        // Status changed to 'done' - check if was due soon
        if (isTaskDueSoon(dueDate, oldStatus)) {
          applyOptimisticUpdate(event.detail.taskId, -1)
        }
      }
    }

    const handleDeleted = (event: CustomEvent<TaskDeletedEventDetail>) => {
      const { status, dueDate } = event.detail
      
      // Only decrement if deleted task was due soon
      if (isTaskDueSoon(dueDate, status)) {
        applyOptimisticUpdate(event.detail.taskId, -1)
      }
    }

    const handleCreated = (event: CustomEvent<TaskCreatedEventDetail>) => {
      const { status, dueDate } = event.detail
      
      // Only increment if new task is due soon
      if (isTaskDueSoon(dueDate, status)) {
        applyOptimisticUpdate(event.detail.taskId, 1)
      }
    }

    // Use window.addEventListener for custom events
    window.addEventListener(TASK_DUE_DATE_CHANGED_EVENT, handleDueDateChanged as EventListener)
    window.addEventListener(TASK_STATUS_CHANGED_EVENT, handleStatusChanged as EventListener)
    window.addEventListener(TASK_DELETED_EVENT, handleDeleted as EventListener)
    window.addEventListener(TASK_CREATED_EVENT, handleCreated as EventListener)

    return () => {
      window.removeEventListener(TASK_DUE_DATE_CHANGED_EVENT, handleDueDateChanged as EventListener)
      window.removeEventListener(TASK_STATUS_CHANGED_EVENT, handleStatusChanged as EventListener)
      window.removeEventListener(TASK_DELETED_EVENT, handleDeleted as EventListener)
      window.removeEventListener(TASK_CREATED_EVENT, handleCreated as EventListener)
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

      // Helper function to check if task belongs to our connections
      const belongsToOurConnections = (connectionId: string) => {
        return connectionIdsSet.has(connectionId)
      }

      // Helper function to check if task is due soon based on real-time data
      const checkIfDueSoon = (dueDate: string | null, status: string) => {
        return isTaskDueSoon(dueDate, status as 'to_do' | 'in_progress' | 'on_hold' | 'done')
      }

      // Create channel for all connections
      // Note: We subscribe to all tasks and filter client-side since Supabase real-time
      // doesn't support 'in' filters directly. This is efficient since we only process
      // events for tasks that match our connection IDs.
      const channel = supabase
        .channel('tasks-due-soon-count')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'tasks',
          },
          (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; due_date: string | null; status: string; deleted_at: string | null }>) => {
            const newTask = payload?.new as { id: string; connection_id: string; due_date: string | null; status: string; deleted_at: string | null } | undefined
            if (!newTask || newTask.deleted_at) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newTask.connection_id)) return

            // Only count if task is due soon
            if (checkIfDueSoon(newTask.due_date, newTask.status)) {
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
          (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; due_date: string | null; status: string; deleted_at: string | null }>) => {
            const oldTask = payload?.old as { id: string; due_date: string | null; status: string; deleted_at: string | null } | undefined
            const newTask = payload?.new as { id: string; connection_id: string; due_date: string | null; status: string; deleted_at: string | null } | undefined

            if (!oldTask || !newTask) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(newTask.connection_id)) return

            // Handle soft delete
            if (newTask.deleted_at && !oldTask.deleted_at) {
              // Task was deleted
              if (checkIfDueSoon(oldTask.due_date, oldTask.status)) {
                const taskId = newTask.id
                if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                  setCount(prev => Math.max(0, prev - 1))
                } else {
                  pendingOptimisticUpdatesRef.current.delete(taskId)
                }
              }
              return
            }

            // Check if due date or status changed
            const oldDueDate = oldTask.due_date
            const newDueDate = newTask.due_date
            const oldStatus = oldTask.status
            const newStatus = newTask.status

            const wasDueSoon = checkIfDueSoon(oldDueDate, oldStatus)
            const isDueSoon = checkIfDueSoon(newDueDate, newStatus)

            if (wasDueSoon === isDueSoon) return // No change in due soon status

            const taskId = newTask.id

            // Task was due soon but no longer is
            if (wasDueSoon && !isDueSoon) {
              if (!pendingOptimisticUpdatesRef.current.has(taskId)) {
                setCount(prev => Math.max(0, prev - 1))
              } else {
                pendingOptimisticUpdatesRef.current.delete(taskId)
              }
            }
            // Task became due soon
            else if (!wasDueSoon && isDueSoon) {
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
          (payload: RealtimePostgresChangesPayload<{ id: string; connection_id: string; due_date: string | null; status: string; deleted_at: string | null }>) => {
            const deletedTask = payload?.old as { id: string; connection_id: string; due_date: string | null; status: string } | undefined
            if (!deletedTask) return

            // Filter by connection ID client-side
            if (!belongsToOurConnections(deletedTask.connection_id)) return

            // Only decrement if deleted task was due soon
            if (checkIfDueSoon(deletedTask.due_date, deletedTask.status)) {
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
      <div className="flex items-center justify-between">
      <CardTitle className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>{title}</CardTitle>
        {isAgency && (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <div>
                <Info size={14} weight="regular" style={{ color: 'var(--color-base-text-tertiary)' }} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Due in next 7 days
            </TooltipContent>
          </Tooltip>
        )}
      </div>
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

// Export event dispatcher utilities for use in TasksCardClient
export function dispatchTaskDueDateChanged(detail: TaskDueDateChangedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_DUE_DATE_CHANGED_EVENT, { detail }))
}

export function dispatchTaskStatusChanged(detail: TaskStatusChangedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_STATUS_CHANGED_EVENT, { detail }))
}

export function dispatchTaskDeleted(detail: TaskDeletedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_DELETED_EVENT, { detail }))
}

export function dispatchTaskCreated(detail: TaskCreatedEventDetail) {
  window.dispatchEvent(new CustomEvent(TASK_CREATED_EVENT, { detail }))
}

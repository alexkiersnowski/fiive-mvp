"use client"

import { useRef, useMemo, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'
import { VIRTUAL_ROW_HEIGHT, VIRTUAL_OVERSCAN, VIRTUAL_LOAD_MORE_THRESHOLD, VIRTUAL_LOAD_MORE_DEBOUNCE } from '@/components/virtual-table/constants'
import type { Task } from '../server'

interface VirtualizedTaskListProps {
  tasks: Task[]
  onLoadMore?: (virtualItems: VirtualItem[]) => void // Optional, only for global tables (not used in connection tables)
  renderRow: (task: Task, index: number) => React.ReactNode
  parentRef?: React.RefObject<HTMLElement | null>
}

const ROW_HEIGHT = VIRTUAL_ROW_HEIGHT // 44px

/**
 * VirtualizedTaskList - Isolated virtualizer for a single status group
 * 
 * Responsibilities:
 * - Own a single @tanstack/react-virtual instance
 * - Auto virtualization threshold (only virtualize when needed)
 * - Render only TaskRow components (no group headers)
 * - No drag & drop logic (handled at TasksTable level)
 * - No scroll position exposure (prevents coupling)
 */
export function VirtualizedTaskList({
  tasks,
  onLoadMore,
  renderRow,
  parentRef
}: VirtualizedTaskListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isMounted, setIsMounted] = useState(false)
  
  // Track mount state to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])
  
  // Auto virtualization check (resilient to row height changes, with hard floor)
  // Only enable virtualization after mount to prevent SSR/client mismatch
  const shouldVirtualize = useMemo(() => {
    if (!isMounted) return false // Always return false during SSR/initial render
    const estimatedTotalHeight = tasks.length * ROW_HEIGHT
    // Use container height if available, fallback to window height (only in browser)
    const containerHeight = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800
    return (
      tasks.length > 30 && // Hard floor: avoid thrashing on small lists
      estimatedTotalHeight > 2 * containerHeight // Use container height, not window
    )
  }, [tasks.length, isMounted])

  // Virtualizer instance (only created when shouldVirtualize is true)
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? tasks.length : 0,
    getScrollElement: () => (parentRef?.current || containerRef.current) as Element | null,
    estimateSize: () => ROW_HEIGHT,
    overscan: tasks.length > 100 ? 5 : VIRTUAL_OVERSCAN,
    enabled: shouldVirtualize
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  // Force virtualizer to measure when tasks change
  useEffect(() => {
    if (shouldVirtualize && tasks.length > 0) {
      rowVirtualizer.measure()
    }
  }, [tasks.length, shouldVirtualize, rowVirtualizer])

  // Calculate if user is near the end of the list (for loadMore)
  const isNearEnd = useMemo(() => {
    if (!shouldVirtualize || virtualItems.length === 0) return false
    const lastItem = virtualItems[virtualItems.length - 1]
    return lastItem.index >= tasks.length - VIRTUAL_LOAD_MORE_THRESHOLD
  }, [shouldVirtualize, virtualItems, tasks.length])

  // Handle scroll to trigger loadMore (optional, only for global tables)
  useEffect(() => {
    if (!onLoadMore || !isNearEnd || !shouldVirtualize) return
    
    const timeoutId = setTimeout(() => {
      onLoadMore(virtualItems)
    }, VIRTUAL_LOAD_MORE_DEBOUNCE)
    
    return () => clearTimeout(timeoutId)
  }, [isNearEnd, onLoadMore, virtualItems, shouldVirtualize])

  // Empty state
  if (tasks.length === 0) {
    return null
  }

  // Small lists: render directly without virtualization (no overhead)
  if (!shouldVirtualize) {
    return (
      <div className="w-full">
        {tasks.map((task, index) => (
          <div key={task.id}>
            {renderRow(task, index)}
          </div>
        ))}
      </div>
    )
  }

  // Large lists: use virtualization
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = Math.max(
    0,
    rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
  )

  return (
    <div className="relative w-full" ref={containerRef}>
      {paddingTop > 0 && (
        <div aria-hidden style={{ height: paddingTop }} />
      )}

      {virtualItems.map((virtualRow) => {
        const task = tasks[virtualRow.index]
        if (!task) return null

        return (
          <div
            key={task.id}
            ref={(node) => rowVirtualizer.measureElement(node)}
            data-index={virtualRow.index}
            style={{ height: `${virtualRow.size}px` }}
          >
            {renderRow(task, virtualRow.index)}
          </div>
        )
      })}

      {paddingBottom > 0 && (
        <div aria-hidden style={{ height: paddingBottom }} />
      )}
    </div>
  )
}

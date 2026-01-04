"use client"

import { useRef, useMemo, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { VirtualItem } from '@tanstack/react-virtual'
import { VIRTUAL_ROW_HEIGHT, VIRTUAL_OVERSCAN, VIRTUAL_LOAD_MORE_THRESHOLD, VIRTUAL_LOAD_MORE_DEBOUNCE } from '@/components/virtual-table/constants'
import type { Request } from '../server'

interface VirtualizedRequestListProps {
  requests: Request[]
  onLoadMore?: (virtualItems: VirtualItem[]) => void // Optional, only for global tables (not used in connection tables)
  renderRow: (request: Request, index: number) => React.ReactNode
  parentRef?: React.RefObject<HTMLElement | null>
}

const ROW_HEIGHT = VIRTUAL_ROW_HEIGHT // 44px

/**
 * VirtualizedRequestList - Isolated virtualizer for a single status group
 * 
 * Responsibilities:
 * - Own a single @tanstack/react-virtual instance
 * - Auto virtualization threshold (only virtualize when needed)
 * - Render only RequestRow components (no group headers)
 * - No drag & drop logic (handled at RequestsTable level)
 * - No scroll position exposure (prevents coupling)
 */
export function VirtualizedRequestList({
  requests,
  onLoadMore,
  renderRow,
  parentRef
}: VirtualizedRequestListProps) {
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
    const estimatedTotalHeight = requests.length * ROW_HEIGHT
    // Use container height if available, fallback to window height (only in browser)
    const containerHeight = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800
    return (
      requests.length > 30 && // Hard floor: avoid thrashing on small lists
      estimatedTotalHeight > 2 * containerHeight // Use container height, not window
    )
  }, [requests.length, isMounted])

  // Virtualizer instance (only created when shouldVirtualize is true)
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? requests.length : 0,
    getScrollElement: () => (parentRef?.current || containerRef.current) as Element | null,
    estimateSize: () => ROW_HEIGHT,
    overscan: requests.length > 100 ? 5 : VIRTUAL_OVERSCAN,
    enabled: shouldVirtualize
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  // Force virtualizer to measure when requests change
  useEffect(() => {
    if (shouldVirtualize && requests.length > 0) {
      rowVirtualizer.measure()
    }
  }, [requests.length, shouldVirtualize, rowVirtualizer])

  // Calculate if user is near the end of the list (for loadMore)
  const isNearEnd = useMemo(() => {
    if (!shouldVirtualize || virtualItems.length === 0) return false
    const lastItem = virtualItems[virtualItems.length - 1]
    return lastItem.index >= requests.length - VIRTUAL_LOAD_MORE_THRESHOLD
  }, [shouldVirtualize, virtualItems, requests.length])

  // Handle scroll to trigger loadMore (optional, only for global tables)
  useEffect(() => {
    if (!onLoadMore || !isNearEnd || !shouldVirtualize) return
    
    const timeoutId = setTimeout(() => {
      onLoadMore(virtualItems)
    }, VIRTUAL_LOAD_MORE_DEBOUNCE)
    
    return () => clearTimeout(timeoutId)
  }, [isNearEnd, onLoadMore, virtualItems, shouldVirtualize])

  // Empty state
  if (requests.length === 0) {
    return null
  }

  // Small lists: render directly without virtualization (no overhead)
  if (!shouldVirtualize) {
    return (
      <div className="w-full">
        {requests.map((request, index) => (
          <div key={(request as any)._uiId ?? request.id}>
            {renderRow(request, index)}
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
        const request = requests[virtualRow.index]
        if (!request) return null

        return (
          <div
            key={(request as any)._uiId ?? request.id}
            ref={(node) => rowVirtualizer.measureElement(node)}
            data-index={virtualRow.index}
            style={{ height: `${virtualRow.size}px` }}
          >
            {renderRow(request, virtualRow.index)}
          </div>
        )
      })}

      {paddingBottom > 0 && (
        <div aria-hidden style={{ height: paddingBottom }} />
      )}
    </div>
  )
}

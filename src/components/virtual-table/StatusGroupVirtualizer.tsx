'use client'

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { VIRTUAL_ROW_HEIGHT, VIRTUAL_OVERSCAN, VIRTUAL_LOAD_MORE_THRESHOLD, VIRTUAL_LOAD_MORE_DEBOUNCE } from './constants'

interface StatusGroupVirtualizerProps<T> {
  items: T[]
  onLoadMore?: (virtualItems: VirtualItem[]) => void
  renderItem: (item: T, index: number, virtualRow: VirtualItem) => React.ReactNode
  getItemKey: (item: T, index: number) => string
  parentRef?: React.RefObject<HTMLElement | null>
  estimateSize?: (index: number) => number
  emptyState?: React.ReactNode
}

/**
 * Virtualizer for client blocks within a single status group
 * Each status group has its own independent virtualizer instance
 * 
 * @param items - Array of client blocks to virtualize
 * @param onLoadMore - Optional callback triggered when scrolling near end
 * @param renderItem - Function to render a single client block
 * @param getItemKey - Function to get unique key for each client block
 * @param parentRef - Optional parent scroll element ref
 * @param estimateSize - Optional function to estimate height of each client block
 */
export function StatusGroupVirtualizer<T>({
  items,
  onLoadMore,
  renderItem,
  getItemKey,
  parentRef,
  estimateSize,
  emptyState
}: StatusGroupVirtualizerProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Default estimate size function - can be overridden for dynamic heights
  const defaultEstimateSize = useCallback(() => VIRTUAL_ROW_HEIGHT, [])
  const sizeEstimator = estimateSize || defaultEstimateSize
  
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef?.current || containerRef.current,
    estimateSize: sizeEstimator,
    overscan: VIRTUAL_OVERSCAN,
  })

  // Force virtualizer to recalculate when items length changes
  useEffect(() => {
    rowVirtualizer.measure()
  }, [items.length, rowVirtualizer])

  const virtualItems = rowVirtualizer.getVirtualItems()
  
  // Calculate if user is near the end of the list
  const isNearEnd = useMemo(() => {
    if (virtualItems.length === 0) return false
    const lastItem = virtualItems[virtualItems.length - 1]
    return lastItem.index >= items.length - VIRTUAL_LOAD_MORE_THRESHOLD
  }, [virtualItems, items.length])

  // Handle scroll to trigger loadMore
  useEffect(() => {
    if (!onLoadMore || !isNearEnd) return
    
    // Debounce to prevent excessive calls
    const timeoutId = setTimeout(() => {
      onLoadMore(virtualItems)
    }, VIRTUAL_LOAD_MORE_DEBOUNCE)
    
    return () => clearTimeout(timeoutId)
  }, [isNearEnd, onLoadMore, virtualItems])

  // Empty state guard
  if (items.length === 0) {
    if (emptyState) {
      return <div>{emptyState}</div>
    }
    return null
  }

  // Calculate spacer heights so rows stay in normal flow
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0
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
        const item = items[virtualRow.index]
        // Guard against undefined items (can happen if items array changes while virtualizer has stale indices)
        if (!item) {
          return null
        }
        return (
          <div
            key={getItemKey(item, virtualRow.index)}
            ref={(node) => rowVirtualizer.measureElement(node)}
            data-index={virtualRow.index}
          >
            {renderItem(item, virtualRow.index, virtualRow)}
          </div>
        )
      })}

      {paddingBottom > 0 && (
        <div aria-hidden style={{ height: paddingBottom }} />
      )}
    </div>
  )
}
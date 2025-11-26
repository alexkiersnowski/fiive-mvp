'use client'

import { useRef, useCallback, useEffect, useMemo } from 'react'
import { useVirtualizer, type VirtualItem } from '@tanstack/react-virtual'
import { VIRTUAL_ROW_HEIGHT, VIRTUAL_OVERSCAN, VIRTUAL_LOAD_MORE_THRESHOLD, VIRTUAL_LOAD_MORE_DEBOUNCE } from './constants'

interface UseVirtualTableOptions<T> {
  items: T[]
  onLoadMore?: (virtualItems: VirtualItem[]) => void
  scrollRestoreDeps?: unknown[]
  parentRef?: React.RefObject<HTMLElement | null>
}

interface UseVirtualTableReturn<T> {
  containerRef: React.RefObject<HTMLDivElement | null>
  rowVirtualizer: ReturnType<typeof useVirtualizer>
  virtualItems: VirtualItem[]
  isNearEnd: boolean
}

/**
 * Shared hook for virtual table scrolling
 * Handles virtualization, loadMore triggers, and scroll restoration
 * 
 * @param items - Array of items to virtualize
 * @param onLoadMore - Optional callback triggered when scrolling near end
 * @param scrollRestoreDeps - Dependencies that should trigger scroll-to-top (e.g., search query)
 * @param parentRef - Optional parent scroll element ref
 * @returns Virtualizer instance and virtual items
 */
export function useVirtualTable<T>({
  items,
  onLoadMore,
  scrollRestoreDeps = [],
  parentRef
}: UseVirtualTableOptions<T>): UseVirtualTableReturn<T> {
  const containerRef = useRef<HTMLDivElement>(null)
  
  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef?.current || containerRef.current,
    estimateSize: useCallback(() => VIRTUAL_ROW_HEIGHT, []),
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

  // Scroll restoration on search/filter changes
  const scrollToTop = useCallback(() => {
    rowVirtualizer.scrollToIndex(0)
  }, [rowVirtualizer])
  
  useEffect(() => {
    scrollToTop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, scrollRestoreDeps)

  return {
    containerRef,
    rowVirtualizer,
    virtualItems,
    isNearEnd
  }
}


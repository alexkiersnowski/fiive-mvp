'use client'

import { VIRTUAL_ROW_HEIGHT } from './constants'
import type { VirtualItem } from '@tanstack/react-virtual'

interface VirtualListBodyProps<T> {
  items: T[]
  virtualItems: VirtualItem[]
  rowVirtualizer: { measureElement: (el: HTMLElement | null) => void; getTotalSize: () => number }
  renderItem: (item: T, index: number, virtualRow: VirtualItem) => React.ReactNode
  emptyState?: React.ReactNode
  getItemKey: (item: T, index: number) => string
}

/**
 * Generic virtual list body component for mixed item types (groups + tasks)
 * Handles the virtualized rendering of list items with proper positioning
 * 
 * @param items - Array of items to render (can be mixed types)
 * @param virtualItems - Virtual items from useVirtualizer
 * @param rowVirtualizer - Virtualizer instance
 * @param renderItem - Function to render a single item
 * @param emptyState - Optional custom empty state component
 * @param getItemKey - Function to get unique key for each item
 */
export function VirtualListBody<T>({
  items,
  virtualItems,
  rowVirtualizer,
  renderItem,
  emptyState,
  getItemKey
}: VirtualListBodyProps<T>) {
  // Empty state guard
  if (items.length === 0) {
    if (emptyState) {
      return <div>{emptyState}</div>
    }
    return (
      <div className="text-center py-8">
        <span className="text-sm-regular text-[var(--color-base-text-tertiary)]">
          No results found
        </span>
      </div>
    )
  }

  // Calculate spacer heights so rows stay in normal flow
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0
  const paddingBottom = Math.max(
    0,
    rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
  )

  return (
    <div className="relative w-full">
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
            style={{ height: `${virtualRow.size}px` }}
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


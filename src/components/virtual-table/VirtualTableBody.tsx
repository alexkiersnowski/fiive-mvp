'use client'

import { Table, TableBody, TableRow } from '@/components/ui/table'
import { VIRTUAL_ROW_HEIGHT } from './constants'
import type { VirtualItem } from '@tanstack/react-virtual'

interface VirtualTableBodyProps<T> {
  items: T[]
  virtualItems: { index: number; start: number; end: number; size: number; measureElement: (el: HTMLElement | null) => void }[]
  rowVirtualizer: { measureElement: (el: HTMLElement | null) => void; getTotalSize: () => number }
  renderRow: (item: T, index: number, virtualRow: VirtualItem) => React.ReactNode
  emptyState?: React.ReactNode
  rowClassName?: string
  onRowClick?: (item: T) => void
  colGroup?: React.ReactNode
}

/**
 * Generic virtual table body component
 * Handles the virtualized rendering of table rows with proper positioning
 * 
 * @param items - Array of items to render
 * @param virtualItems - Virtual items from useVirtualizer
 * @param rowVirtualizer - Virtualizer instance
 * @param renderRow - Function to render a single row (returns TableCell components)
 * @param emptyState - Optional custom empty state component
 * @param rowClassName - Optional className for rows
 * @param onRowClick - Optional row click handler
 */
export function VirtualTableBody<T extends { id: string }>({
  items,
  virtualItems,
  rowVirtualizer,
  renderRow,
  emptyState,
  rowClassName = '',
  onRowClick,
  colGroup
}: VirtualTableBodyProps<T>) {
  // Empty state guard
  if (items.length === 0) {
    // Parent supplied a custom empty state (e.g., true empty state with custom layout)
    if (emptyState) {
      return (
        <Table noWrapper className="table-fixed w-full border-collapse">
          <TableBody>
            {emptyState}
          </TableBody>
        </Table>
      )
    }
    // Default "No results" when filters return nothing
    return (
      <Table noWrapper className="table-fixed w-full border-collapse">
        <TableBody>
          <TableRow className="hover:bg-transparent">
            <td 
              colSpan={1000} 
              className="text-center py-8"
            >
              <span className="text-sm-regular text-[var(--color-base-text-tertiary)]">
                No results found
              </span>
            </td>
          </TableRow>
        </TableBody>
      </Table>
    )
  }

  // Calculate spacer heights so rows stay in normal table flow
  const paddingTop = virtualItems.length ? virtualItems[0].start : 0
  const paddingBottom = Math.max(
    0,
    rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
  )

  return (
    <Table noWrapper className="table-fixed w-full border-collapse">
      {colGroup}
      <TableBody>
        {paddingTop > 0 && (
          <TableRow aria-hidden>
            <td colSpan={1000} style={{ height: paddingTop, padding: 0, border: 0 }} />
          </TableRow>
        )}

        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index]
          // Guard against undefined items (can happen if items array changes while virtualizer has stale indices)
          if (!item) {
            return null
          }
          return (
            <TableRow
              key={item.id}
              ref={VIRTUAL_ROW_HEIGHT ? undefined : (node) => rowVirtualizer.measureElement(node)}
              data-index={virtualRow.index}
              style={{ height: `${VIRTUAL_ROW_HEIGHT}px` }}
              onClick={() => onRowClick?.(item)}
              className={`${onRowClick ? 'hover:bg-[var(--color-interactive-surface-hover)] cursor-pointer' : ''} transition-colors duration-75 ${rowClassName}`}
            >
              {renderRow(item, virtualRow.index, virtualRow)}
            </TableRow>
          )
        })}

        {paddingBottom > 0 && (
          <TableRow aria-hidden>
            <td colSpan={1000} style={{ height: paddingBottom, padding: 0, border: 0 }} />
          </TableRow>
        )}
      </TableBody>
    </Table>
  )
}


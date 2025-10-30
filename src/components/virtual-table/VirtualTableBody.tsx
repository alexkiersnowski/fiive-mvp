'use client'

import { Table, TableBody, TableRow } from '@/components/ui/table'
import { VIRTUAL_ROW_HEIGHT } from './constants'

interface VirtualTableBodyProps<T> {
  items: T[]
  virtualItems: { index: number; start: number; end: number; size: number; measureElement: (el: HTMLElement | null) => void }[]
  rowVirtualizer: { measureElement: (el: HTMLElement | null) => void; getTotalSize: () => number }
  renderRow: (item: T, index: number, virtualRow: any) => React.ReactNode
  emptyState?: React.ReactNode
  rowClassName?: string
  onRowClick?: (item: T) => void
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
  onRowClick
}: VirtualTableBodyProps<T>) {
  // Empty state guard
  if (items.length === 0) {
    if (emptyState) {
      return <>{emptyState}</>
    }
    return (
      <div className="py-10 text-center text-[var(--color-base-text-tertiary)]">
        No items found
      </div>
    )
  }

  return (
    <div
      style={{
        height: `${rowVirtualizer.getTotalSize()}px`,
        position: 'relative',
      }}
    >
      <Table noWrapper className="table-fixed w-full border-collapse">
        <TableBody>
          {virtualItems.map((virtualRow) => {
            const item = items[virtualRow.index]
            return (
              <TableRow 
                key={item.id}
                ref={VIRTUAL_ROW_HEIGHT ? undefined : (node) => rowVirtualizer.measureElement(node)}
                data-index={virtualRow.index}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  height: `${VIRTUAL_ROW_HEIGHT}px`,
                }}
                onClick={() => onRowClick?.(item)}
                className={`hover:bg-[var(--color-interactive-surface-hover)] cursor-pointer transition-colors duration-75 ${rowClassName}`}
              >
                {renderRow(item, virtualRow.index, virtualRow)}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}


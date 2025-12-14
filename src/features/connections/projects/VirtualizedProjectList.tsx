"use client"

import React, { useRef, useMemo, useEffect, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { VIRTUAL_ROW_HEIGHT, VIRTUAL_OVERSCAN } from '@/components/virtual-table/constants'
import type { Project } from '../server'

interface VirtualizedProjectListProps {
  projects: Project[]
  renderRow: (project: Project, index: number) => React.ReactNode
  parentRef?: React.RefObject<HTMLElement | null>
}

const ROW_HEIGHT = VIRTUAL_ROW_HEIGHT // 44px

/**
 * VirtualizedProjectList - Isolated virtualizer for projects list
 * 
 * Responsibilities:
 * - Own a single @tanstack/react-virtual instance
 * - Auto virtualization threshold (only virtualize when needed)
 * - Render only ProjectRow components (single flat list, no grouping)
 * - No pagination (all data fetched upfront)
 */
export function VirtualizedProjectList({
  projects,
  renderRow,
  parentRef
}: VirtualizedProjectListProps) {
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
    const estimatedTotalHeight = projects.length * ROW_HEIGHT
    // Use container height if available, fallback to window height (only in browser)
    const containerHeight = containerRef.current?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 800) || 800
    return (
      projects.length > 30 && // Hard floor: avoid thrashing on small lists
      estimatedTotalHeight > 2 * containerHeight // Use container height, not window
    )
  }, [projects.length, isMounted])

  // Virtualizer instance (only created when shouldVirtualize is true)
  const rowVirtualizer = useVirtualizer({
    count: shouldVirtualize ? projects.length : 0,
    getScrollElement: () => parentRef?.current || containerRef.current || (typeof window !== 'undefined' ? window : null),
    estimateSize: () => ROW_HEIGHT,
    overscan: projects.length > 100 ? 5 : VIRTUAL_OVERSCAN,
    enabled: shouldVirtualize
  })

  const virtualItems = shouldVirtualize ? rowVirtualizer.getVirtualItems() : []

  // Force virtualizer to measure when projects change
  useEffect(() => {
    if (shouldVirtualize && projects.length > 0) {
      rowVirtualizer.measure()
    }
  }, [projects.length, shouldVirtualize, rowVirtualizer])

  // Empty state
  if (projects.length === 0) {
    return null
  }

  // Small lists: render directly without virtualization (no overhead)
  // Return fragment to allow rows to be direct children of tbody
  if (!shouldVirtualize) {
    return (
      <>
        {projects.map((project, index) => (
          <React.Fragment key={project.id}>
            {renderRow(project, index)}
          </React.Fragment>
        ))}
      </>
    )
  }

  // Large lists: use virtualization
  // Note: renderRow already returns a TableRow (<tr>), so we render it directly
  // We use spacer rows for padding instead of divs
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0
  const paddingBottom = Math.max(
    0,
    rowVirtualizer.getTotalSize() - (virtualItems[virtualItems.length - 1]?.end ?? 0)
  )

  return (
    <>
      {paddingTop > 0 && (
        <tr aria-hidden style={{ height: paddingTop, display: 'table-row' }}>
          <td colSpan={7} style={{ padding: 0, border: 0, height: paddingTop }} />
        </tr>
      )}

      {virtualItems.map((virtualRow) => {
        const project = projects[virtualRow.index]
        if (!project) return null

        // renderRow returns a TableRow component, so we need to clone it with ref
        const rowElement = renderRow(project, virtualRow.index)
        const existingProps = (rowElement as React.ReactElement)?.props || {}
        return (
          <React.Fragment key={project.id}>
            {React.cloneElement(rowElement as React.ReactElement, {
              ...existingProps,
              ref: (node: HTMLTableRowElement | null) => {
                if (node) {
                  rowVirtualizer.measureElement(node)
                }
              },
              'data-index': virtualRow.index,
              style: { ...existingProps.style, height: `${virtualRow.size}px` }
            })}
          </React.Fragment>
        )
      })}

      {paddingBottom > 0 && (
        <tr aria-hidden style={{ height: paddingBottom, display: 'table-row' }}>
          <td colSpan={7} style={{ padding: 0, border: 0, height: paddingBottom }} />
        </tr>
      )}
    </>
  )
}

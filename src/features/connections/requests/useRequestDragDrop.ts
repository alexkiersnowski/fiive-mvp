"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import type { RequestStatus } from './requestSort'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

interface UseRequestDragDropOptions {
  onStatusChange: (requestId: string, newStatus: RequestStatus) => Promise<void>
  onRequestUpdate?: (requestId: string, updates: { status?: RequestStatus }) => void
  requests: Array<{ id: string; status: RequestStatus }>
  containerRef?: React.RefObject<HTMLElement | null>
  parentRef?: React.RefObject<HTMLElement | null>
  openActionsDropdown: string | null
}

interface UseRequestDragDropReturn {
  draggedRequestId: string | null
  dragStartPosition: { x: number; y: number } | null
  hoveredGroupStatus: RequestStatus | null
  dragOffset: { x: number; y: number } | null
  hasDragged: boolean
  handleDragStart: (requestId: string, e: React.MouseEvent) => void
  dragGhostProps: {
    draggedRequestId: string | null
    dragStartPosition: { x: number; y: number } | null
    dragOffset: { x: number; y: number } | null
    containerWidth?: number
  }
}

/**
 * useRequestDragDrop - Simplified drag & drop hook for status change only
 * 
 * Responsibilities:
 * - Handle drag start/end
 * - Track dragged request ID
 * - Detect drop target (status header via dropzone hover)
 * - Call status change handler
 * - No within-status reordering (requests don't have explicit order field)
 * - No virtual index math (simple dropzone hover detection)
 * - Cursor stays "move" (indicates status change, not position change)
 */
export function useRequestDragDrop({
  onStatusChange,
  onRequestUpdate,
  requests,
  containerRef,
  parentRef,
  openActionsDropdown
}: UseRequestDragDropOptions): UseRequestDragDropReturn {
  const [draggedRequestId, setDraggedRequestId] = useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredGroupStatus, setHoveredGroupStatus] = useState<RequestStatus | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false)
  const dragStartRef = useRef<{ requestId: string; startX: number; startY: number } | null>(null)
  const hoverDetectionThrottleRef = useRef<number | null>(null)

  // Handle drag start (mouse down on request row)
  const handleDragStart = useCallback((requestId: string, e: React.MouseEvent) => {
    // Prevent drag if dropdown is open or other interactions are active
    if (openActionsDropdown !== null) {
      return
    }
    
    dragStartRef.current = {
      requestId,
      startX: e.clientX,
      startY: e.clientY
    }
    setDragStartPosition({ x: e.clientX, y: e.clientY })
    setHasDragged(false)
  }, [openActionsDropdown])

  // Handle mouse move during drag - detect which StatusSection dropzone is hovered
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return
    
    const { requestId, startX, startY } = dragStartRef.current
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // 10px threshold to start drag
    if (distance > 10) {
      if (!draggedRequestId) {
        setDraggedRequestId(requestId)
        setHasDragged(true)
      }
      
      // Update drag offset for ghost positioning
      setDragOffset({
        x: e.clientX - startX,
        y: e.clientY - startY
      })
      
      // Simplified hover detection: check which StatusSection is under cursor
      // Detects hover anywhere within the section (header or list), not just the header
      if (hoverDetectionThrottleRef.current === null) {
        hoverDetectionThrottleRef.current = window.requestAnimationFrame(() => {
          hoverDetectionThrottleRef.current = null
          
          // Find StatusSection container under cursor using data attributes
          // This works for any element within the section (header, list items, empty space)
          const elementUnderCursor = document.elementFromPoint(e.clientX, e.clientY)
          const statusSection = elementUnderCursor?.closest('[data-status-section]')
          
          if (statusSection) {
            const status = statusSection.getAttribute('data-status-section') as RequestStatus | null
            setHoveredGroupStatus(status)
          } else {
            setHoveredGroupStatus(null)
          }
        })
      }
    }
  }, [draggedRequestId])

  // Handle mouse up (drop or cancel)
  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return
    
    const { requestId } = dragStartRef.current
    
    // If we were dragging and have a valid drop target
    if (draggedRequestId === requestId && hoveredGroupStatus) {
      const draggedRequest = requests.find(r => r.id === requestId)
      // Only update if status actually changed
      if (draggedRequest && draggedRequest.status !== hoveredGroupStatus) {
        // Store original status for error recovery
        const originalStatus = draggedRequest.status
        
        // Call status change with error recovery
        onStatusChange(requestId, hoveredGroupStatus).catch(() => {
          // If status change fails, ensure UI is reverted immediately
          if (onRequestUpdate) {
            const currentRequest = requests.find(r => r.id === requestId)
            if (currentRequest && currentRequest.status !== originalStatus) {
              onRequestUpdate(requestId, { status: originalStatus })
            }
          }
        })
      }
    }
    
    // Reset drag state
    dragStartRef.current = null
    setDraggedRequestId(null)
    setDragStartPosition(null)
    setHoveredGroupStatus(null)
    setDragOffset(null)
    
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => {
      setHasDragged(false)
    }, 100)
  }, [draggedRequestId, hoveredGroupStatus, requests, onStatusChange, onRequestUpdate])

  // Attach document-level mouse event listeners when dragging
  useEffect(() => {
    if (dragStartPosition) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      // Prevent text selection during drag
      document.body.style.userSelect = 'none'
      document.body.style.cursor = 'grabbing'
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
  }, [dragStartPosition, handleMouseMove, handleMouseUp])

  // Handle mouse leave document (cancel drag)
  useEffect(() => {
    const handleMouseLeave = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setDraggedRequestId(null)
        setDragStartPosition(null)
        setHoveredGroupStatus(null)
        setDragOffset(null)
        setHasDragged(false)
        // Reset body styles
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
    }
    
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave)
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setDraggedRequestId(null)
        setDragStartPosition(null)
        setHoveredGroupStatus(null)
        setDragOffset(null)
        setHasDragged(false)
        document.body.style.userSelect = ''
        document.body.style.cursor = ''
      }
      // Cancel any pending hover detection
      if (hoverDetectionThrottleRef.current !== null) {
        cancelAnimationFrame(hoverDetectionThrottleRef.current)
        hoverDetectionThrottleRef.current = null
      }
    }
  }, [])

  return {
    draggedRequestId,
    dragStartPosition,
    hoveredGroupStatus,
    dragOffset,
    hasDragged,
    handleDragStart,
    dragGhostProps: {
      draggedRequestId,
      dragStartPosition,
      dragOffset,
      containerWidth: containerRef?.current?.offsetWidth
    }
  }
}

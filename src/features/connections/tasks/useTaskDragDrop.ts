"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import type { TaskStatus } from '../server'

// Drag ghost offset from cursor (pixels from left edge of row)
const DRAG_GHOST_OFFSET_X = 200
const DRAG_GHOST_OFFSET_Y = 22 // Half of row height (44px / 2)

interface UseTaskDragDropOptions {
  onStatusChange: (taskId: string, newStatus: TaskStatus) => Promise<void>
  onTaskUpdate?: (taskId: string, updates: { status?: TaskStatus }) => void
  tasks: Array<{ id: string; status: TaskStatus }>
  containerRef?: React.RefObject<HTMLElement | null>
  parentRef?: React.RefObject<HTMLElement | null>
  openActionsDropdown: string | null
}

interface UseTaskDragDropReturn {
  draggedTaskId: string | null
  dragStartPosition: { x: number; y: number } | null
  hoveredGroupStatus: TaskStatus | null
  dragOffset: { x: number; y: number } | null
  hasDragged: boolean
  handleDragStart: (taskId: string, e: React.MouseEvent) => void
  dragGhostProps: {
    draggedTaskId: string | null
    dragStartPosition: { x: number; y: number } | null
    dragOffset: { x: number; y: number } | null
    containerWidth?: number
  }
}

/**
 * useTaskDragDrop - Simplified drag & drop hook for status change only
 * 
 * Responsibilities:
 * - Handle drag start/end
 * - Track dragged task ID
 * - Detect drop target (status header via dropzone hover)
 * - Call status change handler
 * - No within-status reordering (tasks don't have explicit order field)
 * - No virtual index math (simple dropzone hover detection)
 * - Cursor stays "move" (indicates status change, not position change)
 */
export function useTaskDragDrop({
  onStatusChange,
  onTaskUpdate,
  tasks,
  containerRef,
  parentRef,
  openActionsDropdown
}: UseTaskDragDropOptions): UseTaskDragDropReturn {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null)
  const [dragStartPosition, setDragStartPosition] = useState<{ x: number; y: number } | null>(null)
  const [hoveredGroupStatus, setHoveredGroupStatus] = useState<TaskStatus | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [hasDragged, setHasDragged] = useState(false)
  const dragStartRef = useRef<{ taskId: string; startX: number; startY: number } | null>(null)
  const hoverDetectionThrottleRef = useRef<number | null>(null)

  // Handle drag start (mouse down on task row)
  const handleDragStart = useCallback((taskId: string, e: React.MouseEvent) => {
    // Prevent drag if dropdown is open or other interactions are active
    if (openActionsDropdown !== null) {
      return
    }
    
    dragStartRef.current = {
      taskId,
      startX: e.clientX,
      startY: e.clientY
    }
    setDragStartPosition({ x: e.clientX, y: e.clientY })
    setHasDragged(false)
  }, [openActionsDropdown])

  // Handle mouse move during drag - detect which StatusSection dropzone is hovered
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragStartRef.current) return
    
    const { taskId, startX, startY } = dragStartRef.current
    const deltaX = Math.abs(e.clientX - startX)
    const deltaY = Math.abs(e.clientY - startY)
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
    
    // 10px threshold to start drag
    if (distance > 10) {
      if (!draggedTaskId) {
        setDraggedTaskId(taskId)
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
            const status = statusSection.getAttribute('data-status-section') as TaskStatus | null
            setHoveredGroupStatus(status)
          } else {
            setHoveredGroupStatus(null)
          }
        })
      }
    }
  }, [draggedTaskId])

  // Handle mouse up (drop or cancel)
  const handleMouseUp = useCallback(() => {
    if (!dragStartRef.current) return
    
    const { taskId } = dragStartRef.current
    
    // If we were dragging and have a valid drop target
    if (draggedTaskId === taskId && hoveredGroupStatus) {
      const draggedTask = tasks.find(t => t.id === taskId)
      // Only update if status actually changed
      if (draggedTask && draggedTask.status !== hoveredGroupStatus) {
        // Store original status for error recovery
        const originalStatus = draggedTask.status
        
        // Call status change with error recovery
        onStatusChange(taskId, hoveredGroupStatus).catch(() => {
          // If status change fails, ensure UI is reverted immediately
          if (onTaskUpdate) {
            const currentTask = tasks.find(t => t.id === taskId)
            if (currentTask && currentTask.status !== originalStatus) {
              onTaskUpdate(taskId, { status: originalStatus })
            }
          }
        })
      }
    }
    
    // Reset drag state
    dragStartRef.current = null
    setDraggedTaskId(null)
    setDragStartPosition(null)
    setHoveredGroupStatus(null)
    setDragOffset(null)
    
    // Reset hasDragged after a short delay to allow click handler to check it
    setTimeout(() => {
      setHasDragged(false)
    }, 100)
  }, [draggedTaskId, hoveredGroupStatus, tasks, onStatusChange, onTaskUpdate])

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
        setDraggedTaskId(null)
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
        setDraggedTaskId(null)
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
    draggedTaskId,
    dragStartPosition,
    hoveredGroupStatus,
    dragOffset,
    hasDragged,
    handleDragStart,
    dragGhostProps: {
      draggedTaskId,
      dragStartPosition,
      dragOffset,
      containerWidth: containerRef?.current?.offsetWidth
    }
  }
}

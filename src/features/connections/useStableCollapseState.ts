import { useState, useCallback } from 'react'

/**
 * Hook that provides stable Set references for collapse state
 * Only creates a new Set instance when the actual contents change
 * Used for connection-specific tables that group by status only
 */
export function useStableSet<T>(initialValue: Set<T> = new Set()) {
  const [set, setSet] = useState<Set<T>>(initialValue)

  const toggle = useCallback((value: T) => {
    setSet(prev => {
      const next = new Set(prev)
      if (next.has(value)) {
        next.delete(value)
      } else {
        next.add(value)
      }
      return next
    })
  }, [])

  const add = useCallback((value: T) => {
    setSet(prev => {
      if (prev.has(value)) return prev // Return same reference if no change
      const next = new Set(prev)
      next.add(value)
      return next
    })
  }, [])

  const remove = useCallback((value: T) => {
    setSet(prev => {
      if (!prev.has(value)) return prev // Return same reference if no change
      const next = new Set(prev)
      next.delete(value)
      return next
    })
  }, [])

  const clear = useCallback(() => {
    setSet(prev => {
      if (prev.size === 0) return prev // Return same reference if already empty
      return new Set()
    })
  }, [])

  return { set, toggle, add, remove, clear }
}


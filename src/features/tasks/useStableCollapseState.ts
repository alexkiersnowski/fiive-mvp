import { useState, useCallback, useRef } from 'react'

/**
 * Hook that provides stable Set references for collapse state
 * Only creates a new Set instance when the actual contents change
 */
export function useStableSet<T>(initialValue: Set<T> = new Set()) {
  const [set, setSet] = useState<Set<T>>(initialValue)
  const setRef = useRef(set)
  setRef.current = set

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

/**
 * Hook that provides stable Map references for nested collapse state
 * Map<status, Set<clientId>> - only creates new instances when contents change
 */
export function useStableNestedSet<T extends string>(
  initialValue: Map<T, Set<string>> = new Map()
) {
  const [map, setMap] = useState<Map<T, Set<string>>>(initialValue)
  const mapRef = useRef(map)
  mapRef.current = map

  const toggle = useCallback((status: T, clientId: string) => {
    setMap(prev => {
      const clientsForStatus = prev.get(status) || new Set<string>()
      const hasClientId = clientsForStatus.has(clientId)
      
      // If toggling would result in no change, return same reference
      // (This shouldn't happen in normal usage, but handle it for safety)
      if (hasClientId && clientsForStatus.size === 1) {
        // Removing the last item - need to create new Map without this status
        const next = new Map(prev)
        next.delete(status)
        return next
      }
      
      // Create new Map and Set with the toggle applied
      const next = new Map(prev)
      const newClientsForStatus = new Set(clientsForStatus)
      if (hasClientId) {
        newClientsForStatus.delete(clientId)
      } else {
        newClientsForStatus.add(clientId)
      }
      next.set(status, newClientsForStatus)
      return next
    })
  }, [])

  const add = useCallback((status: T, clientId: string) => {
    setMap(prev => {
      const clientsForStatus = prev.get(status) || new Set<string>()
      if (clientsForStatus.has(clientId)) return prev // Return same reference if no change
      
      const next = new Map(prev)
      const newClientsForStatus = new Set(clientsForStatus)
      newClientsForStatus.add(clientId)
      next.set(status, newClientsForStatus)
      return next
    })
  }, [])

  const remove = useCallback((status: T, clientId: string) => {
    setMap(prev => {
      const clientsForStatus = prev.get(status)
      if (!clientsForStatus || !clientsForStatus.has(clientId)) {
        return prev // Return same reference if no change
      }
      
      const next = new Map(prev)
      const newClientsForStatus = new Set(clientsForStatus)
      newClientsForStatus.delete(clientId)
      if (newClientsForStatus.size === 0) {
        next.delete(status)
      } else {
        next.set(status, newClientsForStatus)
      }
      return next
    })
  }, [])

  const get = useCallback((status: T): Set<string> => {
    return mapRef.current.get(status) || new Set<string>()
  }, [])

  return { map, toggle, add, remove, get }
}


"use client"

import { useState, useEffect } from 'react'

interface DashboardData {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    jobTitle?: string
    avatarUrl?: string
  }
  organization: {
    id: string
    name: string
    type: string
    industry?: string
    logoUrl?: string
    memberCount: number
  }
}

let cachedData: DashboardData | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export function useDashboardCache() {
  const [data, setData] = useState<DashboardData | null>(cachedData)
  const [isLoading, setIsLoading] = useState(!cachedData)

  useEffect(() => {
    const now = Date.now()
    
    // If we have cached data and it's still fresh, use it
    if (cachedData && (now - cacheTimestamp) < CACHE_DURATION) {
      setData(cachedData)
      setIsLoading(false)
      return
    }

    // Otherwise, fetch fresh data
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard-data')
        if (response.ok) {
          const freshData = await response.json()
          cachedData = freshData
          cacheTimestamp = now
          setData(freshData)
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [])

  return { data, isLoading }
}

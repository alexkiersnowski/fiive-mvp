"use client"

import { useDashboardCache } from '@/lib/hooks/useDashboardCache'
import { redirect } from 'next/navigation'
import { Skeleton } from '@/components/ui/skeleton'

export default function DashboardHome() {
  const { data, isLoading } = useDashboardCache()
  
  if (!data && !isLoading) {
    redirect('/signin')
  }

  return (
    <div style={{ padding: '24px 16px 24px 32px' }}>
      <div className="mb-10">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-64 mb-3" />
            <Skeleton className="h-4 w-80" />
          </>
        ) : (
          <>
            <h1 className="display-9-medium mb-3" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              You&apos;re in, {data?.user.firstName}
            </h1>
            <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
              Here&apos;s what&apos;s active across your {data?.organization.type}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

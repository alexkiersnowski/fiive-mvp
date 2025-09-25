import { getDashboardData } from '@/lib/supabase/dashboard-data'
import { redirect } from 'next/navigation'

export default async function DashboardHome() {
  // Data is already fetched at layout level, but we can access it here if needed
  // For now, we'll keep the simple approach since the layout handles auth
  const data = await getDashboardData()
  
  if (!data) {
    redirect('/signin')
  }

  return (
    <div style={{ padding: '24px 16px 24px 32px' }}>
      <div className="mb-10">
        <h1 className="display-9-medium mb-3" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          You&apos;re in, {data.user.firstName}
        </h1>
        <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Here&apos;s what&apos;s active across your {data.organization.type}
        </p>
      </div>
    </div>
  )
}

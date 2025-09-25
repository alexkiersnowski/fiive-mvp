import { getDashboardData } from '@/lib/dashboard-data'

export default async function DashboardHome() {
  const data = await getDashboardData()
  
  if (!data) {
    return null // Layout will handle redirect
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

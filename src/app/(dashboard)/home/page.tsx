import { getDashboardData } from '@/lib/dashboard-data'
import { getActiveContext } from '@/lib/mode/getActiveContext'

export default async function DashboardHome() {
  const data = await getDashboardData()
  const context = await getActiveContext()
  
  if (!data || !context) {
    return null // Layout will handle redirect
  }

  const description = context.variant === 'agency'
    ? "Here's what's active across your agency"
    : "Here's what's happening across your agencies"

  return (
    <div style={{ padding: '24px 16px 24px 32px' }}>
      <div className="mb-10">
        <h1 className="display-9-medium mb-3" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          You&apos;re in, {data.user.firstName}
        </h1>
        <p className="text-sm-regular" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          {description}
        </p>
      </div>
    </div>
  )
}

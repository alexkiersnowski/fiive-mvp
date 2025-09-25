import LoadingSpinner from './loading-spinner'

export default function DashboardLoading() {
  return (
    <div className="h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-neutral-2)' }}>
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner size="lg" />
        <p className="text-sm text-gray-600">Loading dashboard...</p>
      </div>
    </div>
  )
}

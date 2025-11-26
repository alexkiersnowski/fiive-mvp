import { getActiveContext } from '@/lib/mode/getActiveContext'
import { validateOrgContext } from '@/lib/mode/validateContext'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import DashboardLayout from '@/components/layouts/DashboardLayout'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const context = await getActiveContext()

  if (!context) {
    redirect('/signin')
  }

  // CRITICAL: Validate organization context before proceeding
  // This ensures draft orgs cannot become active contexts
  if (!validateOrgContext(context)) {
    console.error('Invalid organization context detected in dashboard layout');
    redirect('/signin')
  }

  // Note: Route-level org type validation is handled in individual page components
  // (e.g., clients/page.tsx checks canSeeClients, agencies/page.tsx checks canSeeAgencies)
  // This ensures agencies cannot access /agencies routes and clients cannot access /clients routes

  // Read sidebar state from cookie
  const cookieStore = await cookies()
  const c = cookieStore.get("sidebar")?.value
  const initialIsCollapsed = c === "collapsed"

  return (
    <DashboardLayout 
      data={context}
      context={context}
      initialIsCollapsed={initialIsCollapsed}
    >
      {children}
    </DashboardLayout>
  )
}

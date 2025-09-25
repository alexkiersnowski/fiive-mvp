import { createClient } from '@/lib/supabase/server'

export interface DashboardData {
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

export async function getDashboardData(): Promise<DashboardData | null> {
  const supabase = await createClient()
  
  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return null
    }

    // Fetch user profile and organization data in parallel
    const [profileResult, organizationResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('first_name, last_name, job_title, avatar_url')
        .eq('id', user.id)
        .single(),
      
      supabase
        .from('organizations')
        .select('id, name, type, industry, logo_url')
        .eq('owner_id', user.id)
        .single()
    ])

    const profile = profileResult.data
    const organization = organizationResult.data

    if (!profile || !organization) {
      return null
    }

    // Get member count for the organization
    const { count: memberCount, error: memberCountError } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('org_id', organization.id)

    if (memberCountError) {
      console.error('Error fetching member count:', memberCountError)
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        jobTitle: profile.job_title || undefined,
        avatarUrl: profile.avatar_url || undefined
      },
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        industry: organization.industry || undefined,
        logoUrl: organization.logo_url || undefined,
        memberCount: memberCount || 0
      }
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return null
  }
}

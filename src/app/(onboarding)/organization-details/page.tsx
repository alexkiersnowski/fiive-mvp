import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { LogoUpload } from '@/components/ui/logo-upload'
import { handleOrganizationDetails } from '../actions'
import { createClient } from '@/app/utils/supabase/server'
import { redirect } from 'next/navigation'

export default async function OrganizationDetailsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ type?: string }> 
}) {
  const resolvedSearchParams = await searchParams
  const type = resolvedSearchParams.type // 'agency' or 'client'
  
  // Check authentication
  const supabase = await createClient()
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  
  if (userError || !user) {
    redirect('/signin')
  }

  // Load existing organization data
  console.log('=== DEBUGGING ORGANIZATION QUERY ===')
  console.log('User ID:', user.id)
  console.log('User email:', user.email)
  
  // First, let's check what organizations exist
  const { data: allOrgs, error: allOrgsError } = await supabase
    .from('organizations')
    .select('*')
  
  console.log('All organizations in DB:', allOrgs)
  console.log('All orgs error:', allOrgsError)
  
  // Check memberships
  const { data: allMemberships, error: allMembershipsError } = await supabase
    .from('memberships')
    .select('*')
  
  console.log('All memberships in DB:', allMemberships)
  console.log('All memberships error:', allMembershipsError)
  
  // Check profiles table
  const { data: allProfiles, error: allProfilesError } = await supabase
    .from('profiles')
    .select('*')
  
  console.log('All profiles in DB:', allProfiles)
  console.log('All profiles error:', allProfilesError)
  
  // Check if current user has a profile
  const { data: currentProfile, error: currentProfileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  
  console.log('Current user profile:', currentProfile)
  console.log('Current user profile error:', currentProfileError)
  
  // Try to find organization by owner_id first
  let { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('name, type, industry, logo_url, connection_code')
    .eq('owner_id', user.id)
    .single()
  
  console.log('Direct owner_id query result:', { organization, orgError })
  
  // If not found by owner_id, try to find via memberships table
  if (!organization && orgError?.code === 'PGRST116') {
    console.log('Organization not found by owner_id, trying memberships table...')
    const { data: membershipData } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
    
    console.log('Membership query result:', membershipData)
    
    if (membershipData) {
      console.log('Trying to fetch organization with ID:', membershipData.org_id)
      
      // First try to get all fields to see what exists
      const { data: allOrgData, error: allOrgErr } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', membershipData.org_id)
        .single()
      
      console.log('Full organization data:', { allOrgData, allOrgErr })
      
      // Then try the specific fields
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('name, type, industry, logo_url, connection_code')
        .eq('id', membershipData.org_id)
        .single()
      
      console.log('Organization via membership result:', { orgData, orgErr })
      organization = orgData
      orgError = orgErr
    }
  }
  
  console.log('=== FINAL RESULT ===')
  console.log('Organization:', organization ? JSON.stringify(organization) : 'null')
  console.log('Org Error:', orgError ? JSON.stringify(orgError) : 'null')
  
  // Conditional content based on account type
  const title = type === 'agency' ? 'Agency details' : 'Company details'
  const subtitle = type === 'agency' 
    ? 'This is how your agency will appear to clients' 
    : 'This is how your company will appear to agencies'

  // Debug logging to see what data we're loading
  console.log('Loading organization data:', {
    organization: organization ? JSON.stringify(organization) : 'null',
    type,
    name: organization?.name || 'undefined',
    industry: organization?.industry || 'undefined',
    organizationType: organization?.type || 'undefined'
  })

  return (
    <OnboardingLayout
      title={title}
      subtitle={subtitle}
      buttonText="Continue"
      onSubmit={handleOrganizationDetails}
      formKey={`organization-form-${type}`}
      showForm={true}
      formType="organization"
      showBackButton={true}
      logoUpload={<LogoUpload initialLogoUrl={organization?.logo_url} />}
      accountType={type as 'agency' | 'client'}
      initialLogoUrl={organization?.logo_url}
      initialData={{
        name: organization?.name || '',
        agencyType: organization?.type === 'agency' ? organization?.industry : '',
        industry: organization?.type === 'client' ? organization?.industry : ''
      }}
    />
  )
}

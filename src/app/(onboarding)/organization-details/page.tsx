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
  // Try to find organization by owner_id first
  let { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('name, type, industry, logo_url, connection_code')
    .eq('owner_id', user.id)
    .single()
  
  // If not found by owner_id, try to find via memberships table
  if (!organization && orgError?.code === 'PGRST116') {
    const { data: membershipData } = await supabase
      .from('memberships')
      .select('org_id')
      .eq('user_id', user.id)
      .single()
    
    if (membershipData) {
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('name, type, industry, logo_url, connection_code')
        .eq('id', membershipData.org_id)
        .single()
      
      organization = orgData
      orgError = orgErr
    }
  }
  
  // Conditional content based on account type
  const title = type === 'agency' ? 'Agency details' : 'Company details'
  const subtitle = type === 'agency' 
    ? 'This is how your agency will appear to clients' 
    : 'This is how your company will appear to agencies'


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

import { redirect } from "next/navigation"
import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { ImageUpload } from '@/components/ui/image-upload'
import { handleClaimOrganizationUpdate } from '../../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { createClient } from '@/lib/supabase/server'
import { verifyInviteToken } from '@/lib/tokens/verifyInviteToken'

// Force fresh data on every request to ensure updated user data is shown immediately
export const revalidate = 0

interface ClaimOrganizationDetailsPageProps {
  searchParams: Promise<{ token?: string }>
}

export default async function ClaimOrganizationDetailsPage({ searchParams }: ClaimOrganizationDetailsPageProps) {
  const resolvedSearchParams = await searchParams
  const token = resolvedSearchParams.token

  // Get authenticated user - account already created via claim flow
  const user = await getAuthenticatedUser()

  // Load organization via owner_id (ownership is tracked in organizations.owner_id, not memberships.role)
  // Claimed organizations set owner_id to the claiming user's ID
  const supabase = await createClient()

  // Protect claim flow - require valid token OR user must own a claimed org
  if (token) {
    // Verify token if provided
    const tokenResult = await verifyInviteToken(token)
    if (!tokenResult.success) {
      redirect('/home') // Invalid/expired token = not allowed
    }
  } else {
    // No token - check if user owns a claimed org (continuing flow after auth)
    const { data: org } = await supabase
      .from('organizations')
      .select('id, claimed_at')
      .eq('owner_id', user.id)
      .is('is_draft', false)
      .maybeSingle()
    
    if (!org || !org.claimed_at) {
      redirect('/home') // No token and doesn't own claimed org = not allowed
    }
  }
  const { data: organization, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, type, industry, website, description, logo_url, currency_code')
    .eq('owner_id', user.id)
    .is('is_draft', false)
    .maybeSingle()

  if (orgError || !organization) {
    console.error('Error loading organization:', orgError)
    redirect('/signin?error=organization_not_found')
  }

  // Determine organization type
  const isAgency = organization.type === 'agency'
  const accountType = isAgency ? 'agency' : 'client'

  // Display website URL without protocol (clean, modern look)
  const displayWebsite = (url: string | null | undefined): string => {
    if (!url) return ''
    
    let cleanDomain = url
    
    // Remove protocol
    if (cleanDomain.startsWith('http://')) {
      cleanDomain = cleanDomain.replace('http://', '')
    } else if (cleanDomain.startsWith('https://')) {
      cleanDomain = cleanDomain.replace('https://', '')
    }
    
    // Remove www. for display
    if (cleanDomain.startsWith('www.')) {
      cleanDomain = cleanDomain.replace('www.', '')
    }
    
    return cleanDomain
  }

  // Set contextual title and subtitle based on organization type
  const title = isAgency ? 'Agency details' : 'Company details'
  const subtitle = isAgency 
    ? 'Your client has pre-filled some of your details'
    : 'Your agency has pre-filled some of your details'

  // Prepare initial data based on organization type
  const initialData = isAgency
    ? {
        name: organization?.name || '',
        agencyType: organization?.industry || '', // Agency type is stored in industry field
        website: displayWebsite(organization?.website),
        description: organization?.description || ''
      }
    : {
        name: organization?.name || '',
        industry: organization?.industry || '',
        website: displayWebsite(organization?.website),
        description: organization?.description || ''
      }

  return (
    <OnboardingLayout
      title={title}
      subtitle={subtitle}
      buttonText="Create account"
      onSubmit={handleClaimOrganizationUpdate}
      formKey="claim-organization-form"
      showForm={true}
      formType="organization"
      showBackButton={true}
      logoUpload={<ImageUpload initialLogoUrl={organization?.logo_url || undefined} useSessionStorage={true} uploadText="Upload logo (optional)" />}
      accountType={accountType}
      initialLogoUrl={organization?.logo_url || undefined}
      initialData={initialData}
    />
  )
}

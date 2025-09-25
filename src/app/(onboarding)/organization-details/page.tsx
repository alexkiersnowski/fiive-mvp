import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { LogoUpload } from '@/components/ui/logo-upload'
import { handleOrganizationDetails } from '../actions'
import { getAuthenticatedUser } from '@/lib/onboarding/auth'
import { getOrganizationData } from '@/lib/onboarding/data'

export default async function OrganizationDetailsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ type?: string }> 
}) {
  const resolvedSearchParams = await searchParams
  const type = resolvedSearchParams.type // 'agency' or 'client'
  
  // Check authentication (centralized, DRY)
  const user = await getAuthenticatedUser()

  // Load existing organization data (optimized single query)
  const organization = await getOrganizationData(user.id)
  
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
      logoUpload={<LogoUpload initialLogoUrl={organization?.logo_url || undefined} />}
      accountType={type as 'agency' | 'client'}
      initialLogoUrl={organization?.logo_url || undefined}
      initialData={{
        name: organization?.name || '',
        agencyType: organization?.type === 'agency' ? (organization?.industry || '') : '',
        industry: organization?.type === 'client' ? (organization?.industry || '') : ''
      }}
    />
  )
}

import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { LogoUpload } from '@/components/ui/logo-upload'

export default async function OrganizationDetailsPage({ 
  searchParams 
}: { 
  searchParams: Promise<{ type?: string }> 
}) {
  const resolvedSearchParams = await searchParams
  const type = resolvedSearchParams.type // 'agency' or 'client'
  
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
      showForm={true}
      formType="organization"
      showBackButton={true}
      logoUpload={<LogoUpload />}
      accountType={type as 'agency' | 'client'}
    />
  )
}

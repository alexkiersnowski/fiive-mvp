import OnboardingLayout from '@/components/layouts/OnboardingLayout'
import { handleAccountTypeSelection } from '../actions'

export default function AccountTypePage() {
  return (
    <OnboardingLayout
      title="Choose your account type"
      buttonText="Continue"
      onSubmit={handleAccountTypeSelection}
      showForm={true}
      formType="accountType"
      showBackButton={true}
    />
  )
}

import { Card } from '@/components/ui/card'
import { RequestDetailContent } from '@/features/connections/requests/RequestDetailContent'

// Temporary mock data
function getMockRequest(requestId: string) {
  return {
    id: requestId,
    title: 'Update homepage hero for the summer campaign',
    description: 'We need to update the homepage hero section to reflect our new summer campaign. Please refresh all visual elements including the background images, CTAs, and messaging to align with the summer theme.',
  }
}

export default async function ClientRequestDetailPage({ 
  params 
}: { 
  params: Promise<{ requestId: string }> 
}) {
  const { requestId } = await params
  const requestData = getMockRequest(requestId)
  
  return (
    <Card className="w-full">
      <RequestDetailContent 
        requestId={requestId}
        title={requestData.title}
        description={requestData.description}
        mode="page"
      />
    </Card>
  )
}


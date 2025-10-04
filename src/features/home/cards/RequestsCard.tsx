import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../types';

export default function RequestsCard({ snapshot, context }: StatsCardProps) {
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Requests' : 'Requests';
  const description = isAgency 
    ? 'No requests yet. Clients can submit requests from their portal, or you can add one on their behalf.'
    : 'No requests yet. Ask questions, share updates, or request new work directly from your agency.';
  const buttonText = isAgency ? 'Add request' : 'Submit request';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
        {title}
      </CardTitle>
      <p className="text-xs-regular text-tertiary">
        {description}
      </p>
      <div className="mt-auto flex justify-end">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 shadow-none cursor-pointer transition-all duration-75"
        >
          <Plus size={16} weight="regular" />
          {buttonText}
        </Button>
      </div>
    </Card>
  );
}

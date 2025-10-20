import Link from 'next/link';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from '@phosphor-icons/react/dist/ssr';
import type { StatsCardProps } from '../../types';

export default function ClientsCard({ snapshot, context }: StatsCardProps) {
  const { clients } = snapshot;
  
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Clients' : 'Agencies';
  const buttonText = isAgency ? 'Clients' : 'Agencies';
  const href = isAgency ? '/clients' : '/agencies';

  return (
    <Card className="w-full pt-5 pb-[18px] px-5 flex flex-col gap-3">
      <CardTitle className="text-sm-regular" style={{ color: 'var(--color-base-text-primary)' }}>{title}</CardTitle>
      <div className="display-8-medium" style={{ color: 'var(--color-base-text-primary)' }}>{clients.total}</div>
      <Link href={href} className="ml-auto">
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-2 text-xs-bold cursor-pointer back-button hover:bg-interactive-surface-hover transition-all duration-75 mt-1"
        >
          <span className="mr-1">{buttonText}</span>
          <ArrowRight size={16} weight="regular" />
        </Button>
      </Link>
    </Card>
  );
}

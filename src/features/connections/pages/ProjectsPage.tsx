'use client'

import { useConnection } from '../ConnectionContext';
import { Card, CardTitle } from '@/components/ui/card';

export function ProjectsPage() {
  const { snapshot, context } = useConnection();
  const isAgency = context.variant === 'agency';
  const title = isAgency ? 'Projects' : 'Projects';

  return (
    <Card className="w-full h-full pt-5 pb-6 px-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <CardTitle className="text-xl-medium" style={{ color: 'var(--color-base-text-primary)' }}>
            {title}
          </CardTitle>
        </div>
      </div>
      <div className="flex-1">
        {/* Content area for projects table, forms, etc. */}
      </div>
    </Card>
  );
}


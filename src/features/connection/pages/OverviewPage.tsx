'use client'

import { useConnection } from '../ConnectionContext';
import AboutCard from '../cards/AboutCard';
import DetailsCard from '../cards/DetailsCard';

export function OverviewPage() {
  const { snapshot, context } = useConnection();

  return (
    <div className="mt-4 grid grid-cols-3 gap-4">
      <div className="col-span-2">
        <AboutCard />
      </div>
      <div className="col-span-1">
        <DetailsCard />
      </div>
    </div>
  );
}


'use client'

import type { ReactNode } from 'react';
import { useConnection } from '../ConnectionContext';
import AboutCard from '../cards/AboutCard';
import DetailsCard from '../cards/DetailsCard';
import ContactsCard from '../cards/ContactsCard';
import ResourcesCard from '../cards/ResourcesCard';

interface OverviewPageProps {
  requestsCard: ReactNode;
  tasksCard: ReactNode;
  projectsCard: ReactNode;
}

export function OverviewPage({ requestsCard, tasksCard, projectsCard }: OverviewPageProps) {
  const { snapshot, context } = useConnection();

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <AboutCard />
        </div>
        <div className="col-span-1">
          <DetailsCard context={context} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-1">
          {requestsCard}
        </div>
        <div className="col-span-1">
          {tasksCard}
        </div>
        <div className="col-span-1">
          <ContactsCard snapshot={snapshot} context={context} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          {projectsCard}
        </div>
        <div className="col-span-1">
          <ResourcesCard snapshot={snapshot} context={context} />
        </div>
      </div>
    </div>
  );
}


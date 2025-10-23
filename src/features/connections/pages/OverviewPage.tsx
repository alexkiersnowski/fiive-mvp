'use client'

import { useConnection } from '../ConnectionContext';
import AboutCard from '../cards/AboutCard';
import DetailsCard from '../cards/DetailsCard';
import RequestsCard from '../cards/RequestsCard';
import TasksCard from '../cards/TasksCard';
import ContactsCard from '../cards/ContactsCard';
import ProjectsCard from '../cards/ProjectsCard';
import ResourcesCard from '../cards/ResourcesCard';

export function OverviewPage() {
  const { snapshot, context } = useConnection();

  return (
    <div className="mt-4 flex flex-col gap-4">
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
          <RequestsCard snapshot={snapshot} context={context} />
        </div>
        <div className="col-span-1">
          <TasksCard snapshot={snapshot} context={context} />
        </div>
        <div className="col-span-1">
          <ContactsCard snapshot={snapshot} context={context} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          <ProjectsCard snapshot={snapshot} context={context} />
        </div>
        <div className="col-span-1">
          <ResourcesCard snapshot={snapshot} context={context} />
        </div>
      </div>
    </div>
  );
}


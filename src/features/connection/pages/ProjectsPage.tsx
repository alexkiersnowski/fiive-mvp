'use client'

import { useConnection } from '../ConnectionContext';

export function ProjectsPage() {
  const { snapshot, context } = useConnection();
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Projects</h2>
      <p className="text-neutral-11">Projects feature coming soon...</p>
    </div>
  );
}


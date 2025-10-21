'use client'

import { useConnection } from '../ConnectionContext';

export function TasksPage() {
  const { snapshot, context } = useConnection();
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Tasks</h2>
      <p className="text-neutral-11">Tasks feature coming soon...</p>
    </div>
  );
}


'use client'

import { useConnection } from '../ConnectionContext';

export function RequestsPage() {
  const { snapshot, context } = useConnection();
  
  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">Requests</h2>
      <p className="text-neutral-11">Requests feature coming soon...</p>
    </div>
  );
}


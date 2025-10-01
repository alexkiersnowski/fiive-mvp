import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';

export default async function AgenciesPage() {
  const ctx = await getActiveContext();
  
  if (!ctx || !ctx.capabilities.canSeeAgencies) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Agencies</h1>
      <p className="text-gray-600">Client view: View your agency connections</p>
    </div>
  );
}

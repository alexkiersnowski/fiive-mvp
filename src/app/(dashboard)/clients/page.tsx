import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';

export default async function ClientsPage() {
  const ctx = await getActiveContext();
  
  if (!ctx || !ctx.capabilities.canSeeClients) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Clients</h1>
      <p className="text-gray-600">Agency view: Manage your client connections</p>
    </div>
  );
}


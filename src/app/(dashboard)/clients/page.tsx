import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { getClientsSnapshot } from '@/features/clients/server';
import { ClientsContent } from './ClientsContent';

interface ClientsPageProps {
  searchParams: {
    search?: string;
    sort?: string;
  };
}

export default async function ClientsPage({ searchParams }: ClientsPageProps) {
  const context = await getActiveContext();
  
  if (!context || !context.capabilities.canSeeClients) {
    notFound();
  }

  const snapshot = await getClientsSnapshot(context, {
    search: searchParams.search || '',
    limit: 50,
    sort: searchParams.sort || 'newest-first'
  });

  return (
    <ClientsContent 
      snapshot={snapshot} 
      context={context}
      initialSearchValue={searchParams.search || ''}
      initialSortValue={searchParams.sort || 'newest-first'}
    />
  );
}


import { getActiveContext } from '@/lib/mode/getActiveContext';
import { notFound } from 'next/navigation';
import { AgenciesContent } from './AgenciesContent';

interface AgenciesPageProps {
  searchParams: {
    search?: string;
  };
}

export default async function AgenciesPage({ searchParams }: AgenciesPageProps) {
  const context = await getActiveContext();
  
  if (!context || !context.capabilities.canSeeAgencies) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;

  return (
    <AgenciesContent 
      initialSearchValue={resolvedSearchParams.search || ''}
    />
  );
}
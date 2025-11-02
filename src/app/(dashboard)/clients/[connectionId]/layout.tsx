import ConnectionLayoutWrapper from '@/features/connections/ConnectionLayoutWrapper';

interface ClientConnectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ connectionId: string }>;
}

export default async function ClientConnectionLayout({ children, params }: ClientConnectionLayoutProps) {
  return (
    <ConnectionLayoutWrapper
      params={params}
      baseRoute="clients"
      requiredCapability="canSeeClients"
    >
      {children}
    </ConnectionLayoutWrapper>
  );
}


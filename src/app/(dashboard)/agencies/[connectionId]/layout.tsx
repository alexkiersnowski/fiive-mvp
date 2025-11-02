import ConnectionLayoutWrapper from '@/features/connections/ConnectionLayoutWrapper';

interface AgencyConnectionLayoutProps {
  children: React.ReactNode;
  params: Promise<{ connectionId: string }>;
}

export default async function AgencyConnectionLayout({ children, params }: AgencyConnectionLayoutProps) {
  return (
    <ConnectionLayoutWrapper
      params={params}
      baseRoute="agencies"
      requiredCapability="canSeeAgencies"
    >
      {children}
    </ConnectionLayoutWrapper>
  );
}


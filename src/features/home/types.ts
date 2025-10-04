import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type HomeSnapshot = {
  clients: {
    total: number;
    // Future: newThisMonth: number;
  };
  requests: {
    newCount: number;
    // Future: items: RequestItem[];
  };
  contracts: {
    endingSoonCount: number;
    // Future: items: ContractItem[];
  };
  tasks: {
    dueSoonCount: number;
    // Future: items: TaskItem[];
  };
};

export type StatsCardProps = {
  snapshot: HomeSnapshot;
  context: EnhancedModeContext;
};

export type CardConfig = {
  key: string;
  Component: React.ComponentType<StatsCardProps>;
};


import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type AgencyPreview = {
  id: string;
  connectionId: string;
  name: string;
  logo?: string;
  projectCount: number; // Default to 0 for now
};

export type HomeSnapshot = {
  clients: {
    total: number;
    // Future: newThisMonth: number;
  };
  health: {
    healthy: number;
    atRisk: number;
    critical: number;
    unassigned: number;
  };
  agencies: AgencyPreview[]; // Preview of up to 5 agencies for client view
  requests: {
    newCount: number;
    inReviewCount: number;
    // Future: items: RequestItem[];
  };
  contracts: {
    endingSoonCount: number;
    // Future: items: ContractItem[];
  };
  tasks: {
    dueSoonCount: number;
    assignedCount: number;
    // Future: items: TaskItem[];
  };
};

export type StatsCardProps = {
  snapshot: HomeSnapshot;
  context: EnhancedModeContext;
  allowedConnectionIds?: string[] | null;
};

export type CardConfig = {
  key: string;
  Component: React.ComponentType<StatsCardProps>;
};


import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type Client = {
  id: string
  name: string
  logo?: string
  status: "draft" | "onboarding" | "active" | "offboarded"
  accountManager: {
    name: string
    avatar?: string
  }
  contractEnd?: string
  health: "unassigned" | "healthy" | "at-risk" | "critical" | "n/a"
  badge?: string
}

export type ClientsSnapshot = {
  clients: Client[];
  total: number;
  cursor?: string | null;
  hasNextPage: boolean;
};

export type ClientsPaginationOptions = {
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
};


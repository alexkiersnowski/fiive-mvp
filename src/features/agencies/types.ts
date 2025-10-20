import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type Agency = {
  id: string
  name: string
  logo?: string
  industry?: string
  status: "connected" | "invited" | "disconnected" | "draft"
  accountManager: {
    name: string
    avatar?: string
  }
}

export type AgenciesSnapshot = {
  agencies: Agency[];
  total: number;
};

export type AgenciesPaginationOptions = {
  search?: string;
  limit?: number;
};

import { z } from 'zod';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';

export type Client = {
  id: string
  name: string
  logo?: string
  status: "draft" | "onboarding" | "active" | "offboarded"
  createdAt?: string
  accountManager: {
    id: string
    name: string
    firstName: string
    lastName: string
    email: string
    jobTitle?: string
    avatar?: string
    organization: {
      id: string
      name: string
      logo_url?: string
    }
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

// Form validation schemas
export const accountTypeSchema = z.object({
  accountType: z.string().min(1, "Please make a selection")
});

export const addNewClientSchema = z.object({
  clientName: z.string().min(1, "Client name is required")
});

export const connectToClientSchema = z.object({
  connectionCode: z.string().min(1, "Connection code is required")
});

// Form data types
export type AccountTypeFormData = z.infer<typeof accountTypeSchema>;
export type AddNewClientFormData = z.infer<typeof addNewClientSchema>;
export type ConnectToClientFormData = z.infer<typeof connectToClientSchema>;

// Connection types
export type ConnectionCode = {
  code: string;
  organizationId: string;
  organizationName: string;
  isActive: boolean;
};

export type ConnectionResult = {
  success: boolean;
  clientName?: string;
  clientLogo?: string;
  error?: string;
};

export interface NewClientPayload {
  connection_id: string;
  connection_status: 'draft';
  engagement_status: string | null;
  client_id: string;
  client_name: string;
  logo_url?: string | null;
  is_draft: boolean;
  created_at: string;
}

export type NewClientResult =
  | { success: true; data: NewClientPayload }
  | { success: false; error: string };


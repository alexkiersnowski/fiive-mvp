export type Agency = {
  id: string
  connectionId: string // Connection ID from connections table
  name: string
  logo?: string
  industry?: string
  status: "connected" | "invited" | "disconnected" | "internal"
  invitedEmail?: string
  accountManager: {
    id: string
    name: string
    avatarUrl?: string | undefined
    email?: string
    jobTitle?: string
  }
  projectCount?: number
}

export type AgenciesSnapshot = {
  agencies: Agency[];
  total: number;
  unfilteredTotalCount: number; // Total count without search/filter applied
  cursor?: string | null;
  hasNextPage: boolean;
};

export type AgenciesPaginationOptions = {
  search?: string;
  cursor?: string;
  limit?: number;
};

// Request type matches the one from connections/server.ts but includes connection info
export type Request = {
  id: string
  connectionId: string
  title: string
  description: string
  status: 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed'
  project: {
    id: string
    name: string
  } | null
  submittedBy: {
    id: string
    name: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId: string
    orgName: string
    orgLogo?: string
  }
  assignee: {
    id: string
    name: string
    email: string
    avatarUrl?: string
  } | null
  client: {
    id: string
    name: string
    logoUrl?: string
  }
  agency?: {
    id: string
    name: string
    logoUrl?: string
  }
  createdAt: string
  createdByOrgId: string
  createdByOrgType?: 'agency' | 'client'
}

export type RequestsSnapshot = {
  requests: Request[];
  total: number;
  unfilteredTotalCount: number; // Total count without search/filter applied
  cursor?: string | null;
  hasNextPage: boolean;
};

export type RequestsPaginationOptions = {
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: string;
  assignedToUserId?: string;
  createdByUserId?: string;
  connectionIds?: string[]; // Optional: share connection IDs to avoid redundant queries
};


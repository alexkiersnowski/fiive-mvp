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
  requests: Request[]; // Flat ordered list
  total: number;
  unfilteredTotalCount: number; // Total count without search/filter applied
  offset: number; // Single offset for flat stream
  hasMore: boolean; // Single hasMore flag
  // All connection metadata (for grouping) - includes ALL connections user has access to (RLS enforced)
  allConnectionsMetadata?: Map<string, { name: string; logoUrl?: string }>;
  // Status-specific counts across ALL connections (not just loaded) - calculated from metadata
  statusCounts?: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  };
  // Per-connection counts for collapse math (from skeleton)
  clientCounts?: Record<string, number>; // NEW: connection_id -> count
  // Total unique client count (agnostic to pagination) - for status header display
  totalClientCount?: number; // Total unique clients across ALL connections (e.g., 25)
  // Which status this snapshot represents (for status-specific pagination)
  status?: 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled';
  // Deprecated: Not used in flat pagination
  fetchedConnectionIds?: string[]; // Kept for backward compatibility, but empty array in flat pagination
  loadedStatusCounts?: {
    new: number;
    in_review: number;
    accepted: number;
    closed: number;
    canceled: number;
  };
};

export type RequestsPaginationOptions = {
  search?: string;
  offset?: number; // Single offset (not per-connection) - offset into flat ordered stream
  limit?: number; // Single limit (not per-connection) - number of requests to load per page (default: 50)
  excludedConnectionIds?: string[]; // Server-side collapse: connections to skip
  assignedToUserId?: string;
  createdByUserId?: string;
  // Status-specific pagination
  status?: 'new' | 'in_review' | 'accepted' | 'closed' | 'canceled'; // Filter by status for status-specific pagination
};

// Search results types for server-side search mode
export type SearchClientResult = {
  client_id: string; // org_id
  client_name: string;
  client_logo_url?: string;
  requests: Request[]; // Pre-loaded, fully populated Request objects
}

export type SearchResults = {
  clients: SearchClientResult[];
  totalClients: number;
}


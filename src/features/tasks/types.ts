// Task type matches the one from connections/server.ts but includes connection info for global view
export type Task = {
  id: string
  connectionId: string
  title: string
  description: string
  status: 'to_do' | 'in_progress' | 'on_hold' | 'done'
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
    organizationId?: string
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
  createdAtRaw?: string | null
  updatedAt?: string
  dueDate?: string | null
  dueDateRaw?: string | null
  completedAt?: string | null
  completedAtRaw?: string | null
  createdByUserId: string
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
  clientVisible: boolean
  clientVisibilityLocked: boolean
  isPinned?: boolean
  sourceRequestId?: string | null
  linkedRequest?: {
    id: string
    title: string
    createdAt: string
    createdByUserId?: string
    createdByName?: string
  } | null
}

export type TasksSnapshot = {
  tasks: Task[];
  total: number;
  unfilteredTotalCount: number; // Total count without search/filter applied
  offset: number; // REQUIRED: Server always returns explicit next offset (never optional)
  hasMore: boolean; // Changed from hasNextPage
  fetchedConnectionIds: string[]; // REQUIRED for status-specific pagination: Org IDs (groupIds) that were paginated/fetched. Empty array for search mode.
  // All connection metadata (for grouping) - includes ALL connections user has access to (RLS enforced)
  allConnectionsMetadata?: Map<string, { name: string; logoUrl?: string }>;
  // Status-specific counts across ALL connections (not just loaded) - calculated from metadata
  statusCounts?: {
    to_do: number;
    in_progress: number;
    on_hold: number;
    done: number;
  };
  // Status counts from loaded connections only (for debugging/display)
  loadedStatusCounts?: {
    to_do: number;
    in_progress: number;
    on_hold: number;
    done: number;
  };
  // Total unique client count (agnostic to pagination) - for status header display
  totalClientCount?: number; // Total unique clients across ALL connections (e.g., 25)
  // Which status this snapshot represents (for status-specific pagination)
  status?: 'to_do' | 'in_progress' | 'on_hold' | 'done';
};

export type TasksPaginationOptions = {
  search?: string;
  offset?: number; // Changed from cursor - offset into paginated connection list
  limit?: number; // Number of connections to load per page (default: 20)
  assignedToUserId?: string;
  assignedToUserIds?: string[]; // For filtering by multiple user IDs (e.g., all client team members)
  // Status-specific pagination
  status?: 'to_do' | 'in_progress' | 'on_hold' | 'done'; // Filter by status for status-specific pagination
};

// Search results types for server-side search mode
export type SearchClientResult = {
  client_id: string; // org_id
  client_name: string;
  client_logo_url?: string;
  tasks: Task[]; // Pre-loaded, fully populated Task objects
}

export type SearchResults = {
  clients: SearchClientResult[];
  totalClients: number;
}


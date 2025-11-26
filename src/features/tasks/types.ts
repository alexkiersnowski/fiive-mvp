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
  cursor?: string | null;
  hasNextPage: boolean;
};

export type TasksPaginationOptions = {
  search?: string;
  cursor?: string;
  limit?: number;
  sort?: string; // 'status', 'due_date', 'client_asc', 'client_desc', 'agency_asc', 'agency_desc'
  assignedToUserId?: string;
  assignedToUserIds?: string[]; // For filtering by multiple user IDs (e.g., all client team members)
};


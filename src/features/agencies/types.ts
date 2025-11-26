export type Agency = {
  id: string
  connectionId: string // Connection ID from connections table
  name: string
  logo?: string
  industry?: string
  status: "connected" | "invited" | "disconnected" | "internal"
  accountManager: {
    id: string
    name: string
    avatarUrl?: string | undefined
    email?: string
    jobTitle?: string
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

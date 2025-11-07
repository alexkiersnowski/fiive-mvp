import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import * as formatters from './formatters';
import { sortTasks, type TaskSortMode } from './tasks/taskSort';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Lightweight validation to check if the current user's organization has access to a connection.
 * This is used for request detail pages where we don't need the full snapshot.
 */
export const validateConnectionAccess = cache(async (
  connectionId: string,
  context: EnhancedModeContext
): Promise<boolean> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('validateConnectionAccess called with:', {
      connectionId,
      orgId: context.orgId,
      variant: context.variant
    });
  }
  
  // Minimal query: just check if connection exists and belongs to user's org
  if (context.variant === 'agency') {
    const { data, error } = await supabase
      .from('connections')
      .select('id')
      .eq('id', connectionId)
      .eq('agency_id', context.orgId)
      .single();
    
    return !error && !!data;
  } else {
    const { data, error } = await supabase
      .from('connections')
      .select('id')
      .eq('id', connectionId)
      .eq('client_id', context.orgId)
      .single();
    
    return !error && !!data;
  }
});

export const getConnectionSnapshot = cache(async (
  context: EnhancedModeContext,
  connectionId: string
): Promise<ConnectionSnapshot | null> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getConnectionSnapshot called with:', {
      connectionId,
      orgId: context.orgId,
      variant: context.variant
    });
  }
  
  let currentUserType: 'agency' | 'client';
  let connection;
  let error;
  
  if (context.variant === 'agency') {
    // Agency viewing client - join with client organization
    currentUserType = 'agency';
    const result = await supabase
      .from('connections')
      .select(`
        id,
        connection_status,
        engagement_status,
        health_status,
        contract_end_on,
        contract_value,
        agency_primary_contact_id,
        client_primary_contact_id,
        agency_id,
        client_id,
        organizations!connections_client_id_fkey (
          id,
          name,
          logo_url,
          description,
          website,
          industry
        )
      `)
      .eq('id', connectionId)
      .eq('agency_id', context.orgId) // Ensure this agency owns this connection
      .single();
    
    connection = result.data;
    error = result.error;
  } else {
    // Client viewing agency - join with agency organization
    currentUserType = 'client';
    const result = await supabase
      .from('connections')
      .select(`
        id,
        connection_status,
        engagement_status,
        health_status,
        contract_end_on,
        contract_value,
        agency_primary_contact_id,
        client_primary_contact_id,
        agency_id,
        client_id,
        organizations!connections_agency_id_fkey (
          id,
          name,
          logo_url,
          description,
          website,
          industry
        )
      `)
      .eq('id', connectionId)
      .eq('client_id', context.orgId) // Ensure this client owns this connection
      .single();
    
    connection = result.data;
    error = result.error;
  }
  
  if (error || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection snapshot:', {
        error,
        connection,
        connectionId,
        orgId: context.orgId,
        variant: context.variant
      });
    }
    return null;
  }
  
  const partnerOrg = connection.organizations as { 
    name?: string; 
    logo_url?: string; 
    description?: string;
    website?: string;
    industry?: string;
  } | null;
  
  // Fetch agency organization to get currency_code, name, and logo (always from agency, not client)
  const { data: agencyOrg } = await supabase
    .from('organizations')
    .select('id, name, logo_url, currency_code')
    .eq('id', connection.agency_id)
    .single();
  
  // Fetch client primary contact if it exists
  let clientPrimaryContact = null;
  if (connection.client_primary_contact_id) {
    const { data: contact } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .eq('id', connection.client_primary_contact_id)
      .single();
    
    if (contact) {
      clientPrimaryContact = {
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        avatarUrl: contact.avatar_url,
        jobTitle: contact.job_title
      };
    }
  }
  
  // Fetch client members for the dropdown
  // When agency views client: use client_id
  // When client views agency: use current orgId (which is the client)
  const clientId = currentUserType === 'agency' ? connection.client_id : context.orgId;
  
  const { data: members } = await supabase
    .from('memberships')
    .select(`
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        job_title,
        deleted_at
      )
    `)
    .eq('org_id', clientId)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');
  
  const clientMembers = members?.map(member => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      avatarUrl: profile.avatar_url || undefined,
      jobTitle: profile.job_title || undefined
    };
  }) || [];
  
  // Fetch agency primary contact if it exists
  let agencyPrimaryContact = null;
  if (connection.agency_primary_contact_id) {
    const { data: contact } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .eq('id', connection.agency_primary_contact_id)
      .single();
    
    if (contact) {
      agencyPrimaryContact = {
        id: contact.id,
        firstName: contact.first_name,
        lastName: contact.last_name,
        email: contact.email,
        avatarUrl: contact.avatar_url,
        jobTitle: contact.job_title
      };
    }
  }
  
  // Fetch agency members for the dropdown
  // When agency views client: use current orgId (which is the agency)
  // When client views agency: use agency_id
  const agencyId = currentUserType === 'agency' ? context.orgId : connection.agency_id;
  
  const { data: agencyMembersData } = await supabase
    .from('memberships')
    .select(`
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        job_title,
        deleted_at
      )
    `)
    .eq('org_id', agencyId)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');
  
  const agencyMembers = agencyMembersData?.map(member => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      avatarUrl: profile.avatar_url || undefined,
      jobTitle: profile.job_title || undefined
    };
  }) || [];
  
  // Format contract value for display
  let formattedContractValue: string | null = null;
  if (connection.contract_value) {
    const numericValue = parseFloat(connection.contract_value);
    if (!isNaN(numericValue)) {
      // Check if number has meaningful decimal places
      const hasSignificantDecimals = numericValue % 1 !== 0;
      
      // Format with thousand separators, only show decimals if they're meaningful
      formattedContractValue = numericValue.toLocaleString('en-US', {
        minimumFractionDigits: hasSignificantDecimals ? 2 : 0,
        maximumFractionDigits: 2
      });
    }
  }
  
  // Fetch count of new requests for this connection (only for agency view)
  let newRequestsCount: number | undefined = undefined;
  if (currentUserType === 'agency') {
    const { count, error: countError } = await supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .eq('status', 'new')
      .is('deleted_at', null);
    
    if (!countError && count !== null) {
      newRequestsCount = count;
    }
  }
  
  return {
    connection: {
      id: connection.id,
      status: connection.connection_status || 'draft',
      engagementStatus: connection.engagement_status,
      health: connection.health_status || undefined,
      contractEnd: connection.contract_end_on 
        ? new Date(connection.contract_end_on).toLocaleDateString('en-GB', { 
            day: 'numeric', 
            month: 'short', 
            year: 'numeric' 
          })
        : undefined,
      contractValue: formattedContractValue,
      accountManager: connection.agency_primary_contact_id
        ? { name: 'Loading...', avatar: undefined } // TODO: Fetch from profiles when RLS allows
        : { name: 'Unassigned', avatar: undefined },
      clientPrimaryContact: clientPrimaryContact,
      agencyPrimaryContact: agencyPrimaryContact
    },
    partner: {
      id: currentUserType === 'agency' ? connection.client_id : connection.agency_id,
      name: partnerOrg?.name || (currentUserType === 'agency' ? 'Unknown Client' : 'Unknown Agency'),
      logo: partnerOrg?.logo_url,
      description: partnerOrg?.description,
      website: partnerOrg?.website,
      industry: partnerOrg?.industry,
      type: currentUserType === 'agency' ? 'client' : 'agency'
    },
    agency: {
      id: connection.agency_id,
      name: agencyOrg?.name || 'Agency',
      logo: agencyOrg?.logo_url,
      currencyCode: (agencyOrg?.currency_code as 'EUR' | 'USD' | 'GBP') || 'EUR'
    },
    currentUserType,
    clientMembers,
    agencyMembers,
    newRequestsCount
  };
});

export function invalidateConnection(connectionId: string) {
  // TODO: Implement cache invalidation when using real data
  // revalidateTag(`connection:${connectionId}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Invalidating connection cache for: ${connectionId}`);
  }
}

export interface Request {
  id: string
  connectionId: string
  title: string
  description: string
  status: 'new' | 'in_review' | 'accepted' | 'canceled'
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

export interface RecentRequestSummary {
  id: string
  title: string
  createdAt: string
}

type RecentRequestRow = {
  id: string
  title: string | null
  created_at: string | null
}

export type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

export interface Task {
  id: string
  connectionId: string
  title: string
  description: string
  status: TaskStatus
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
  createdByUserId: string
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
  clientVisible: boolean
  clientVisibilityLocked: boolean
  isPinned?: boolean
}

// Cache connection info separately to avoid duplicate fetches
const getConnectionInfo = cache(async (connectionId: string) => {
  const supabase = await createClient();
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('client_id, agency_id')
    .eq('id', connectionId)
    .single();
  
  if (connectionError || !connection) {
    return { connection: null, error: connectionError };
  }
  
  return { connection, error: null };
});

export interface RequestsWithCount {
  requests: Request[]
  totalCount: number
}

export interface TasksWithCount {
  tasks: Task[]
  totalCount: number
}

export const getRequestsForConnection = cache(async (
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string }
): Promise<RequestsWithCount> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const startTime = isDev ? performance.now() : 0;
  const { limit = 50, offset = 0, searchQuery, assignedToUserId, createdByUserId } = options || {};
  const supabase = await createClient();
  
  // Fetch the connection info (cached, shared with getAgencyMembersForConnection)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError) {
    if (isDev) {
      console.error('Error fetching connection:', connectionError);
    }
    // Return empty result - connection error means we can't proceed
    // Client will handle showing appropriate error if needed
    return { requests: [], totalCount: 0 };
  }
  
  if (!connection) {
    // Connection not found - return empty result (no results)
    return { requests: [], totalCount: 0 };
  }
  
  // Fetch client and agency organization details (can run in parallel with requests query)
  const clientOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.client_id)
    .single();
  
  const agencyOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.agency_id)
    .single();
  
  // Fetch requests and orgs in parallel (they don't depend on each other)
  const requestsStartTime = isDev ? performance.now() : 0;
  
  // Normalize search query for status matching
  const normalizeStatusQuery = (query: string): string | null => {
    const normalized = query.toLowerCase().trim();
    const STATUS_KEYWORDS: Record<string, 'new' | 'in_review' | 'accepted' | 'canceled'> = {
      open: 'new',
      new: 'new',
      'in review': 'in_review',
      in_review: 'in_review',
      review: 'in_review',
      reviewing: 'in_review',
      accepted: 'accepted',
      approve: 'accepted',
      approved: 'accepted',
      accept: 'accepted',
      canceled: 'canceled',
      cancelled: 'canceled',
      cancel: 'canceled'
    };
    return STATUS_KEYWORDS[normalized] ?? null;
  };


  // Build the base query for filtering (used for both count and data)
  let baseQuery = supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .is('deleted_at', null);

  if (assignedToUserId) {
    baseQuery = baseQuery.eq('assignee_user_id', assignedToUserId);
  }
  
  if (createdByUserId) {
    baseQuery = baseQuery.eq('created_by_user_id', createdByUserId);
  }
  
  // Apply search filter if searchQuery is provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeStatusQuery(trimmedQuery);
    
    // Build OR list for search
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`project_name_cached.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    baseQuery = baseQuery.or(orParts.join(','));
  }
  
  // Build the requests query for fetching data
  let requestsQuery = supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      status,
      project_id,
      created_by_user_id,
      assignee_user_id,
      created_at,
      created_by_org_id
    `)
    .eq('connection_id', connectionId)
    .is('deleted_at', null);

  if (assignedToUserId) {
    requestsQuery = requestsQuery.eq('assignee_user_id', assignedToUserId);
  }
  
  if (createdByUserId) {
    requestsQuery = requestsQuery.eq('created_by_user_id', createdByUserId);
  }
  
  // Apply search filter if searchQuery is provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeStatusQuery(trimmedQuery);
    
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`project_name_cached.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    requestsQuery = requestsQuery.or(orParts.join(','));
  }
  
  const [countResult, requestsResult, clientOrgResult, agencyOrgResult] = await Promise.all([
    baseQuery,
    requestsQuery
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
    clientOrgPromise,
    agencyOrgPromise
  ]);
  
  const requestsTime = isDev ? performance.now() - requestsStartTime : 0;
  const { data: requests, error } = requestsResult;
  const { count, error: countError } = countResult;
  const { data: clientOrg, error: clientOrgError } = clientOrgResult;
  const { data: agencyOrg, error: agencyOrgError } = agencyOrgResult;
  
  if (error) {
    if (isDev) {
      console.error('Error fetching requests:', error);
    }
    // Query error - return empty result (client will handle)
    return { requests: [], totalCount: 0 };
  }
  
  if (countError && isDev) {
    console.error('Error fetching request count:', countError);
  }
  
  // If requests is null/undefined, treat as no results (empty query result)
  const requestsData = requests || [];
  const totalCount = countError ? 0 : (count ?? 0);
  
  if (requestsData.length === 0 && totalCount === 0) {
    return { requests: [], totalCount: 0 };
  }
  
  if (clientOrgError && isDev) {
    console.error('Error fetching client organization:', clientOrgError);
    // Non-critical - we can continue with connection.client_id as fallback
  }
  
  if (agencyOrgError && isDev) {
    console.error('Error fetching agency organization:', agencyOrgError);
    // Non-critical - we can continue with connection.agency_id as fallback
  }
  
  // Fetch all unique user IDs for submitted by and assignees, unique org IDs for created_by_org_id, and unique project IDs
  const userIds = new Set<string>();
  const orgIds = new Set<string>();
  const projectIds = new Set<string>();
  requests?.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
    if (request.created_by_org_id) orgIds.add(request.created_by_org_id);
    if (request.project_id) projectIds.add(request.project_id);
  });
  
  // Fetch user profiles, memberships, organization types, and projects in parallel
  let profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  const projectMap: Record<string, { id: string; name: string }> = {};
  let parallelTime = 0;
  if (userIds.size > 0 || orgIds.size > 0 || projectIds.size > 0) {
    const userIdArray = Array.from(userIds);
    const orgIdArray = Array.from(orgIds);
    const projectIdArray = Array.from(projectIds);
    
    // Run all queries in parallel
    const parallelStartTime = isDev ? performance.now() : 0;
    const profilesPromise = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .in('id', userIdArray);
    
    const membershipsPromise = supabase
      .from('memberships')
      .select(`
        user_id,
        org_id,
        organizations!inner(
          id,
          name,
          logo_url
        )
      `)
      .in('user_id', userIdArray);
    
    const orgTypesPromise = orgIdArray.length > 0
      ? supabase
          .from('organizations')
          .select('id, type')
          .in('id', orgIdArray)
      : Promise.resolve({ data: null, error: null });
    
    const projectsPromise = projectIdArray.length > 0
      ? supabase
          .from('projects')
          .select('id, name')
          .in('id', projectIdArray)
          .is('deleted_at', null)
      : Promise.resolve({ data: null, error: null });
    
    const [profilesResult, membershipsResult, orgTypesResult, projectsResult] = await Promise.all([
      profilesPromise,
      membershipsPromise,
      orgTypesPromise,
      projectsPromise
    ]);
    parallelTime = isDev ? performance.now() - parallelStartTime : 0;
    
    // Process profiles
    if (!profilesResult.error && profilesResult.data) {
      profilesMap = profilesResult.data.reduce((acc: typeof profilesMap, profile: { id: string; first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as typeof profilesMap);
    }
    
    // Process memberships
    if (!membershipsResult.error && membershipsResult.data) {
      membershipsResult.data.forEach((membership: { user_id: string; org_id: string; organizations: { id: string; name: string; logo_url?: string } | { id: string; name: string; logo_url?: string }[] }) => {
        const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
        if (org) {
          userOrgMap[membership.user_id] = {
            orgId: org.id,
            orgName: org.name,
            orgLogo: org.logo_url || undefined
          };
        }
      });
    }
    
    // Process organization types
    if (orgTypesResult && !orgTypesResult.error && orgTypesResult.data) {
      orgTypesResult.data.forEach((org: { id: string; type: string }) => {
        if (org.type === 'agency' || org.type === 'client') {
          orgTypeMap[org.id] = org.type as 'agency' | 'client';
        }
      });
    }
    
    // Process projects
    if (projectsResult && !projectsResult.error && projectsResult.data) {
      projectsResult.data.forEach((project: { id: string; name: string }) => {
        projectMap[project.id] = { id: project.id, name: project.name };
      });
    }
  }
  
  // Map the requests to the UI format
  const formattedRequests = requestsData.map(request => {
    const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
    const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;
    const project = request.project_id ? projectMap[request.project_id] : null;
    
    return {
      id: request.id,
      connectionId: connectionId,
      title: request.title,
      description: request.description || '',
      status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
      project: project || null,
      submittedBy: formatters.buildSubmittedBy(
        request.created_by_user_id,
        submittedByProfile,
        userOrgMap
      ),
      assignee: formatters.buildAssignee(request.assignee_user_id, assigneeProfile),
      client: formatters.buildOrganization(
        clientOrg?.id || connection.client_id,
        clientOrg?.name,
        clientOrg?.logo_url,
        'Unknown Client'
      ),
      agency: formatters.buildOrganization(
        agencyOrg?.id || connection.agency_id,
        agencyOrg?.name,
        agencyOrg?.logo_url,
        'Unknown Agency'
      ),
      createdAt: formatters.formatRequestDate(request.created_at),
      createdByOrgId: request.created_by_org_id,
      createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
    };
  });
  
  if (isDev) {
    const totalTime = performance.now() - startTime;
    console.log(`[Performance] getRequestsForConnection: ${totalTime.toFixed(2)}ms (requests: ${requestsTime.toFixed(2)}ms, parallel: ${parallelTime.toFixed(2)}ms)`);
  }
  
  return { requests: formattedRequests, totalCount };
});

export const getRecentRequestsForConnection = cache(async (
  connectionId: string,
  options?: { limit?: number }
): Promise<RecentRequestSummary[]> => {
  const supabase = await createClient();
  const safeLimit = Math.max(0, options?.limit ?? 2);

  if (safeLimit === 0) {
    return [];
  }

  const { connection, error: connectionError } = await getConnectionInfo(connectionId);

  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection for recent requests:', connectionError);
    }
    return [];
  }

  const { data, error } = await supabase
    .from('requests')
    .select('id, title, created_at')
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error || !data) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching recent requests:', error);
    }
    return [];
  }

  return (data as RecentRequestRow[]).map((request) => ({
    id: request.id,
    title: (request.title || '').trim() || 'Untitled request',
    createdAt: request.created_at || ''
  }));
});

// ============================================================================
// TASKS - SUPABASE IMPLEMENTATION
// ============================================================================

type TaskRow = {
  id: string
  connection_id: string
  project_id: string | null
  title: string
  description: string | null
  status: TaskStatus
  due_date: string | null
  assignee_user_id: string | null
  client_visible: boolean | null
  created_by_user_id: string
  created_at: string
  updated_at: string | null
  source_request_id?: string | null
}

type ProfileRow = {
  id: string
  first_name: string
  last_name: string
  email: string
  avatar_url?: string
  job_title?: string
}

type MembershipRow = {
  user_id: string
  org_id: string
  organizations: {
    id: string
    name: string | null
    logo_url?: string | null
  } | Array<{
    id: string
    name: string | null
    logo_url?: string | null
  }>
}

type OrganizationRow = {
  id: string
  name?: string | null
  logo_url?: string | null
}

const TASK_STATUS_KEYWORDS: Record<string, TaskStatus> = {
  'to do': 'to_do',
  todo: 'to_do',
  open: 'to_do',
  backlog: 'to_do',
  'in progress': 'in_progress',
  progress: 'in_progress',
  active: 'in_progress',
  working: 'in_progress',
  'on hold': 'on_hold',
  hold: 'on_hold',
  paused: 'on_hold',
  blocked: 'on_hold',
  completed: 'done',
  complete: 'done',
  done: 'done',
  finished: 'done'
}

const normalizeTaskStatusQuery = (query: string): TaskStatus | null => {
  const normalized = query.toLowerCase().trim()
  return TASK_STATUS_KEYWORDS[normalized] ?? null
}

const toOrgRecord = (org: OrganizationRow | null | undefined, fallbackId: string) => ({
  id: org?.id || fallbackId,
  name: org?.name || undefined,
  logoUrl: org?.logo_url || undefined
})

async function hydrateTaskRows(
  supabase: SupabaseClient,
  rows: TaskRow[],
  connection: { client_id: string; agency_id: string },
  clientOrg?: OrganizationRow | null,
  agencyOrg?: OrganizationRow | null
): Promise<Task[]> {
  if (!rows.length) {
    return []
  }

  const projectIds = Array.from(new Set(rows.map(row => row.project_id).filter(Boolean))) as string[]
  const userIds = new Set<string>()

  rows.forEach(row => {
    if (row.created_by_user_id) userIds.add(row.created_by_user_id)
    if (row.assignee_user_id) userIds.add(row.assignee_user_id)
  })

  let projectMap: Record<string, { id: string; name?: string | null }> = {}
  if (projectIds.length > 0) {
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('id, name')
      .in('id', projectIds)
      .is('deleted_at', null)

    if (!projectsError && projectsData) {
      projectMap = projectsData.reduce((acc, project) => {
        acc[project.id] = project
        return acc
      }, {} as Record<string, { id: string; name?: string | null }>)
    } else if (projectsError && process.env.NODE_ENV !== 'production') {
      console.error('Error fetching projects while hydrating tasks:', projectsError)
    }
  }

  let profilesMap: Record<string, ProfileRow> = {}
  if (userIds.size > 0) {
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .in('id', Array.from(userIds))

    if (profilesData) {
      profilesMap = profilesData.reduce((acc, profile) => {
        acc[profile.id] = {
          id: profile.id,
          first_name: profile.first_name || '',
          last_name: profile.last_name || '',
          email: profile.email || '',
          avatar_url: profile.avatar_url || undefined,
          job_title: profile.job_title || undefined
        }
        return acc
      }, {} as Record<string, ProfileRow>)
    }
  }

  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {}
  const userOrgIds: Record<string, Set<string>> = {}

  if (userIds.size > 0) {
    const orgFilter = [connection.client_id, connection.agency_id].filter(Boolean)
    if (orgFilter.length > 0) {
      const { data: membershipsData } = await supabase
        .from('memberships')
        .select(`
          user_id,
          org_id,
          organizations!inner(
            id,
            name,
            logo_url
          )
        `)
        .in('user_id', Array.from(userIds))
        .in('org_id', orgFilter as string[])

      if (membershipsData) {
        membershipsData.forEach((membership: MembershipRow) => {
          const org = Array.isArray(membership.organizations)
            ? membership.organizations[0]
            : membership.organizations

          if (!org) return

          if (!userOrgIds[membership.user_id]) {
            userOrgIds[membership.user_id] = new Set()
          }
          userOrgIds[membership.user_id].add(org.id)

          const shouldOverride = !userOrgMap[membership.user_id] || org.id === connection.client_id
          if (shouldOverride) {
            userOrgMap[membership.user_id] = {
              orgId: org.id,
              orgName: org.name || '',
              orgLogo: org.logo_url || undefined
            }
          }
        })
      }
    }
  }

  const clientOrgInfo = toOrgRecord(clientOrg ?? null, connection.client_id)
  const agencyOrgInfo = toOrgRecord(agencyOrg ?? null, connection.agency_id)

  return rows.map(row => {
    const submittedProfile = row.created_by_user_id ? profilesMap[row.created_by_user_id] ?? null : null
    const assigneeProfile = row.assignee_user_id ? profilesMap[row.assignee_user_id] ?? null : null

    const createdOrg = row.created_by_user_id ? userOrgMap[row.created_by_user_id] : undefined
    const assigneeOrg = row.assignee_user_id ? userOrgMap[row.assignee_user_id] : undefined
    const assigneeOrgIds = row.assignee_user_id ? userOrgIds[row.assignee_user_id] : undefined

    const createdByOrgType = createdOrg?.orgId === connection.client_id
      ? 'client'
      : createdOrg?.orgId === connection.agency_id
        ? 'agency'
        : undefined

    return {
      id: row.id,
      connectionId: row.connection_id,
      title: row.title,
      description: row.description || '',
      status: row.status as TaskStatus,
      project: row.project_id && projectMap[row.project_id]
        ? { id: row.project_id, name: projectMap[row.project_id].name || '' }
        : null,
      submittedBy: formatters.buildSubmittedBy(
        row.created_by_user_id,
        submittedProfile,
        userOrgMap
      ),
      assignee: formatters.buildAssignee(
        row.assignee_user_id,
        assigneeProfile,
        assigneeOrg?.orgId
      ),
      client: formatters.buildOrganization(
        clientOrgInfo.id,
        clientOrgInfo.name,
        clientOrgInfo.logoUrl,
        'Unknown Client'
      ),
      agency: formatters.buildOrganization(
        agencyOrgInfo.id,
        agencyOrgInfo.name,
        agencyOrgInfo.logoUrl,
        'Unknown Agency'
      ),
      createdAt: formatters.formatRequestDate(row.created_at),
      createdAtRaw: row.created_at,
      updatedAt: row.updated_at ? formatters.formatRequestDate(row.updated_at) : undefined,
      dueDate: row.due_date ? formatters.formatRequestDate(row.due_date) : undefined,
      dueDateRaw: row.due_date,
      createdByUserId: row.created_by_user_id,
      createdByOrgId: createdOrg?.orgId,
      createdByOrgType,
      clientVisible: Boolean(row.client_visible),
      clientVisibilityLocked: Boolean(row.assignee_user_id && assigneeOrgIds?.has(connection.client_id))
    } satisfies Task
  })
}

export const getTasksForConnection = cache(async (
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; assignedToUserIds?: string[]; createdByUserId?: string; sortMode?: TaskSortMode }
): Promise<TasksWithCount> => {
  const isDev = process.env.NODE_ENV !== 'production'
  const supabase = await createClient()
  const { limit = 50, offset = 0, searchQuery, assignedToUserId, assignedToUserIds, createdByUserId, sortMode = 'status' } = options || {}

  const { connection, error: connectionError } = await getConnectionInfo(connectionId)

  if (connectionError || !connection) {
    if (isDev && connectionError) {
      console.error('Error fetching connection for tasks:', connectionError)
    }
    return { tasks: [], totalCount: 0 }
  }

  const clientOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.client_id)
    .single()

  const agencyOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.agency_id)
    .single()

  let projectIdsMatchingSearch: string[] = []
  if (searchQuery && searchQuery.trim().length > 0) {
    const escaped = escapeForILike(searchQuery.trim())
    const { data: matchingProjects, error: projectSearchError } = await supabase
      .from('projects')
      .select('id')
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
      .ilike('name', `%${escaped}%`)

    if (projectSearchError) {
      if (isDev) {
        console.error('Error searching projects for tasks:', projectSearchError)
      }
    } else if (matchingProjects?.length) {
      projectIdsMatchingSearch = matchingProjects.map(project => project.id)
    }
  }

  let tasksQuery = supabase
    .from('tasks')
    .select(`
      id,
      connection_id,
      project_id,
      title,
      description,
      status,
      due_date,
      assignee_user_id,
      client_visible,
      created_by_user_id,
      created_at,
      updated_at,
      source_request_id
    `, { count: 'exact' })
    .eq('connection_id', connectionId)
    .is('deleted_at', null)

  if (Array.isArray(assignedToUserIds) && assignedToUserIds.length > 0) {
    tasksQuery = tasksQuery.in('assignee_user_id', assignedToUserIds)
  } else if (assignedToUserId) {
    tasksQuery = tasksQuery.eq('assignee_user_id', assignedToUserId)
  }
  
  if (createdByUserId) {
    tasksQuery = tasksQuery.eq('created_by_user_id', createdByUserId)
  }

  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim()
    const escaped = escapeForILike(trimmedQuery)
    const statusMatch = normalizeTaskStatusQuery(trimmedQuery)
    const orParts = [`title.ilike.%${escaped}%`, `description.ilike.%${escaped}%`]

    if (statusMatch) {
      orParts.push(`status.eq.${statusMatch}`)
    }

    if (projectIdsMatchingSearch.length > 0) {
      const inClause = projectIdsMatchingSearch.map(id => `"${id}"`).join(',')
      orParts.push(`project_id.in.(${inClause})`)
    }

    tasksQuery = tasksQuery.or(orParts.join(','))
  }

  const { data: taskRows, error: tasksError, count } = await tasksQuery

  if (tasksError) {
  if (isDev) {
      console.error('Error fetching tasks:', tasksError)
    }
    return { tasks: [], totalCount: 0 }
  }

  if (!taskRows || taskRows.length === 0) {
    return { tasks: [], totalCount: count ?? 0 }
  }

  const [clientOrgResult, agencyOrgResult] = await Promise.all([clientOrgPromise, agencyOrgPromise])

  if (isDev && clientOrgResult.error) {
    console.error('Error fetching client organization for tasks:', clientOrgResult.error)
  }
  if (isDev && agencyOrgResult.error) {
    console.error('Error fetching agency organization for tasks:', agencyOrgResult.error)
  }

  const hydratedTasks = await hydrateTaskRows(
    supabase,
    taskRows as TaskRow[],
    connection,
    clientOrgResult.data ?? null,
    agencyOrgResult.data ?? null
  )

  const sortedTasks = sortTasks(hydratedTasks, sortMode)

  const safeOffset = Math.max(0, offset ?? 0)
  const safeLimit = typeof limit === 'number' ? Math.max(0, limit) : sortedTasks.length
  const paginatedTasks = safeLimit === 0
    ? []
    : sortedTasks.slice(safeOffset, safeOffset + safeLimit)

  const totalCount = count ?? sortedTasks.length

  return { tasks: paginatedTasks, totalCount }
})

const mapMembershipProfiles = (
  members: any[],
  orgDetails: { id: string; name: string; type: 'agency' | 'client' }
) => {
  return members?.map(member => {
    const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
    return {
      id: profile.id,
      firstName: profile.first_name || '',
      lastName: profile.last_name || '',
      email: profile.email || '',
      avatarUrl: profile.avatar_url || undefined,
      jobTitle: profile.job_title || undefined,
      orgId: orgDetails.id,
      orgName: orgDetails.name,
      orgType: orgDetails.type
    };
  }) || [];
};

export const getConnectionMembers = cache(async (
  connectionId: string
): Promise<{
  agencyMembers: Array<{
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
  clientMembers: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
    orgId?: string
    orgName?: string
    orgType?: 'agency' | 'client'
  }>
}> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const supabase = await createClient();
  
  // Use cached connection info (shared with getRequestsForConnection)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError || !connection) {
    if (isDev) {
      console.error('Error fetching connection for agency members:', connectionError);
    }
    return { agencyMembers: [], clientMembers: [] };
  }

  const [agencyOrgResult, clientOrgResult] = await Promise.all([
    connection.agency_id
      ? supabase
          .from('organizations')
          .select('id, name')
          .eq('id', connection.agency_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    connection.client_id
      ? supabase
          .from('organizations')
          .select('id, name')
          .eq('id', connection.client_id)
          .single()
      : Promise.resolve({ data: null, error: null })
  ])

  if (isDev && agencyOrgResult.error) {
    console.error('Error fetching agency organization:', agencyOrgResult.error)
  }

  if (isDev && clientOrgResult.error) {
    console.error('Error fetching client organization:', clientOrgResult.error)
  }

  const agencyOrgName = agencyOrgResult.data?.name || 'Agency member'
  const clientOrgName = clientOrgResult.data?.name || 'Client member'
  
  // Fetch agency members
  const { data: members, error: membersError } = await supabase
    .from('memberships')
    .select(`
      org_id,
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        job_title,
        deleted_at
      )
    `)
    .eq('org_id', connection.agency_id)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');
  
  if (membersError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching agency members:', membersError);
    }
    return { agencyMembers: [], clientMembers: [] };
  }
  
  const agencyMembers = mapMembershipProfiles(members || [], {
    id: connection.agency_id,
    name: agencyOrgName,
    type: 'agency'
  });

  // Fetch client members
  const { data: clientMembersData, error: clientMembersError } = await supabase
    .from('memberships')
    .select(`
      org_id,
      profiles!inner(
        id,
        first_name,
        last_name,
        email,
        avatar_url,
        job_title,
        deleted_at
      )
    `)
    .eq('org_id', connection.client_id)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');

  if (clientMembersError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching client members:', clientMembersError);
    }
    return { agencyMembers, clientMembers: [] };
  }

  const clientMembers = mapMembershipProfiles(clientMembersData || [], {
    id: connection.client_id,
    name: clientOrgName,
    type: 'client'
  });

  return { agencyMembers, clientMembers };
});

export const getAgencyMembersForConnection = cache(async (
  connectionId: string
) => {
  const { agencyMembers } = await getConnectionMembers(connectionId)
  return agencyMembers
})

export const getClientMembersForConnection = cache(async (
  connectionId: string
) => {
  const { clientMembers } = await getConnectionMembers(connectionId)
  return clientMembers
})

/**
 * Get the partner organization name for a connection.
 * Returns the name of the organization we're connected to (client if viewing as agency, agency if viewing as client).
 */
export const getConnectionPartnerName = cache(async (
  connectionId: string,
  context: EnhancedModeContext
): Promise<string | null> => {
  const supabase = await createClient();

  if (context.variant === 'agency') {
    // Agency viewing client - get client organization name
    const { data: connection, error } = await supabase
      .from('connections')
      .select(`
        client_id,
        organizations!connections_client_id_fkey (
          name
        )
      `)
      .eq('id', connectionId)
      .eq('agency_id', context.orgId)
      .single();

    if (error || !connection) return null;
    
    const clientOrg = Array.isArray(connection.organizations) 
      ? connection.organizations[0] 
      : connection.organizations;
    
    return clientOrg?.name || null;
  } else {
    // Client viewing agency - get agency organization name
    const { data: connection, error } = await supabase
      .from('connections')
      .select(`
        agency_id,
        organizations!connections_agency_id_fkey (
          name
        )
      `)
      .eq('id', connectionId)
      .eq('client_id', context.orgId)
      .single();

    if (error || !connection) return null;
    
    const agencyOrg = Array.isArray(connection.organizations) 
      ? connection.organizations[0] 
      : connection.organizations;
    
    return agencyOrg?.name || null;
  }
});

export const getRequestById = cache(async (
  requestId: string,
  connectionId: string
): Promise<Request | null> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getRequestById called with:', { requestId, connectionId });
  }
  
  // Fetch the connection to get client_id and agency_id
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('client_id, agency_id')
    .eq('id', connectionId)
    .single();
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection:', {
        error: connectionError,
        connectionId,
        connection,
        errorDetails: connectionError ? {
          message: connectionError.message,
          details: connectionError.details,
          hint: connectionError.hint,
          code: connectionError.code
        } : null
      });
    }
    return null;
  }
  
  // Fetch client and agency organization details in parallel
  const [clientOrgResult, agencyOrgResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', connection.client_id)
      .single(),
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', connection.agency_id)
      .single()
  ]);
  
  const { data: clientOrg, error: clientOrgError } = clientOrgResult;
  const { data: agencyOrg, error: agencyOrgError } = agencyOrgResult;
  
  if (clientOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching client organization:', clientOrgError);
  }
  
  if (agencyOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching agency organization:', agencyOrgError);
  }
  
  // Fetch the specific request
  const { data: request, error } = await supabase
    .from('requests')
    .select(`
      id,
      title,
      description,
      status,
      project_id,
      created_by_user_id,
      assignee_user_id,
      created_at,
      created_by_org_id,
      connection_id
    `)
    .eq('id', requestId)
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .single();
  
  if (error || !request) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching request:', {
        error,
        requestId,
        connectionId,
        request,
        message: error?.message || 'Request not found or does not belong to connection'
      });
    }
    return null;
  }
  
  // Verify the request belongs to the connection (safety check)
  if (request.connection_id !== connectionId) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Request connection mismatch:', {
        requestConnectionId: request.connection_id,
        providedConnectionId: connectionId
      });
    }
    return null;
  }
  
  // Fetch user IDs needed
  const userIds = new Set<string>();
  if (request.created_by_user_id) userIds.add(request.created_by_user_id);
  if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  
  // Fetch user profiles, memberships, org type, and project in parallel
  let profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  let userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  let orgType: 'agency' | 'client' | undefined = undefined;
  let project: { id: string; name: string } | null = null;
  
  // Prepare parallel queries
  const profilesPromise = userIds.size > 0
    ? supabase
        .from('profiles')
        .select('id, first_name, last_name, email, avatar_url, job_title')
        .in('id', Array.from(userIds))
    : Promise.resolve({ data: null, error: null });
  
  const membershipsPromise = userIds.size > 0
    ? supabase
        .from('memberships')
        .select(`
          user_id,
          org_id,
          organizations!inner(
            id,
            name,
            logo_url
          )
        `)
        .in('user_id', Array.from(userIds))
    : Promise.resolve({ data: null, error: null });
  
  const orgTypePromise = request.created_by_org_id
    ? supabase
        .from('organizations')
        .select('type')
        .eq('id', request.created_by_org_id)
        .single()
    : Promise.resolve({ data: null, error: null });
  
  const projectPromise = request.project_id
    ? supabase
        .from('projects')
        .select('id, name')
        .eq('id', request.project_id)
        .is('deleted_at', null)
        .single()
    : Promise.resolve({ data: null, error: null });
  
  // Execute all queries in parallel
  const [profilesResult, membershipsResult, orgTypeResult, projectResult] = await Promise.all([
    profilesPromise,
    membershipsPromise,
    orgTypePromise,
    projectPromise
  ]);
  
  // Process profiles
  if (!profilesResult.error && profilesResult.data) {
    profilesMap = profilesResult.data.reduce((acc, profile) => {
      acc[profile.id] = profile;
      return acc;
    }, {} as typeof profilesMap);
  }
  
  // Process memberships
  if (!membershipsResult.error && membershipsResult.data) {
    membershipsResult.data.forEach(membership => {
      const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
      if (org) {
        userOrgMap[membership.user_id] = {
          orgId: org.id,
          orgName: org.name,
          orgLogo: org.logo_url || undefined
        };
      }
    });
  }
  
  // Process org type
  if (!orgTypeResult.error && orgTypeResult.data) {
    orgType = orgTypeResult.data.type as 'agency' | 'client' | undefined;
  }
  
  // Process project
  if (!projectResult.error && projectResult.data) {
    project = { id: projectResult.data.id, name: projectResult.data.name };
  }
  
  const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
  const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;

  return {
    id: request.id,
    connectionId: connectionId,
    title: request.title,
    description: request.description || '',
    status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
    project: project || null,
    submittedBy: formatters.buildSubmittedBy(
      request.created_by_user_id,
      submittedByProfile,
      userOrgMap
    ),
    assignee: formatters.buildAssignee(request.assignee_user_id, assigneeProfile),
    client: formatters.buildOrganization(
      clientOrg?.id || connection.client_id,
      clientOrg?.name,
      clientOrg?.logo_url,
      'Unknown Client'
    ),
    agency: formatters.buildOrganization(
      agencyOrg?.id || connection.agency_id,
      agencyOrg?.name,
      agencyOrg?.logo_url,
      'Unknown Agency'
    ),
    createdAt: formatters.formatRequestDate(request.created_at),
    createdByOrgId: request.created_by_org_id,
    createdByOrgType: orgType
  };
});

export const getTaskById = cache(async (
  taskId: string,
  connectionId: string
): Promise<Task | null> => {
  const isDev = process.env.NODE_ENV !== 'production'
  const supabase = await createClient()

  const { connection, error: connectionError } = await getConnectionInfo(connectionId)

  if (connectionError || !connection) {
    if (isDev && connectionError) {
      console.error('Error fetching connection for task detail:', connectionError)
    }
    return null
  }

  const [clientOrgResult, agencyOrgResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', connection.client_id)
      .single(),
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', connection.agency_id)
      .single()
  ])

  const { data: taskRows, error: taskError } = await supabase
    .from('tasks')
    .select(`
      id,
      connection_id,
      project_id,
      title,
      description,
      status,
      due_date,
      assignee_user_id,
      client_visible,
      created_by_user_id,
      created_at,
      updated_at,
      source_request_id
    `)
    .eq('id', taskId)
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .limit(1)

  if (taskError) {
    if (isDev) {
      console.error('Error fetching task by id:', taskError)
    }
    return null
  }

  if (!taskRows || taskRows.length === 0) {
    return null
  }

  const tasks = await hydrateTaskRows(
    supabase,
    taskRows as TaskRow[],
    connection,
    clientOrgResult.data ?? null,
    agencyOrgResult.data ?? null
  )

  return tasks[0] ?? null
})

export interface Comment {
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}

/**
 * Get all comments for a request, excluding soft-deleted ones
 */
export const getCommentsForRequest = cache(async (
  requestId: string
): Promise<Comment[]> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getCommentsForRequest called with:', { requestId });
  }
  
  const { data: comments, error } = await supabase
    .from('request_comments')
    .select(`
      id,
      body,
      created_at,
      created_by_user_id,
      profiles!request_comments_created_by_user_id_fkey (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('request_id', requestId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching comments:', error);
    }
    return [];
  }
  
  if (!comments || comments.length === 0) {
    return [];
  }
  
  // Transform the data to match the Comment interface
  const formattedComments: Comment[] = comments.map(comment => {
    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';
    
    return {
      id: comment.id,
      userId: comment.created_by_user_id,
      userName: fullName,
      userAvatar: profile?.avatar_url || undefined,
      createdAt: new Date(comment.created_at),
      text: comment.body
    };
  });
  
  return formattedComments;
});

/**
 * Get all comments for multiple requests, excluding soft-deleted ones
 * Returns a map keyed by requestId for instant lookup
 */
export const getCommentsForRequests = cache(async (
  requestIds: string[]
): Promise<Record<string, Comment[]>> => {
  if (!requestIds.length) {
    return {};
  }

  const supabase = await createClient();

  if (process.env.NODE_ENV !== 'production') {
    console.log('getCommentsForRequests called with:', { requestIds: requestIds.length });
  }

  const { data: comments, error } = await supabase
    .from('request_comments')
    .select(`
      id,
      body,
      created_at,
      created_by_user_id,
      request_id,
      profiles!request_comments_created_by_user_id_fkey (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .in('request_id', requestIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching comments:', error);
    }
    return {};
  }

  if (!comments || comments.length === 0) {
    return {};
  }

  // Transform the data to match the Comment interface and group by request_id
  const groupedComments: Record<string, Comment[]> = {};

  comments.forEach(comment => {
    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    const formattedComment: Comment = {
      id: comment.id,
      userId: comment.created_by_user_id,
      userName: fullName,
      userAvatar: profile?.avatar_url || undefined,
      createdAt: new Date(comment.created_at),
      text: comment.body
    };

    const requestId = comment.request_id;
    if (!groupedComments[requestId]) {
      groupedComments[requestId] = [];
    }
    groupedComments[requestId].push(formattedComment);
  });

  return groupedComments;
});

/**
 * Get all comments for a task, excluding soft-deleted ones
 * MOCK DATA: Returns empty array until task_comments table is created in Supabase
 */
export const getCommentsForTask = cache(async (
  taskId: string
): Promise<Comment[]> => {
  const supabase = await createClient();
  
  const { data: comments, error } = await supabase
    .from('task_comments')
    .select(`
      id,
      body,
      created_at,
      created_by_user_id,
      profiles!task_comments_created_by_user_id_fkey (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('task_id', taskId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error || !comments) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching task comments:', error);
    }
  return [];
  }
  
  return comments.map(comment => {
    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';
    
    return {
      id: comment.id,
      userId: comment.created_by_user_id,
      userName: fullName,
      userAvatar: profile?.avatar_url || undefined,
      createdAt: new Date(comment.created_at),
      text: comment.body
    } satisfies Comment;
  });
});

/**
 * Get all comments for multiple tasks, excluding soft-deleted ones
 * Returns a map keyed by taskId for instant lookup
 * MOCK DATA: Returns empty object until task_comments table is created in Supabase
 */
export const getCommentsForTasks = cache(async (
  taskIds: string[]
): Promise<Record<string, Comment[]>> => {
  if (!taskIds.length) {
    return {};
  }

  const supabase = await createClient();

  const { data: comments, error } = await supabase
    .from('task_comments')
    .select(`
      id,
      body,
      created_at,
      created_by_user_id,
      task_id,
      profiles!task_comments_created_by_user_id_fkey (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .in('task_id', taskIds)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error || !comments) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching task comments map:', error);
    }
  return {};
  }

  const grouped: Record<string, Comment[]> = {};

  comments.forEach(comment => {
    const profile = Array.isArray(comment.profiles) ? comment.profiles[0] : comment.profiles;
    const firstName = profile?.first_name || '';
    const lastName = profile?.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || 'Unknown User';

    const formatted: Comment = {
      id: comment.id,
      userId: comment.created_by_user_id,
      userName: fullName,
      userAvatar: profile?.avatar_url || undefined,
      createdAt: new Date(comment.created_at),
      text: comment.body
    };

    const taskId = comment.task_id;
    if (!grouped[taskId]) {
      grouped[taskId] = [];
    }
    grouped[taskId].push(formatted);
  });

  return grouped;
});

// ============================================================================
// PROJECTS - PLACEHOLDER FUNCTIONS WITH MOCK DATA
// ============================================================================
// NOTE: These functions return mock data until the projects table is created in Supabase.
// When the table exists, replace these implementations with real Supabase queries.

export interface Project {
  id: string
  connectionId: string
  title: string
  description: string
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
  type: string | null
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
  startDate: string
  endDate: string
  createdAt: string
  requestsCount: number
  tasksCount: number
  createdByOrgId: string
  createdByOrgType?: 'agency' | 'client'
}

export interface ProjectsWithCount {
  projects: Project[]
  totalCount: number
}

// Mock Project data for UI development
const generateMockProjects = (connectionId: string, count: number = 10): Project[] => {
  const mockProjects: Project[] = []
  const statuses: Array<'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'> = ['planned', 'active', 'on_hold', 'completed', 'canceled']
  
  for (let i = 0; i < count; i++) {
    const daysAgo = Math.floor(Math.random() * 90)
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - daysAgo)
    
    // Generate a random start date (between 0-120 days ago)
    const startDaysAgo = Math.floor(Math.random() * 120)
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - startDaysAgo)
    
    // Generate a random end date (between startDate and 180 days in the future)
    const endDaysAgo = Math.floor(Math.random() * 180) - Math.floor(Math.random() * 60)
    const endDate = new Date()
    endDate.setDate(endDate.getDate() - endDaysAgo)
    
    mockProjects.push({
      id: `mock-project-${i + 1}`,
      connectionId,
      title: `Mock Project ${i + 1}`,
      description: `This is a mock project description ${i + 1}. Used for UI development until the projects table is created in Supabase.`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      type: i % 3 === 0 ? 'general' : null,
      submittedBy: {
        id: `mock-user-${i % 3}`,
        name: `User ${i % 3 + 1}`,
        email: `user${i % 3 + 1}@example.com`,
        avatarUrl: undefined,
        jobTitle: 'Developer',
        orgId: 'mock-org-1',
        orgName: 'Mock Organization',
        orgLogo: undefined
      },
      assignee: i % 2 === 0 ? {
        id: 'mock-assignee-1',
        name: 'Assigned User',
        email: 'assignee@example.com',
        avatarUrl: undefined
      } : null,
      client: {
        id: 'mock-client-1',
        name: 'Mock Client',
        logoUrl: undefined
      },
      agency: {
        id: 'mock-agency-1',
        name: 'Mock Agency',
        logoUrl: undefined
      },
      startDate: formatters.formatRequestDate(startDate.toISOString()),
      endDate: formatters.formatRequestDate(endDate.toISOString()),
      createdAt: formatters.formatRequestDate(createdAt.toISOString()),
      requestsCount: Math.floor(Math.random() * 20) + 1, // Random number between 1-20
      tasksCount: Math.floor(Math.random() * 15) + 1, // Random number between 1-15
      createdByOrgId: 'mock-org-1',
      createdByOrgType: i % 2 === 0 ? 'agency' : 'client'
    })
  }
  
  return mockProjects
}

export const getProjectsForConnection = cache(async (
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string; sort?: string }
): Promise<ProjectsWithCount> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const startTime = isDev ? performance.now() : 0;
  const { limit = 50, offset = 0, searchQuery, assignedToUserId, createdByUserId, sort = 'newest_first' } = options || {};
  const supabase = await createClient();
  
  // Fetch the connection info (cached, shared with getAgencyMembersForConnection)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError) {
    if (isDev) {
      console.error('Error fetching connection:', connectionError);
    }
    // Return empty result - connection error means we can't proceed
    return { projects: [], totalCount: 0 };
  }
  
  if (!connection) {
    // Connection not found - return empty result
    return { projects: [], totalCount: 0 };
  }
  
  // Fetch client and agency organization details (can run in parallel with projects query)
  const clientOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.client_id)
    .single();
  
  const agencyOrgPromise = supabase
    .from('organizations')
    .select('id, name, logo_url, currency_code')
    .eq('id', connection.agency_id)
    .single();
  
  // Fetch projects and orgs in parallel
  const projectsStartTime = isDev ? performance.now() : 0;
  
  // Normalize search query for project status matching
  const normalizeProjectStatusQuery = (query: string): string | null => {
    const normalized = query.toLowerCase().trim();
    const PROJECT_STATUS_KEYWORDS: Record<string, 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'> = {
      planned: 'planned',
      plan: 'planned',
      planning: 'planned',
      active: 'active',
      'on hold': 'on_hold',
      onhold: 'on_hold',
      on_hold: 'on_hold',
      hold: 'on_hold',
      paused: 'on_hold',
      completed: 'completed',
      complete: 'completed',
      done: 'completed',
      finished: 'completed',
      canceled: 'canceled',
      cancelled: 'canceled',
      cancel: 'canceled'
    };
    return PROJECT_STATUS_KEYWORDS[normalized] ?? null;
  };
  
  // Build the base query for filtering (used for both count and data)
  let baseQuery = supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('connection_id', connectionId)
    .is('deleted_at', null);
  
  // Apply search filter if searchQuery is provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeProjectStatusQuery(trimmedQuery);
    
    // Build OR list for search
    const orParts: string[] = [];
    orParts.push(`name.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    baseQuery = baseQuery.or(orParts.join(','));
  }
  
  // Note: assignedToUserId and createdByUserId filters will be handled later
  
  // Build the projects query for fetching data
  // Note: Only selecting columns that exist in the schema
  // assignee_user_id and created_by_org_id may not exist yet
  let projectsQuery = supabase
    .from('projects')
    .select(`
      id,
      name,
      description,
      status,
      start_date,
      end_date,
      created_by_user_id,
      created_at
    `)
    .eq('connection_id', connectionId)
    .is('deleted_at', null);
  
  // Apply search filter if searchQuery is provided
  if (searchQuery && searchQuery.trim().length > 0) {
    const trimmedQuery = searchQuery.trim();
    const escaped = escapeForILike(trimmedQuery);
    const matchedStatus = normalizeProjectStatusQuery(trimmedQuery);
    
    // Build OR list for search
    const orParts: string[] = [];
    orParts.push(`name.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    projectsQuery = projectsQuery.or(orParts.join(','));
  }
  
  // Note: assignedToUserId and createdByUserId filters will be added later
  
  // Apply sorting based on sort parameter
  let orderedQuery = projectsQuery;
  switch (sort) {
    case 'newest_first':
      orderedQuery = projectsQuery.order('created_at', { ascending: false });
      break;
    case 'project_asc':
      orderedQuery = projectsQuery.order('name', { ascending: true });
      break;
    case 'project_desc':
      orderedQuery = projectsQuery.order('name', { ascending: false });
      break;
    case 'end_date_asc':
      // Order by end_date ascending (soonest first)
      // Projects without end dates (nulls) will sort last, and be sorted by created_at (newest first) as secondary sort
      orderedQuery = projectsQuery
        .order('end_date', { ascending: true })
        .order('created_at', { ascending: false });
      break;
    default:
      // Default to newest first
      orderedQuery = projectsQuery.order('created_at', { ascending: false });
  }
  
  const [countResult, projectsResult, clientOrgResult, agencyOrgResult] = await Promise.all([
    baseQuery,
    orderedQuery.range(offset, offset + limit - 1),
    clientOrgPromise,
    agencyOrgPromise
  ]);
  
  const projectsTime = isDev ? performance.now() - projectsStartTime : 0;
  const { data: projects, error } = projectsResult;
  const { count, error: countError } = countResult;
  const { data: clientOrg, error: clientOrgError } = clientOrgResult;
  const { data: agencyOrg, error: agencyOrgError } = agencyOrgResult;
  
  if (error) {
    if (isDev) {
      console.error('Error fetching projects:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
        connectionId
      });
    }
    // Query error - return empty result
    return { projects: [], totalCount: 0 };
  }
  
  if (countError && isDev) {
    console.error('Error fetching project count:', countError);
  }
  
  // If projects is null/undefined, treat as no results
  const projectsData = projects || [];
  const totalCount = countError ? 0 : (count ?? 0);
  
  if (projectsData.length === 0 && totalCount === 0) {
    return { projects: [], totalCount: 0 };
  }
  
  if (clientOrgError && isDev) {
    console.error('Error fetching client organization:', clientOrgError);
    // Non-critical - we can continue with connection.client_id as fallback
  }
  
  if (agencyOrgError && isDev) {
    console.error('Error fetching agency organization:', agencyOrgError);
    // Non-critical - we can continue with connection.agency_id as fallback
  }
  
  // Get currency code from agency org (default to EUR)
  const currencyCode = (agencyOrg?.currency_code as 'EUR' | 'USD' | 'GBP') || 'EUR';
  
  // Fetch all unique user IDs for submitted by
  // Fetch unique user IDs (assignee_user_id and created_by_org_id columns do not exist in schema)
  const userIds = new Set<string>();
  projectsData?.forEach(project => {
    if (project.created_by_user_id) userIds.add(project.created_by_user_id);
    // Note: assignee_user_id column does not exist in schema
  });
  
  // Fetch user profiles and memberships in parallel
  // Note: created_by_org_id column does not exist in schema, so we don't fetch org types
  let profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {}; // Empty since created_by_org_id doesn't exist
  let parallelTime = 0;
  if (userIds.size > 0) {
    const userIdArray = Array.from(userIds);
    
    // Run all queries in parallel
    const parallelStartTime = isDev ? performance.now() : 0;
    const profilesPromise = supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .in('id', userIdArray);
    
    const membershipsPromise = supabase
      .from('memberships')
      .select(`
        user_id,
        org_id,
        organizations!inner(
          id,
          name,
          logo_url
        )
      `)
      .in('user_id', userIdArray);
    
    const [profilesResult, membershipsResult] = await Promise.all([
      profilesPromise,
      membershipsPromise
    ]);
    parallelTime = isDev ? performance.now() - parallelStartTime : 0;
    
    // Process profiles
    if (!profilesResult.error && profilesResult.data) {
      profilesMap = profilesResult.data.reduce((acc: typeof profilesMap, profile: { id: string; first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as typeof profilesMap);
    }
    
    // Process memberships
    if (!membershipsResult.error && membershipsResult.data) {
      membershipsResult.data.forEach((membership: { user_id: string; org_id: string; organizations: { id: string; name: string; logo_url?: string } | { id: string; name: string; logo_url?: string }[] }) => {
        const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
        if (org) {
          userOrgMap[membership.user_id] = {
            orgId: org.id,
            orgName: org.name,
            orgLogo: org.logo_url || undefined
          };
        }
      });
    }
    // Note: No organization types to process since created_by_org_id doesn't exist in schema
  }
  
  // Fetch requests counts for all projects in parallel
  const projectIds = projectsData.map(p => p.id);
  let requestsCountMap: Record<string, number> = {};
  
  if (projectIds.length > 0) {
    const requestsCountStartTime = isDev ? performance.now() : 0;
    
    // Query all requests for these projects in a single query
    const { data: requestsData, error: requestsError } = await supabase
      .from('requests')
      .select('project_id')
      .in('project_id', projectIds)
      .eq('connection_id', connectionId)
      .is('deleted_at', null);
    
    if (!requestsError && requestsData) {
      // Group by project_id and count
      requestsData.forEach(request => {
        if (request.project_id) {
          requestsCountMap[request.project_id] = (requestsCountMap[request.project_id] || 0) + 1;
        }
      });
    }
    
    if (isDev && requestsError) {
      console.error('Error fetching requests counts:', requestsError);
    }
    
    const requestsCountTime = isDev ? performance.now() - requestsCountStartTime : 0;
    if (isDev && requestsCountTime > 0) {
      console.log(`[Performance] Requests count query: ${requestsCountTime.toFixed(2)}ms`);
    }
  }
  
  // Map the projects to the UI format
  const formattedProjects = projectsData.map(project => {
    const submittedByProfile = project.created_by_user_id ? profilesMap[project.created_by_user_id] : null;
    // Note: assignee_user_id column does not exist in schema, so assignee is always null
    const assigneeUserId = null;
    const assigneeProfile = null;
    
    // Format dates
    const startDate = formatters.formatProjectDate(project.start_date);
    const endDate = formatters.formatProjectDate(project.end_date);
    const createdAt = formatters.formatRequestDate(project.created_at);
    
    // Get requests count for this project
    const requestsCount = requestsCountMap[project.id] || 0;
    
    return {
      id: project.id,
      connectionId: connectionId,
      title: project.name,
      description: project.description || '',
      status: project.status as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled',
      type: null, // TODO: Add type field if needed
      submittedBy: formatters.buildSubmittedBy(
        project.created_by_user_id,
        submittedByProfile,
        userOrgMap
      ),
      assignee: formatters.buildAssignee(assigneeUserId as string | null, assigneeProfile),
      client: formatters.buildOrganization(
        clientOrg?.id || connection.client_id,
        clientOrg?.name,
        clientOrg?.logo_url,
        'Unknown Client'
      ),
      agency: formatters.buildOrganization(
        agencyOrg?.id || connection.agency_id,
        agencyOrg?.name,
        agencyOrg?.logo_url,
        'Unknown Agency'
      ),
      startDate: startDate,
      endDate: endDate,
      createdAt: createdAt,
      requestsCount: requestsCount,
      tasksCount: 0, // TODO: Fetch actual count when tasks are linked to projects
      createdByOrgId: '', // Note: created_by_org_id column does not exist in schema
      createdByOrgType: undefined // Note: created_by_org_id column does not exist in schema
    };
  });
  
  if (isDev) {
    const totalTime = performance.now() - startTime;
    console.log(`[Performance] getProjectsForConnection: ${totalTime.toFixed(2)}ms (projects: ${projectsTime.toFixed(2)}ms, parallel: ${parallelTime.toFixed(2)}ms)`);
  }
  
  return { projects: formattedProjects, totalCount };
});

export const getProjectById = cache(async (
  projectId: string,
  connectionId: string
): Promise<Project | null> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getProjectById called with:', { projectId, connectionId });
  }
  
  // Fetch the connection to get client_id and agency_id
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('client_id, agency_id')
    .eq('id', connectionId)
    .single();
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection:', {
        error: connectionError,
        connectionId,
        connection,
        errorDetails: connectionError ? {
          message: connectionError.message,
          details: connectionError.details,
          hint: connectionError.hint,
          code: connectionError.code
        } : null
      });
    }
    return null;
  }
  
  // Fetch client and agency organization details in parallel
  const [clientOrgResult, agencyOrgResult] = await Promise.all([
    supabase
      .from('organizations')
      .select('id, name, logo_url')
      .eq('id', connection.client_id)
      .single(),
    supabase
      .from('organizations')
      .select('id, name, logo_url, currency_code')
      .eq('id', connection.agency_id)
      .single()
  ]);
  
  const { data: clientOrg, error: clientOrgError } = clientOrgResult;
  const { data: agencyOrg, error: agencyOrgError } = agencyOrgResult;
  
  if (clientOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching client organization:', clientOrgError);
  }
  
  if (agencyOrgError && process.env.NODE_ENV !== 'production') {
    console.error('Error fetching agency organization:', agencyOrgError);
  }
  
  // Get currency code from agency org (default to EUR)
  const currencyCode = (agencyOrg?.currency_code as 'EUR' | 'USD' | 'GBP') || 'EUR';
  
  // Fetch the specific project
  // Note: Only selecting columns that exist in the schema
  const { data: project, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      description,
      status,
      start_date,
      end_date,
      created_by_user_id,
      created_at,
      connection_id
    `)
    .eq('id', projectId)
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .single();
  
  if (error || !project) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching project:', {
        error,
        projectId,
        connectionId,
        project,
        message: error?.message || 'Project not found or does not belong to connection'
      });
    }
    return null;
  }
  
  // Verify the project belongs to the connection (safety check)
  if (project.connection_id !== connectionId) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Project connection mismatch:', {
        projectConnectionId: project.connection_id,
        providedConnectionId: connectionId
      });
    }
    return null;
  }
  
  // Fetch user IDs needed
  const userIds = new Set<string>();
  if (project.created_by_user_id) userIds.add(project.created_by_user_id);
  // Note: assignee_user_id column does not exist in schema
  
  // Fetch user profiles
  let profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  
  if (userIds.size > 0) {
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email, avatar_url, job_title')
      .in('id', Array.from(userIds));
    
    if (!profilesError && profiles) {
      profilesMap = profiles.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as typeof profilesMap);
    }
  }
  
  // Fetch organization IDs for each user from memberships
  let userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  
  if (userIds.size > 0) {
    const { data: memberships, error: membershipsError } = await supabase
      .from('memberships')
      .select(`
        user_id,
        org_id,
        organizations!inner(
          id,
          name,
          logo_url
        )
      `)
      .in('user_id', Array.from(userIds));
    
    if (!membershipsError && memberships) {
      memberships.forEach(membership => {
        const org = Array.isArray(membership.organizations) ? membership.organizations[0] : membership.organizations;
        if (org) {
          userOrgMap[membership.user_id] = {
            orgId: org.id,
            orgName: org.name,
            orgLogo: org.logo_url || undefined
          };
        }
      });
    }
  }
  
  const submittedByProfile = project.created_by_user_id ? profilesMap[project.created_by_user_id] : null;
  // Note: assignee_user_id column does not exist in schema, so assignee is always null
  const assigneeUserId = null;
  const assigneeProfile = null;
  
  // Note: created_by_org_id column does not exist in schema, so orgType is always undefined
  const orgType: 'agency' | 'client' | undefined = undefined;
  
  // Fetch requests count for this project
  let requestsCount = 0;
  const { count: requestsCountResult, error: requestsCountError } = await supabase
    .from('requests')
    .select('*', { count: 'exact', head: true })
    .eq('project_id', project.id)
    .eq('connection_id', connectionId)
    .is('deleted_at', null);
  
  if (!requestsCountError && requestsCountResult !== null) {
    requestsCount = requestsCountResult;
  }
  
  if (process.env.NODE_ENV !== 'production' && requestsCountError) {
    console.error('Error fetching requests count for project:', requestsCountError);
  }
  
  // Format dates
  const startDate = formatters.formatProjectDate(project.start_date);
  const endDate = formatters.formatProjectDate(project.end_date);
  const createdAt = formatters.formatRequestDate(project.created_at);
  
  return {
    id: project.id,
    connectionId: connectionId,
    title: project.name,
    description: project.description || '',
    status: project.status as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled',
    type: null, // TODO: Add type field if needed
    submittedBy: formatters.buildSubmittedBy(
      project.created_by_user_id,
      submittedByProfile,
      userOrgMap
    ),
    assignee: formatters.buildAssignee(assigneeUserId as string | null, assigneeProfile),
    client: formatters.buildOrganization(
      clientOrg?.id || connection.client_id,
      clientOrg?.name,
      clientOrg?.logo_url,
      'Unknown Client'
    ),
    agency: formatters.buildOrganization(
      agencyOrg?.id || connection.agency_id,
      agencyOrg?.name,
      agencyOrg?.logo_url,
      'Unknown Agency'
    ),
    startDate: startDate,
    endDate: endDate,
    createdAt: createdAt,
    requestsCount: requestsCount,
    tasksCount: 0, // TODO: Fetch actual count when tasks are linked to projects
    createdByOrgId: '', // Note: created_by_org_id column does not exist in schema
    createdByOrgType: undefined // Note: created_by_org_id column does not exist in schema
  };
});

export const getCommentsForProject = cache(async (
  projectId: string
): Promise<Array<{
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}>> => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    console.log('[Projects] getCommentsForProject called (MOCK DATA):', { projectId });
  }
  
  // Return empty array for now - comments can be added later
  return []
});

export const getCommentsForProjects = cache(async (
  projectIds: string[]
): Promise<Record<string, Array<{
  id: string
  userId: string
  userName: string
  userAvatar?: string
  createdAt: Date
  text: string
}>>> => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    console.log('[Projects] getCommentsForProjects called (MOCK DATA):', { projectIds });
  }
  
  // Return empty map for now - comments can be added later
  const result: Record<string, Array<{
    id: string
    userId: string
    userName: string
    userAvatar?: string
    createdAt: Date
    text: string
  }>> = {}
  
  projectIds.forEach(id => {
    result[id] = []
  })
  
  return result
});

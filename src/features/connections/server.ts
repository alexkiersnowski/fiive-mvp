import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import { getActiveContext, type EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import * as formatters from './formatters';

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
    // For clients, check that connection_status is 'connected' or 'disconnected'
    // This prevents access to connection pages before the agency has claimed their organization
    // but allows access to disconnected connections (previously connected)
    const { data, error } = await supabase
      .from('connections')
      .select('id, connection_status')
      .eq('id', connectionId)
      .eq('client_id', context.orgId)
      .in('connection_status', ['connected', 'disconnected'])
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
        invited_email,
        invited_at,
        invite_token,
        organizations!connections_client_id_fkey (
          id,
          name,
          logo_url,
          description,
          website,
          industry,
          connection_code
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
        invited_email,
        invited_at,
        invite_token,
        organizations!connections_agency_id_fkey (
          id,
          name,
          logo_url,
          description,
          website,
          industry,
          connection_code
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
    connection_code?: string;
  } | null;
  
  // Calculate IDs for parallel fetching
  const clientId = currentUserType === 'agency' ? connection.client_id : context.orgId;
  const agencyId = currentUserType === 'agency' ? context.orgId : connection.agency_id;
  
  // Parallelize ALL independent fetches (major performance optimization)
  // Fetch agency org, client primary contact, agency primary contact, members, and new requests count in parallel
  // For client view, also fetch live projects count, next delivery date, requests in review count, and tasks assigned count
  const [
    agencyOrgResult,
    clientPrimaryContactResult,
    agencyPrimaryContactResult,
    clientMembersResult,
    agencyMembersResult,
    newRequestsCountResult,
    liveProjectsResult,
    requestsInReviewResult,
    tasksAssignedResult
  ] = await Promise.all([
    // Agency organization (always needed)
    supabase
      .from('organizations')
      .select('id, name, logo_url, currency_code')
      .eq('id', connection.agency_id)
      .single(),
    // Client primary contact (conditional)
    connection.client_primary_contact_id
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .eq('id', connection.client_primary_contact_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    // Agency primary contact (conditional)
    connection.agency_primary_contact_id
      ? supabase
          .from('profiles')
          .select('id, first_name, last_name, email, avatar_url, job_title')
          .eq('id', connection.agency_primary_contact_id)
          .single()
      : Promise.resolve({ data: null, error: null }),
    // Client members
    supabase
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
      .order('profiles(first_name)'),
    // Agency members
    supabase
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
      .order('profiles(first_name)'),
    // New requests count (only for agency view)
    currentUserType === 'agency'
      ? supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('connection_id', connectionId)
          .eq('status', 'new')
          .is('deleted_at', null)
      : Promise.resolve({ count: null, error: null }),
    // Live projects count and next delivery date (only for client view)
    currentUserType === 'client'
      ? supabase
          .from('projects')
          .select('end_date')
          .eq('connection_id', connectionId)
          .in('status', ['planned', 'active', 'on_hold'])
          .is('deleted_at', null)
      : Promise.resolve({ data: null, error: null }),
    // Requests in review count (only for client view)
    currentUserType === 'client'
      ? supabase
          .from('requests')
          .select('*', { count: 'exact', head: true })
          .eq('connection_id', connectionId)
          .eq('status', 'in_review')
          .is('deleted_at', null)
      : Promise.resolve({ count: null, error: null }),
    // Tasks assigned to client members count (only for client view)
    currentUserType === 'client'
      ? supabase
          .from('tasks')
          .select('assignee_user_id', { count: 'exact', head: false })
          .eq('connection_id', connectionId)
          .is('deleted_at', null)
          .not('assignee_user_id', 'is', null)
      : Promise.resolve({ data: null, error: null })
  ]);
  
  const agencyOrg = agencyOrgResult.data;
  
  // Process client primary contact
  let clientPrimaryContact = null;
  if (clientPrimaryContactResult.data) {
    const contact = clientPrimaryContactResult.data;
    clientPrimaryContact = {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      avatarUrl: contact.avatar_url,
      jobTitle: contact.job_title
    };
  }
  
  // Process agency primary contact
  let agencyPrimaryContact = null;
  if (agencyPrimaryContactResult.data) {
    const contact = agencyPrimaryContactResult.data;
    agencyPrimaryContact = {
      id: contact.id,
      firstName: contact.first_name,
      lastName: contact.last_name,
      email: contact.email,
      avatarUrl: contact.avatar_url,
      jobTitle: contact.job_title
    };
  }
  
  // Process members
  const clientMembers = clientMembersResult.data?.map(member => {
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
  
  const agencyMembers = agencyMembersResult.data?.map(member => {
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
  
  // Process new requests count
  let newRequestsCount: number | undefined = undefined;
  if (currentUserType === 'agency') {
    if (!newRequestsCountResult.error && newRequestsCountResult.count !== null) {
      newRequestsCount = newRequestsCountResult.count;
    } else {
      newRequestsCount = 0;
    }
  }
  
  // Process client view metrics
  let liveProjectsCount: number | undefined = undefined;
  let nextDeliveryDate: string | null | undefined = undefined;
  let requestsInReviewCount: number | undefined = undefined;
  let tasksAssignedCount: number | undefined = undefined;
  
  if (currentUserType === 'client') {
    // Process live projects count and next delivery date
    if (!liveProjectsResult.error && liveProjectsResult.data) {
      const liveProjects = liveProjectsResult.data;
      liveProjectsCount = liveProjects.length;
      
      // Find earliest upcoming end_date (end_date >= today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const upcomingEndDates = liveProjects
        .map(project => project.end_date)
        .filter((endDate): endDate is string => {
          if (!endDate) return false;
          const date = new Date(endDate);
          date.setHours(0, 0, 0, 0);
          return date >= today;
        })
        .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
      
      if (upcomingEndDates.length > 0) {
        // Format the date using the same pattern as contractEnd
        nextDeliveryDate = new Date(upcomingEndDates[0]).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric'
        });
      } else {
        nextDeliveryDate = null;
      }
    } else {
      liveProjectsCount = 0;
      nextDeliveryDate = null;
    }
    
    // Process requests in review count
    if (!requestsInReviewResult.error && requestsInReviewResult.count !== null) {
      requestsInReviewCount = requestsInReviewResult.count;
    } else {
      requestsInReviewCount = 0;
    }
    
    // Process tasks assigned to client members count
    if (!tasksAssignedResult.error && tasksAssignedResult.data) {
      // Get set of client member user IDs for efficient lookup
      const clientMemberIds = new Set(clientMembers.map(member => member.id));
      
      // Filter tasks to only those assigned to client members
      const tasksAssignedToClientMembers = tasksAssignedResult.data.filter(
        (task: { assignee_user_id: string | null }) =>
          task.assignee_user_id && clientMemberIds.has(task.assignee_user_id)
      );
      
      tasksAssignedCount = tasksAssignedToClientMembers.length;
    } else {
      tasksAssignedCount = 0;
    }
  }
  
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
  
  const connectionStatus = connection.connection_status || 'internal';
  const isInternal = connectionStatus === 'internal';
  
  return {
    connection: {
      id: connection.id,
      status: connectionStatus,
      isInternal,
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
      invitedEmail: connection.invited_email || undefined,
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
      connectionCode: partnerOrg?.connection_code,
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
    newRequestsCount,
    liveProjectsCount,
    nextDeliveryDate,
    requestsInReviewCount,
    tasksAssignedCount
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

// Request with optional UI identifier for optimistic updates
export type RequestWithUiId = Request & {
  _uiId?: string
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

// Task with optional UI identifier for optimistic updates
export type TaskWithUiId = Task & {
  _uiId?: string
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

/**
 * Get connection status for a given connection ID
 */
export const getConnectionStatus = cache(async (
  connectionId: string,
  context: EnhancedModeContext
): Promise<'connected' | 'invited' | 'disconnected' | 'internal' | null> => {
  const supabase = await createClient();
  
  const query = context.variant === 'agency'
    ? supabase
        .from('connections')
        .select('connection_status')
        .eq('id', connectionId)
        .eq('agency_id', context.orgId)
    : supabase
        .from('connections')
        .select('connection_status')
        .eq('id', connectionId)
        .eq('client_id', context.orgId);
  
  const { data, error } = await query.single();
  
  if (error || !data) {
    return null;
  }
  
  return (data.connection_status || 'internal') as 'connected' | 'invited' | 'disconnected' | 'internal';
});

export interface RequestsWithCount {
  requests: Request[]
  totalCount: number
  newCount: number
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
  const { limit = 100, offset = 0, searchQuery, assignedToUserId, createdByUserId } = options || {};
  const supabase = await createClient();
  
  // Fetch the connection info (cached, shared with getAgencyMembersForConnection)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError) {
      if (isDev) {
        console.error('Error fetching connection:', connectionError);
      }
      // Return empty result - connection error means we can't proceed
      // Client will handle showing appropriate error if needed
      return { requests: [], totalCount: 0, newCount: 0 };
    }
    
    if (!connection) {
      // Connection not found - return empty result (no results)
      return { requests: [], totalCount: 0, newCount: 0 };
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
    
    // Build the base query for filtering (used for both count and data)
    // Note: Uses idx_requests_connection_not_deleted index for optimal performance
    // Exact counts require scanning matching rows, but the index makes this efficient
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
    
    // Apply search filter if searchQuery is provided (title only)
    if (searchQuery && searchQuery.trim().length > 0) {
      const trimmedQuery = searchQuery.trim();
      const escaped = escapeForILike(trimmedQuery);
      baseQuery = baseQuery.ilike('title', `%${escaped}%`);
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
    
    // Apply search filter if searchQuery is provided (title only)
    if (searchQuery && searchQuery.trim().length > 0) {
      const trimmedQuery = searchQuery.trim();
      const escaped = escapeForILike(trimmedQuery);
      requestsQuery = requestsQuery.ilike('title', `%${escaped}%`);
    }
    
    // Apply pagination at database level (always, even when searching)
    // Sort by status ASC, then created_at DESC, then id DESC
    requestsQuery = requestsQuery
      .order('status', { ascending: true })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Build newCount query to run in parallel (only needed for agency view, but fetch always for consistency)
    const newCountQuery = supabase
      .from('requests')
      .select('*', { count: 'exact', head: true })
      .eq('connection_id', connectionId)
      .eq('status', 'new')
      .is('deleted_at', null);
    
    const [countResult, requestsResult, clientOrgResult, agencyOrgResult, newCountResult] = await Promise.all([
      baseQuery,
      requestsQuery,
      clientOrgPromise,
      agencyOrgPromise,
      newCountQuery
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
      return { requests: [], totalCount: 0, newCount: 0 };
    }
    
    if (countError && isDev) {
      console.error('Error fetching request count:', countError);
    }
    
    // If requests is null/undefined, treat as no results (empty query result)
    const requestsData = requests || [];
    
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
    
    // All filtering is now DB-level, no in-memory filtering needed
    // Pagination is already applied at DB level
    const finalTotalCount = countError ? 0 : (count ?? 0);
    
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
        status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled' | 'closed',
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
        createdAt: request.created_at || '',
        createdByOrgId: request.created_by_org_id,
        createdByOrgType: formatters.getOrgType(request.created_by_org_id, orgTypeMap)
      };
    });
    
    if (isDev) {
      const totalTime = performance.now() - startTime;
      console.log(`[Performance] getRequestsForConnection: ${totalTime.toFixed(2)}ms (requests: ${requestsTime.toFixed(2)}ms, parallel: ${parallelTime.toFixed(2)}ms)`);
    }
    
    // Extract newCount from parallel query result
    const { count: newStatusCount, error: newCountError } = newCountResult;
    let newCount = 0;
    if (!newCountError && newStatusCount !== null) {
      newCount = newStatusCount;
    } else if (isDev && newCountError) {
      console.error('Error fetching new requests count:', newCountError);
    }

  return { requests: formattedRequests, totalCount: finalTotalCount, newCount };
});

/**
 * Fetch status counts for a single connection (lightweight, no request rows)
 * Used to prevent count flicker in connections tables
 */
export const getRequestsCountsForConnection = cache(async (
  connectionId: string,
  options?: { assignedToUserId?: string; createdByUserId?: string }
): Promise<Record<string, number>> => {
  const supabase = await createClient();
  const { assignedToUserId, createdByUserId } = options || {};

  const { data, error } = await supabase.rpc('get_requests_counts_for_connection', {
    p_connection_id: connectionId,
    p_assigned_to_user_id: assignedToUserId || null,
    p_created_by_user_id: createdByUserId || null
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching requests counts:', error);
    }
    return {};
  }

  // Parse status_counts from JSON response
  const statusCounts = data?.status_counts || {};
  return statusCounts as Record<string, number>;
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

  // Fetch more items than needed to ensure we capture enough 'new' status items
  // Sorting by status priority will happen in RequestsCard component
  const fetchLimit = Math.max(safeLimit * 3, 20);

  const { data, error } = await supabase
    .from('requests')
    .select('id, title, created_at')
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .in('status', ['new', 'in_review', 'accepted'])
    .order('created_at', { ascending: false })
    .limit(fetchLimit);

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
  completed_at: string | null
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
  const requestIds = new Set<string>()

  rows.forEach(row => {
    if (row.created_by_user_id) userIds.add(row.created_by_user_id)
    if (row.assignee_user_id) userIds.add(row.assignee_user_id)
    if (row.source_request_id) requestIds.add(row.source_request_id)
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

  const requestMap: Record<string, { id: string; title: string | null; created_by_user_id: string | null; created_at: string | null }> = {}
  if (requestIds.size > 0) {
    const { data: requestRows, error: requestError } = await supabase
      .from('requests')
      .select('id, title, created_by_user_id, created_at')
      .in('id', Array.from(requestIds))
      .is('deleted_at', null)

    if (!requestError && requestRows) {
      requestRows.forEach(request => {
        requestMap[request.id] = request
        if (request.created_by_user_id) {
          userIds.add(request.created_by_user_id)
        }
      })
    } else if (requestError && process.env.NODE_ENV !== 'production') {
      console.error('Error fetching linked requests while hydrating tasks:', requestError)
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

    const requestData = row.source_request_id ? requestMap[row.source_request_id] : undefined
    const linkedRequestProfile = requestData?.created_by_user_id ? profilesMap[requestData.created_by_user_id] : undefined
    const linkedCreatorNameRaw = linkedRequestProfile
      ? `${linkedRequestProfile.first_name || ''} ${linkedRequestProfile.last_name || ''}`.trim()
      : undefined
    const linkedCreatorName = linkedCreatorNameRaw && linkedCreatorNameRaw.length > 0
      ? linkedCreatorNameRaw
      : linkedRequestProfile?.email

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
      completedAt: row.completed_at ? formatters.formatRequestDate(row.completed_at) : undefined,
      completedAtRaw: row.completed_at,
      createdByUserId: row.created_by_user_id,
      createdByOrgId: createdOrg?.orgId,
      createdByOrgType,
      clientVisible: Boolean(row.client_visible),
      clientVisibilityLocked: Boolean(row.assignee_user_id && assigneeOrgIds?.has(connection.client_id)),
      sourceRequestId: row.source_request_id ?? null,
      linkedRequest: requestData
        ? {
            id: requestData.id,
            title: (requestData.title || '').trim() || 'Untitled request',
            createdAt: requestData.created_at ? formatters.formatRequestDate(requestData.created_at) : '',
            createdByUserId: requestData.created_by_user_id ?? undefined,
            createdByName: linkedCreatorName,
          }
        : null,
    } satisfies Task
  })
}

export const getTasksForConnection = cache(async (
  connectionId: string,
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; assignedToUserIds?: string[]; createdByUserId?: string; sortBy?: 'status' | 'updated_at'; status?: 'to_do' | 'in_progress' | 'on_hold' | 'done' | 'canceled' }
): Promise<TasksWithCount> => {
    const isDev = process.env.NODE_ENV !== 'production'
    const supabase = await createClient()
    const {
      limit = 100,
      offset = 0,
      searchQuery,
      assignedToUserId,
      assignedToUserIds,
      createdByUserId,
      sortBy = 'status',
      status
    } = options || {}
    const safeLimit = typeof limit === 'number' ? Math.max(0, limit) : 100
    const safeOffset = Math.max(0, offset ?? 0)

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
        completed_at,
        source_request_id
      `, { count: 'exact' })
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
    
    // Filter by status if provided (for fetching tasks from specific status)
    if (status) {
      tasksQuery = tasksQuery.eq('status', status)
    }

    if (Array.isArray(assignedToUserIds) && assignedToUserIds.length > 0) {
      tasksQuery = tasksQuery.in('assignee_user_id', assignedToUserIds)
    } else if (assignedToUserId) {
      tasksQuery = tasksQuery.eq('assignee_user_id', assignedToUserId)
    }
    
    if (createdByUserId) {
      tasksQuery = tasksQuery.eq('created_by_user_id', createdByUserId)
    }

    // Search by title only
    if (searchQuery && searchQuery.trim().length > 0) {
      const trimmedQuery = searchQuery.trim()
      const escaped = escapeForILike(trimmedQuery)
      tasksQuery = tasksQuery.ilike('title', `%${escaped}%`)
    }
    
    // Sort based on sortBy option
    let orderedQuery = tasksQuery;
    if (sortBy === 'updated_at') {
      // Sort by updated_at DESC (most recently active first), then id DESC for consistency
      orderedQuery = tasksQuery
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false, nullsFirst: false })
    } else {
      // Default: sort by status ASC, then created_at DESC, then id DESC
      orderedQuery = tasksQuery
        .order('status', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: false, nullsFirst: false })
    }
    
    const { data: taskRows, error: tasksError, count } = await orderedQuery.range(
      safeOffset,
      safeLimit > 0 ? safeOffset + safeLimit - 1 : safeOffset - 1
    )

    if (tasksError) {
      if (isDev) {
        console.error('Error fetching tasks:', {
          error: tasksError,
          message: tasksError?.message,
          details: tasksError?.details,
          hint: tasksError?.hint,
          code: tasksError?.code,
          connectionId,
          options
        })
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

    // Note: Complex sorting (pinned tasks first, done tasks last, due_date sorting)
    // still happens client-side via sortTasksWithPinnedFirst in TasksPageClient
    // Database now provides base ordering, reducing client-side work
    // For MVP, we keep client-side sorting for pinned/done logic but DB handles base order
  const totalCount = count ?? hydratedTasks.length

  return { tasks: hydratedTasks, totalCount }
})

/**
 * Fetch status counts for a single connection (lightweight, no task rows)
 * Used to prevent count flicker in connections tables
 */
export const getTasksCountsForConnection = cache(async (
  connectionId: string,
  options?: { assignedToUserId?: string; assignedToUserIds?: string[] }
): Promise<Record<string, number>> => {
  const supabase = await createClient();
  const { assignedToUserId, assignedToUserIds } = options || {};

  const { data, error } = await supabase.rpc('get_tasks_counts_for_connection', {
    p_connection_id: connectionId,
    p_assigned_to_user_id: assignedToUserId || null,
    p_assigned_to_user_ids: assignedToUserIds || null
  });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching tasks counts:', error);
    }
    return {};
  }

  // Parse status_counts from JSON response
  const statusCounts = data?.status_counts || {};
  return statusCounts as Record<string, number>;
});

interface MembershipWithProfile {
  profiles: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
  } | Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    email: string;
    avatar_url: string | null;
    job_title: string | null;
  }>;
}

const mapMembershipProfiles = (
  members: MembershipWithProfile[],
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
  
  // Fetch the connection to get client_id and agency_id (using cached function)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
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
  
  // Check paywall for agencies accessing restricted connections
  const context = await getActiveContext()
  if (context && context.variant === 'agency') {
    const { assertConnectionAccessOrThrow } = await import('@/lib/paywall/assertConnectionAccess')
    await assertConnectionAccessOrThrow(
      connectionId,
      context.orgId,
      context.organization.billing_status || 'free'
    )
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
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
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
    createdAt: request.created_at || '',
    createdByOrgId: request.created_by_org_id,
    createdByOrgType: orgType
  };
});

/**
 * Batch function to fetch multiple requests by IDs efficiently.
 * Replaces N+1 pattern of calling getRequestById individually.
 */
export const getRequestsByIds = cache(async (
  connectionId: string,
  requestIds: string[]
): Promise<Request[]> => {
  if (requestIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getRequestsByIds called with:', { connectionId, requestIdsCount: requestIds.length });
  }
  
  // Fetch the connection to get client_id and agency_id (using cached function)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection:', {
        error: connectionError,
        connectionId,
        connection
      });
    }
    return [];
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
  
  // Fetch all requests in a single query
  const { data: requests, error } = await supabase
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
    .in('id', requestIds)
    .eq('connection_id', connectionId)
    .is('deleted_at', null);
  
  if (error || !requests || requests.length === 0) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching requests:', error);
    }
    return [];
  }
  
  // Collect all unique user IDs and project IDs
  const userIds = new Set<string>();
  const projectIds = new Set<string>();
  const orgIds = new Set<string>();
  
  requests.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
    if (request.project_id) projectIds.add(request.project_id);
    if (request.created_by_org_id) orgIds.add(request.created_by_org_id);
  });
  
  // Fetch all profiles, memberships, org types, and projects in parallel
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
  
  const orgTypesPromise = orgIds.size > 0
    ? supabase
        .from('organizations')
        .select('id, type')
        .in('id', Array.from(orgIds))
    : Promise.resolve({ data: null, error: null });
  
  const projectsPromise = projectIds.size > 0
    ? supabase
        .from('projects')
        .select('id, name')
        .in('id', Array.from(projectIds))
        .is('deleted_at', null)
    : Promise.resolve({ data: null, error: null });
  
  // Execute all queries in parallel
  const [profilesResult, membershipsResult, orgTypesResult, projectsResult] = await Promise.all([
    profilesPromise,
    membershipsPromise,
    orgTypesPromise,
    projectsPromise
  ]);
  
  // Build maps for efficient lookup
  const profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  if (!profilesResult.error && profilesResult.data) {
    profilesResult.data.forEach(profile => {
      profilesMap[profile.id] = profile;
    });
  }
  
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
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
  
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  if (!orgTypesResult.error && orgTypesResult.data) {
    orgTypesResult.data.forEach(org => {
      orgTypeMap[org.id] = org.type as 'agency' | 'client';
    });
  }
  
  const projectsMap: Record<string, { id: string; name: string }> = {};
  if (!projectsResult.error && projectsResult.data) {
    projectsResult.data.forEach(project => {
      projectsMap[project.id] = { id: project.id, name: project.name };
    });
  }
  
  // Map requests to Request objects
  return requests.map(request => {
    const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
    const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;
    const project = request.project_id ? projectsMap[request.project_id] || null : null;
    const orgType = request.created_by_org_id ? orgTypeMap[request.created_by_org_id] : undefined;
    
    return {
      id: request.id,
      connectionId: connectionId,
      title: request.title,
      description: request.description || '',
      status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
      project: project,
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
      createdAt: request.created_at || '',
      createdByOrgId: request.created_by_org_id,
      createdByOrgType: orgType
    };
  });
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

  // Check paywall for agencies accessing restricted connections
  const context = await getActiveContext()
  if (context && context.variant === 'agency') {
    const { assertConnectionAccessOrThrow } = await import('@/lib/paywall/assertConnectionAccess')
    await assertConnectionAccessOrThrow(
      connectionId,
      context.orgId,
      context.organization.billing_status || 'free'
    )
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
      completed_at,
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
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    // Extract error properties (only truthy, non-empty values)
    const errorMessage = error?.message?.trim();
    const errorCode = error?.code;
    const errorDetails = error?.details;
    const errorHint = error?.hint;
    
    // Build log object with only meaningful error properties
    const errorInfo: Record<string, unknown> = {};
    if (errorMessage) errorInfo.message = errorMessage;
    if (errorCode) errorInfo.code = errorCode;
    if (errorDetails) errorInfo.details = errorDetails;
    if (errorHint) errorInfo.hint = errorHint;
    
    // Only log if we have at least one meaningful error property
    // This prevents logging empty error objects {} from Supabase
    const hasMeaningfulError = Object.keys(errorInfo).length > 0;
    
    if (hasMeaningfulError && process.env.NODE_ENV !== 'production') {
      console.error('Error fetching comments:', {
        ...errorInfo,
        requestIdsCount: requestIds.length,
        ...(requestIds.length > 0 && { requestIdsSample: requestIds.slice(0, 5) })
      });
    }
    
    // Return empty object to prevent breaking the UI
    // This is safe - the UI handles empty comments gracefully
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
const _generateMockProjects = (connectionId: string, count: number = 10): Project[] => {
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
  const { limit = 100, offset = 0, searchQuery, assignedToUserId: _assignedToUserId, createdByUserId: _createdByUserId, sort = 'project_asc' } = options || {};
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
    baseQuery = baseQuery.ilike('name', `%${escaped}%`);
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
    projectsQuery = projectsQuery.ilike('name', `%${escaped}%`);
  }
  
  // Note: assignedToUserId and createdByUserId filters will be added later
  
  // Apply sorting based on sort parameter
  let orderedQuery = projectsQuery;
  switch (sort) {
    case 'project_asc':
      orderedQuery = projectsQuery.order('name', { ascending: true });
      break;
    case 'end_date_asc':
      // Order by end_date ascending (soonest first)
      // Projects without end dates (nulls) will sort last, and be sorted by name (A-Z) as secondary sort
      orderedQuery = projectsQuery
        .order('end_date', { ascending: true })
        .order('name', { ascending: true });
      break;
    default:
      // Default to project_asc
      orderedQuery = projectsQuery.order('name', { ascending: true });
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
  const _currencyCode = (agencyOrg?.currency_code as 'EUR' | 'USD' | 'GBP') || 'EUR';
  
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
  const _orgTypeMap: Record<string, 'agency' | 'client'> = {}; // Empty since created_by_org_id doesn't exist
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
  
  // Fetch requests and tasks counts for all projects in parallel
  // Note: We fetch only project_id column (minimal data) and count in memory
  // The indexes idx_requests_project_connection and idx_tasks_project_connection optimize these queries
  const projectIds = projectsData.map(p => p.id);
  const requestsCountMap: Record<string, number> = {};
  const tasksCountMap: Record<string, number> = {};
  
  if (projectIds.length > 0) {
    const chunkSize = 200
    
    // Helper function to fetch requests counts for a chunk
    // Only fetches project_id column (minimal data) - optimized by idx_requests_project_connection
    const fetchRequestsCountsForChunk = async (chunk: string[]) => {
      const { data: requestRows, error: requestsCountError } = await supabase
        .from('requests')
        .select('project_id')
        .in('project_id', chunk)
        .eq('connection_id', connectionId)
        .is('deleted_at', null)

      if (!requestsCountError && requestRows) {
        requestRows.forEach(row => {
          if (row.project_id) {
            requestsCountMap[row.project_id] = (requestsCountMap[row.project_id] || 0) + 1
          }
        })
      } else if (isDev && requestsCountError) {
        console.error('Error fetching requests counts:', requestsCountError)
      }
    }
    
    // Helper function to fetch tasks counts for a chunk
    // Only fetches project_id column (minimal data) - optimized by idx_tasks_project_connection
    const fetchTasksCountsForChunk = async (chunk: string[]) => {
      const { data: taskRows, error: tasksCountError } = await supabase
        .from('tasks')
        .select('project_id')
        .in('project_id', chunk)
        .eq('connection_id', connectionId)
        .is('deleted_at', null)

      if (!tasksCountError && taskRows) {
        taskRows.forEach(row => {
          if (row.project_id) {
            tasksCountMap[row.project_id] = (tasksCountMap[row.project_id] || 0) + 1
          }
        })
      } else if (isDev && tasksCountError) {
        console.error('Error fetching tasks counts:', tasksCountError)
      }
    }
    
    // Fetch requests and tasks counts in parallel
    const chunkPromises: Promise<void>[] = []
    for (let i = 0; i < projectIds.length; i += chunkSize) {
      const chunk = projectIds.slice(i, i + chunkSize)
      chunkPromises.push(
        Promise.all([
          fetchRequestsCountsForChunk(chunk),
          fetchTasksCountsForChunk(chunk)
        ]).then(() => {}) // Convert to void promise
      )
    }
    
    await Promise.all(chunkPromises)
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
    
    // Get requests and tasks counts for this project
    const requestsCount = requestsCountMap[project.id] || 0;
    const tasksCount = tasksCountMap[project.id] || 0;
    
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
      tasksCount: tasksCount,
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

/**
 * Lightweight function to fetch only project id and name for dropdowns.
 * Much faster than getProjectsForConnection as it doesn't fetch profiles, counts, etc.
 */
export const getProjectOptionsForConnection = cache(async (
  connectionId: string
): Promise<Array<{ id: string; name: string }>> => {
  const supabase = await createClient();
  
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection for project options:', connectionError);
    }
    return [];
  }
  
  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name')
    .eq('connection_id', connectionId)
    .is('deleted_at', null)
    .order('name', { ascending: true });
  
  if (error || !projects) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching project options:', error);
    }
    return [];
  }
  
  return projects.map((project) => ({
    id: project.id,
    name: project.name || 'Untitled project',
  }));
});

export const getProjectById = cache(async (
  projectId: string,
  connectionId: string
): Promise<Project | null> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const startTime = isDev ? performance.now() : 0;
  const supabase = await createClient();
  
  if (isDev) {
    console.log('getProjectById called with:', { projectId, connectionId });
  }
  
  // Fetch the connection to get client_id and agency_id (using cached function)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
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
  const _currencyCode = (agencyOrg?.currency_code as 'EUR' | 'USD' | 'GBP') || 'EUR';
  
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
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  
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
  const _orgType: 'agency' | 'client' | undefined = undefined;
  
  // Fetch requests and tasks counts in parallel using optimized queries
  // Select only project_id (minimal data) to leverage idx_requests_project_connection and idx_tasks_project_connection indexes
  const countsStartTime = isDev ? performance.now() : 0;
  const [requestsCountResult, tasksCountResult] = await Promise.all([
    supabase
      .from('requests')
      .select('project_id')
      .eq('project_id', project.id)
      .eq('connection_id', connectionId)
      .is('deleted_at', null),
    supabase
      .from('tasks')
      .select('project_id')
      .eq('project_id', project.id)
      .eq('connection_id', connectionId)
      .is('deleted_at', null)
  ]);
  const countsTime = isDev ? performance.now() - countsStartTime : 0;
  
  // Count in memory (faster than count: 'exact' and leverages indexes better)
  const requestsCount = requestsCountResult.data?.length || 0;
  const tasksCount = tasksCountResult.data?.length || 0;
  
  if (isDev) {
    if (requestsCountResult.error) {
      console.error('Error fetching requests count for project:', requestsCountResult.error);
    }
    if (tasksCountResult.error) {
      console.error('Error fetching tasks count for project:', tasksCountResult.error);
    }
  }
  
  // Format dates
  const startDate = formatters.formatProjectDate(project.start_date);
  const endDate = formatters.formatProjectDate(project.end_date);
  const createdAt = formatters.formatRequestDate(project.created_at);
  
  if (isDev) {
    const totalTime = performance.now() - startTime;
    console.log(`[Performance] getProjectById: ${totalTime.toFixed(2)}ms (counts: ${countsTime.toFixed(2)}ms)`);
  }
  
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
    tasksCount: tasksCount,
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

export const getConnectionResources = cache(async (
  connectionId: string,
  context: EnhancedModeContext
): Promise<Array<{
  id: string;
  url: string;
  label: string | null;
  clientVisible: boolean;
  createdAt: string | null;
}>> => {
  const supabase = await createClient();
  
  let query = supabase
    .from('connection_resources')
    .select('id, url, label, client_visible, created_at')
    .eq('connection_id', connectionId);

  if (context.variant === 'client') {
    query = query.eq('client_visible', true);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Failed to load connection resources:', error);
    }
    return [];
  }

  const rows = (data ?? []) as Array<{
    id: string;
    url: string;
    label: string | null;
    client_visible: boolean;
    created_at: string | null;
  }>;

  return rows.map((item) => ({
    id: item.id,
    url: item.url,
    label: item.label,
    clientVisible: item.client_visible,
    createdAt: item.created_at,
  }));
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

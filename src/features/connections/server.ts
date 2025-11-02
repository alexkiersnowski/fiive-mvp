import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { escapeForILike } from '@/lib/utils';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';
import * as formatters from './formatters';

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
  createdAt: string
  createdByOrgId: string
  createdByOrgType?: 'agency' | 'client'
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

  // Normalize search query for request type (enum) matching
  // Only match when the token exactly maps to a known type to avoid enum ilike
  const normalizeTypeQuery = (query: string): string | null => {
    const normalized = query.toLowerCase().trim();
    // Known request types (extend as needed when adding more types)
    const TYPE_KEYWORDS: Record<string, string> = {
      general: 'general',
      'general request': 'general'
    };
    return TYPE_KEYWORDS[normalized] ?? null;
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
    const matchedType = normalizeTypeQuery(trimmedQuery);
    
    // Build OR list (avoid ilike on enum type). Include project_id text search.
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`project_id.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    if (matchedType) orParts.push(`type.eq.${matchedType}`);
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
      type,
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
    const matchedType = normalizeTypeQuery(trimmedQuery);
    
    const orParts: string[] = [];
    orParts.push(`title.ilike.%${escaped}%`);
    orParts.push(`project_id.ilike.%${escaped}%`);
    if (matchedStatus) orParts.push(`status.eq.${matchedStatus}`);
    if (matchedType) orParts.push(`type.eq.${matchedType}`);
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
  
  // Fetch all unique user IDs for submitted by and assignees, and unique org IDs for created_by_org_id
  const userIds = new Set<string>();
  const orgIds = new Set<string>();
  requests?.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
    if (request.created_by_org_id) orgIds.add(request.created_by_org_id);
  });
  
  // Fetch user profiles, memberships, and organization types in parallel
  let profilesMap: Record<string, { first_name: string; last_name: string; email: string; avatar_url?: string; job_title?: string }> = {};
  const userOrgMap: Record<string, { orgId: string; orgName: string; orgLogo?: string }> = {};
  const orgTypeMap: Record<string, 'agency' | 'client'> = {};
  let parallelTime = 0;
  if (userIds.size > 0 || orgIds.size > 0) {
    const userIdArray = Array.from(userIds);
    const orgIdArray = Array.from(orgIds);
    
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
    
    const [profilesResult, membershipsResult, orgTypesResult] = await Promise.all([
      profilesPromise,
      membershipsPromise,
      orgTypesPromise
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
  }
  
  // Map the requests to the UI format
  const formattedRequests = requestsData.map(request => {
    const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
    const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;
    
    return {
      id: request.id,
      connectionId: connectionId,
      title: request.title,
      description: request.description || '',
      status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
      type: request.type,
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

export const getAgencyMembersForConnection = cache(async (
  connectionId: string
): Promise<Array<{
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
}>> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const supabase = await createClient();
  
  // Use cached connection info (shared with getRequestsForConnection)
  const { connection, error: connectionError } = await getConnectionInfo(connectionId);
  
  if (connectionError || !connection) {
    if (isDev) {
      console.error('Error fetching connection for agency members:', connectionError);
    }
    return [];
  }
  
  // Fetch agency members
  const { data: members, error: membersError } = await supabase
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
    .eq('org_id', connection.agency_id)
    .is('profiles.deleted_at', null)
    .order('profiles(first_name)');
  
  if (membersError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching agency members:', membersError);
    }
    return [];
  }
  
  const formattedMembers = members?.map(member => {
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
  
  return formattedMembers;
});

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
      type,
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
  
  const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
  const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;
  
  // Fetch org type separately for this single request
  let orgType: 'agency' | 'client' | undefined = undefined;
  if (request.created_by_org_id) {
    const { data: orgTypeData } = await supabase
      .from('organizations')
      .select('type')
      .eq('id', request.created_by_org_id)
      .single();
    orgType = orgTypeData?.type as 'agency' | 'client' | undefined;
  }

  return {
    id: request.id,
    connectionId: connectionId,
    title: request.title,
    description: request.description || '',
    status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
    type: request.type,
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
  budget: string
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
      budget: `€${Math.floor(Math.random() * 1000000).toLocaleString('en-US', { useGrouping: true })}`,
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
  options?: { limit?: number; offset?: number; searchQuery?: string; assignedToUserId?: string; createdByUserId?: string }
): Promise<ProjectsWithCount> => {
  const isDev = process.env.NODE_ENV !== 'production';
  const { limit = 50, offset = 0, searchQuery, assignedToUserId, createdByUserId } = options || {};
  
  if (isDev) {
    console.log('[Projects] getProjectsForConnection called (MOCK DATA):', { connectionId, limit, offset, searchQuery, assignedToUserId, createdByUserId });
  }
  
  // Generate mock projects
  let allProjects = generateMockProjects(connectionId, 10)
  
  // Apply filters (mock implementation)
  if (searchQuery && searchQuery.trim()) {
    const query = searchQuery.toLowerCase()
    allProjects = allProjects.filter(p => 
      p.title.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query)
    )
  }
  
  if (assignedToUserId) {
    allProjects = allProjects.filter(p => p.assignee?.id === assignedToUserId)
  }
  
  if (createdByUserId) {
    allProjects = allProjects.filter(p => p.submittedBy.id === createdByUserId)
  }
  
  const totalCount = allProjects.length
  const paginatedProjects = allProjects.slice(offset, offset + limit)
  
  return {
    projects: paginatedProjects,
    totalCount
  }
});

export const getProjectById = cache(async (
  projectId: string,
  connectionId: string
): Promise<Project | null> => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  if (isDev) {
    console.log('[Projects] getProjectById called (MOCK DATA):', { projectId, connectionId });
  }
  
  // Generate mock projects and find the one matching the ID
  const mockProjects = generateMockProjects(connectionId, 50)
  const project = mockProjects.find(p => p.id === projectId)
  
  return project || null
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

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

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
    agencyMembers
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
  createdAt: string
  createdByOrgId: string
}

export const getRequestsForConnection = cache(async (
  connectionId: string
): Promise<Request[]> => {
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getRequestsForConnection called with:', { connectionId });
  }
  
  // Fetch the connection to get client_id
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('client_id')
    .eq('id', connectionId)
    .single();
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching connection:', connectionError);
    }
    return [];
  }
  
  // Fetch client organization details
  const { data: clientOrg, error: clientOrgError } = await supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.client_id)
    .single();
  
  if (clientOrgError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching client organization:', clientOrgError);
    }
  }
  
  // Fetch requests for this connection
  const { data: requests, error } = await supabase
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
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  
  if (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching requests:', error);
    }
    return [];
  }
  
  // Fetch all unique user IDs for submitted by and assignees
  const userIds = new Set<string>();
  requests?.forEach(request => {
    if (request.created_by_user_id) userIds.add(request.created_by_user_id);
    if (request.assignee_user_id) userIds.add(request.assignee_user_id);
  });
  
  // Fetch all user profiles in one query
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
  
  // Map the requests to the UI format
  const formattedRequests = requests?.map(request => {
    const submittedByProfile = request.created_by_user_id ? profilesMap[request.created_by_user_id] : null;
    const assigneeProfile = request.assignee_user_id ? profilesMap[request.assignee_user_id] : null;
    
    return {
      id: request.id,
      connectionId: connectionId,
      title: request.title,
      description: request.description || '',
      status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
      type: request.type,
      submittedBy: {
        id: request.created_by_user_id,
        name: submittedByProfile 
          ? `${submittedByProfile.first_name || ''} ${submittedByProfile.last_name || ''}`.trim() || 'Unknown User'
          : 'Unknown User',
        email: submittedByProfile?.email || '',
        avatarUrl: submittedByProfile?.avatar_url || undefined,
        jobTitle: submittedByProfile?.job_title || undefined,
        orgId: userOrgMap[request.created_by_user_id]?.orgId || '',
        orgName: userOrgMap[request.created_by_user_id]?.orgName || '',
        orgLogo: userOrgMap[request.created_by_user_id]?.orgLogo
      },
      assignee: request.assignee_user_id && assigneeProfile ? {
        id: request.assignee_user_id,
        name: `${assigneeProfile.first_name || ''} ${assigneeProfile.last_name || ''}`.trim() || 'Unknown User',
        email: assigneeProfile.email,
        avatarUrl: assigneeProfile.avatar_url || undefined
      } : null,
      client: {
        id: clientOrg?.id || connection.client_id,
        name: clientOrg?.name || 'Unknown Client',
        logoUrl: clientOrg?.logo_url
      },
      createdAt: request.created_at ? (() => {
        const date = new Date(request.created_at);
        const day = date.getDate();
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear();
        return `${day} ${month} ${year}`;
      })() : '',
      createdByOrgId: request.created_by_org_id
    };
  }) || [];
  
  return formattedRequests;
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
  const supabase = await createClient();
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('getAgencyMembersForConnection called with:', { connectionId });
  }
  
  // Get the connection to find the agency_id
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('agency_id')
    .eq('id', connectionId)
    .single();
  
  if (connectionError || !connection) {
    if (process.env.NODE_ENV !== 'production') {
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
  
  // Fetch the connection to get client_id
  const { data: connection, error: connectionError } = await supabase
    .from('connections')
    .select('client_id')
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
  
  // Fetch client organization details
  const { data: clientOrg, error: clientOrgError } = await supabase
    .from('organizations')
    .select('id, name, logo_url')
    .eq('id', connection.client_id)
    .single();
  
  if (clientOrgError) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error fetching client organization:', clientOrgError);
    }
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
  
  return {
    id: request.id,
    connectionId: connectionId,
    title: request.title,
    description: request.description || '',
    status: request.status as 'new' | 'in_review' | 'accepted' | 'canceled',
    type: request.type,
    submittedBy: {
      id: request.created_by_user_id,
      name: submittedByProfile 
        ? `${submittedByProfile.first_name || ''} ${submittedByProfile.last_name || ''}`.trim() || 'Unknown User'
        : 'Unknown User',
      email: submittedByProfile?.email || '',
      avatarUrl: submittedByProfile?.avatar_url || undefined,
      jobTitle: submittedByProfile?.job_title || undefined,
      orgId: userOrgMap[request.created_by_user_id]?.orgId || '',
      orgName: userOrgMap[request.created_by_user_id]?.orgName || '',
      orgLogo: userOrgMap[request.created_by_user_id]?.orgLogo
    },
    assignee: request.assignee_user_id && assigneeProfile ? {
      id: request.assignee_user_id,
      name: `${assigneeProfile.first_name || ''} ${assigneeProfile.last_name || ''}`.trim() || 'Unknown User',
      email: assigneeProfile.email,
      avatarUrl: assigneeProfile.avatar_url || undefined
    } : null,
    client: {
      id: clientOrg?.id || connection.client_id,
      name: clientOrg?.name || 'Unknown Client',
      logoUrl: clientOrg?.logo_url
    },
    createdAt: request.created_at ? (() => {
      const date = new Date(request.created_at);
      const day = date.getDate();
      const month = date.toLocaleDateString('en-US', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    })() : '',
    createdByOrgId: request.created_by_org_id
  };
});

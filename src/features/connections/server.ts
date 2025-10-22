import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionSnapshot } from './types';

export const getConnectionSnapshot = cache(async (
  context: EnhancedModeContext,
  connectionId: string
): Promise<ConnectionSnapshot | null> => {
  const supabase = await createClient();
  
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
    console.error('Error fetching connection snapshot:', error);
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
  console.log(`Invalidating connection cache for: ${connectionId}`);
}

'use server'

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { AgenciesSnapshot } from './types';
import { getAgenciesSnapshot } from './server';

export type ConnectionResult = {
  success: boolean;
  agencyName?: string;
  agencyLogo?: string;
  error?: string;
};

export type NewAgencyResult = {
  success: boolean;
  agencyId?: string;
  agencyName?: string;
  error?: string;
};

/**
 * Creates a new agency organization and establishes connection with invite
 * Used when a client adds an agency who is NOT on Fiive yet
 * 
 * Implementation:
 * 1. Validates client context and email
 * 2. Calls create_draft_agency_connection RPC to create draft agency org + connection + invite token
 * 3. Sends invitation email to the primary contact
 * 4. Revalidates agencies page
 */
export async function createNewAgencyAndInvite(
  agencyName: string,
  primaryContactEmail: string,
  context: EnhancedModeContext
): Promise<NewAgencyResult> {
  const supabase = await createClient();
  
  try {
    // Validate context before proceeding
    if (!context || !context.orgId || !context.userId) {
      console.error('Invalid context provided to createNewAgencyAndInvite:', { context });
      return {
        success: false,
        error: 'Invalid session. Please refresh the page and try again.',
      };
    }

    // Only clients can invite agencies
    if (context.variant !== 'client') {
      return {
        success: false,
        error: 'Only clients can invite agencies',
      };
    }

    const trimmedName = agencyName.trim();
    const trimmedEmail = primaryContactEmail.trim().toLowerCase();

    if (!trimmedName) {
      return {
        success: false,
        error: 'Agency name is required',
      };
    }

    if (trimmedName.length > 255) {
      return {
        success: false,
        error: 'Agency name must be 255 characters or fewer',
      };
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return {
        success: false,
        error: 'Please enter a valid email address',
      };
    }

    // Validate owner ID exists
    const ownerId = context.organization.ownerId ?? context.userId;
    if (!ownerId) {
      console.error('Missing owner ID in context:', { context });
      return {
        success: false,
        error: 'Unable to determine organization owner. Please refresh the page and try again.',
      };
    }

    // Validation: Email must NOT already exist in auth.users
    const { data: emailExists, error: userCheckError } = await supabase.rpc('check_user_email_exists', {
      p_email: trimmedEmail
    });
    
    if (userCheckError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking existing users:', userCheckError);
      }
      return {
        success: false,
        error: 'Failed to validate email address',
      };
    }

    if (emailExists === true) {
      return {
        success: false,
        error: 'This email already has a Fiive account',
      };
    }

    // Validation: Email cannot belong to the client org
    const { data: clientMembers, error: clientMembersError } = await supabase
      .from('memberships')
      .select(`
        profiles!inner(
          email
        )
      `)
      .eq('org_id', context.orgId);

    if (clientMembersError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error checking client members:', clientMembersError);
      }
      return {
        success: false,
        error: 'Failed to validate email address',
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientEmails = (clientMembers || []).map((m: any) => 
      m.profiles?.email?.toLowerCase()
    ).filter(Boolean);

    if (clientEmails.includes(trimmedEmail)) {
      return {
        success: false,
        error: 'This email belongs to your organization',
      };
    }

    // Call RPC to create draft agency org + connection (status='invited', but no token yet)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_draft_agency_connection', {
      p_client_id: context.orgId,
      p_owner_id: ownerId,
      p_agency_name: trimmedName,
      p_primary_contact_email: trimmedEmail
    });

    if (rpcError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error creating draft agency connection:', rpcError);
      }
      return {
        success: false,
        error: rpcError.message || 'Failed to create agency. Please try again.',
      };
    }

    if (!rpcResult || rpcResult.length === 0) {
      return {
        success: false,
        error: 'Failed to create agency. Please try again.',
      };
    }

    const { connection_id, agency_id } = rpcResult[0];

    if (!connection_id || !agency_id) {
      return {
        success: false,
        error: 'Failed to create agency. Please try again.',
      };
    }

    // Generate and store invite token (matching client invite flow pattern)
    const { createInviteToken } = await import('@/lib/tokens/createInviteToken');
    const tokenResult = await createInviteToken(connection_id, trimmedEmail);
    if (!tokenResult.success) {
      return {
        success: false,
        error: tokenResult.error || 'Failed to create invite token',
      };
    }

    // Get client organization name for email
    const { data: clientOrg, error: clientOrgError } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', context.orgId)
      .single();

    if (clientOrgError || !clientOrg) {
      return {
        success: false,
        error: 'Failed to retrieve client information',
      };
    }

    // Build invite URL
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const inviteUrl = `${baseUrl}/claim?token=${tokenResult.token}`;

    // Send invitation email via Resend
    try {
      const { sendAgencyInviteEmail } = await import('@/app/actions/sendAgencyInviteEmail');
      await sendAgencyInviteEmail({
        to: trimmedEmail,
        clientName: clientOrg.name,
        inviteUrl
      });
    } catch (emailError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error sending invitation email:', emailError);
      }
      return {
        success: false,
        error: emailError instanceof Error ? emailError.message : 'Failed to send invitation email',
      };
    }

    // Revalidate agencies page to show the new connection
    revalidatePath('/agencies');
    
    return {
      success: true,
      agencyId: agency_id,
      agencyName: trimmedName,
    };
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error creating agency:', error);
    }
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}

/**
 * Validates connection code and establishes connection to existing agency
 * Used when connecting to an agency already on Fiive
 * 
 * Implementation:
 * 1. Look up organization by connection code
 * 2. Validate organization type is 'agency' (not 'client')
 * 3. Check if connection already exists
 * 4. Create connection record in connections table
 */
export async function connectToExistingAgency(
  connectionCode: string,
  context: EnhancedModeContext
): Promise<ConnectionResult> {
  try {
    // Use admin client to bypass RLS policies when looking up organizations by connection code
    const supabase = createAdminClient();
    
    // 1. Look up organization by connection code
    const { data: targetOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, type, logo_url, connection_code')
      .eq('connection_code', connectionCode)
      .is('deleted_at', null) // Only active organizations
      .single();
    
    if (orgError || !targetOrg) {
      console.error('Organization lookup error:', orgError);
      return {
        success: false,
        error: 'Invalid code. Please check and try again.'
      };
    }
    
    // 2. Validate that the two organizations are of different types (agency cannot connect to another agency, client cannot connect to another client)
    if (context.variant === targetOrg.type) {
      return {
        success: false,
        error: 'Invalid code. Please check and try again.'
      };
    }
    
    // 3. Check if connection already exists
    const { data: existingConnection, error: connectionCheckError } = await supabase
      .from('connections')
      .select('id')
      .eq('client_id', context.orgId)
      .eq('agency_id', targetOrg.id)
      .single();
    
    if (connectionCheckError && connectionCheckError.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is what we want
      console.error('Connection check error:', connectionCheckError);
      return {
        success: false,
        error: 'Invalid code. Please check and try again.'
      };
    }
    
    if (existingConnection) {
      return {
        success: false,
        error: 'You\'re already connected to this agency'
      };
    }
    
    // 4. Create connection record
    const now = new Date().toISOString();
    const { data: newConnection, error: connectionError } = await supabase
      .from('connections')
      .insert({
        agency_id: targetOrg.id,
        client_id: context.orgId,
        agency_primary_contact_id: null,
        client_primary_contact_id: null,
        connection_status: 'connected',
        engagement_status: null,
        health_status: null,
        contract_value: null,
        contract_end_on: null,
        invited_email: null,
        invited_at: null,
        invite_token: null,
        connected_at: now,
        disconnected_at: null,
        created_at: now,
        updated_at: now
      })
      .select()
      .single();
    
    if (connectionError) {
      console.error('Connection creation error:', connectionError);
      return {
        success: false,
        error: 'Invalid code. Please check and try again.'
      };
    }
    
    console.log('Connection created successfully:', newConnection);
    
    // Revalidate the agencies page to show the new connection
    revalidatePath('/agencies');
    
    return {
      success: true,
      agencyName: targetOrg.name,
      agencyLogo: targetOrg.logo_url
    };
    
  } catch (error) {
    console.error('Error connecting to agency:', error);
    return {
      success: false,
      error: 'Invalid code. Please check and try again.'
    };
  }
}

/**
 * Refreshes the agencies data from the server
 * Used to update the client-side state after mutations
 */
export async function refreshAgenciesData(
  context: EnhancedModeContext
): Promise<AgenciesSnapshot> {
  const snapshot = await getAgenciesSnapshot(context);
  return snapshot;
}

/**
 * Validates a connection code without creating a connection
 * Used for client-side validation feedback (optional enhancement)
 */
export async function validateConnectionCode(
  connectionCode: string
): Promise<{ valid: boolean; organizationName?: string; error?: string }> {
  try {
    // TODO: Implement when database is ready
    console.log('Validating connection code:', connectionCode);
    
    // Mock response for now
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      valid: true,
      organizationName: 'Acme Agency'
    };
    
    // Real implementation:
    // const org = await db.organizations.findOne({
    //   where: { connectionCode: connectionCode, isActive: true }
    // });
    //
    // if (!org) {
    //   return { valid: false, error: 'Invalid or expired connection code' };
    // }
    //
    // return { valid: true, organizationName: org.name };
  } catch (error) {
    console.error('Error validating connection code:', error);
    return {
      valid: false,
      error: 'Validation failed'
    };
  }
}

// Additional actions for future implementation

export async function updateAgenciesFilters(
  _searchValue: string,
  _context: EnhancedModeContext
) {
  // In a real app, this would update URL search params or database filters
  // For now, we'll just revalidate the agencies page
  revalidatePath('/agencies');
  
  // In a real implementation, you might redirect with search params:
  // redirect(`/agencies?search=${encodeURIComponent(searchValue)}`);
}

export async function addAgency(formData: FormData, context: EnhancedModeContext) {
  // TODO: Implement actual agency creation
  const name = formData.get('name') as string;
  const accountManager = formData.get('accountManager') as string;
  
  if (!name || !accountManager) {
    throw new Error('Name and account manager are required');
  }
  
  // In a real app, this would create the agency in the database
  console.log('Creating agency:', { name, accountManager, context });
  
  revalidatePath('/agencies');
}

export async function updateAgencyStatus(
  agencyId: string,
  status: string,
  context: EnhancedModeContext
) {
  // TODO: Implement actual status update
  console.log('Updating agency status:', { agencyId, status, context });
  
  revalidatePath('/agencies');
}

export async function deleteAgency(
  agencyId: string,
  context: EnhancedModeContext
) {
  // TODO: Implement actual agency deletion
  console.log('Deleting agency:', { agencyId, context });
  
  revalidatePath('/agencies');
}

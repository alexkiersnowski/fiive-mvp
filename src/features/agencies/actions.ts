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
 * Creates a new agency organization and establishes connection
 * Used when a client adds an agency who is NOT on Fiive yet
 * 
 * Database implementation will:
 * 1. Create new organization record for the agency (type: 'agency')
 * 2. Generate a unique connection_code for the new agency
 * 3. Create connection record linking client org to agency org
 * 4. Set up default workspace/permissions
 * 
 * TODO: Implement when "Add new agency" flow is ready
 */
export async function createNewAgency(
  agencyName: string,
  context: EnhancedModeContext
): Promise<NewAgencyResult> {
  try {
    // TODO: Implement when database is ready
    console.log('Creating new agency:', { agencyName, context });
    
    // Mock success response for now
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    
    return {
      success: true,
      agencyId: `agency-${Date.now()}`,
      agencyName: agencyName
    };
    
    // Real implementation will look like:
    // const newOrg = await db.organizations.create({
    //   name: agencyName,
    //   type: 'agency',
    //   createdBy: context.userId
    // });
    //
    // const connection = await db.connections.create({
    //   client_id: context.orgId,
    //   agency_id: newOrg.id,
    //   status: 'active',
    //   createdBy: context.userId
    // });
    //
    // revalidatePath('/agencies');
    // return { success: true, agencyId: newOrg.id, agencyName: newOrg.name };
  } catch (error) {
    console.error('Error creating agency:', error);
    return {
      success: false,
      error: 'Failed to create agency. Please try again.'
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
  searchValue: string,
  context: EnhancedModeContext
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

'use server'

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionResult, NewClientResult, ClientsSnapshot } from './types';
import { getClientsSnapshot } from './server';

/**
 * Creates a new client organization and establishes connection
 * Used when an agency adds a client who is NOT on Fiive yet
 * 
 * Database implementation will:
 * 1. Create new organization record for the client (type: 'client')
 * 2. Generate a unique connection_code for the new client
 * 3. Create connection record linking agency org to client org
 * 4. Set up default workspace/permissions
 * 
 * TODO: Implement when "Add new client" flow is ready
 */
export async function createNewClient(
  clientName: string,
  context: EnhancedModeContext
): Promise<NewClientResult> {
  try {
    // TODO: Implement when database is ready
    console.log('Creating new client:', { clientName, context });
    
    // Mock success response for now
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay
    
    return {
      success: true,
      clientId: `client-${Date.now()}`,
      clientName: clientName
    };
    
    // Real implementation will look like:
    // const newOrg = await db.organizations.create({
    //   name: clientName,
    //   type: 'client',
    //   createdBy: context.userId
    // });
    //
    // const connection = await db.connections.create({
    //   agencyOrgId: context.organizationId,
    //   clientOrgId: newOrg.id,
    //   status: 'active',
    //   createdBy: context.userId
    // });
    //
    // revalidatePath('/clients');
    // return { success: true, clientId: newOrg.id, clientName: newOrg.name };
  } catch (error) {
    console.error('Error creating client:', error);
    return {
      success: false,
      error: 'Failed to create client. Please try again.'
    };
  }
}

/**
 * Validates connection code and establishes connection to existing client
 * Used when connecting to a client already on Fiive
 * 
 * Implementation:
 * 1. Look up organization by connection code
 * 2. Validate organization type is 'client' (not 'agency')
 * 3. Check if connection already exists
 * 4. Create connection record in connections table
 */
export async function connectToExistingClient(
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
      .eq('agency_id', context.orgId)
      .eq('client_id', targetOrg.id)
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
        error: 'You\'re already connected to this client'
      };
    }
    
    // 4. Create connection record
    const now = new Date().toISOString();
    const { data: newConnection, error: connectionError } = await supabase
      .from('connections')
      .insert({
        agency_id: context.orgId,
        client_id: targetOrg.id,
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
    
    // Revalidate the clients page to show the new connection
    revalidatePath('/clients');
    
    return {
      success: true,
      clientName: targetOrg.name,
      clientLogo: targetOrg.logo_url
    };
    
  } catch (error) {
    console.error('Error connecting to client:', error);
    return {
      success: false,
      error: 'Invalid code. Please check and try again.'
    };
  }
}

/**
 * Refreshes the clients data from the server
 * Used to update the client-side state after mutations
 */
export async function refreshClientsData(
  context: EnhancedModeContext
): Promise<ClientsSnapshot> {
  const snapshot = await getClientsSnapshot(context);
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
      organizationName: 'Acme Corporation'
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

// Existing actions below

export async function updateClientsFilters(
  searchValue: string,
  sortValue: string,
  context: EnhancedModeContext
) {
  // In a real app, this would update URL search params or database filters
  // For now, we'll just revalidate the clients page
  revalidatePath('/clients');
  
  // In a real implementation, you might redirect with search params:
  // redirect(`/clients?search=${encodeURIComponent(searchValue)}&sort=${encodeURIComponent(sortValue)}`);
}

export async function addClient(formData: FormData, context: EnhancedModeContext) {
  // TODO: Implement actual client creation
  const name = formData.get('name') as string;
  const accountManager = formData.get('accountManager') as string;
  
  if (!name || !accountManager) {
    throw new Error('Name and account manager are required');
  }
  
  // In a real app, this would create the client in the database
  console.log('Creating client:', { name, accountManager, context });
  
  revalidatePath('/clients');
}

export async function updateClientStatus(
  clientId: string,
  status: string,
  context: EnhancedModeContext
) {
  // TODO: Implement actual status update
  console.log('Updating client status:', { clientId, status, context });
  
  revalidatePath('/clients');
}

export async function deleteClient(
  clientId: string,
  context: EnhancedModeContext
) {
  // TODO: Implement actual client deletion
  console.log('Deleting client:', { clientId, context });
  
  revalidatePath('/clients');
}

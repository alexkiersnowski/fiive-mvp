'use server'

import { revalidatePath } from 'next/cache';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { deleteLogoFolder } from '@/lib/supabase/storage';
import type { EnhancedModeContext } from '@/lib/mode/getActiveContext';
import type { ConnectionResult, NewClientResult, NewClientPayload, DeleteClientResult, ClientsSnapshot } from './types';
import { getClientsSnapshot } from './server';

/**
 * Creates a draft client organization and linked connection for an agency member.
 * Delegates the transactional work to the `create_draft_client_connection` RPC.
 */
export async function createNewClient(
  clientName: string,
  context: EnhancedModeContext
): Promise<NewClientResult> {
  try {
    // Validate context before proceeding
    if (!context || !context.orgId || !context.userId) {
      console.error('Invalid context provided to createNewClient:', { context });
      return {
        success: false,
        error: 'Invalid session. Please refresh the page and try again.',
      };
    }

    // Only agencies can create clients
    if (context.variant !== 'agency') {
      return {
        success: false,
        error: 'Only agencies can create clients',
      };
    }

    const trimmedName = clientName.trim();

    if (!trimmedName) {
      return {
        success: false,
        error: 'Client name is required',
      };
    }

    if (trimmedName.length > 255) {
      return {
        success: false,
        error: 'Client name must be 255 characters or fewer',
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

    const supabase = await createClient();

    // Call RPC with timeout protection
    const rpcPromise = supabase
      .rpc('create_draft_client_connection', {
        p_agency_id: context.orgId,
        // Always assign the draft client to the agency owner so ownership stays with the org
        p_owner_id: ownerId,
        p_client_name: trimmedName,
      })
      .single();

    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
      setTimeout(() => resolve({ data: null, error: { message: 'Request timeout' } }), 10000); // 10 second timeout
    });

    let data, error;
    try {
      const result = await Promise.race([rpcPromise, timeoutPromise]);
      data = result.data;
      error = result.error;
      
      // Check if timeout occurred
      if (error && error.message === 'Request timeout') {
        console.error('RPC call timed out:', {
          input: { agencyId: context.orgId, ownerId, clientName: trimmedName },
        });
        return {
          success: false,
          error: 'Request timed out. Please try again.',
        };
      }
    } catch (unexpectedError) {
      console.error('Unexpected error during RPC call:', {
        unexpectedError,
        input: { agencyId: context.orgId, ownerId, clientName: trimmedName },
      });
      return {
        success: false,
        error: 'An unexpected error occurred. Please try again.',
      };
    }

    if (error || !data) {
      // Type-safe error handling
      const errorObj = error as { code?: string; message?: string; details?: string; hint?: string } | null;
      
      console.error('Error creating draft client connection:', {
        error,
        data,
        input: { agencyId: context.orgId, ownerId, clientName: trimmedName },
        errorCode: errorObj?.code,
        errorMessage: errorObj?.message,
        errorDetails: errorObj?.details,
        errorHint: errorObj?.hint,
      });

      // Extract error message with priority order
      const message =
        errorObj?.message ||
        errorObj?.details ||
        errorObj?.hint ||
        'Failed to create client. Please try again.';

      return {
        success: false,
        error: message,
      };
    }

    // Revalidate the clients page to show the new client
    revalidatePath('/clients');

    return {
      success: true,
      data: data as NewClientPayload,
    };
  } catch (error) {
    console.error('Unexpected error creating client:', {
      error,
      errorMessage: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create client. Please try again.'
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
    console.log('[DEBUG] connectToExistingClient called with:', { connectionCode, contextOrgId: context.orgId });
    
    // Use admin client to bypass RLS policies when looking up organizations by connection code
    const supabase = createAdminClient();
    console.log('[DEBUG] Admin client created successfully');
    
    // 1. Look up organization by connection code
    console.log('[DEBUG] Looking up organization with connection code:', connectionCode);
    const { data: targetOrg, error: orgError } = await supabase
      .from('organizations')
      .select('id, name, type, logo_url, connection_code')
      .eq('connection_code', connectionCode)
      .is('deleted_at', null) // Only active organizations
      .single();
    
    console.log('[DEBUG] Organization lookup result:', { targetOrg, orgError });
    
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
  context: EnhancedModeContext,
  options?: { search?: string; sort?: string }
): Promise<ClientsSnapshot> {
  const snapshot = await getClientsSnapshot(context, {
    search: options?.search || '',
    sort: options?.sort || 'newest-first',
    limit: 50
  });
  return snapshot;
}

/**
 * Fetches more clients using cursor-based pagination
 * Used for infinite scroll / load more functionality
 */
export async function fetchMoreClients(
  context: EnhancedModeContext,
  options: { cursor: string | null; search?: string; sort?: string; limit?: number }
): Promise<ClientsSnapshot> {
  if (!options.cursor) {
    return {
      clients: [],
      total: 0,
      unfilteredTotalCount: 0,
      cursor: null,
      hasNextPage: false,
    };
  }
  
  const snapshot = await getClientsSnapshot(context, {
    search: options.search || '',
    sort: options.sort || 'newest-first',
    cursor: options.cursor,
    limit: options.limit || 50
  });
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

/**
 * Deletes a draft client organization and all related data.
 * Only works for draft clients (is_draft = true) that have never been invited/claimed.
 * For non-draft clients, use soft delete instead.
 */
export async function deleteClient(
  clientId: string,
  context: EnhancedModeContext
): Promise<DeleteClientResult> {
  try {
    // Only agencies can delete clients
    if (context.variant !== 'agency') {
      return {
        success: false,
        error: 'Only agencies can delete clients',
      };
    }

    const supabase = await createClient();

    // Delete logo folder from storage FIRST (before organization is deleted)
    // This is necessary so RLS policy can verify the organization exists and user has permission
    // Storage deletion is best-effort - if it fails, we still proceed with DB deletion
    const storageResult = await deleteLogoFolder(clientId);
    if (!storageResult.success) {
      // Log the error but don't fail the deletion - storage cleanup is best-effort
      console.warn('Failed to delete logo folder for draft client:', {
        clientId,
        error: storageResult.error,
      });
    }

    // Call the RPC function to delete the draft client (deletes organization and all related data)
    const { error } = await supabase.rpc('delete_draft_client', {
      p_client_id: clientId,
      p_agency_id: context.orgId,
      p_user_id: context.userId,
    });

    if (error) {
      console.error('Error deleting draft client:', {
        error,
        clientId,
        agencyId: context.orgId,
        userId: context.userId,
      });

      const message =
        (error && ('message' in error ? error.message : undefined)) ||
        (error && ('details' in error ? (error as { details?: string }).details : undefined)) ||
        (error && ('hint' in error ? (error as { hint?: string }).hint : undefined)) ||
        'Failed to delete client. Please try again.';

      return {
        success: false,
        error: message,
      };
    }

    // Revalidate the clients page to reflect the deletion
  revalidatePath('/clients');

    return {
      success: true,
    };
  } catch (error) {
    console.error('Error deleting client:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete client. Please try again.',
    };
  }
}

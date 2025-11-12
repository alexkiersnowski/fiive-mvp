'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadLogo } from '@/lib/supabase/storage'
import { z } from 'zod'

export async function updateClientPrimaryContact(
  connectionId: string,
  clientPrimaryContactId: string | null
) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase
      .from('connections')
      .update({ client_primary_contact_id: clientPrimaryContactId })
      .eq('id', connectionId)
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating client primary contact:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating client primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateEngagementStatus(
  connectionId: string,
  engagementStatus: string | null
) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase
      .from('connections')
      .update({ engagement_status: engagementStatus })
      .eq('id', connectionId)
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating engagement status:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating engagement status:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateContractValue(
  connectionId: string,
  contractValue: string | null
) {
  const supabase = await createClient()
  
  try {
    // Parse the formatted value (e.g., "1,000,000.50") to a numeric string for the database
    let numericValue: string | null = null
    
    if (contractValue) {
      // Remove commas and convert to numeric
      const cleanValue = contractValue.replace(/,/g, '')
      const parsed = parseFloat(cleanValue)
      
      if (isNaN(parsed)) {
        return { success: false, error: 'Invalid contract value provided.' }
      }
      
      // Store as string representation of the number (DB will handle numeric(12,2))
      numericValue = cleanValue
    }

    const { error } = await supabase
      .from('connections')
      .update({ contract_value: numericValue })
      .eq('id', connectionId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating contract value:', error)
      }
      return { success: false, error: error.message }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating contract value:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateContractEndDate(
  connectionId: string,
  contractEndDate: string | null
) {
  const supabase = await createClient()
  
  try {
    // Parse the formatted date (e.g., "30 Jul 2027") to ISO format for the database
    let isoDate: string | null = null
    
    if (contractEndDate) {
      const parsedDate = new Date(contractEndDate)
      
      if (isNaN(parsedDate.getTime())) {
        return { success: false, error: 'Invalid date provided.' }
      }
      
      // Convert to ISO date string (YYYY-MM-DD) using local date to avoid timezone shifts
      const year = parsedDate.getFullYear()
      const month = String(parsedDate.getMonth() + 1).padStart(2, '0')
      const day = String(parsedDate.getDate()).padStart(2, '0')
      isoDate = `${year}-${month}-${day}`
    }

    const { error } = await supabase
      .from('connections')
      .update({ contract_end_on: isoDate })
      .eq('id', connectionId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating contract end date:', error)
      }
      return { success: false, error: error.message }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating contract end date:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateHealthStatus(
  connectionId: string,
  healthStatus: string | null
) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase
      .from('connections')
      .update({ health_status: healthStatus })
      .eq('id', connectionId)
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating health status:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    revalidatePath('/home')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating health status:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function updateAgencyPrimaryContact(
  connectionId: string,
  memberId: string | null
) {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase
      .from('connections')
      .update({ agency_primary_contact_id: memberId })
      .eq('id', connectionId)
    
    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating agency primary contact:', error)
      }
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating agency primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

const DraftClientOrganizationSchema = z.object({
  connectionId: z.string().uuid(),
  name: z.string().min(1, "Organization name is required").optional(),
  website: z.string().url("Please enter a valid website URL").optional().or(z.literal("")),
  description: z.string().optional(),
  industry: z.string().optional(),
  logo_file: z.instanceof(File).optional(),
})

export async function updateDraftClientOrganization(data: {
  connectionId: string
  name?: string
  website?: string
  description?: string
  industry?: string
  logo_file?: File
}) {
  const supabase = await createClient()
  
  try {
    // Validate input data
    const parsed = DraftClientOrganizationSchema.safeParse({
      ...data,
      connectionId: data.connectionId
    })
    
    if (!parsed.success) {
      return { 
        success: false, 
        error: parsed.error.errors[0]?.message || 'Invalid input data' 
      }
    }

    // Verify the user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return { 
        success: false, 
        error: "Unauthorized" 
      }
    }

    // Get user's organization and verify it's an agency
    const { data: membership, error: membershipError } = await supabase
      .from('memberships')
      .select(`
        id,
        org_id,
        role,
        organizations!inner(
          id,
          type,
          owner_id
        )
      `)
      .eq('user_id', user.id)
      .is('organizations.is_draft', false)
      .single()

    let agencyOrgId: string | null = null

    if (membershipError || !membership) {
      // Try fallback: check if user is owner
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, type, owner_id')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single()

      if (ownerError || !ownerOrg || ownerOrg.type !== 'agency') {
        return { 
          success: false, 
          error: "You must be a member of an agency organization" 
        }
      }
      
      agencyOrgId = ownerOrg.id
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membership as any).organizations
      if (!org || org.type !== 'agency') {
        return { 
          success: false, 
          error: "You must be a member of an agency organization" 
        }
      }
      
      agencyOrgId = org.id
    }

    if (!agencyOrgId) {
      return { 
        success: false, 
        error: "Agency organization not found" 
      }
    }

    // Validate connection exists, belongs to agency, and is in draft state
    const { data: connection, error: connectionError } = await supabase
      .from('connections')
      .select('id, connection_status, client_id, agency_id')
      .eq('id', data.connectionId)
      .eq('agency_id', agencyOrgId)
      .single()

    if (connectionError || !connection) {
      return { 
        success: false, 
        error: "Connection not found or access denied" 
      }
    }

    // CRITICAL: Only allow updates if connection is in draft state
    if (connection.connection_status !== 'draft') {
      return { 
        success: false, 
        error: "Organization details can only be updated for draft connections" 
      }
    }

    // Get client organization ID
    const clientOrgId = connection.client_id
    if (!clientOrgId) {
      return { 
        success: false, 
        error: "Client organization not found" 
      }
    }

    // Prepare update data - only include fields that are provided
    const updateData: {
      name?: string
      website?: string | null
      description?: string | null
      industry?: string
      updated_at: string
      logo_url?: string
    } = {
      updated_at: new Date().toISOString()
    }

    // Only include fields that are provided (not undefined)
    if (data.name !== undefined) {
      updateData.name = data.name
    }
    if (data.website !== undefined) {
      updateData.website = data.website || null
    }
    if (data.description !== undefined) {
      updateData.description = data.description || null
    }
    if (data.industry !== undefined) {
      updateData.industry = data.industry
    }

    // Handle logo upload if provided
    if (data.logo_file) {
      try {
        const logoUrl = await uploadLogo(data.logo_file, clientOrgId)
        updateData.logo_url = logoUrl
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Logo upload error:', error)
        }
        return {
          success: false,
          error: `Logo upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        }
      }
    }

    // Update the client organization
    const { error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', clientOrgId)

    if (updateError) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Organization update error:', updateError)
      }
      return { 
        success: false, 
        error: updateError.message 
      }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${data.connectionId}`)
    revalidatePath(`/agencies/${data.connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating draft client organization:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

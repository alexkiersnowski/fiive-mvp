'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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
      console.error('Error updating client primary contact:', error)
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating client primary contact:', error)
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
      console.error('Error updating engagement status:', error)
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating engagement status:', error)
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
      console.error('Error updating contract value:', error)
      return { success: false, error: error.message }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating contract value:', error)
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
      console.error('Error updating contract end date:', error)
      return { success: false, error: error.message }
    }

    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')

    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating contract end date:', error)
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
      console.error('Error updating health status:', error)
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating health status:', error)
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
      console.error('Error updating agency primary contact:', error)
      return { success: false, error: error.message }
    }
    
    // Revalidate the connection pages to reflect the changes
    revalidatePath(`/clients/${connectionId}`)
    revalidatePath(`/agencies/${connectionId}`)
    revalidatePath('/clients')
    revalidatePath('/agencies')
    
    return { success: true }
  } catch (error) {
    console.error('Unexpected error updating agency primary contact:', error)
    return { success: false, error: 'An unexpected error occurred' }
  }
}

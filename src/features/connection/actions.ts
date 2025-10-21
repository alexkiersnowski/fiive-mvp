'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

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

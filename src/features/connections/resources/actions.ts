'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CreateConnectionResourceInput = {
  connectionId: string
  url: string
  label?: string | null
  clientVisible: boolean
  createdByUserId: string
}

export async function createConnectionResource({
  connectionId,
  url,
  label,
  clientVisible,
  createdByUserId
}: CreateConnectionResourceInput) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('connection_resources')
      .insert({
        connection_id: connectionId,
        url,
        label: label?.trim() ? label.trim() : null,
        client_visible: clientVisible,
        created_by_user_id: createdByUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error creating connection resource:', error)
      }
      return { success: false, error: error.message }
    }

    // Revalidate potential routes where resources are displayed
    revalidatePath(`/clients/${connectionId}/overview`)
    revalidatePath(`/agencies/${connectionId}/overview`)

    return { success: true, data }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error creating connection resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while creating the resource.' }
  }
}

type UpdateConnectionResourceInput = {
  resourceId: string
  connectionId: string
  url: string
  label?: string | null
  clientVisible: boolean
}

export async function updateConnectionResource({
  resourceId,
  connectionId,
  url,
  label,
  clientVisible
}: UpdateConnectionResourceInput) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('connection_resources')
      .update({
        url,
        label: label?.trim() ? label.trim() : null,
        client_visible: clientVisible
      })
      .eq('id', resourceId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating connection resource:', error)
      }
      return { success: false, error: error.message }
    }

    revalidatePath(`/clients/${connectionId}/overview`)
    revalidatePath(`/agencies/${connectionId}/overview`)

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating connection resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while updating the resource.' }
  }
}

export async function deleteConnectionResource(resourceId: string, connectionId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('connection_resources')
      .delete()
      .eq('id', resourceId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting connection resource:', error)
      }
      return { success: false, error: error.message }
    }

    revalidatePath(`/clients/${connectionId}/overview`)
    revalidatePath(`/agencies/${connectionId}/overview`)

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error deleting connection resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while deleting the resource.' }
  }
}



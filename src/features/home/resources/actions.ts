'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

type CreateOrganizationResourceInput = {
  organizationId: string
  url: string
  label?: string | null
  createdByUserId: string
}

export async function createOrganizationResource({
  organizationId,
  url,
  label,
  createdByUserId
}: CreateOrganizationResourceInput) {
  const supabase = await createClient()

  try {
    const { data, error } = await supabase
      .from('organization_resources')
      .insert({
        organization_id: organizationId,
        url,
        label: label?.trim() ? label.trim() : null,
        created_by_user_id: createdByUserId,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error creating organization resource:', error)
      }
      return { success: false, error: error.message }
    }

    // Revalidate home page where resources are displayed
    revalidatePath('/home')

    return { success: true, data }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error creating organization resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while creating the resource.' }
  }
}

type UpdateOrganizationResourceInput = {
  resourceId: string
  organizationId: string
  url: string
  label?: string | null
}

export async function updateOrganizationResource({
  resourceId,
  organizationId,
  url,
  label
}: UpdateOrganizationResourceInput) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('organization_resources')
      .update({
        url,
        label: label?.trim() ? label.trim() : null
      })
      .eq('id', resourceId)
      .eq('organization_id', organizationId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error updating organization resource:', error)
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/home')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error updating organization resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while updating the resource.' }
  }
}

export async function deleteOrganizationResource(resourceId: string, organizationId: string) {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from('organization_resources')
      .delete()
      .eq('id', resourceId)
      .eq('organization_id', organizationId)

    if (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting organization resource:', error)
      }
      return { success: false, error: error.message }
    }

    revalidatePath('/home')

    return { success: true }
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Unexpected error deleting organization resource:', error)
    }
    return { success: false, error: 'An unexpected error occurred while deleting the resource.' }
  }
}


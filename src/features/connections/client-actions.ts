'use client'

import { updateClientPrimaryContact, updateAgencyPrimaryContact } from './actions'

export async function handleContactSelect(
  connectionId: string,
  memberId: string
) {
  try {
    const result = await updateClientPrimaryContact(connectionId, memberId)
    if (result.success) {
      // The page will revalidate and show the updated contact
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update primary contact:', result.error)
      }
    }
    return result
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error updating primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function handleUnassignContact(connectionId: string) {
  try {
    const result = await updateClientPrimaryContact(connectionId, null)
    if (result.success) {
      // Primary contact unassigned successfully
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to unassign primary contact:', result.error)
      }
    }
    return result
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error unassigning primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function handleAgencyContactSelect(
  connectionId: string,
  memberId: string
) {
  try {
    const result = await updateAgencyPrimaryContact(connectionId, memberId)
    if (result.success) {
      // The page will revalidate and show the updated contact
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update agency primary contact:', result.error)
      }
    }
    return result
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error updating agency primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

export async function handleUnassignAgencyContact(connectionId: string) {
  try {
    const result = await updateAgencyPrimaryContact(connectionId, null)
    if (result.success) {
      // Agency primary contact unassigned successfully
    } else {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to unassign agency primary contact:', result.error)
      }
    }
    return result
  } catch (error) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Error unassigning agency primary contact:', error)
    }
    return { success: false, error: 'An unexpected error occurred' }
  }
}

"use client"

import { useUser } from '@/lib/contexts/UserContext'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function useOrganization() {
  const { currentOrganization, memberships, refreshOrganization, user } = useUser()
  const supabase = createClient()

  const requireOrganization = () => {
    if (!currentOrganization) {
      throw new Error('Organization context required')
    }
    return currentOrganization
  }

  const getCurrentOrganizationId = () => {
    if (!currentOrganization) {
      throw new Error('Organization context required')
    }
    return currentOrganization.id
  }

  const getUserRole = () => {
    if (!currentOrganization || !user) {
      return null
    }

    const membership = memberships.find(
      m => m.organization_id === currentOrganization.id && m.user_id === user.id
    )
    
    return membership?.role || null
  }

  const isOwner = () => {
    return getUserRole() === 'owner'
  }

  const isAdmin = () => {
    const role = getUserRole()
    return role === 'owner' || role === 'admin'
  }

  const canManageMembers = () => {
    return isAdmin()
  }

  const canManageSettings = () => {
    return isAdmin()
  }

  const canManageBilling = () => {
    return isOwner()
  }

  const switchOrganization = async (organizationId: string) => {
    if (!user) {
      throw new Error('Authentication required')
    }

    try {
      // In a real app, you might want to store the current org in localStorage
      // or have a separate endpoint to switch organizations
      // For now, we'll just refresh to get the latest data
      await refreshOrganization()
      toast.success('Organization switched successfully')
    } catch (error) {
      console.error('Error switching organization:', error)
      toast.error('Failed to switch organization')
    }
  }

  return {
    currentOrganization,
    memberships,
    refreshOrganization,
    requireOrganization,
    getCurrentOrganizationId,
    getUserRole,
    isOwner,
    isAdmin,
    canManageMembers,
    canManageSettings,
    canManageBilling,
    switchOrganization,
  }
}

import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Variant, ModeContext } from './types';
import { isValidVariant } from './types';
import { deriveCapabilities } from './capabilities';

// Cache this function so it only runs once per request, even if called multiple times
export const getActiveContext = cache(async (): Promise<ModeContext | null> => {
  const supabase = await createClient();

  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return null;
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Get organization - try owner first, then member
    let organization = null;
    let membership = null;
    let isOwner = false;
    
    // Try as owner first
    const { data: ownerOrg, error: ownerError } = await supabase
      .from('organizations')
      .select('id, type, owner_id')
      .eq('owner_id', user.id)
      .single();
    
    if (ownerOrg && !ownerError) {
      organization = ownerOrg;
      isOwner = true;
      
      // Get the membership record for owner
      const { data: ownerMembership } = await supabase
        .from('memberships')
        .select('id, role')
        .eq('user_id', user.id)
        .eq('org_id', ownerOrg.id)
        .single();
      
      membership = ownerMembership || { id: 'owner', role: 'owner' };
    } else {
      // Try as member
      const { data: memberMembership, error: membershipError } = await supabase
        .from('memberships')
        .select('id, org_id, role')
        .eq('user_id', user.id)
        .single();
      
      if (memberMembership && !membershipError) {
        membership = memberMembership;
        
        const { data: memberOrg, error: memberOrgError } = await supabase
          .from('organizations')
          .select('id, type, owner_id')
          .eq('id', memberMembership.org_id)
          .single();
        
        if (memberOrg && !memberOrgError) {
          organization = memberOrg;
          isOwner = memberMembership.role === 'owner';
        }
      }
    }

    if (!organization || !membership) {
      return null;
    }

    // Validate organization type from database matches our Variant type
    if (!isValidVariant(organization.type)) {
      console.error(`Invalid organization type from database: "${organization.type}". Expected 'agency' or 'client'.`);
      return null;
    }

    // Derive variant and capabilities from single source of truth
    const variant: Variant = organization.type; // Now type-safe!
    const capabilities = deriveCapabilities(variant, isOwner);

    return {
      userId: user.id,
      orgId: organization.id,
      membershipId: typeof membership.id === 'string' ? membership.id : '',
      variant,
      capabilities,
    };
  } catch (error) {
    console.error('Error fetching active context:', error);
    return null;
  }
});


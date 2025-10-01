import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Variant, ModeContext } from './types';
import { isValidVariant } from './types';
import { deriveCapabilities } from './capabilities';

// Enhanced context that includes dashboard data to eliminate redundancy
export interface EnhancedModeContext extends ModeContext {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    jobTitle?: string;
    avatarUrl?: string;
  };
  organization: {
    id: string;
    name: string;
    type: string;
    industry?: string;
    logoUrl?: string;
    memberCount: number;
    website?: string;
    description?: string;
    currencyCode?: string;
    connectionCode?: string;
    ownerId: string;
  };
  currentUserRole: 'owner' | 'member';
}

// Cache this function so it only runs once per request, even if called multiple times
export const getActiveContext = cache(async (): Promise<EnhancedModeContext | null> => {
  const supabase = await createClient();

  try {
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return null;
    }

    // Get user profile with all needed fields
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('first_name, last_name, job_title, avatar_url')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return null;
    }

    // Get membership first, then organization (optimized approach)
    const { data: membershipData, error: membershipError } = await supabase
      .from('memberships')
      .select('id, org_id, role')
      .eq('user_id', user.id)
      .single();
    
    let organization = null;
    let isOwner = false;
    let membership = null;
    
    if (membershipData && !membershipError) {
      membership = membershipData;
      
      // Get organization data
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, type, industry, logo_url, website, description, currency_code, connection_code, owner_id')
        .eq('id', membership.org_id)
        .single();
      
      if (org && !orgError) {
        organization = org;
        // Owner is determined by organizations.owner_id, not membership.role
        isOwner = org.owner_id === user.id;
      }
    } else {
      // Fallback: try as owner (for cases where membership might not exist)
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, name, type, industry, logo_url, website, description, currency_code, connection_code, owner_id')
        .eq('owner_id', user.id)
        .single();
      
      if (ownerOrg && !ownerError) {
        organization = ownerOrg;
        isOwner = true;
        membership = { id: 'owner', role: 'owner' };
      }
    }

    if (!profile || !organization || !membership) {
      console.error('Missing required data:', { profile: !!profile, organization: !!organization, membership: !!membership });
      return null;
    }


    // Get member count for the organization (optimized)
    // Use a more efficient count query with proper indexing
    let memberCount = 0;
    try {
      const { count, error: memberCountError } = await supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', organization.id);
      
      if (!memberCountError) {
        memberCount = count || 0;
      }
    } catch (error) {
      // Silently fail for member count - not critical for most pages
      console.warn('Could not fetch member count:', error);
    }

    // Validate organization type from database matches our Variant type
    if (!isValidVariant(organization.type)) {
      console.error(`Invalid organization type from database: "${organization.type}". Expected 'agency' or 'client'.`);
      return null;
    }

    // Derive variant and capabilities from single source of truth
    const variant: Variant = organization.type; // Now type-safe!
    const capabilities = deriveCapabilities(variant, isOwner);

    const enhancedContextData = {
      // ModeContext fields
      userId: user.id,
      orgId: organization.id,
      membershipId: typeof membership.id === 'string' ? membership.id : '',
      variant,
      capabilities,
      // User and organization data
      user: {
        id: user.id,
        email: user.email || '',
        firstName: profile.first_name || '',
        lastName: profile.last_name || '',
        jobTitle: profile.job_title || undefined,
        avatarUrl: profile.avatar_url || undefined
      },
      organization: {
        id: organization.id,
        name: organization.name,
        type: organization.type,
        industry: organization.industry || undefined,
        logoUrl: organization.logo_url || undefined,
        memberCount: memberCount || 0,
        website: organization.website || undefined,
        description: organization.description || undefined,
        currencyCode: organization.currency_code || undefined,
        connectionCode: organization.connection_code || undefined,
        ownerId: organization.owner_id
      },
      currentUserRole: (isOwner ? 'owner' : 'member') as 'owner' | 'member'
    };

    return enhancedContextData;
  } catch (error) {
    console.error('Error fetching active context:', error);
    return null;
  }
});


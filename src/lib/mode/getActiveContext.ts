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
    is_draft?: boolean; // Included for validation - should always be false for active contexts
    billing_status?: string;
    stripe_price_id?: string;
    current_period_end?: string;
  };
  currentUserRole: 'owner' | 'member';
}

// Cache this function so it only runs once per request, even if called multiple times
export const getActiveContext = cache(async (): Promise<EnhancedModeContext | null> => {
  const startTime = performance.now();
  const supabase = await createClient();

  try {
    // Get the current user (must be first - provides user.id for subsequent queries)
    const authStartTime = performance.now();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    console.log(`[Performance] auth.getUser: ${(performance.now() - authStartTime).toFixed(2)}ms`);
    
    if (userError || !user) {
      return null;
    }

    // Fetch profile and membership+org in parallel for maximum performance
    const parallelStartTime = performance.now();
    const [
      { data: profile, error: profileError },
      { data: membershipWithOrgAndCount, error: membershipError }
    ] = await Promise.all([
      // Query 1: User profile
      supabase
        .from('profiles')
        .select('first_name, last_name, job_title, avatar_url')
        .eq('id', user.id)
        .single(),
      
      // Query 2: Membership WITH joined organization data
      // CRITICAL: Filter out draft organizations - they cannot be active contexts
      supabase
        .from('memberships')
        .select(`
          id, 
          org_id, 
          role,
          organizations!memberships_org_id_fkey (
            id, name, type, industry, logo_url, 
            website, description, currency_code, 
            connection_code, owner_id, is_draft, billing_status, stripe_price_id, current_period_end
          )
        `)
        .eq('user_id', user.id)
        .is('organizations.is_draft', false)
        .single()
    ]);
    
    console.log(`[Performance] Parallel queries (profile + membership+org): ${(performance.now() - parallelStartTime).toFixed(2)}ms`);

    if (profileError || !profile) {
      console.error('Profile fetch failed:', profileError);
      return null;
    }

    let organization = null;
    let isOwner = false;
    let membership = null;
    let finalMemberCount = 0;
    
    if (membershipWithOrgAndCount && !membershipError) {
      membership = {
        id: membershipWithOrgAndCount.id,
        org_id: membershipWithOrgAndCount.org_id,
        role: membershipWithOrgAndCount.role
      };
      
      // Extract organization from joined data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const org = (membershipWithOrgAndCount as any).organizations;
      
      if (org) {
        organization = org;
        isOwner = org.owner_id === user.id;
        
        // Fetch member count - optimized to run in parallel with other operations
        // We use head: true for faster count-only queries (no data transfer)
        const countStartTime = performance.now();
        const { count, error: memberCountError } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', organization.id);
        
        console.log(`[Performance] Member count query: ${(performance.now() - countStartTime).toFixed(2)}ms`);
        
        if (!memberCountError) {
          finalMemberCount = count || 0;
        }
      }
    } else {
      // Fallback: try as owner (for cases where membership might not exist)
      // CRITICAL: Filter out draft organizations - they cannot be active contexts
      const fallbackStartTime = performance.now();
      const { data: ownerOrg, error: ownerError } = await supabase
        .from('organizations')
        .select('id, name, type, industry, logo_url, website, description, currency_code, connection_code, owner_id, is_draft, billing_status, stripe_price_id, current_period_end')
        .eq('owner_id', user.id)
        .is('is_draft', false)
        .single();
      
      console.log(`[Performance] Owner fallback query: ${(performance.now() - fallbackStartTime).toFixed(2)}ms`);
      
      if (ownerOrg && !ownerError) {
        organization = ownerOrg;
        isOwner = true;
        membership = { id: 'owner', role: 'owner' };
        
        // Fetch member count for owner org - optimized with head: true
        const { count } = await supabase
          .from('memberships')
          .select('*', { count: 'exact', head: true })
          .eq('org_id', ownerOrg.id);
        
        finalMemberCount = count || 0;
      }
    }

    if (!profile || !organization || !membership) {
      console.error('Missing required data:', { profile: !!profile, organization: !!organization, membership: !!membership });
      return null;
    }

    // CRITICAL: Runtime guard - reject draft organizations as active contexts
    // Draft orgs are only visible through connection views, never as logged-in contexts
    if (organization.is_draft === true) {
      const errorMessage = `SECURITY VIOLATION: Attempted to use draft organization as active context. Org ID: ${organization.id}, User ID: ${user.id}, Org Name: ${organization.name}`;
      console.error(errorMessage);
      
      // Log error (Sentry integration removed to avoid build-time module resolution issues)
      // Error is logged to console for debugging purposes
      // If Sentry is needed in the future, it should be installed as a dependency
      console.error(errorMessage);
      
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
        memberCount: finalMemberCount || 0,
        website: organization.website || undefined,
        description: organization.description || undefined,
        currencyCode: organization.currency_code || undefined,
        connectionCode: organization.connection_code || undefined,
        ownerId: organization.owner_id,
        is_draft: organization.is_draft || false, // Should always be false for active contexts
        billing_status: organization.billing_status || undefined,
        stripe_price_id: organization.stripe_price_id || undefined,
        current_period_end: organization.current_period_end || undefined
      },
      currentUserRole: (isOwner ? 'owner' : 'member') as 'owner' | 'member'
    };

    const totalTime = performance.now() - startTime;
    console.log(`[Performance] getActiveContext TOTAL: ${totalTime.toFixed(2)}ms`);

    return enhancedContextData;
  } catch (error) {
    console.error('Error fetching active context:', error);
    return null;
  }
});


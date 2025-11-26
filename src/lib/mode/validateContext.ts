import type { EnhancedModeContext } from './getActiveContext';

/**
 * Validates that an organization context is safe to use as an active context.
 * 
 * This function ensures:
 * 1. The organization is not a draft (draft orgs cannot be active contexts)
 * 2. The variant matches the organization type
 * 3. The organization has required fields
 * 
 * @param context - The enhanced mode context to validate
 * @returns true if context is valid, false otherwise
 */
export function validateOrgContext(context: EnhancedModeContext | null): boolean {
  if (!context) {
    return false;
  }

    // CRITICAL: Draft organizations cannot be active contexts
    // They are only visible through connection views, never as logged-in org contexts
    if (context.organization.is_draft === true) {
      const errorMessage = `SECURITY VIOLATION: Draft organization cannot be active context. Org ID: ${context.orgId}, Variant: ${context.variant}, Org Name: ${context.organization.name}`;
      console.error(errorMessage);
      // Note: Sentry logging is handled in getActiveContext.ts (async function)
      // This synchronous function only logs to console to avoid build-time module resolution issues
      
      return false;
    }

  // Validate variant matches organization type
  if (context.variant !== context.organization.type) {
    const errorMessage = `Context variant mismatch: variant=${context.variant}, orgType=${context.organization.type}`;
    console.error(errorMessage);
    
    if (typeof window !== 'undefined') {
      const windowWithSentry = window as { Sentry?: { captureException: (error: Error, options?: { tags?: Record<string, string>; extra?: Record<string, unknown> }) => void } };
      if (windowWithSentry.Sentry) {
        windowWithSentry.Sentry.captureException(new Error(errorMessage), {
          tags: { type: 'context_variant_mismatch' },
          extra: { 
            orgId: context.orgId, 
            variant: context.variant,
            orgType: context.organization.type
          }
        });
      }
    }
    
    return false;
  }

  // Validate required fields
  if (!context.orgId || !context.userId || !context.organization.id) {
    console.error('Context missing required fields:', {
      hasOrgId: !!context.orgId,
      hasUserId: !!context.userId,
      hasOrgData: !!context.organization.id
    });
    return false;
  }

  return true;
}

/**
 * Asserts that a context is valid, throwing an error if not.
 * Use this in critical paths where invalid context should cause immediate failure.
 */
export function assertValidOrgContext(context: EnhancedModeContext | null): asserts context is EnhancedModeContext {
  if (!validateOrgContext(context)) {
    throw new Error('Invalid organization context: context validation failed');
  }
}


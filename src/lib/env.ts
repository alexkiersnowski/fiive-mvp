/**
 * Centralized server-side environment variables
 * 
 * These are server-only variables (without NEXT_PUBLIC_ prefix)
 * and are available at runtime, unlike NEXT_PUBLIC_ variables
 * which are embedded at build time.
 */

// SITE_URL is used for server-side URL construction (emails, webhooks, etc.)
// Falls back to localhost:3000 for local development only
export const SITE_URL = process.env.SITE_URL || (process.env.NODE_ENV !== 'production' ? 'http://localhost:3000' : undefined);

if (!SITE_URL && process.env.NODE_ENV === 'production') {
  throw new Error('SITE_URL environment variable is required in production');
}

// Export other server-only env vars for consistency
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;


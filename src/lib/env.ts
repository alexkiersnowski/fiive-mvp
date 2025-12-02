/**
 * Centralized server-side environment variables
 * 
 * These are server-only variables (without NEXT_PUBLIC_ prefix)
 * and are available at runtime, unlike NEXT_PUBLIC_ variables
 * which are embedded at build time.
 */

// SITE_URL is used for server-side URL construction (emails, webhooks, etc.)
// Only allow localhost fallback in true local development (not on Vercel)
// In any deployed environment (Vercel preview/production), require SITE_URL to be set
const isLocalDevelopment = process.env.NODE_ENV === 'development' && !process.env.VERCEL;
export const SITE_URL = process.env.SITE_URL || (isLocalDevelopment ? 'http://localhost:3000' : undefined);

// Fail fast if SITE_URL is missing in any non-local environment
if (!SITE_URL) {
  throw new Error('SITE_URL environment variable is required. Set it in your Vercel environment variables.');
}

// Export other server-only env vars for consistency
export const RESEND_API_KEY = process.env.RESEND_API_KEY;
export const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;


/**
 * Shared constants for connections features (requests, projects, etc.)
 */

export const PAGE_SIZE = 50; // Reduced from 100 for MVP performance
// Decision: Start with 50
// Drop to 25 only if:
// - Initial payload is still > ~150ms
// - OR mobile performance is bad
// Do not bikeshed this - lock at 50 for MVP
export const PREFETCH_TIMEOUT_MS = 5000; // Reduced from 10000 to prevent stale prefetched data

// Note: VIRTUAL_ROW_HEIGHT and VIRTUAL_OVERSCAN are now imported from
// @/components/virtual-table to ensure consistency across all tables

// Helper to check if we're in development
export const isDev = () => process.env.NODE_ENV !== 'production';


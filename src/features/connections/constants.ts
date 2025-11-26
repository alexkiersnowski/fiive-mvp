/**
 * Shared constants for connections features (requests, projects, etc.)
 */

export const PAGE_SIZE = 100; // Optimized for virtual scrolling - larger batches reduce network round trips
export const PREFETCH_TIMEOUT_MS = 5000; // Reduced from 10000 to prevent stale prefetched data

// Note: VIRTUAL_ROW_HEIGHT and VIRTUAL_OVERSCAN are now imported from
// @/components/virtual-table to ensure consistency across all tables

// Helper to check if we're in development
export const isDev = () => process.env.NODE_ENV !== 'production';


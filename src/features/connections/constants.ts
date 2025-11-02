/**
 * Shared constants for connections features (requests, projects, etc.)
 */

export const PAGE_SIZE = 50;
export const PREFETCH_TIMEOUT_MS = 10000;

// Note: VIRTUAL_ROW_HEIGHT and VIRTUAL_OVERSCAN are now imported from
// @/components/virtual-table to ensure consistency across all tables

// Helper to check if we're in development
export const isDev = () => process.env.NODE_ENV !== 'production';


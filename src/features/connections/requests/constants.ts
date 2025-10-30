/**
 * Constants for requests table pagination and virtual scroll
 */

export const PAGE_SIZE = 50;
export const PREFETCH_TIMEOUT_MS = 10000;

// Virtual scroll constants
export const VIRTUAL_ROW_HEIGHT = 44; // matches [&>*]:h-[44px] in RequestsTable.tsx
export const VIRTUAL_OVERSCAN = 10; // render 10 extra rows above/below viewport

// Helper to check if we're in development
export const isDev = () => process.env.NODE_ENV !== 'production';


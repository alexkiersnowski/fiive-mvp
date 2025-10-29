/**
 * Constants for requests table pagination and infinite scroll
 */

export const PAGE_SIZE = 50;
export const INTERSECTION_ROOT_MARGIN = '0px 0px 250px 0px'; // top right bottom left
export const INTERSECTION_THRESHOLD = 0.1;
export const SENTINEL_SETUP_DELAY_MS = 100;
export const PREFETCH_TIMEOUT_MS = 10000;

// Helper to check if we're in development
export const isDev = () => process.env.NODE_ENV !== 'production';


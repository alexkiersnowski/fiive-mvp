/**
 * Shared constants for virtual tables across Fiive
 * This is the single source of truth for virtual scroll settings
 */

export const VIRTUAL_ROW_HEIGHT = 44 // Standard row height across all tables
export const VIRTUAL_OVERSCAN = 10 // Render 10 extra rows above/below viewport
export const VIRTUAL_LOAD_MORE_THRESHOLD = 20 // Trigger loadMore when within N items of end
export const VIRTUAL_LOAD_MORE_DEBOUNCE = 100 // Debounce loadMore triggers (ms)


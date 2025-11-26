export type Variant = 'agency' | 'client';

// Runtime validator to ensure database value matches our type
export function isValidVariant(value: unknown): value is Variant {
  return value === 'agency' || value === 'client';
}

// Re-export Capabilities from the single source of truth
export type { Capabilities } from './capabilities';

// Import for use in ModeContext
import type { Capabilities } from './capabilities';

export type ModeContext = {
  userId: string;
  orgId: string;
  membershipId: string;
  variant: Variant;
  capabilities: Capabilities;
};


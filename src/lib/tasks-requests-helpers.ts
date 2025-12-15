'use client'

/**
 * Shared helper for handling paywall errors in task/request operations.
 * Wraps any async function and handles "workspace_limit" errors by showing paywall modal.
 * 
 * @param fn - The async function to execute
 * @param onSuccess - Callback when operation succeeds
 * @param onPaywall - Callback when paywall is triggered (should open paywall modal)
 */
export async function runWithPaywallCheck<T>(
  fn: () => Promise<T>,
  onSuccess: (result: T) => void,
  onPaywall: () => void
): Promise<void> {
  try {
    const result = await fn();
    onSuccess(result);
  } catch (error) {
    // Check if error is "workspace_limit" (from server-side check)
    if (error instanceof Error && error.message === 'workspace_limit') {
      onPaywall();
    } else {
      // Re-throw other errors so they can be handled by the caller
      throw error;
    }
  }
}


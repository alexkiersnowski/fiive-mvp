'use client';

import { useMode } from '@/lib/mode/ModeContext';
import type { Capabilities } from '@/lib/mode/capabilities';

interface CapabilityGateProps {
  /**
   * The capability to check
   */
  capability: keyof Capabilities;
  /**
   * Content to render if user has the capability
   */
  children: React.ReactNode;
  /**
   * Content to render if user doesn't have the capability (optional)
   */
  fallback?: React.ReactNode;
  /**
   * Whether to render nothing if user doesn't have the capability
   * (overrides fallback if true)
   */
  hideIfNotAllowed?: boolean;
}

/**
 * CapabilityGate - Conditionally render content based on user capabilities
 * 
 * Usage:
 * <CapabilityGate capability="canSeeClients">
 *   <ClientsList />
 * </CapabilityGate>
 * 
 * <CapabilityGate 
 *   capability="canManageBilling" 
 *   fallback={<div>Upgrade to manage billing</div>}
 * >
 *   <BillingSettings />
 * </CapabilityGate>
 */
export function CapabilityGate({ 
  capability, 
  children, 
  fallback = null,
  hideIfNotAllowed = false 
}: CapabilityGateProps) {
  const { capabilities } = useMode();
  
  if (!capabilities[capability]) {
    return hideIfNotAllowed ? null : <>{fallback}</>;
  }
  
  return <>{children}</>;
}

/**
 * MultiCapabilityGate - Check multiple capabilities with AND/OR logic
 */
interface MultiCapabilityGateProps {
  /**
   * Capabilities to check
   */
  capabilities: (keyof Capabilities)[];
  /**
   * Whether user needs ALL capabilities (AND) or ANY capability (OR)
   * @default 'any'
   */
  mode?: 'all' | 'any';
  children: React.ReactNode;
  fallback?: React.ReactNode;
  hideIfNotAllowed?: boolean;
}

export function MultiCapabilityGate({ 
  capabilities: requiredCapabilities, 
  mode = 'any',
  children, 
  fallback = null,
  hideIfNotAllowed = false 
}: MultiCapabilityGateProps) {
  const { capabilities: userCapabilities } = useMode();
  
  const hasRequiredCapabilities = mode === 'all' 
    ? requiredCapabilities.every(capability => userCapabilities[capability])
    : requiredCapabilities.some(capability => userCapabilities[capability]);
  
  if (!hasRequiredCapabilities) {
    return hideIfNotAllowed ? null : <>{fallback}</>;
  }
  
  return <>{children}</>;
}

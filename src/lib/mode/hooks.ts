'use client';

import { useMode } from './ModeContext';
import type { Capabilities } from './capabilities';

/**
 * Capability-based hooks for better reusability and cleaner component code
 * 
 * Usage:
 * const canManageClients = useCanManageClients();
 * const canSubmitRequests = useCanSubmitRequests();
 */

export const useCanSeeClients = () => {
  const { capabilities } = useMode();
  return capabilities.canSeeClients;
};

export const useCanSeeAgencies = () => {
  const { capabilities } = useMode();
  return capabilities.canSeeAgencies;
};

export const useCanViewAllRequests = () => {
  const { capabilities } = useMode();
  return capabilities.canViewAllRequests;
};

export const useCanSubmitRequests = () => {
  const { capabilities } = useMode();
  return capabilities.canSubmitRequests;
};

export const useCanAssignRequests = () => {
  const { capabilities } = useMode();
  return capabilities.canAssignRequests;
};

export const useCanCloseRequests = () => {
  const { capabilities } = useMode();
  return capabilities.canCloseRequests;
};

export const useCanViewAllTasks = () => {
  const { capabilities } = useMode();
  return capabilities.canViewAllTasks;
};

export const useCanCreateTasks = () => {
  const { capabilities } = useMode();
  return capabilities.canCreateTasks;
};

export const useCanAssignTasks = () => {
  const { capabilities } = useMode();
  return capabilities.canAssignTasks;
};

export const useCanViewOwnTasks = () => {
  const { capabilities } = useMode();
  return capabilities.canViewOwnTasks;
};

export const useCanSeeBudgets = () => {
  const { capabilities } = useMode();
  return capabilities.canSeeBudgets;
};

export const useCanManageBilling = () => {
  const { capabilities } = useMode();
  return capabilities.canManageBilling;
};

export const useCanInviteMembers = () => {
  const { capabilities } = useMode();
  return capabilities.canInviteMembers;
};

export const useCanManageMembers = () => {
  const { capabilities } = useMode();
  return capabilities.canManageMembers;
};

export const useCanManageConnections = () => {
  const { capabilities } = useMode();
  return capabilities.canManageConnections;
};

/**
 * Generic capability hook for custom capabilities
 */
export const useCapability = <K extends keyof Capabilities>(capability: K): Capabilities[K] => {
  const { capabilities } = useMode();
  return capabilities[capability];
};

/**
 * Check if user has any of the specified capabilities
 */
export const useHasAnyCapability = (capabilities: (keyof Capabilities)[]): boolean => {
  const { capabilities: userCapabilities } = useMode();
  return capabilities.some(capability => userCapabilities[capability]);
};

/**
 * Check if user has all of the specified capabilities
 */
export const useHasAllCapabilities = (capabilities: (keyof Capabilities)[]): boolean => {
  const { capabilities: userCapabilities } = useMode();
  return capabilities.every(capability => userCapabilities[capability]);
};

/**
 * Shared request formatting utilities
 * Used across getRequestsForConnection and getRequestById
 */

interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
  job_title?: string;
}

interface UserOrgMap {
  [userId: string]: {
    orgId: string;
    orgName: string;
    orgLogo?: string;
  };
}

interface OrgTypeMap {
  [orgId: string]: 'agency' | 'client';
}

// Removed unused Connection interface

/**
 * Format a user's full name from profile data
 */
export function formatUserName(profile: Profile | null): string {
  if (!profile) return 'Unknown User';
  const firstName = profile.first_name || '';
  const lastName = profile.last_name || '';
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || 'Unknown User';
}

/**
 * Format a date as "DD MMM YYYY" (e.g., "15 Jan 2024")
 */
export function formatRequestDate(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Build submitted by user info
 */
export function buildSubmittedBy(
  userId: string,
  profile: Profile | null,
  userOrgMap: UserOrgMap
) {
  return {
    id: userId,
    name: formatUserName(profile),
    email: profile?.email || '',
    avatarUrl: profile?.avatar_url || undefined,
    jobTitle: profile?.job_title || undefined,
    orgId: userOrgMap[userId]?.orgId || '',
    orgName: userOrgMap[userId]?.orgName || '',
    orgLogo: userOrgMap[userId]?.orgLogo
  };
}

/**
 * Build assignee user info
 */
export function buildAssignee(
  userId: string | null,
  profile: Profile | null,
  organizationId?: string | null
) {
  if (!userId || !profile) return null;
  
  return {
    id: userId,
    name: formatUserName(profile),
    email: profile.email,
    avatarUrl: profile.avatar_url || undefined,
    organizationId: organizationId || undefined
  };
}

/**
 * Build organization info (client or agency)
 */
export function buildOrganization(
  orgId: string,
  orgName: string | undefined,
  orgLogo: string | undefined,
  fallbackName: string
) {
  return {
    id: orgId,
    name: orgName || fallbackName,
    logoUrl: orgLogo
  };
}

/**
 * Get organization type from map
 */
export function getOrgType(
  orgId: string | null,
  orgTypeMap: OrgTypeMap
): 'agency' | 'client' | undefined {
  if (!orgId) return undefined;
  return orgTypeMap[orgId];
}

/**
 * Format a project date as "DD MMM YYYY" (e.g., "15 Jan 2024")
 * Reuses the same logic as formatRequestDate for consistency
 */
export function formatProjectDate(dateString: string | null | undefined): string {
  if (!dateString) return '';
  return formatRequestDate(dateString);
}

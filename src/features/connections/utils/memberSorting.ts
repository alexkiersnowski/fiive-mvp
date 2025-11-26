export interface MemberSummary {
  id: string
  firstName: string
  lastName: string
  email: string
  avatarUrl?: string
  jobTitle?: string
  orgId?: string
  orgName?: string
  orgType?: 'agency' | 'client'
}

const buildSortableName = (member: MemberSummary) => {
  const parts = [member.firstName, member.lastName].filter(Boolean)
  if (parts.length === 0 && member.email) {
    return member.email.toLowerCase()
  }
  return parts.join(' ').toLowerCase()
}

export const sortMembersWithActiveFirst = (
  members: MemberSummary[],
  activeUserId?: string | null
): MemberSummary[] => {
  const activeId = activeUserId ?? undefined
  return [...members].sort((a, b) => {
    const aIsActive = activeId ? a.id === activeId : false
    const bIsActive = activeId ? b.id === activeId : false
    if (aIsActive && !bIsActive) return -1
    if (!aIsActive && bIsActive) return 1
    const nameA = buildSortableName(a)
    const nameB = buildSortableName(b)
    return nameA.localeCompare(nameB)
  })
}


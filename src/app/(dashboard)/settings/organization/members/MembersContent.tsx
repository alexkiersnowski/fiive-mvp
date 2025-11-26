'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import MembersTable from './MembersTable'
import { OrganizationMember, OrganizationInvitation, getOrganizationMembers, getOrganizationInvitations } from '../../actions'
import type { VirtualItem } from '@tanstack/react-virtual'

const PAGE_SIZE = 100

interface MembersContentProps {
  members: OrganizationMember[]
  invitations: OrganizationInvitation[]
  organizationId: string
  currentUserRole: 'owner' | 'member'
  unfilteredTotalCount: number
  initialHasNextPage: boolean
}

export default function MembersContent({
  members: initialMembers,
  invitations: initialInvitations,
  organizationId,
  currentUserRole,
  unfilteredTotalCount,
  initialHasNextPage
}: MembersContentProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const parentRef = useRef<HTMLDivElement | null>(null)
  const headerWrapperRef = useRef<HTMLDivElement>(null)
  const [headerOffset, setHeaderOffset] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const membersTableRef = useRef<{ openInviteDialog: () => void } | null>(null)
  const currentRequestRef = useRef(0)
  const canManageRoles = currentUserRole === 'owner'
  
  // Pagination state
  const [members, setMembers] = useState<OrganizationMember[]>(initialMembers)
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>(initialInvitations)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(initialHasNextPage)
  const [currentOffset, setCurrentOffset] = useState(PAGE_SIZE)
  const [isBootstrapping, setIsBootstrapping] = useState(false)
  
  const memberCount = members.length + invitations.length

  const handleInviteClick = () => {
    membersTableRef.current?.openInviteDialog()
  }
  
  // Helper to merge arrays by id while preserving order and uniqueness
  function mergeUniqueById<T extends { id: string }>(base: T[], incoming: T[]): T[] {
    const seen = new Set(base.map(i => i.id))
    const merged = [...base]
    for (const item of incoming) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        merged.push(item)
      }
    }
    return merged
  }
  
  // Load more function following RequestsPageClient pattern
  const loadMore = useCallback(async () => {
    // Prevent concurrent calls
    if (isLoading) {
      return
    }
    
    if (!hasMore) {
      return
    }
    
    setIsLoading(true)
    
      try {
        // Fetch next page of members and invitations in parallel
        const [membersResult, invitationsResult] = await Promise.all([
          getOrganizationMembers(organizationId, { limit: PAGE_SIZE, offset: currentOffset, searchQuery: debouncedSearchQuery }),
          getOrganizationInvitations(organizationId, { limit: PAGE_SIZE, offset: currentOffset, searchQuery: debouncedSearchQuery })
        ])
      
      if (membersResult.ok && membersResult.data) {
        setMembers(prev => mergeUniqueById(prev, membersResult.data!))
      }
      
      if (invitationsResult.ok && invitationsResult.data) {
        setInvitations(prev => mergeUniqueById(prev, invitationsResult.data!))
      }
      
      // Update hasMore if either has more pages
      const membersHasMore = membersResult.ok ? (membersResult.hasNextPage || false) : false
      const invitationsHasMore = invitationsResult.ok ? (invitationsResult.hasNextPage || false) : false
      const newHasMore = membersHasMore || invitationsHasMore
      
      setHasMore(newHasMore)
      setCurrentOffset(prev => prev + PAGE_SIZE)
    } catch (error) {
      console.error('Error loading more members/invitations:', error)
      setHasMore(false)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, currentOffset, organizationId, debouncedSearchQuery])
  
  // Load more handler for virtual scroll
  const handleLoadMore = useCallback((virtualRows: VirtualItem[]) => {
    loadMore()
  }, [loadMore])
  
  // Debounce server fetch (150ms - matching other tables)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 150)

    return () => clearTimeout(timer)
  }, [searchQuery])
  
  // Track current request to prevent stale updates
  useEffect(() => {
    // Handle empty search query by resetting to initial data
    if (!debouncedSearchQuery.trim()) {
      setMembers(initialMembers)
      setInvitations(initialInvitations)
      setHasMore(initialHasNextPage)
      setCurrentOffset(PAGE_SIZE)
      setIsBootstrapping(false)
      setIsLoading(false)
      return
    }
    
    // Increment request ID for this search
    const requestId = ++currentRequestRef.current
    
    setIsBootstrapping(true)
    setIsLoading(true)
    
    async function run() {
      try {
        const [membersResult, invitationsResult] = await Promise.all([
          getOrganizationMembers(organizationId, { limit: PAGE_SIZE, offset: 0, searchQuery: debouncedSearchQuery }),
          getOrganizationInvitations(organizationId, { limit: PAGE_SIZE, offset: 0, searchQuery: debouncedSearchQuery })
        ])
        
        // Only update state if this request is still the latest
        if (requestId === currentRequestRef.current) {
          if (membersResult.ok && membersResult.data) {
            setMembers(membersResult.data)
          }
          
          if (invitationsResult.ok && invitationsResult.data) {
            setInvitations(invitationsResult.data)
          }
          
          const membersHasMore = membersResult.ok ? (membersResult.hasNextPage || false) : false
          const invitationsHasMore = invitationsResult.ok ? (invitationsResult.hasNextPage || false) : false
          setHasMore(membersHasMore || invitationsHasMore)
          setCurrentOffset(PAGE_SIZE)
          setIsLoading(false)
          setIsBootstrapping(false)
        }
      } catch (error) {
        // Only update state if this request is still the latest
        if (requestId === currentRequestRef.current) {
          console.error('Error fetching search results:', error)
          setHasMore(false)
          setIsLoading(false)
          setIsBootstrapping(false)
        }
      }
    }
    
    run()
    
    // Cleanup does NOTHING async — that's correct.
    // It only ensures the requestId won't match on stale responses.
    return () => {
      // No-op. The ref check prevents stale updates.
    }
  }, [debouncedSearchQuery, organizationId])
  
  // Sync local state when props change (e.g., when new members/invitations are added)
  // Only sync when there's no active search to avoid interfering with search results
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setMembers(initialMembers)
      setInvitations(initialInvitations)
      setHasMore(initialHasNextPage)
    }
  }, [initialMembers, initialInvitations, initialHasNextPage, debouncedSearchQuery])


  // Track header height for sticky table offset
  useEffect(() => {
    if (!headerWrapperRef.current) return
    const node = headerWrapperRef.current
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeaderOffset(entry.contentRect.height)
      }
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={rootRef} className="flex flex-col">
      <div
        ref={headerWrapperRef}
        className="sticky z-20"
        style={{
          top: 0,
          backgroundColor: 'var(--color-base-surface-page-background)',
          backdropFilter: 'saturate(180%) blur(12px)',
        }}
      >
        <div className="flex flex-col gap-5 pb-4" style={{ marginTop: '40px' }}>
          <div>
            <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)', marginBottom: '0.75rem' }}>
              User management
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-base-text-secondary, rgba(3, 9, 26, 0.72))' }}>
              {currentUserRole === 'owner' 
                ? 'Manage your team and system owner'
                : 'Your team and system owner'
              }
            </p>
          </div>
          <div className="flex items-center justify-between w-full">
            <SearchInput
              placeholder="Search members"
              value={searchQuery}
              onChange={setSearchQuery}
              count={memberCount}
              countLabel={memberCount === 1 ? 'member' : 'members'}
            />
            {canManageRoles && (
              <Button
                variant="default"
                size="lg"
                className="cursor-pointer text-sm"
                onClick={handleInviteClick}
              >
                Invite
              </Button>
            )}
          </div>
        </div>
      </div>

      <div ref={parentRef}>
        <MembersTable
          ref={membersTableRef}
          members={members}
          invitations={invitations}
          organizationId={organizationId}
          currentUserRole={currentUserRole}
          parentRef={parentRef}
          unfilteredTotalCount={unfilteredTotalCount}
          headerOffset={headerOffset}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onLoadMore={handleLoadMore}
          hasNextPage={hasMore}
          isLoading={isLoading}
          isBootstrapping={isBootstrapping}
        />
      </div>
    </div>
  )
}


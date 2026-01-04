"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ProjectBadge } from '@/components/ui/project-badge'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, CaretDown, Check, DotsThree, MagnifyingGlass, LinkSimple, Trash, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateProjectAssignee, updateProjectStatus, deleteProject } from './actions'
import type { Project } from '../server'
import { VirtualizedProjectList } from './VirtualizedProjectList'
import { useConnection } from '../ConnectionContext'
import { Skeleton } from '@/components/ui/skeleton'
import { isOptimisticId, updateProjectLatestDraft, scheduleProjectFlush } from '../utils/optimisticTracker'

interface ProjectsTableProps {
  userAvatar?: string
  userInitials?: string
  onProjectClick?: (projectId: string) => void
  onNewProject?: () => void
  projects?: Project[]
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  onProjectUpdate?: (projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'; assignee?: Project['assignee'] }) => void
  currentOrgId: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  totalCount?: number
  unfilteredTotalCount?: number
  parentRef?: React.RefObject<HTMLDivElement | null>
  isBootstrapping?: boolean
  isAgency?: boolean
  agencyOrganization?: {
    id: string
    name: string
    logoUrl?: string
  }
  onProjectDeleted?: (projectId: string) => void
  sortValue?: string
  onSortChange?: (sortValue: string) => void
}

export default function ProjectsTable({ userAvatar: _userAvatar = '', userInitials: _userInitials = 'U', onProjectClick, onNewProject, projects = [], agencyMembers = [], onProjectUpdate, currentOrgId: _currentOrgId, searchQuery = '', onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, isBootstrapping = false, isAgency = false, agencyOrganization: _agencyOrganization, onProjectDeleted, sortValue = 'project_asc', onSortChange }: ProjectsTableProps) {
  const { isDisconnected } = useConnection()
  const pathname = usePathname()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{projectId: string; projectName: string} | null>(null)
  
  // Assignee ref for combobox functionality
  const _assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [_isAssigneeUnassigned, _setIsAssigneeUnassigned] = useState(false)
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  const isMutingStatus = useRef(false)
  
  // Track pending status updates per project ID to prevent flickering
  const pendingStatusUpdatesRef = useRef<Map<string, Project['status']>>(new Map())
  
  // Profile Card state
  const [profileDialogOpen, setProfileDialogOpen] = useState(false)
  const [selectedContact, setSelectedContact] = useState<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  } | null>(null)

  // Use total count from database, fallback to displayed projects count if not provided
  const projectCount = totalCount !== undefined ? totalCount : projects.length
  
  // Transform agency members to combobox options (memoized to prevent recreation)
  const _comboboxOptions = useMemo(() => 
    agencyMembers.map(member => ({
      value: member.id,
      label: `${member.firstName} ${member.lastName}`,
      avatar: member.avatarUrl,
      email: member.email
    })),
    [agencyMembers]
  )

  // Sort options (memoized to prevent recreation)
  const sortOptions = useMemo(() => [
    { value: 'project_asc', label: 'Project (A-Z)', buttonLabel: 'Project (A-Z)' },
    { value: 'end_date_asc', label: 'End date', buttonLabel: 'End date' }
  ], [])

  // Current sort label (memoized based on sortValue)
  const currentSortLabel = useMemo(() => 
    sortOptions.find(option => option.value === sortValue)?.buttonLabel || 'Project (A-Z)',
    [sortOptions, sortValue]
  )

  const handleSortChange = (newSortValue: string) => {
    setIsSortDropdownOpen(false)
    // Call parent callback to update sort state
    onSortChange?.(newSortValue)
  }

  // Assignee handlers with loading guard
  const _handleAssigneeSelect = async (projectId: string, memberId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Notify parent for bidirectional updates (table → modal)
      if (onProjectUpdate) {
        onProjectUpdate(projectId, { assignee: newAssignee })
      }
      
      // Set loading guard
      isMutingAssignee.current = true
      
      try {
        await updateProjectAssignee(projectId, memberId)
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
        // Real-time subscription will handle UI updates
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update assignee:', error)
        }
        toast.error('Failed to update assignee')
        // Revert parent state on error
        if (onProjectUpdate) {
          const originalProject = projects.find(p => p.id === projectId)
          if (originalProject) {
            onProjectUpdate(projectId, { assignee: originalProject.assignee })
          }
        }
      } finally {
        // Clear loading guard
        isMutingAssignee.current = false
      }
    }
  }

  const _handleClearAssignee = async (projectId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Notify parent for bidirectional updates (table → modal)
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { assignee: null })
    }
    
    // Set loading guard
    isMutingAssignee.current = true
    
    try {
      await updateProjectAssignee(projectId, null)
      toast.success('Assignee removed')
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to clear assignee:', error)
      }
      toast.error('Failed to clear assignee')
      // Revert parent state on error
      if (onProjectUpdate) {
        const originalProject = projects.find(p => p.id === projectId)
        if (originalProject) {
          onProjectUpdate(projectId, { assignee: originalProject.assignee })
        }
      }
    } finally {
      // Clear loading guard
      isMutingAssignee.current = false
    }
  }

  // Status handler with pending override pattern
  const handleStatusChange = useCallback(async (projectId: string, newStatus: string): Promise<void> => {
    const validStatuses = ['planned', 'active', 'on_hold', 'completed', 'canceled'] as const
    if (!(validStatuses as readonly string[]).includes(newStatus)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as Project['status']
    
    // Notify parent for bidirectional updates (table → modal)
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { status: typedStatus })
    }
    
    // Handle optimistic IDs
    if (isOptimisticId(projectId)) {
      // Track draft state and schedule flush
      updateProjectLatestDraft(projectId, { status: typedStatus })
      scheduleProjectFlush(projectId, async (realId, draft) => {
        // Call per-field actions based on what's in draft
        if (draft.status !== undefined) {
          await updateProjectStatus(realId, draft.status)
        }
      })
      return // Success - no error, no await
    }
    
    // Set pending override so the dropdown never snaps back
    pendingStatusUpdatesRef.current.set(projectId, typedStatus)
    
    try {
      await updateProjectStatus(projectId, typedStatus)
      // Do NOT clear here; let realtime/cached data catch up, then clear in an effect (below)
    } catch (error) {
      pendingStatusUpdatesRef.current.delete(projectId)
      toast.error('Failed to update status')
      
      // Revert parent if you're pushing optimistic parent updates
      if (onProjectUpdate) {
        const originalProject = projects.find(p => p.id === projectId)
        if (originalProject) {
          onProjectUpdate(projectId, { status: originalProject.status })
        }
      }
    }
  }, [onProjectUpdate, projects])

  // Clear pending status updates when realtime data matches
  useEffect(() => {
    for (const project of projects) {
      const pending = pendingStatusUpdatesRef.current.get(project.id)
      if (pending && pending === project.status) {
        pendingStatusUpdatesRef.current.delete(project.id)
      }
    }
  }, [projects])

  // Profile Card handler
  const _handleContactClick = (contact: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url?: string;
    job_title?: string;
    organization: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }) => {
    setSelectedContact(contact);
    setProfileDialogOpen(true);
  };

  // Navigation handler
  const handleRowClick = (projectId: string) => {
    onProjectClick?.(projectId)
  }

  const handleCopyLink = (projectId: string, connectionId: string) => {
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/projects/${projectId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteProject = (projectId: string) => {
    const project = projects.find(p => p.id === projectId)
    if (project) {
      setPendingDelete({ projectId, projectName: project.title })
      setDeleteDialogOpen(true)
    }
  }

  const confirmDeleteProject = async () => {
    if (pendingDelete) {
      // Close dialog immediately
      setDeleteDialogOpen(false)
      setPendingDelete(null)
      
      // Show success toast immediately
      toast.success('Project deleted')
      
      // Notify parent for badge count updates
      onProjectDeleted?.(pendingDelete.projectId)
      
      // Delete in background
      deleteProject(pendingDelete.projectId).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error deleting project:', error)
        }
        toast.error('Failed to delete project')
      })
      
      // Real-time subscription will handle UI updates
    }
  }

  // Empty state logic: ONLY show empty state when no projects exist at all
  const hasActiveFilters = (searchQuery?.trim().length ?? 0) > 0
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0 && !hasActiveFilters

  // Empty state component matching VirtualTableBody "No results" style
  const emptyState = isEmptyState ? (
    <TableRow 
      className="hover:bg-transparent"
      style={{
        backgroundColor: 'var(--color-base-surface-page-background)',
      }}
    >
      <td 
        colSpan={8} 
        className="text-center py-8"
      >
        <span className="text-sm-regular text-[var(--color-base-text-tertiary)]">
          No projects
        </span>
      </td>
    </TableRow>
  ) : null

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search projects by name…"
              value={searchQuery || ''}
              onChange={(value) => {
                onSearchChange?.(value)
              }}
              count={projectCount}
              countLabel={(projectCount as number) === 1 ? 'project' : 'projects'}
            />
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Badge 
                  variant="outline" 
                  className="text-xs border-0"
                  style={{
                    borderRadius: 'var(--radius-1-max, 3px)',
                    backgroundColor: 'var(--color-neutral-3, #f0f0f3)',
                    border: 'none',
                    cursor: 'default'
                  }}
                >
                  <Eye size={12} weight="fill" style={{ color: 'var(--color-neutral-11, #44474f)' }} />
                  <span className="ml-1" style={{ color: 'var(--color-neutral-11, #44474f)' }}>
                    {isAgency ? 'Client visible' : 'View only'}
                  </span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={8}>
                {isAgency 
                  ? 'Visible in client portal. Only your agency can edit.'
                  : 'Only your agency can edit this'}
              </TooltipContent>
            </Tooltip>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu modal={false} open={isSortDropdownOpen} onOpenChange={setIsSortDropdownOpen}>
              <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
                  className={`cursor-pointer text-sm-regular h-[32px] flex items-center gap-2 shadow-none transition-all duration-75 ${
                    isSortDropdownOpen 
                      ? 'bg-interactive-surface-hover hover:bg-interactive-surface-hover' 
                      : 'hover:bg-interactive-surface-hover'
                  }`}
            >
              <SortAscending size={16} />
              {currentSortLabel}
                  <CaretDown size={16} />
            </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {sortOptions.map((option) => (
                  <DropdownMenuItem
                    key={option.value}
                    onClick={(e) => {
                      handleSortChange(option.value);
                      setIsSortDropdownOpen(false);
                      // Blur the button after selection to prevent focus
                      const trigger = e.currentTarget.closest('[data-radix-dropdown-menu-trigger]') as HTMLElement;
                      setTimeout(() => {
                        trigger?.blur();
                      }, 0);
                    }}
                    className="flex items-center justify-between"
                  >
                    <span>{option.label}</span>
                    {sortValue === option.value && (
                      <Check size={16} className="text-inherit" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {isAgency && !isDisconnected && (
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm flex-shrink-0 h-6"
              style={{ paddingLeft: '16px', paddingRight: '16px' }}
              onClick={() => {
                onNewProject?.();
              }}
            >
              <Plus size={16} className="mr-1" />
                New project
            </Button>
            )}
          </div>
        </div>
      </div>

      {/* Table Header - Sticky */}
      <div className="sticky top-[112px] z-10 bg-[var(--color-base-surface-page-background)] px-5">
        <Table className="table-fixed w-full border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[25%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Project
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Status
              </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    Start date
                  </TableHead>
                  <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                    End date
                  </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Requests
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Tasks
              </TableHead>
              <TableHead className="w-[44px] p-0 text-xs-medium text-[var(--color-base-text-tertiary)]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
        </Table>
      </div>

      {/* Table Body - Virtualized Scrollable */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        <div className="px-5 pb-5">
          {isBootstrapping ? (
            <div className="space-y-0">
              {/* Project Row Skeletons - 20 rows */}
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((projectIndex) => (
                <div
                  key={projectIndex}
                  className="border-b border-[var(--color-neutral-4)] h-[44px] grid items-center"
                  style={{
                    gridTemplateColumns: '25% 15% 15% 15% 15% 15% 44px',
                  }}
                >
                  {/* Project */}
                  <div className="px-3">
                    <Skeleton className="w-32 h-4 rounded" />
                  </div>
                  {/* Status */}
                  <div className="px-3">
                    <Skeleton className="w-20 h-4 rounded" />
                  </div>
                  {/* Start date */}
                  <div className="px-3">
                    <Skeleton className="w-24 h-4 rounded" />
                  </div>
                  {/* End date */}
                  <div className="px-3">
                    <Skeleton className="w-24 h-4 rounded" />
                  </div>
                  {/* Requests */}
                  <div className="px-3">
                    <Skeleton className="w-8 h-4 rounded" />
                  </div>
                  {/* Tasks */}
                  <div className="px-3">
                    <Skeleton className="w-8 h-4 rounded" />
                  </div>
                  {/* Actions */}
                  <div></div>
                </div>
              ))}
            </div>
          ) : (
            isEmptyState ? (
              <Table className="table-fixed w-full border-collapse" noWrapper>
                <TableBody>
                  <TableRow 
                    className="hover:bg-transparent"
                    style={{
                      backgroundColor: 'var(--color-base-surface-page-background)',
                    }}
                  >
                    <TableCell 
                      colSpan={7} 
                      className="text-center py-8"
                    >
                      <span className="text-sm-regular text-[var(--color-base-text-tertiary)]">
                        No projects
                      </span>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <Table className="table-fixed w-full border-collapse" noWrapper>
                <TableBody>
                  <VirtualizedProjectList
                    projects={projects}
                    parentRef={parentRef}
                    renderRow={(project, index) => (
                      <TableRow
                        key={project.id}
                        className="hover:bg-[var(--color-interactive-surface-hover)] transition-colors duration-75 cursor-pointer"
                        onClick={() => handleRowClick(project.id)}
                      >
                    <TableCell className="w-[25%] py-0 truncate">
                      {project.title}
                    </TableCell>

                    {isDisconnected || !isAgency ? (
                      <TableCell 
                        className="w-[15%] py-0"
                      >
                        <ProjectBadge variant={project.status as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'} size="sm" showText={true} className="inline-flex" />
                      </TableCell>
                    ) : (
                      <TableCell 
                        className="w-[15%] py-0" 
                        onClick={(e) => e.stopPropagation()}
                      >
                        <InlineEdit
                          type="badge"
                          value={(() => {
                            const pending = pendingStatusUpdatesRef.current.get(project.id)
                            return pending ?? project.status
                          })()}
                          options={[
                            { value: 'planned', label: 'Planned' },
                            { value: 'active', label: 'Active' },
                            { value: 'on_hold', label: 'On hold' },
                            { value: 'completed', label: 'Completed' },
                            { value: 'canceled', label: 'Canceled' },
                          ]}
                          onSave={(newStatus) => handleStatusChange(project.id, newStatus)}
                          badgeComponent="project"
                          className="truncate h-6 rounded-[8px]"
                        />
                      </TableCell>
                    )}

                    <TableCell className="w-[15%] py-0 truncate">
                      <span 
                        className="text-sm-regular" 
                        style={project.startDate ? undefined : { color: 'var(--color-base-text-tertiary)' }}
                      >
                        {project.startDate || "No start date"}
                      </span>
                    </TableCell>

                    <TableCell className="w-[15%] py-0 truncate">
                      <span 
                        className="text-sm-regular" 
                        style={project.endDate ? undefined : { color: 'var(--color-base-text-tertiary)' }}
                      >
                        {project.endDate || "No end date"}
                      </span>
                    </TableCell>

                    <TableCell className="w-[15%] py-0 truncate">
                      {project.requestsCount}
                    </TableCell>

                    <TableCell className="w-[15%] py-0 truncate">
                      {project.tasksCount}
                    </TableCell>

                    <TableCell 
                      className="w-[44px] p-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center h-full">
                        <DropdownMenu modal={false} open={openActionsDropdown === project.id} onOpenChange={(open) => setOpenActionsDropdown(open ? project.id : null)}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                                openActionsDropdown === project.id
                                  ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]'
                                  : 'hover:bg-[var(--color-interactive-surface-hover)]'
                              }`}
                            >
                              <DotsThree size={16} />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[200px]">
                            <DropdownMenuItem onClick={() => {
                              setOpenActionsDropdown(null)
                              handleRowClick(project.id)
                            }}>
                              <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                              View details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => {
                              setOpenActionsDropdown(null)
                              handleCopyLink(project.id, project.connectionId)
                            }}>
                              <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                              Copy link
                            </DropdownMenuItem>
                            {!isDisconnected && isAgency && (
                              <>
                            <div className="border-t border-[var(--color-neutral-6)] my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                handleDeleteProject(project.id)
                                setOpenActionsDropdown(null)
                              }}
                              style={{ color: 'var(--color-red-11)' }}
                            >
                              <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                              Delete project
                            </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                      </TableRow>
                    )}
                  />
                </TableBody>
              </Table>
            )
          )}
        </div>
      </div>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent style={{ padding: '24px', width: '460px', gap: '0.75rem' }} className="[&>button]:hidden h-auto">
          <DialogHeader className="space-y-0">
            <DialogTitle className="display-5-medium mb-0">
              Delete project &quot;{pendingDelete?.projectName}&quot;?
            </DialogTitle>
          </DialogHeader>
          <DialogDescription 
            className="text-sm-regular mb-0"
          >
            Deleting this project will unlink all related tasks and requests. This action cannot be undone.
          </DialogDescription>
          <div className="flex justify-end" style={{ marginTop: '12px', gap: '12px' }}>
            <Button 
              variant="ghost" 
              onClick={() => setDeleteDialogOpen(false)}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button 
              variant="destructive"
              onClick={confirmDeleteProject}
              style={{ height: '40px' }}
              className="cursor-pointer"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Card Dialog */}
      {selectedContact && (
        <ProfileCard
          member={selectedContact}
          isOpen={profileDialogOpen}
          onClose={() => {
            setProfileDialogOpen(false);
            setSelectedContact(null);
          }}
        />
      )}
    </div>
  )
}

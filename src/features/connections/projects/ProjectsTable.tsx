"use client"

import { useState, useRef, useEffect, useMemo } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ProjectBadge } from '@/components/ui/project-badge'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, CaretDown, Check, DotsThree, MagnifyingGlass, LinkSimple, Trash, User, Eye } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateProjectAssignee, updateProjectStatus, deleteProject } from './actions'
import type { Project } from '../server'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'

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
  onProjectUpdate?: (projectId: string, updates: { title?: string; description?: string; status?: 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'; assignee?: any }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: any[]) => void
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
  initialSortValue?: string
  onSortChange?: (sortValue: string) => void
}

export default function ProjectsTable({ userAvatar = '', userInitials = 'U', onProjectClick, onNewProject, projects = [], agencyMembers = [], onProjectUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, unfilteredTotalCount = 0, parentRef, isBootstrapping = false, isAgency = false, agencyOrganization, onProjectDeleted, initialSortValue = 'newest_first', onSortChange }: ProjectsTableProps) {
  
  const pathname = usePathname()
  const router = useRouter()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortValue, setSortValue] = useState(initialSortValue)
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  
  // Update sortValue when initialSortValue prop changes
  useEffect(() => {
    setSortValue(initialSortValue)
  }, [initialSortValue])
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<{projectId: string; projectName: string} | null>(null)
  
  // Optimistic UI state for projects
  const [optimisticProjects, setOptimisticProjects] = useState<Project[]>(projects)
  
  // Update optimistic projects when props change
  useEffect(() => {
    setOptimisticProjects(projects)
  }, [projects])
  
  // Assignee ref for combobox functionality
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [isAssigneeUnassigned, setIsAssigneeUnassigned] = useState(false)
  
  // Loading guard refs to prevent rapid-fire mutations
  const isMutingAssignee = useRef(false)
  const isMutingStatus = useRef(false)
  
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
  const projectCount = totalCount !== undefined ? totalCount : optimisticProjects.length
  
  // Transform agency members to combobox options (memoized to prevent recreation)
  const comboboxOptions = useMemo(() => 
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
    { value: 'newest_first', label: 'Newest first', buttonLabel: 'Newest first' },
    { value: 'project_asc', label: 'Project (A-Z)', buttonLabel: 'Project (A-Z)' },
    { value: 'project_desc', label: 'Project (Z-A)', buttonLabel: 'Project (Z-A)' },
    { value: 'end_date_asc', label: 'End date (soonest first)', buttonLabel: 'End date' }
  ], [])

  // Current sort label (memoized based on sortValue)
  const currentSortLabel = useMemo(() => 
    sortOptions.find(option => option.value === sortValue)?.buttonLabel || 'Newest first',
    [sortOptions, sortValue]
  )

  const handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue)
    setIsSortDropdownOpen(false)
    // Call parent callback to trigger data refetch with new sort
    onSortChange?.(newSortValue)
  }

  // Assignee handlers with loading guard
  const handleAssigneeSelect = async (projectId: string, memberId: string) => {
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
      
      // Optimistic update
      setOptimisticProjects(prev => 
        prev.map(proj => 
          proj.id === projectId 
            ? { ...proj, assignee: newAssignee } 
            : proj
        )
      )
      
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
        // Revert optimistic update on error
        setOptimisticProjects(projects)
        if (onProjectUpdate) {
          // Revert parent state as well
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

  const handleClearAssignee = async (projectId: string) => {
    // Prevent rapid-fire mutations
    if (isMutingAssignee.current) return
    
    // Optimistic update
    setOptimisticProjects(prev => 
      prev.map(proj => 
        proj.id === projectId 
          ? { ...proj, assignee: null } 
          : proj
      )
    )
    
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
      // Revert optimistic update on error
      setOptimisticProjects(projects)
      if (onProjectUpdate) {
        // Revert parent state as well
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

  // Status handler with loading guard
  const handleStatusChange = async (projectId: string, newStatus: string) => {
    // Prevent rapid-fire mutations
    if (isMutingStatus.current) return
    
    const validStatuses = ['planned', 'active', 'on_hold', 'completed', 'canceled'] as const
    if (!validStatuses.includes(newStatus as any)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'
    
    // Optimistic update
    setOptimisticProjects(prev => 
      prev.map(proj => 
        proj.id === projectId 
          ? { ...proj, status: typedStatus } 
          : proj
      )
    )
    
    // Notify parent for bidirectional updates (table → modal)
    if (onProjectUpdate) {
      onProjectUpdate(projectId, { status: typedStatus })
    }
    
    // Set loading guard
    isMutingStatus.current = true
    
    try {
      await updateProjectStatus(projectId, typedStatus)
      const statusLabels = {
        planned: 'Planned',
        active: 'Active',
        on_hold: 'On hold',
        completed: 'Completed',
        canceled: 'Canceled'
      }
      toast.success(`Status updated to ${statusLabels[typedStatus]}`)
      // Real-time subscription will handle UI updates
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update status:', error)
      }
      toast.error('Failed to update status')
      // Revert optimistic update on error
      setOptimisticProjects(projects)
      if (onProjectUpdate) {
        // Revert parent state as well
        const originalProject = projects.find(p => p.id === projectId)
        if (originalProject) {
          onProjectUpdate(projectId, { status: originalProject.status })
        }
      }
    } finally {
      // Clear loading guard
      isMutingStatus.current = false
    }
  }

  // Profile Card handler
  const handleContactClick = (contact: {
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
    const project = optimisticProjects.find(p => p.id === projectId)
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
      
      // Optimistically remove project from table
      setOptimisticProjects(prev => prev.filter(p => p.id !== pendingDelete.projectId))
      
      // Notify parent for badge count updates
      onProjectDeleted?.(pendingDelete.projectId)
      
      // Delete in background
      deleteProject(pendingDelete.projectId).catch((error) => {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Error deleting project:', error)
        }
        toast.error('Failed to delete project')
        // Revert optimistic update on error
        setOptimisticProjects(projects)
      })
      
      // Real-time subscription will handle UI updates
    }
  }

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd } = useVirtualTable({
    items: optimisticProjects,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // isNearEnd available for future use (e.g., showing loading indicator)

  // Derived from current filter state — prevents flicker during search clear
  const hasActiveFilters = searchQuery.trim().length > 0;
  const isEmptyState = !isBootstrapping && unfilteredTotalCount === 0 && !hasActiveFilters;

  // Empty state component matching ClientsTable design
  const emptyState = isEmptyState ? (
    <TableRow 
      className="hover:bg-transparent"
      style={{ 
        backgroundColor: 'var(--color-base-surface-page-background)', 
        borderBottomColor: 'var(--color-neutral-5)',
        height: '100%'
      }}
    >
      <TableCell 
        colSpan={isAgency ? 8 : 8} 
        className="text-left" 
        style={{ height: 'calc(100vh - 352px)', minHeight: '400px', paddingLeft: '120px' }}
      >
        <div className="flex flex-col items-start justify-center h-full gap-4" style={{ transform: 'translateY(-40px)' }}>
          <div className="flex flex-col items-start gap-2">
            <h2 className="display-8-medium">Your best work starts here</h2>
            <span className="text-sm-regular text-neutral-11">
              {isAgency 
                ? 'Projects give your team and client a shared view of work and progress'
                : 'Projects are created by your agency and give you a shared view of work and progress'}
            </span>
          </div>
          {onNewProject && isAgency && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 shadow-none cursor-pointer transition-all duration-75 mt-4"
              onClick={onNewProject}
            >
              <Plus size={16} weight="regular" />
              New project
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  ) : null

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search by project or status…"
              value={searchQuery}
              onChange={(value) => {
                setSearchQuery(value)
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
                  ? 'Your client can see this. Only your agency can edit.' 
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
              <DropdownMenuContent align="end" className="w-55">
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
            {isAgency && (
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
      {(unfilteredTotalCount > 0 || hasActiveFilters) && (
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
      )}

      {/* Table Body - Virtualized Scrollable */}
      <div className="w-full overflow-x-auto" ref={containerRef}>
        <div className="px-5 pb-5">
          {/* During initial assigned=me bootstrap, suppress empty-state flash with skeleton block */}
          {isBootstrapping && projects.length === 0 ? (
            <div>
              <div className="h-[44px] rounded-md bg-[var(--color-neutral-6)] animate-pulse" />
            </div>
          ) : (
            <VirtualTableBody
            items={optimisticProjects}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            onRowClick={(project) => handleRowClick(project.id)}
            emptyState={isEmptyState ? emptyState : undefined}
            renderRow={(project) => (
              <>
                <TableCell className="w-[25%] py-0 truncate">
                  {project.title}
                </TableCell>

                {isAgency ? (
                  <TableCell 
                    className="w-[15%] py-0" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <InlineEdit
                      type="badge"
                      value={project.status}
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
                ) : (
                  <TableCell className="w-[15%] py-0">
                    <ProjectBadge variant={project.status as 'planned' | 'active' | 'on_hold' | 'completed' | 'canceled'} size="sm" showText={true} className="inline-flex" />
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
                        {isAgency && (
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
              </>
            )}
          />
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

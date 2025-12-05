'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ListRow } from '@/components/ui/list-row'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command'
import { TaskStatusButton } from '@/components/ui/task-status-button'
import { TaskBadge } from '@/components/ui/task-badge'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Eye, EyeSlash, Check, CaretDown, User, X } from '@phosphor-icons/react'
import { parse, format } from 'date-fns'
import { toast } from 'sonner'
import { fetchProjectsForConnection, fetchMembersForConnection } from './actions'
import { Spinner } from '@/components/ui/shadcn-io/spinner'

type TaskStatus = 'to_do' | 'in_progress' | 'on_hold' | 'done'

interface OrganizationSummary {
  id: string
  name: string
  logoUrl?: string
}

interface PersonSummary {
  id: string
  name: string
  email: string
  avatarUrl?: string
}

interface ProjectSummary {
  id: string
  name: string
}

interface MemberSummary {
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

interface RequestSummary {
  requestId: string
  title: string
  description: string
  client?: OrganizationSummary
  agency?: OrganizationSummary
  submittedBy?: PersonSummary
  assignee?: PersonSummary | null
  project?: ProjectSummary | null
  createdAt?: string
  createdByOrgId?: string
  createdByOrgType?: 'agency' | 'client'
}

export interface ConvertToTaskModalValues {
  requestId: string
  title: string
  description: string
  status: TaskStatus
  project: ProjectSummary | null
  assignee: PersonSummary | null
  dueDateDisplay: string | null
  dueDateRaw: string | null
  clientVisible: boolean
}

export interface ConvertToTaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (values: ConvertToTaskModalValues) => void
  isSubmitting?: boolean
  connectionId: string
  variant?: 'agency' | 'client'
  request: RequestSummary | null
  agencyMembers?: MemberSummary[]
  projects?: ProjectSummary[]
}

const statusOptions: { value: TaskStatus; label: string }[] = [
  { value: 'to_do', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'done', label: 'Done' },
]

export function ConvertToTaskModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  connectionId,
  variant = 'agency',
  request,
  agencyMembers = [],
  projects = [],
}: ConvertToTaskModalProps) {
  const isClientVariant = variant === 'client'

  const [members, setMembers] = useState<MemberSummary[]>(agencyMembers)
  const [titleValue, setTitleValue] = useState('')
  const [descriptionValue, setDescriptionValue] = useState('')
  const [statusValue, setStatusValue] = useState<TaskStatus>('to_do')
  const [projectValue, setProjectValue] = useState<ProjectSummary | null>(null)
  const [assigneeValue, setAssigneeValue] = useState<PersonSummary | null>(null)
  const [dueDateDisplay, setDueDateDisplay] = useState('')
  const [dueDateRaw, setDueDateRaw] = useState<string | null>(null)
  const [clientVisibleValue, setClientVisibleValue] = useState(false)
  const [clientVisibilityLocked, setClientVisibilityLocked] = useState(false)
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false)
  const [projectOptions, setProjectOptions] = useState<ProjectSummary[]>(projects)

  useEffect(() => {
    setMembers(agencyMembers)
  }, [agencyMembers])

  useEffect(() => {
    if (request) {
      setTitleValue(request.title || '')
      setDescriptionValue(request.description || '')
      setStatusValue('to_do')
      setProjectValue(request.project ?? null)
      setAssigneeValue(request.assignee ?? null)
      setDueDateDisplay('')
      setDueDateRaw(null)
      setClientVisibleValue(false)
      setClientVisibilityLocked(false)
    } else {
      setTitleValue('')
      setDescriptionValue('')
      setStatusValue('to_do')
      setProjectValue(null)
      setAssigneeValue(null)
      setDueDateDisplay('')
      setDueDateRaw(null)
      setClientVisibleValue(false)
      setClientVisibilityLocked(false)
    }
  }, [request, isOpen])

  useEffect(() => {
    if (projects.length > 0) {
      setProjectOptions(prev => {
        const map = new Map(prev.map(p => [p.id, p]))
        projects.forEach(p => map.set(p.id, p))
        return Array.from(map.values())
      })
    }
  }, [projects])

  // Listen for project updates (e.g., when project title is updated in ProjectDetailModal)
  useEffect(() => {
    const handleProjectUpdated = (event: CustomEvent) => {
      const { projectId, connectionId: eventConnectionId, title } = event.detail;
      
      // Only handle events for this connection
      if (eventConnectionId !== connectionId) {
        return;
      }

      // Update project name in projectOptions list
      setProjectOptions((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, name: title } : p))
      );

      // Update projectValue if it matches the updated project
      setProjectValue((prev) => {
        if (prev && prev.id === projectId) {
          return { ...prev, name: title };
        }
        return prev;
      });
    };

    window.addEventListener('projectUpdated', handleProjectUpdated as EventListener);
    return () => {
      window.removeEventListener('projectUpdated', handleProjectUpdated as EventListener);
    };
  }, [connectionId])

  useEffect(() => {
    if (!isOpen) return
    if (!request?.assignee) return

    const matchingMember = members.find(member => member.id === request.assignee?.id)
    if (matchingMember?.orgType === 'client') {
      setClientVisibleValue(true)
      setClientVisibilityLocked(true)
    } else {
      setClientVisibilityLocked(false)
    }
  }, [members, isOpen, request?.assignee])

  useEffect(() => {
    if (!connectionId) return
    if (projects.length > 0) return

    fetchProjectsForConnection(connectionId)
      .then(fetched => {
        setProjectOptions(prev => {
          const map = new Map(prev.map(p => [p.id, p]))
          fetched.forEach(p => map.set(p.id, p))
          return Array.from(map.values())
        })
      })
      .catch(error => {
        console.error('Error fetching projects for convert modal:', error)
      })
  }, [connectionId, projects.length])

  useEffect(() => {
    if (!connectionId) return
    let cancelled = false

    const loadMembers = async () => {
      try {
        const { agencyMembers: agency, clientMembers: client } = await fetchMembersForConnection(connectionId)
        if (cancelled) return

        const combined = [...agency, ...client]
        const dedupedMap = new Map<string, MemberSummary>()
        combined.forEach(member => {
          if (!dedupedMap.has(member.id)) {
            dedupedMap.set(member.id, {
              id: member.id,
              firstName: member.firstName,
              lastName: member.lastName,
              email: member.email,
              avatarUrl: member.avatarUrl,
              jobTitle: member.jobTitle,
              orgId: member.orgId,
              orgName: member.orgName,
              orgType: member.orgType,
            })
          }
        })
        setMembers(Array.from(dedupedMap.values()))
      } catch (error) {
        console.error('Error fetching connection members for convert modal:', error)
      }
    }

    void loadMembers()

    return () => {
      cancelled = true
    }
  }, [connectionId])

  const clientEditableMembers = useMemo(() => {
    const clientMemberIds = new Set<string>()
    const options = members
      .filter(member => member.orgType === 'client')
      .map(member => {
        if (member.id) {
          clientMemberIds.add(member.id)
        }
        const fullName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
        return {
          value: member.id,
          label: fullName || member.email,
          avatar: member.avatarUrl,
          email: member.email,
        }
      })
    return { clientMemberIds, options }
  }, [members])

  const comboboxOptions = useMemo(
    () =>
      members.map(member => {
        const fullName = `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
        return {
          value: member.id,
          label: fullName || member.email,
          avatar: member.avatarUrl,
          email: member.email,
          orgName: member.orgName,
          orgType: member.orgType,
        }
      }),
    [members],
  )

  const canClientEditAssignee = useMemo(() => {
    if (!assigneeValue) return true
    return clientEditableMembers.clientMemberIds.has(assigneeValue.id)
  }, [assigneeValue, clientEditableMembers.clientMemberIds])

  const handleProjectSave = (projectId: string) => {
    if (!projectId) {
      setProjectValue(null)
      return
    }

    const selectedProject = projectOptions.find(p => p.id === projectId)
    setProjectValue(selectedProject ?? null)
  }

  const handleStatusChange = (newStatus: string) => {
    if (isClientVariant && !canClientEditAssignee) return
    const validStatuses: TaskStatus[] = ['to_do', 'in_progress', 'on_hold', 'done']
    if (!validStatuses.includes(newStatus as TaskStatus)) return
    setStatusValue(newStatus as TaskStatus)
    setIsStatusDropdownOpen(false)
  }

  const handleAssigneeSelect = (memberId: string) => {
    const selectedMember = members.find(member => member.id === memberId)
    if (!selectedMember) return

    const newAssignee: PersonSummary = {
      id: selectedMember.id,
      name: `${selectedMember.firstName ?? ''} ${selectedMember.lastName ?? ''}`.trim() || selectedMember.email,
      email: selectedMember.email,
      avatarUrl: selectedMember.avatarUrl,
    }

    setAssigneeValue(newAssignee)

    if (selectedMember.orgType === 'client') {
      setClientVisibleValue(true)
      setClientVisibilityLocked(true)
    } else {
      setClientVisibilityLocked(false)
    }
  }

  const handleClearAssignee = () => {
    if (isClientVariant) return
    setAssigneeValue(null)
    setClientVisibleValue(false)
    setClientVisibilityLocked(false)
  }

  const handleDueDateSave = (value: string) => {
    const normalizedDisplay = value?.trim() ? value : ''
    setDueDateDisplay(normalizedDisplay)

    const nextRaw = normalizedDisplay
      ? (() => {
          try {
            const parsed = parse(normalizedDisplay, 'd MMM yyyy', new Date())
            if (isNaN(parsed.getTime())) return null
            return format(parsed, 'yyyy-MM-dd')
          } catch {
            try {
              const parsedAlt = new Date(normalizedDisplay)
              return isNaN(parsedAlt.getTime()) ? null : format(parsedAlt, 'yyyy-MM-dd')
            } catch {
              return null
            }
          }
        })()
      : null

    setDueDateRaw(nextRaw)
  }

  const handleClientVisibleChange = (checked: boolean) => {
    if (clientVisibilityLocked) return
    setClientVisibleValue(checked)
  }

  const handleTitleSave = (value: string) => {
    const trimmed = value.trim()
    if (!trimmed) {
      toast.error('Title cannot be empty')
      return
    }
    setTitleValue(trimmed)
  }

  const handleSubmit = useCallback(() => {
    if (!request?.requestId) {
      toast.error('Request unavailable for conversion')
      return
    }
    const trimmedTitle = titleValue.trim()
    if (!trimmedTitle) {
      toast.error('Task title is required')
      return
    }

    onSubmit({
      requestId: request.requestId,
      title: trimmedTitle,
      description: descriptionValue,
      status: statusValue,
      project: projectValue,
      assignee: assigneeValue,
      dueDateDisplay: dueDateDisplay || null,
      dueDateRaw,
      clientVisible: clientVisibleValue,
    })
  }, [
    assigneeValue,
    clientVisibleValue,
    descriptionValue,
    dueDateDisplay,
    dueDateRaw,
    onSubmit,
    projectValue,
    request,
    statusValue,
    titleValue,
  ])

  const disableCreate = titleValue.trim().length === 0 || isSubmitting

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className="!max-w-[1200px] !w-[calc(100vw-10rem)] !max-h-[820px] !h-[calc(100vh-7.5rem)] overflow-hidden !p-0 !gap-0 !flex !flex-col"
        showCloseButton={false}
      >
        <div className="w-full flex items-center justify-between h-fit flex-shrink-0 pl-10 pr-4 py-4">
          <DialogTitle className="!text-[12px] !leading-[20px] !font-normal !tracking-[0.0025rem] !text-[var(--color-base-text-tertiary)]">
            Task
          </DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 cursor-pointer transition-all duration-75 rounded-md hover:bg-interactive-surface-hover"
          >
            <X className="w-[18px] h-[18px]" />
            <span className="sr-only">Close</span>
          </Button>
        </div>

        <div className="pl-10 pr-10 h-full min-h-0 flex flex-col overflow-hidden">
          <div className="flex gap-0 flex-1 min-h-0">
            <div className="flex-[2] flex flex-col">
              <div className="flex-shrink-0 pb-4 pr-8">
                <div className="flex items-start gap-3">
                  <div data-inline-edit="title" className="flex-1 min-w-0">
                    <InlineEdit
                      type="text"
                      value={titleValue}
                      onSave={handleTitleSave}
                      onChange={setTitleValue}
                      placeholder="Task title"
                      textClass="display-7-medium text-primary"
                      multiline={true}
                      maxLength={255}
                      preventNewLines={true}
                      className="px-0"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    {variant === 'agency' && (
                      <Tooltip delayDuration={250}>
                        <TooltipTrigger asChild>
                          <div className="flex items-center">
                            {clientVisibilityLocked ? (
                              <Eye size={20} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} className="mt-1.5" />
                            ) : clientVisibleValue ? (
                              <Eye size={20} weight="fill" style={{ color: 'var(--color-neutral-11)' }} className="mt-1.5" />
                            ) : (
                              <EyeSlash size={20} weight="fill" style={{ color: 'var(--color-neutral-11)' }} className="mt-1.5" />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" align="center" sideOffset={4}>
                          {clientVisibilityLocked ? 'Visible to client (locked)' : clientVisibleValue ? 'Visible to client' : 'Not visible to client'}
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {(variant === 'agency' || (isClientVariant && canClientEditAssignee)) && (
                      <Popover open={isStatusDropdownOpen} onOpenChange={setIsStatusDropdownOpen}>
                        <PopoverTrigger asChild>
                          <TaskStatusButton variant={statusValue} className="mt-1.5">
                            <CaretDown size={12} weight="fill" />
                          </TaskStatusButton>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-full min-w-48 p-0"
                          align="start"
                          style={{ width: 'var(--radix-popover-trigger-width)' }}
                        >
                          <Command>
                            <CommandList>
                              <CommandEmpty>No status found.</CommandEmpty>
                              <CommandGroup>
                                {statusOptions.map(option => (
                                  <CommandItem
                                    key={option.value}
                                    value={option.value}
                                    onSelect={() => handleStatusChange(option.value)}
                                    className="flex items-center justify-between cursor-pointer"
                                  >
                                    <TaskBadge variant={option.value} size="sm" showText />
                                    {option.value === statusValue && (
                                      <Check size={16} weight="bold" style={{ color: 'var(--color-interactive-neutral-default)' }} />
                                    )}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto min-h-0 pr-8 pb-10">
                <div className="flex flex-col gap-5">
                  <div data-inline-edit="description">
                    <InlineEdit
                      type="text"
                      value={descriptionValue}
                      onSave={setDescriptionValue}
                      onChange={setDescriptionValue}
                      placeholder="Add description…"
                      textClass="text-md-regular"
                      multiline={true}
                      linkifyUrls={true}
                      className="px-0"
                      style={{ fontSize: '15px', lineHeight: '22px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="w-px bg-neutral-alpha-4 flex-shrink-0 mb-10" />

            <div className="flex-[1] flex flex-col gap-2 min-w-0 pl-8 mb-10">
              <h3 className="text-md-medium text-primary">Details</h3>
              <div className="flex flex-col gap-2 mt-2">
                <div className="flex items-center gap-4 h-6">
                  <div className="w-2/5 min-w-0">
                    <p className="text-sm-regular text-secondary truncate">{variant === 'agency' ? 'Client' : 'Agency'}</p>
                  </div>
                  <div className="w-3/5 min-w-0">
                    <ListRow
                      avatar
                      avatarUrl={variant === 'agency' ? request?.client?.logoUrl : request?.agency?.logoUrl}
                      text={variant === 'agency' ? request?.client?.name ?? 'Unknown client' : request?.agency?.name ?? 'Unknown agency'}
                      nonInteractive
                    />
                  </div>
                </div>

                <div className="flex items-center gap-4 h-6">
                  <div className="w-2/5 min-w-0">
                    <p className="text-sm-regular text-secondary truncate">Project</p>
                  </div>
                  <div className="w-3/5 min-w-0 max-w-full">
                    <div className="min-w-0 max-w-full">
                      <InlineEdit
                        type="badge"
                        value={projectValue ? projectValue.id : ''}
                        options={projectOptions.map(p => ({ value: p.id, label: p.name }))}
                        onSave={handleProjectSave}
                        placeholder="None (account task)"
                        searchPlaceholder="Search projects…"
                        clearable={!!projectValue}
                        popoverWidth="240px"
                        badgeBorderRadius="4px"
                        maxHeight="210px"
                        className="h-6"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 h-6">
                  <div className="w-2/5 min-w-0">
                    <p className="text-sm-regular text-secondary truncate">Assignee</p>
                  </div>
                  <div className="w-3/5 min-w-0">
                    {variant === 'agency' ? (
                      <ListRow
                        avatar
                        avatarUrl={assigneeValue?.avatarUrl || undefined}
                        avatarFallback={!assigneeValue ? <User size={16} weight="fill" className="text-white" /> : undefined}
                        text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                        textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                        comboboxSelectedValue={assigneeValue?.id ?? null}
                        comboboxOptions={comboboxOptions}
                        comboboxPlaceholder="Search members…"
                        onComboboxSelect={handleAssigneeSelect}
                        comboboxWidth="280px"
                        clearable={!!assigneeValue}
                        onClear={handleClearAssignee}
                        borderRadius="4px"
                      />
                    ) : clientEditableMembers.options.length > 0 ? (
                      <ListRow
                        avatar
                        avatarUrl={assigneeValue?.avatarUrl || undefined}
                        avatarFallback={!assigneeValue ? <User size={16} weight="fill" className="text-white" /> : undefined}
                        text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                        textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                        comboboxSelectedValue={assigneeValue?.id ?? null}
                        comboboxOptions={clientEditableMembers.options}
                        comboboxPlaceholder="Search members…"
                        onComboboxSelect={handleAssigneeSelect}
                        comboboxWidth="280px"
                        clearable={false}
                        borderRadius="4px"
                      />
                    ) : (
                      <ListRow
                        avatar
                        avatarUrl={assigneeValue?.avatarUrl || undefined}
                        avatarFallback={!assigneeValue ? <User size={16} weight="fill" className="text-white" /> : undefined}
                        text={assigneeValue ? assigneeValue.name : 'Unassigned'}
                        textColor={assigneeValue ? 'var(--color-base-text-primary)' : 'var(--color-base-text-tertiary)'}
                        variant="stacked"
                        className="min-w-0"
                        nonInteractive
                      />
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 h-6">
                  <div className="w-2/5 min-w-0">
                    <p className="text-sm-regular text-secondary truncate">Due date</p>
                  </div>
                  <div className="w-3/5 min-w-0">
                    <InlineEdit
                      type="date"
                      value={dueDateDisplay}
                      placeholder="No due date"
                      dateFormat="d MMM yyyy"
                      onSave={handleDueDateSave}
                      className="h-[28px] cursor-pointer truncate"
                    />
                  </div>
                </div>

                {variant === 'agency' && (
                  <div className="flex flex-col gap-2 mt-8">
                    <h4 className="text-md-medium text-primary">Visibility</h4>
                    <div className="flex items-center gap-4 h-6 mt-2">
                      <div className="w-2/5 min-w-0">
                        <p className="text-sm-regular text-secondary truncate">Client visible</p>
                      </div>
                      <div className="w-3/5 min-w-0 flex items-center gap-2">
                        <Switch
                          checked={clientVisibleValue}
                          disabled={clientVisibilityLocked}
                          onCheckedChange={handleClientVisibleChange}
                          className={clientVisibilityLocked ? '!cursor-default' : 'cursor-pointer'}
                        />
                        {clientVisibleValue ? (
                          <>
                            <Eye
                              size={16}
                              weight="fill"
                              style={{ color: clientVisibilityLocked ? 'var(--color-base-text-tertiary)' : 'var(--color-neutral-11)' }}
                            />
                            <span
                              className="text-sm-regular"
                              style={{ color: clientVisibilityLocked ? 'var(--color-base-text-tertiary)' : 'var(--color-base-text-primary)' }}
                            >
                              Yes
                            </span>
                          </>
                        ) : (
                          <>
                            <EyeSlash size={16} weight="fill" style={{ color: 'var(--color-neutral-11)', opacity: 0.5 }} />
                            <span className="text-sm-regular" style={{ color: 'var(--color-base-text-tertiary)' }}>
                              No
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="px-10 py-5 border-t border-neutral-4 flex-shrink-0">
          <div className="flex items-center justify-between w-full">
            <span className="text-sm text-[var(--color-base-text-primary)]">
              A new task will be created and linked to this request
            </span>
            <div className="flex items-center gap-2">
              <Button onClick={handleSubmit} disabled={disableCreate} className="!h-10 cursor-pointer relative">
                <span className={isSubmitting ? "invisible" : ""}>Create</span>
                {isSubmitting && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Spinner size={16} />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


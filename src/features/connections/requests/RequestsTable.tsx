"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { ProfileCard } from '@/components/ui/profile-card'
import { Plus, SortAscending, CaretDown, Check, DotsThree, MagnifyingGlass, FlowArrow, LinkSimple, Trash, User } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { updateRequestAssignee, updateRequestStatus, deleteRequest } from './actions'
import type { Request } from '../server'
import { useVirtualTable, VirtualTableBody } from '@/components/virtual-table'

interface RequestsTableProps {
  userAvatar?: string
  userInitials?: string
  onRequestClick?: (requestId: string) => void
  onNewRequest?: () => void
  requests?: Request[]
  agencyMembers?: Array<{
    id: string
    firstName: string
    lastName: string
    email: string
    avatarUrl?: string
    jobTitle?: string
  }>
  onRequestUpdate?: (requestId: string, updates: { title?: string; description?: string; status?: 'new' | 'in_review' | 'accepted' | 'canceled'; assignee?: any }) => void
  currentOrgId: string
  onLoadMore?: (virtualRows: any[]) => void
  onSearchChange?: (query: string) => void
  totalCount?: number
  parentRef?: React.RefObject<HTMLDivElement | null>
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U', onRequestClick, onNewRequest, requests = [], agencyMembers = [], onRequestUpdate, currentOrgId, onLoadMore, onSearchChange, totalCount, parentRef }: RequestsTableProps) {
  const pathname = usePathname()
  const router = useRouter()
  const baseRoute = pathname.includes('/clients/') ? 'clients' : 'agencies'
  
  const [searchQuery, setSearchQuery] = useState('')
  const [sortValue, setSortValue] = useState('created')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [requestStatus, setRequestStatus] = useState('in_review')
  const [openActionsDropdown, setOpenActionsDropdown] = useState<string | null>(null)
  
  // Optimistic UI state for requests
  const [optimisticRequests, setOptimisticRequests] = useState<Request[]>(requests)
  
  // Update optimistic requests when props change
  useEffect(() => {
    setOptimisticRequests(requests)
  }, [requests])
  
  // Assignee ref for combobox functionality
  const assigneeListRowRef = useRef<HTMLDivElement & { triggerCombobox: () => void } | null>(null)
  const [isAssigneeUnassigned, setIsAssigneeUnassigned] = useState(false)
  
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

  // Mock current user organization ID (in real app, this would come from context/auth)
  const currentUserOrgId = 'client-org-1' // This should match the submitted by organization ID
  const submittedByOrgId = 'client-org-1' // This should come from the actual request data
  const canDeleteRequest = currentUserOrgId === submittedByOrgId
  
  // Use total count from database, fallback to displayed requests count if not provided
  const requestCount = totalCount !== undefined ? totalCount : optimisticRequests.length
  
  // Transform agency members to combobox options
  const comboboxOptions = agencyMembers.map(member => ({
    value: member.id,
    label: `${member.firstName} ${member.lastName}`,
    avatar: member.avatarUrl,
    email: member.email
  }))

  // Mock requests data
  const mockRequests = [
    {
      id: '1',
      title: 'Update homepage hero for the summer campaign',
      description: 'We need to update the homepage hero section to reflect our new summer campaign. Please refresh all visual elements including the background images, CTAs, and messaging to align with the summer theme.',
      submittedBy: { name: 'John Smith', email: 'john.smith@example.com', orgId: 'client-org-1' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'in_review',
      created: 'Dec 15, 2024'
    },
    {
      id: '2',
      title: 'Fix mobile navigation menu bug',
      submittedBy: { name: 'Emily Chen', email: 'emily.chen@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'new',
      created: 'Dec 14, 2024'
    },
    {
      id: '3',
      title: 'Create new product landing page',
      submittedBy: { name: 'David Wilson', email: 'david.wilson@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'accepted',
      created: 'Dec 13, 2024'
    },
    {
      id: '4',
      title: 'Implement user authentication system',
      submittedBy: { name: 'Lisa Brown', email: 'lisa.brown@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'canceled',
      created: 'Dec 12, 2024'
    },
    {
      id: '5',
      title: 'Design new company logo variations',
      submittedBy: { name: 'Michael Taylor', email: 'michael.taylor@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'in_review',
      created: 'Dec 11, 2024'
    },
    {
      id: '6',
      title: 'Optimize database queries for performance',
      submittedBy: { name: 'Jennifer Lee', email: 'jennifer.lee@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'new',
      created: 'Dec 10, 2024'
    },
    {
      id: '7',
      title: 'Create social media graphics package',
      submittedBy: { name: 'Robert Garcia', email: 'robert.garcia@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'accepted',
      created: 'Dec 9, 2024'
    },
    {
      id: '8',
      title: 'Set up automated testing pipeline',
      submittedBy: { name: 'Amanda White', email: 'amanda.white@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'in_review',
      created: 'Dec 8, 2024'
    },
    {
      id: '9',
      title: 'Redesign checkout flow for better UX',
      submittedBy: { name: 'Kevin Martinez', email: 'kevin.martinez@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'new',
      created: 'Dec 7, 2024'
    },
    {
      id: '10',
      title: 'Implement real-time notifications',
      submittedBy: { name: 'Rachel Green', email: 'rachel.green@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Dec 6, 2024'
    },
    {
      id: '11',
      title: 'Create brand guidelines document',
      submittedBy: { name: 'Thomas Anderson', email: 'thomas.anderson@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'canceled',
      created: 'Dec 5, 2024'
    },
    {
      id: '12',
      title: 'Build admin dashboard interface',
      submittedBy: { name: 'Sofia Rodriguez', email: 'sofia.rodriguez@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'in_review',
      created: 'Dec 4, 2024'
    },
    {
      id: '13',
      title: 'Design email newsletter templates',
      submittedBy: { name: 'James Wilson', email: 'james.wilson@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'new',
      created: 'Dec 3, 2024'
    },
    {
      id: '14',
      title: 'Integrate payment processing system',
      submittedBy: { name: 'Maria Gonzalez', email: 'maria.gonzalez@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Dec 2, 2024'
    },
    {
      id: '15',
      title: 'Create mobile app wireframes',
      submittedBy: { name: 'Daniel Kim', email: 'daniel.kim@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'in_review',
      created: 'Dec 1, 2024'
    },
    {
      id: '16',
      title: 'Implement user role management',
      submittedBy: { name: 'Jessica Brown', email: 'jessica.brown@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'new',
      created: 'Nov 30, 2024'
    },
    {
      id: '17',
      title: 'Design product packaging mockups',
      submittedBy: { name: 'Christopher Davis', email: 'christopher.davis@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'canceled',
      created: 'Nov 29, 2024'
    },
    {
      id: '18',
      title: 'Build API documentation portal',
      submittedBy: { name: 'Ashley Thompson', email: 'ashley.thompson@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Nov 28, 2024'
    },
    {
      id: '19',
      title: 'Create video tutorial thumbnails',
      submittedBy: { name: 'Ryan Murphy', email: 'ryan.murphy@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'in_review',
      created: 'Nov 27, 2024'
    },
    {
      id: '20',
      title: 'Optimize website loading speed',
      submittedBy: { name: 'Nicole Adams', email: 'nicole.adams@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'new',
      created: 'Nov 26, 2024'
    },
    {
      id: '21',
      title: 'Design annual report layout',
      submittedBy: { name: 'Brian Foster', email: 'brian.foster@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'in_review',
      created: 'Nov 25, 2024'
    },
    {
      id: '22',
      title: 'Implement content management system',
      submittedBy: { name: 'Olivia Martinez', email: 'olivia.martinez@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Nov 24, 2024'
    },
    {
      id: '23',
      title: 'Create product photography suite',
      submittedBy: { name: 'Nathan Park', email: 'nathan.park@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'new',
      created: 'Nov 23, 2024'
    },
    {
      id: '24',
      title: 'Build customer analytics dashboard',
      submittedBy: { name: 'Victoria Clarke', email: 'victoria.clarke@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'in_review',
      created: 'Nov 22, 2024'
    },
    {
      id: '25',
      title: 'Redesign mobile app icon',
      submittedBy: { name: 'Carlos Ruiz', email: 'carlos.ruiz@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'accepted',
      created: 'Nov 21, 2024'
    },
    {
      id: '26',
      title: 'Set up CI/CD pipeline',
      submittedBy: { name: 'Hannah Moore', email: 'hannah.moore@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'canceled',
      created: 'Nov 20, 2024'
    },
    {
      id: '27',
      title: 'Create investor pitch deck',
      submittedBy: { name: 'Ian Thompson', email: 'ian.thompson@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'new',
      created: 'Nov 19, 2024'
    },
    {
      id: '28',
      title: 'Implement error logging system',
      submittedBy: { name: 'Grace Lin', email: 'grace.lin@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'in_review',
      created: 'Nov 18, 2024'
    },
    {
      id: '29',
      title: 'Design product packaging mockups',
      submittedBy: { name: 'Jack Wright', email: 'jack.wright@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'accepted',
      created: 'Nov 17, 2024'
    },
    {
      id: '30',
      title: 'Build multi-tenant architecture',
      submittedBy: { name: 'Emma Taylor', email: 'emma.taylor@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'new',
      created: 'Nov 16, 2024'
    },
    {
      id: '31',
      title: 'Create event signage and collateral',
      submittedBy: { name: 'Ryan Scott', email: 'ryan.scott@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'in_review',
      created: 'Nov 15, 2024'
    },
    {
      id: '32',
      title: 'Optimize image loading performance',
      submittedBy: { name: 'Sophia Chen', email: 'sophia.chen@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'accepted',
      created: 'Nov 14, 2024'
    },
    {
      id: '33',
      title: 'Design trade show booth graphics',
      submittedBy: { name: 'Marcus Johnson', email: 'marcus.johnson@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'canceled',
      created: 'Nov 13, 2024'
    },
    {
      id: '34',
      title: 'Implement OAuth authentication',
      submittedBy: { name: 'Lily Anderson', email: 'lily.anderson@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'new',
      created: 'Nov 12, 2024'
    },
    {
      id: '35',
      title: 'Create brand identity guidelines',
      submittedBy: { name: 'Derek Williams', email: 'derek.williams@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'in_review',
      created: 'Nov 11, 2024'
    },
    {
      id: '36',
      title: 'Build inventory management system',
      submittedBy: { name: 'Maya Patel', email: 'maya.patel@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'accepted',
      created: 'Nov 10, 2024'
    },
    {
      id: '37',
      title: 'Design customer onboarding flow',
      submittedBy: { name: 'Peter Mitchell', email: 'peter.mitchell@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'new',
      created: 'Nov 9, 2024'
    },
    {
      id: '38',
      title: 'Implement search functionality',
      submittedBy: { name: 'Ava Brown', email: 'ava.brown@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'in_review',
      created: 'Nov 8, 2024'
    },
    {
      id: '39',
      title: 'Create social media content calendar',
      submittedBy: { name: 'Tyler Davis', email: 'tyler.davis@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'accepted',
      created: 'Nov 7, 2024'
    },
    {
      id: '40',
      title: 'Set up monitoring and alerting',
      submittedBy: { name: 'Zoe Martinez', email: 'zoe.martinez@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'canceled',
      created: 'Nov 6, 2024'
    },
    {
      id: '41',
      title: 'Design product packaging labels',
      submittedBy: { name: 'Connor Lee', email: 'connor.lee@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'new',
      created: 'Nov 5, 2024'
    },
    {
      id: '42',
      title: 'Build data export feature',
      submittedBy: { name: 'Chloe Foster', email: 'chloe.foster@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'in_review',
      created: 'Nov 4, 2024'
    },
    {
      id: '43',
      title: 'Create exhibition wall graphics',
      submittedBy: { name: 'Lucas Garcia', email: 'lucas.garcia@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'accepted',
      created: 'Nov 3, 2024'
    },
    {
      id: '44',
      title: 'Implement file upload system',
      submittedBy: { name: 'Nora Rodriguez', email: 'nora.rodriguez@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'new',
      created: 'Nov 2, 2024'
    },
    {
      id: '45',
      title: 'Design email signature templates',
      submittedBy: { name: 'Sam Wilson', email: 'sam.wilson@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'in_review',
      created: 'Nov 1, 2024'
    },
    {
      id: '46',
      title: 'Build notification center',
      submittedBy: { name: 'Isabella Kim', email: 'isabella.kim@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Oct 31, 2024'
    },
    {
      id: '47',
      title: 'Create website favicon set',
      submittedBy: { name: 'Ethan White', email: 'ethan.white@example.com', orgId: 'client-org-3' },
      type: 'Design',
      assignee: { name: 'Alex Rodriguez', id: '4' },
      status: 'canceled',
      created: 'Oct 30, 2024'
    },
    {
      id: '48',
      title: 'Implement API rate limiting',
      submittedBy: { name: 'Mia Thompson', email: 'mia.thompson@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Emily Davis', id: '3' },
      status: 'new',
      created: 'Oct 29, 2024'
    },
    {
      id: '49',
      title: 'Design presentation templates',
      submittedBy: { name: 'Joshua Clark', email: 'joshua.clark@example.com', orgId: 'client-org-2' },
      type: 'Design',
      assignee: { name: 'Sarah Johnson', id: '1' },
      status: 'in_review',
      created: 'Oct 28, 2024'
    },
    {
      id: '50',
      title: 'Build automated backup system',
      submittedBy: { name: 'Emma Lewis', email: 'emma.lewis@example.com', orgId: 'client-org-1' },
      type: 'Development',
      assignee: { name: 'Mike Chen', id: '2' },
      status: 'accepted',
      created: 'Oct 27, 2024'
    }
  ]

  // Sort options
  const sortOptions = [
    { value: 'created', label: 'Created (newest first)', buttonLabel: 'Created' },
    { value: 'status', label: 'Status', buttonLabel: 'Status' }
  ]

  const getCurrentSortLabel = () => {
    return sortOptions.find(option => option.value === sortValue)?.buttonLabel || 'Created'
  }

  const handleSortChange = (newSortValue: string) => {
    setSortValue(newSortValue)
    // Sort will be applied when we implement actual data
  }

  // Assignee handlers
  const handleAssigneeSelect = async (requestId: string, memberId: string) => {
    const selectedMember = agencyMembers.find(member => member.id === memberId)
    if (selectedMember) {
      const newAssignee = {
        id: memberId,
        name: `${selectedMember.firstName} ${selectedMember.lastName}`,
        email: selectedMember.email,
        avatarUrl: selectedMember.avatarUrl
      }
      
      // Optimistic update
      setOptimisticRequests(prev => 
        prev.map(req => 
          req.id === requestId 
            ? { ...req, assignee: newAssignee } 
            : req
        )
      )
      
      // Notify parent for bidirectional updates (table → modal)
      if (onRequestUpdate) {
        onRequestUpdate(requestId, { assignee: newAssignee })
      }
      
      try {
        await updateRequestAssignee(requestId, memberId)
        toast.success(`Assigned to ${selectedMember.firstName} ${selectedMember.lastName}`)
        router.refresh() // Refresh to get updated data from server
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error('Failed to update assignee:', error)
        }
        toast.error('Failed to update assignee')
        // Revert optimistic update on error
        setOptimisticRequests(requests)
        if (onRequestUpdate) {
          // Revert parent state as well
          const originalRequest = requests.find(r => r.id === requestId)
          if (originalRequest) {
            onRequestUpdate(requestId, { assignee: originalRequest.assignee })
          }
        }
      }
    }
  }

  const handleClearAssignee = async (requestId: string) => {
    // Optimistic update
    setOptimisticRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, assignee: null } 
          : req
      )
    )
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { assignee: null })
    }
    
    try {
      await updateRequestAssignee(requestId, null)
      toast.success('Assignee removed')
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to clear assignee:', error)
      }
      toast.error('Failed to clear assignee')
      // Revert optimistic update on error
      setOptimisticRequests(requests)
      if (onRequestUpdate) {
        // Revert parent state as well
        const originalRequest = requests.find(r => r.id === requestId)
        if (originalRequest) {
          onRequestUpdate(requestId, { assignee: originalRequest.assignee })
        }
      }
    }
  }

  // Status handler
  const handleStatusChange = async (requestId: string, newStatus: string) => {
    const validStatuses = ['new', 'in_review', 'accepted', 'canceled'] as const
    if (!validStatuses.includes(newStatus as any)) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Invalid status:', newStatus)
      }
      return
    }
    
    const typedStatus = newStatus as 'new' | 'in_review' | 'accepted' | 'canceled'
    
    // Optimistic update
    setOptimisticRequests(prev => 
      prev.map(req => 
        req.id === requestId 
          ? { ...req, status: typedStatus } 
          : req
      )
    )
    
    // Notify parent for bidirectional updates (table → modal)
    if (onRequestUpdate) {
      onRequestUpdate(requestId, { status: typedStatus })
    }
    
    try {
      await updateRequestStatus(requestId, typedStatus)
      const statusLabels = {
        new: 'New',
        in_review: 'In review',
        accepted: 'Accepted',
        canceled: 'Canceled'
      }
      toast.success(`Status updated to ${statusLabels[typedStatus]}`)
      router.refresh() // Refresh to get updated data from server
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Failed to update status:', error)
      }
      toast.error('Failed to update status')
      // Revert optimistic update on error
      setOptimisticRequests(requests)
      if (onRequestUpdate) {
        // Revert parent state as well
        const originalRequest = requests.find(r => r.id === requestId)
        if (originalRequest) {
          onRequestUpdate(requestId, { status: originalRequest.status })
        }
      }
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
  const handleRowClick = (requestId: string) => {
    onRequestClick?.(requestId)
  }

  const handleCopyLink = (requestId: string, connectionId: string) => {
    const fullUrl = `${window.location.origin}/${baseRoute}/${connectionId}/requests/${requestId}`
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast.success('Link copied to clipboard')
    }).catch(() => {
      toast.error('Failed to copy link')
    })
  }
  
  const handleDeleteRequest = async (requestId: string) => {
    // Optimistically remove request from table
    setOptimisticRequests(prev => prev.filter(r => r.id !== requestId))
    
    try {
      await deleteRequest(requestId)
      toast.success('Request deleted')
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('Error deleting request:', error)
      }
      toast.error('Failed to delete request')
      // Revert optimistic update on error
      setOptimisticRequests(requests)
    }
  }

  // Virtual scroll setup using shared hook
  const { containerRef, rowVirtualizer, virtualItems, isNearEnd } = useVirtualTable({
    items: optimisticRequests,
    onLoadMore,
    scrollRestoreDeps: [searchQuery],
    parentRef
  })
  
  // isNearEnd available for future use (e.g., showing loading indicator)

  return (
    <div className="w-full min-w-0">
      {/* Search section - Sticky */}
      <div className="sticky top-10 z-1 bg-[var(--color-base-surface-page-background)] pt-5 pb-4 px-5 rounded-t-lg">
        <div className="flex items-center justify-between w-full">
          <SearchInput
            placeholder="Search requests"
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value)
              onSearchChange?.(value)
            }}
            count={requestCount}
            countLabel={(requestCount as number) === 1 ? 'request' : 'requests'}
          />
          <div className="flex items-center gap-3">
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <div>
                  <AvatarButton
                    src={userAvatar}
                    fallback={userInitials}
                    className="flex items-center"
                    size="custom"
                    customSize={{ button: 'h-6 w-6', avatar: 'h-[26px] w-[26px]' }}
                    onClick={() => {
                      // Avatar click handled by ListRow component
                    }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="center" sideOffset={4}>
                Assigned to me
              </TooltipContent>
            </Tooltip>
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
                  {getCurrentSortLabel()}
                  <CaretDown size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
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
            <Button
              variant="default"
              size="lg"
              className="cursor-pointer text-sm flex-shrink-0 h-6"
              style={{ paddingLeft: '16px', paddingRight: '16px' }}
              onClick={() => {
                onNewRequest?.();
              }}
            >
              <Plus size={16} className="mr-1" />
              New request
            </Button>
          </div>
        </div>
      </div>

      {/* Table Header - Sticky */}
      <div className="sticky top-[112px] z-10 bg-[var(--color-base-surface-page-background)] px-5">
        <Table className="table-fixed w-full border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[25%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Title
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Submitted by
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Project
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Assignee
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Status
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Created
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
          <VirtualTableBody
            items={optimisticRequests}
            virtualItems={virtualItems}
            rowVirtualizer={rowVirtualizer}
            onRowClick={(request) => handleRowClick(request.id)}
            renderRow={(request) => (
              <>
                <TableCell className="w-[25%] py-0 truncate">
                  {request.title}
                </TableCell>

                <TableCell 
                  className="w-[15%] py-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ListRow
                    avatar
                    avatarUrl={request.submittedBy.avatarUrl}
                    text={request.submittedBy.name}
                    variant="stacked"
                    className="min-w-0"
                    onClick={() => {
                      const nameParts = request.submittedBy.name.split(' ')
                      handleContactClick({
                        id: request.submittedBy.id,
                        first_name: nameParts[0] || '',
                        last_name: nameParts.slice(1).join(' ') || '',
                        email: request.submittedBy.email,
                        avatar_url: request.submittedBy.avatarUrl || '',
                        job_title: request.submittedBy.jobTitle || '',
                        organization: {
                          id: request.submittedBy.orgId,
                          name: request.submittedBy.orgName,
                          logo_url: request.submittedBy.orgLogo || ''
                        }
                      })
                    }}
                  />
                </TableCell>

                <TableCell className="w-[15%] py-0">
                  <Badge variant="neutral" className="text-xs">
                    {request.type === 'general' ? 'General request' : request.type}
                  </Badge>
                </TableCell>

                <TableCell 
                  className="w-[15%] py-0"
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                >
                  <ListRow
                    ref={assigneeListRowRef}
                    avatar={true}
                    avatarUrl={!isAssigneeUnassigned && request.assignee ? request.assignee.avatarUrl : undefined}
                    avatarFallback={!request.assignee ? <User size={16} weight="fill" className="text-white" /> : undefined}
                    text={!request.assignee ? "Unassigned" : request.assignee.name}
                    textColor={!request.assignee ? "var(--color-base-text-tertiary)" : "var(--color-base-text-primary)"}
                    variant="stacked"
                    className="min-w-0 min-h-[32px]"
                    onClick={() => {
                      // Assignee click handled by combobox
                    }}
                    comboboxOptions={comboboxOptions}
                    onComboboxSelect={(memberId) => handleAssigneeSelect(request.id, memberId)}
                    comboboxPlaceholder="Search members..."
                    comboboxWidth="240px"
                    clearable={!!request.assignee}
                    onClear={() => handleClearAssignee(request.id)}
                  />
                </TableCell>

                <TableCell 
                  className="w-[15%] py-0" 
                  onClick={(e) => e.stopPropagation()}
                >
                  <InlineEdit
                    type="badge"
                    value={request.status}
                    options={[
                      { value: 'new', label: 'New' },
                      { value: 'in_review', label: 'In review' },
                      { value: 'accepted', label: 'Accepted' },
                      { value: 'canceled', label: 'Canceled' },
                    ]}
                    onSave={(newStatus) => handleStatusChange(request.id, newStatus)}
                    badgeComponent="request"
                    className="truncate h-6 rounded-[8px]"
                  />
                </TableCell>

                <TableCell className="w-[15%] py-0 truncate">
                  {request.createdAt}
                </TableCell>

                <TableCell 
                  className="w-[44px] p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center h-full">
                    <DropdownMenu modal={false} open={openActionsDropdown === request.id} onOpenChange={(open) => setOpenActionsDropdown(open ? request.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className={`p-0 h-6 w-6 cursor-pointer transition-colors duration-75 ${
                            openActionsDropdown === request.id
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
                          handleRowClick(request.id)
                        }}>
                          <MagnifyingGlass size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setOpenActionsDropdown(null)}>
                          <FlowArrow size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          Convert to task
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setOpenActionsDropdown(null)
                          handleCopyLink(request.id, request.connectionId)
                        }}>
                          <LinkSimple size={16} style={{ color: 'var(--color-base-text-primary)' }} />
                          Copy link
                        </DropdownMenuItem>
                        {request.createdByOrgId === currentOrgId && (
                          <>
                            <div className="border-t border-[var(--color-neutral-6)] my-1" />
                            <DropdownMenuItem 
                              onClick={() => {
                                handleDeleteRequest(request.id)
                                setOpenActionsDropdown(null)
                              }}
                              style={{ color: 'var(--color-red-11)' }}
                            >
                              <Trash size={16} style={{ color: 'var(--color-red-11)' }} />
                              Delete request
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
        </div>
      </div>

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

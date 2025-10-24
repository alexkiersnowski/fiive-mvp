"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { SearchInput } from '@/components/ui/search-input'
import AvatarButton from '@/components/ui/avatar-button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ListRow } from '@/components/ui/list-row'
import { Badge } from '@/components/ui/badge'
import { RequestBadge } from '@/components/ui/request-badge'
import { InlineEdit } from '@/components/ui/inline-edit'
import { Plus, SortAscending, CaretDown, Check, DotsThree } from '@phosphor-icons/react'

interface RequestsTableProps {
  userAvatar?: string
  userInitials?: string
}

export default function RequestsTable({ userAvatar = '', userInitials = 'U' }: RequestsTableProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortValue, setSortValue] = useState('created')
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)
  const [requestStatus, setRequestStatus] = useState('in_review')
  const [isActionsDropdownOpen, setIsActionsDropdownOpen] = useState(false)
  
  // Mock data for scaffolding
  const requestCount = 1

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



  return (
    <div className="w-full min-w-0">
      {/* Search section */}
      <div>
        <div className="flex items-center justify-between w-full">
          <SearchInput
            placeholder="Search requests"
            value={searchQuery}
            onChange={setSearchQuery}
            count={requestCount}
            countLabel={requestCount === 1 ? 'request' : 'requests'}
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
                      // TODO: Handle avatar click action
                      console.log('Avatar clicked');
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
                // TODO: Handle new request action
                console.log('New request clicked');
              }}
            >
              <Plus size={16} className="mr-1" />
              New request
            </Button>
          </div>
        </div>
      </div>

      {/* Table section */}
      <div className="w-full mt-4 overflow-x-auto">
        <Table className="table-fixed w-full border-collapse">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[30%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Title
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Submitted by
              </TableHead>
              <TableHead className="w-[15%] text-xs-regular text-[var(--color-base-text-tertiary)] truncate">
                Type
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

          <TableBody>
            <TableRow className="[&>*]:h-[44px] hover:bg-transparent">
              <TableCell className="w-[30%] py-0 truncate">
                Update homepage hero for the summer campaign
              </TableCell>

              <TableCell className="w-[15%] py-0">
                <ListRow
                  avatar
                  text="John Smith"
                  variant="stacked"
                  className="min-w-0"
                  onClick={() => console.log('Submitted by clicked')}
                />
              </TableCell>

              <TableCell className="w-[15%] py-0">
                <Badge variant="neutral" className="text-xs">Design</Badge>
              </TableCell>

              <TableCell className="w-[15%] py-0">
                <ListRow
                  avatar
                  text="Sarah Johnson"
                  variant="stacked"
                  className="min-w-0"
                  onClick={() => console.log('Assignee clicked')}
                />
              </TableCell>

              <TableCell className="w-[15%] py-0">
                <InlineEdit
                  type="badge"
                  value={requestStatus}
                  options={[
                    { value: 'new', label: 'New' },
                    { value: 'in_review', label: 'In Review' },
                    { value: 'accepted', label: 'Accepted' },
                    { value: 'canceled', label: 'Canceled' },
                  ]}
                  onSave={setRequestStatus}
                  badgeComponent="request"
                  className="truncate h-6 rounded-[8px]"
                />
              </TableCell>

              <TableCell className="w-[15%] py-0 truncate">
                Dec 15, 2024
              </TableCell>

              <TableCell className="w-[44px] p-0">
                <div className="flex items-center justify-center h-full">
                  <DropdownMenu modal={false} open={isActionsDropdownOpen} onOpenChange={setIsActionsDropdownOpen}>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className="p-0 h-6 w-6 hover:bg-[var(--color-interactive-surface-hover)]"
                      >
                        <DotsThree size={16} />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setIsActionsDropdownOpen(false)}>
                        Edit request
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => setIsActionsDropdownOpen(false)}
                        style={{ color: 'var(--color-red-11)' }}
                      >
                        Delete request
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

    </div>
  )
}

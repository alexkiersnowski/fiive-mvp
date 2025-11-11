'use client'

import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, SortAscending, CaretDown, Check } from '@phosphor-icons/react/ssr'

type SortOption = {
  value: string
  label: string
  buttonLabel: string
}

interface ClientsHeaderProps {
  totalCount: number
  searchValue: string
  onSearchChange: (value: string) => void
  sortValue: string
  sortOptions: SortOption[]
  onSortChange: (value: string) => void
  onAddClient: () => void
}

export function ClientsHeader({
  totalCount,
  searchValue,
  onSearchChange,
  sortValue,
  sortOptions,
  onSortChange,
  onAddClient,
}: ClientsHeaderProps) {
  const [isSortDropdownOpen, setIsSortDropdownOpen] = useState(false)

  const currentSortLabel = useMemo(
    () => sortOptions.find((option) => option.value === sortValue)?.buttonLabel || 'Newest first',
    [sortOptions, sortValue],
  )

  return (
    <div className="flex flex-col gap-5 pb-4" style={{ marginTop: '24px' }}>
      <div className="flex items-center justify-between">
        <h1 className="display-9-medium" style={{ color: 'var(--color-base-text-primary, #1C2024)' }}>
          Clients
        </h1>
        <Button
          variant="default"
          size="lg"
          className="cursor-pointer text-sm flex items-center gap-2"
          onClick={onAddClient}
        >
          <Plus size={16} />
          Add client
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <SearchInput
          placeholder="Search clients"
          count={totalCount}
          countLabel={totalCount === 1 ? 'client' : 'clients'}
          value={searchValue}
          onChange={onSearchChange}
        />
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
          <DropdownMenuContent align="end" className="w-64">
            {sortOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={(e) => {
                  onSortChange(option.value)
                  setIsSortDropdownOpen(false)
                  const trigger = e.currentTarget.closest('[data-radix-dropdown-menu-trigger]') as HTMLElement
                  setTimeout(() => {
                    trigger?.blur()
                  }, 0)
                }}
                className="flex items-center justify-between"
              >
                <span>{option.label}</span>
                {sortValue === option.value && <Check size={16} className="text-inherit" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}


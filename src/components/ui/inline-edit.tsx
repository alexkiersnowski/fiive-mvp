'use client'

import * as React from 'react'
import { Check, XCircle, CalendarBlank } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Badge } from './badge'
import { Button } from './button'
import { Calendar } from './calendar'
import { StatusBadge, StatusVariant } from './connection-badge'
import { EngagementBadge, EngagementVariant } from './engagement-badge'
import { HealthBadge, HealthVariant } from './health-badge'
import { RequestBadge, RequestVariant } from './request-badge'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'

type InlineEditProps = 
  | { 
      type: 'text'
      value: string
      onSave: (value: string) => void
      placeholder?: string
      className?: string
      currency?: string // e.g., '€', '$', '£'
      numeric?: boolean // If true, only allow numeric input
      editingPlaceholder?: string // Placeholder shown when editing (e.g., "250,000.00")
    }
  | { 
      type: 'badge'
      value: string
      options: { value: string; label: string }[]
      onSave: (value: string) => void
      className?: string
      searchable?: boolean
      clearable?: boolean
      badgeComponent?: 'connection' | 'engagement' | 'health' | 'request'
      placeholder?: string
    }
  | {
      type: 'date'
      value: string // ISO date string or formatted date
      onSave: (value: string) => void
      placeholder?: string
      className?: string
      dateFormat?: string // e.g., 'dd MMM yyyy' for '23 Oct 2025'
    }

export function InlineEdit(props: InlineEditProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [tempValue, setTempValue] = React.useState(props.value)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  
  // Date-specific state (moved to top level to avoid conditional hooks)
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(() => {
    if (props.type === 'date' && props.value) {
      try {
        return new Date(props.value)
      } catch {
        return undefined
      }
    }
    return undefined
  })

  // Reset temp value when value prop changes
  React.useEffect(() => {
    setTempValue(props.value)
  }, [props.value])
  
  // Update selected date when value prop changes (for date type)
  React.useEffect(() => {
    if (props.type === 'date') {
      if (props.value) {
        try {
          setSelectedDate(new Date(props.value))
        } catch {
          setSelectedDate(undefined)
        }
      } else {
        setSelectedDate(undefined)
      }
    }
  }, [props.value, props.type])

  // Focus input when editing starts
  React.useEffect(() => {
    if (isEditing && props.type === 'text' && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing, props.type])

  const handleSave = () => {
    let valueToSave = tempValue
    
    // Format numeric/currency values before saving
    if (props.type === 'text' && props.numeric && tempValue) {
      // Remove existing commas and parse as float
      const numericValue = parseFloat(tempValue.replace(/,/g, ''))
      
      if (!isNaN(numericValue)) {
        // Check if number has meaningful decimal places (not just .00)
        const hasSignificantDecimals = numericValue % 1 !== 0
        
        // Format with thousand separators, only show decimals if they're meaningful
        valueToSave = numericValue.toLocaleString('en-US', {
          minimumFractionDigits: hasSignificantDecimals ? 2 : 0,
          maximumFractionDigits: 2
        })
      }
    }
    
    if (valueToSave !== props.value) {
      props.onSave(valueToSave)
      setTempValue(valueToSave) // Update tempValue to match formatted value
    }
    setIsEditing(false)
    setIsPopoverOpen(false)
  }

  const handleCancel = () => {
    setTempValue(props.value)
    setIsEditing(false)
    setIsPopoverOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancel()
    }
  }

  const handleBadgeSelect = (value: string) => {
    setTempValue(value)
    props.onSave(value)
    setIsPopoverOpen(false)
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    setTempValue('')
    props.onSave('')
    setIsPopoverOpen(false)
  }


  if (props.type === 'text') {
    const handleNumericChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value
      
      if (props.numeric) {
        // Allow numbers, decimal point, and comma separators
        const cleanValue = value.replace(/[^\d.,]/g, '')
        
        // Validate numeric(12,2) format: max 10 digits before decimal, 2 after
        const parts = cleanValue.replace(/,/g, '').split('.')
        const integerPart = parts[0] || ''
        const decimalPart = parts[1] || ''
        
        // Check if it exceeds numeric(12,2) limits
        if (integerPart.length <= 10 && decimalPart.length <= 2) {
          setTempValue(cleanValue)
        }
        // If it exceeds limits, don't update (effectively blocking the input)
      } else {
        setTempValue(value)
      }
    }

    const formatDisplayValue = (value: string) => {
      if (!value) return props.placeholder || 'Click to edit'
      if (props.currency) {
        return `${props.currency}${value}`
      }
      return value
    }

    if (isEditing) {
      return (
        <div className="relative flex items-center">
          {props.currency && (
            <span className="absolute left-2 text-sm-regular pointer-events-none" style={{ color: 'var(--color-base-text-primary)' }}>
              {props.currency}
            </span>
          )}
          <Input
            ref={inputRef}
            value={tempValue}
            onChange={handleNumericChange}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            placeholder={props.editingPlaceholder || props.placeholder}
            className={cn(
              "py-1 h-auto text-sm-regular rounded-sm",
              props.currency ? "pl-6 pr-2" : "px-2",
              props.className
            )}
          />
        </div>
      )
    }

    return (
      <div
        className={cn(
          "py-1 px-2 text-sm-regular rounded-sm transition-colors duration-75",
          "hover:bg-[var(--color-interactive-surface-hover)]",
          props.className
        )}
        style={{
          cursor: 'pointer',
          ...(!props.value ? { color: 'var(--color-base-text-tertiary)' } : {})
        }}
        onClick={() => setIsEditing(true)}
      >
        {formatDisplayValue(props.value)}
      </div>
    )
  }

  // Badge type
  if (props.type === 'badge') {
    const selectedOption = props.options.find(option => option.value === tempValue)
    const displayLabel = selectedOption?.label || (tempValue ? tempValue : (props.placeholder || 'Add status'))
    const isEmpty = !tempValue
    
    // Render the appropriate badge component
    const renderBadge = () => {
      if (isEmpty) {
        return (
          <span className="text-sm-regular text-tertiary">
            {displayLabel}
          </span>
        )
      }
      
      if (props.badgeComponent === 'engagement') {
        return <EngagementBadge variant={tempValue as EngagementVariant} size="sm" showText={true} />
      }
      
      if (props.badgeComponent === 'connection') {
        return <StatusBadge variant={tempValue as StatusVariant} size="sm" showText={true} />
      }
      
      if (props.badgeComponent === 'health') {
        return <HealthBadge variant={tempValue as HealthVariant} size="sm" showText={true} />
      }
      
      if (props.badgeComponent === 'request') {
        return <RequestBadge variant={tempValue as RequestVariant} size="sm" showText={true} />
      }
      
      // Default to regular Badge component
      return (
        <Badge variant="outline" className="text-xs">
          {displayLabel}
        </Badge>
      )
    }

    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "py-1 px-2 rounded transition-colors duration-75 flex items-center justify-between gap-2",
              "hover:bg-[var(--color-interactive-surface-hover)]",
              isPopoverOpen && "bg-[var(--color-interactive-surface-hover)]",
              props.className
            )}
            style={{ cursor: 'pointer' }}
          >
            {renderBadge()}
            {props.clearable && tempValue && isPopoverOpen && (
              <XCircle 
                size={16} 
                weight="fill" 
                className="cursor-pointer transition-colors duration-75"
                style={{ 
                  color: 'var(--color-interactive-neutral-default)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-interactive-neutral-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-interactive-neutral-default)'
                }}
                onClick={handleClear}
              />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-full min-w-48 p-0" 
          align="start"
          style={{ width: 'var(--radix-popover-trigger-width)' }}
        >
          <Command>
            {props.searchable && <CommandInput placeholder="Search options..." />}
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {props.options.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleBadgeSelect(option.value)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    {(() => {
                      if (props.badgeComponent === 'engagement') {
                        return <EngagementBadge variant={option.value as EngagementVariant} size="sm" showText={true} />
                      }
                      
                      if (props.badgeComponent === 'connection') {
                        return <StatusBadge variant={option.value as StatusVariant} size="sm" showText={true} />
                      }
                      
                      if (props.badgeComponent === 'health') {
                        return <HealthBadge variant={option.value as HealthVariant} size="sm" showText={true} />
                      }
                      
                      if (props.badgeComponent === 'request') {
                        return <RequestBadge variant={option.value as RequestVariant} size="sm" showText={true} />
                      }
                      
                      return (
                        <Badge variant="outline" className="text-xs">
                          {option.label}
                        </Badge>
                      )
                    })()}
                    {option.value === tempValue && (
                      <Check size={16} className="text-primary" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }

  // Date type
  if (props.type === 'date') {
    const dateFormatString = props.dateFormat || 'd MMM yyyy' // e.g., '23 Oct 2025'
    
    const handleDateSelect = (date: Date | undefined) => {
      setSelectedDate(date)
      if (date) {
        // Format the date for display and save ISO string
        const formattedDate = format(date, dateFormatString)
        props.onSave(formattedDate)
      } else {
        props.onSave('')
      }
      setIsPopoverOpen(false)
    }

    const handleDateClear = (e: React.MouseEvent) => {
      e.stopPropagation()
      setSelectedDate(undefined)
      props.onSave('')
      setIsPopoverOpen(false)
    }
    
    return (
      <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "py-1 px-2 text-sm-regular rounded-sm transition-colors duration-75 flex items-center justify-between gap-2",
              "hover:bg-[var(--color-interactive-surface-hover)]",
              isPopoverOpen && "bg-[var(--color-interactive-surface-hover)]",
              "!cursor-pointer", // Force cursor pointer with !important
              props.className
            )}
            style={{
              cursor: 'pointer',
              ...(!props.value ? { color: 'var(--color-base-text-tertiary)' } : {})
            }}
          >
            <span>{props.value || props.placeholder || 'Select date'}</span>
            {props.value && isPopoverOpen && (
              <XCircle 
                size={16} 
                weight="fill" 
                className="cursor-pointer transition-colors duration-75"
                style={{ 
                  color: 'var(--color-interactive-neutral-default)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--color-interactive-neutral-hover)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--color-interactive-neutral-default)'
                }}
                onClick={handleDateClear}
              />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-auto overflow-hidden p-0" align="center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            defaultMonth={selectedDate || new Date()}
            captionLayout="dropdown"
            initialFocus
          />
        </PopoverContent>
      </Popover>
    )
  }

  // This should never be reached due to TypeScript exhaustiveness checking
  return null
}

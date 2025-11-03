'use client'

import * as React from 'react'
import { Check, XCircle, CalendarBlank } from '@phosphor-icons/react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Textarea } from './textarea'
import { Badge } from './badge'
import { Button } from './button'
import { Calendar } from './calendar'
import { StatusBadge, StatusVariant } from './connection-badge'
import { EngagementBadge, EngagementVariant } from './engagement-badge'
import { HealthBadge, HealthVariant } from './health-badge'
import { RequestBadge, RequestVariant } from './request-badge'
import { ProjectBadge, ProjectVariant } from './project-badge'
import { Popover, PopoverContent, PopoverTrigger } from './popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from './command'

type InlineEditProps = 
  | { 
      type: 'text'
      value: string
      onSave: (value: string) => void
      onChange?: (value: string) => void // Called on every keystroke (real-time updates)
      onTab?: () => void // Called when Tab key is pressed (for custom focus navigation)
      placeholder?: string
      className?: string
      currency?: string // e.g., '€', '$', '£'
      numeric?: boolean // If true, only allow numeric input
      editingPlaceholder?: string // Placeholder shown when editing (e.g., "250,000.00")
      showBorder?: boolean // If true, shows border on input (default: false)
      textClass?: string // Custom text class (e.g., 'display-7-medium text-primary')
      multiline?: boolean // If true, uses textarea for multi-line editing (default: false)
      maxLength?: number // Maximum character length
      preventNewLines?: boolean // If true, Enter saves (no newlines) and pasted content is stripped of newlines (default: false)
      style?: React.CSSProperties // Inline styles
      nonInteractive?: boolean // If true, makes the field non-editable (display only)
      linkifyUrls?: boolean // If true, automatically converts URLs to clickable links in display mode (default: false)
      validationText?: (value: string, isEditing: boolean) => React.ReactNode | React.ReactNode // Validation text shown below input when editing. Function receives current tempValue and isEditing boolean, returns validation content. Or static ReactNode.
    }
  | { 
      type: 'badge'
      value: string
      options: { value: string; label: string }[]
      onSave: (value: string) => void
      className?: string
      searchable?: boolean
      searchPlaceholder?: string
      clearable?: boolean
      badgeComponent?: 'connection' | 'engagement' | 'health' | 'request' | 'project'
      placeholder?: string
      dividerIndex?: number // Index where to insert a divider (after this index)
      popoverWidth?: string // Custom width for the popover dropdown (e.g., '400px')
      badgeBorderRadius?: string // Custom border radius for badge (e.g., '8px')
      maxHeight?: string // Custom max height for the command list dropdown (e.g., '200px')
      nonInteractive?: boolean // If true, makes the field non-editable (display only)
    }
  | {
      type: 'date'
      value: string // ISO date string or formatted date
      onSave: (value: string) => void
      placeholder?: string
      className?: string
      dateFormat?: string // e.g., 'dd MMM yyyy' for '23 Oct 2025'
    }

export interface InlineEditRef {
  startEditing: () => void
}

export const InlineEdit = React.forwardRef<InlineEditRef, InlineEditProps>((props, ref) => {
  const [isEditing, setIsEditing] = React.useState(false)
  const [tempValue, setTempValue] = React.useState(props.value)
  const [isPopoverOpen, setIsPopoverOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  
  // Expose startEditing method to parent via ref
  React.useImperativeHandle(ref, () => ({
    startEditing: () => {
      setIsEditing(true)
      // Focus will happen in useEffect when isEditing becomes true
    }
  }))
  
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

  // Focus input/textarea when editing starts
  React.useEffect(() => {
    if (isEditing && props.type === 'text') {
      const multiline = 'multiline' in props ? props.multiline : false
      if (multiline && textareaRef.current) {
        textareaRef.current.focus()
        // Set cursor to end of text
        const length = textareaRef.current.value.length
        textareaRef.current.setSelectionRange(length, length)
      } else if (!multiline && inputRef.current) {
        inputRef.current.focus()
        // Set cursor to end of text instead of selecting all
        const length = inputRef.current.value.length
        inputRef.current.setSelectionRange(length, length)
      }
    }
  }, [isEditing, props])

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
          if (props.onChange) {
            props.onChange(cleanValue)
          }
        }
        // If it exceeds limits, don't update (effectively blocking the input)
      } else {
        setTempValue(value)
        if (props.onChange) {
          props.onChange(value)
        }
      }
    }

    const formatDisplayValue = (value: string) => {
      if (!value) return props.placeholder || 'Click to edit'
      if (props.currency) {
        return `${props.currency}${value}`
      }
      return value
    }

    // URL detection and linkification utility for multiline text
    const linkifyText = (text: string): React.ReactNode[] => {
      if (!text) return []
      
      // URL regex pattern: matches http://, https://, www., and domain patterns
      // Also handles URLs that may be followed by punctuation
      const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+[^\s]*)/gi
      
      const parts: React.ReactNode[] = []
      let lastIndex = 0
      let match
      
      while ((match = urlRegex.exec(text)) !== null) {
        // Add text before the URL
        if (match.index > lastIndex) {
          parts.push(text.substring(lastIndex, match.index))
        }
        
        // Extract the URL
        let url = match[0]
        
        // Remove trailing punctuation that shouldn't be part of the URL
        // But keep punctuation that's commonly part of URLs (/, ?, &, =, etc.)
        url = url.replace(/[.,;:!?]+$/, '')
        
        // Ensure www. URLs have http:// prefix
        let href = url
        if (url.startsWith('www.')) {
          href = `https://${url}`
        } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
          href = `https://${url}`
        }
        
        // Add the link element
        parts.push(
          React.createElement('a', {
            key: `link-${match.index}`,
            href: href,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (e: React.MouseEvent) => e.stopPropagation(), // Prevent triggering inline edit
            style: {
              color: 'var(--color-interactive-neutral-default)',
              textDecoration: 'underline',
              textDecorationColor: 'var(--color-interactive-neutral-default)',
              cursor: 'pointer'
            },
            className: 'hover:opacity-80'
          }, url)
        )
        
        lastIndex = match.index + match[0].length
      }
      
      // Add remaining text after last URL
      if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex))
      }
      
      return parts.length > 0 ? parts : [text]
    }

    if (isEditing) {
      // Multi-line editing with textarea
      const multiline = 'multiline' in props ? props.multiline : false
      const preventNewLines = 'preventNewLines' in props ? props.preventNewLines : false
      const validationText = 'validationText' in props ? props.validationText : undefined
      
      if (multiline) {
        const validationContent = validationText 
          ? (typeof validationText === 'function' ? validationText(tempValue, true) : validationText)
          : null
        
        return (
          <div className="flex flex-col">
            <Textarea
              ref={textareaRef}
              value={tempValue}
              onChange={(e) => {
                const newValue = e.target.value
                setTempValue(newValue)
                if (props.type === 'text' && props.onChange) {
                  props.onChange(newValue)
                }
              }}
              onPaste={(e) => {
                if (preventNewLines) {
                  const pastedText = e.clipboardData.getData('text')
                  // Only prevent default if there are newlines to clean
                  if (/\r?\n/.test(pastedText)) {
                    e.preventDefault()
                    const cleanedText = pastedText.replace(/\r?\n/g, '')
                    
                    // Get selection to handle overwrite vs append
                    const textarea = e.currentTarget
                    const start = textarea.selectionStart
                    const end = textarea.selectionEnd
                    const newValue = tempValue.substring(0, start) + cleanedText + tempValue.substring(end)
                    setTempValue(newValue)
                    
                    // Move cursor to end of pasted content
                    setTimeout(() => {
                      textarea.selectionStart = textarea.selectionEnd = start + cleanedText.length
                    }, 0)
                  }
                  // If no newlines, let native paste happen to preserve undo
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Tab' && props.type === 'text' && props.onTab) {
                  e.preventDefault()
                  handleSave()
                  props.onTab()
                } else if (e.key === 'Enter' && preventNewLines) {
                  e.preventDefault()
                  handleSave()
                  // If onTab is provided, also navigate to next field
                  if (props.type === 'text' && props.onTab) {
                    props.onTab()
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault()
                  setTempValue(props.value)
                  setIsEditing(false)
                }
              }}
              onBlur={handleSave}
              placeholder={props.editingPlaceholder || props.placeholder}
              maxLength={props.maxLength}
              style={{
                ...(props.style || {}),
                overflowWrap: 'break-word',
                wordBreak: 'break-word'
              }}
              className={cn(
                "resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-1 py-1 rounded-sm !min-h-0",
                props.textClass || "text-sm-regular",
                props.className
              )}
            />
            {/* Validation text - reserve space to prevent layout shift */}
            {validationContent && (
              <div className="h-5 flex items-start mt-2">
                {validationContent}
              </div>
            )}
          </div>
        )
      }
      
      // Single-line editing with input
      const validationContent = validationText 
        ? (typeof validationText === 'function' ? validationText(tempValue, true) : validationText)
        : null
      
      return (
        <div className="flex flex-col">
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
              maxLength={props.maxLength}
              style={props.style || {}}
              className={cn(
                "py-1 h-auto rounded-sm",
                props.textClass || "text-sm-regular",
                !props.showBorder && "border-0 focus-visible:ring-0 focus-visible:ring-offset-0",
                props.currency ? "pl-6 pr-1" : "px-1",
                props.className
              )}
            />
          </div>
          {/* Validation text - reserve space to prevent layout shift */}
          {validationContent && (
            <div className="h-5 flex items-start mt-2">
              {validationContent}
            </div>
          )}
        </div>
      )
    }

    const multiline = 'multiline' in props ? props.multiline : false
    const linkifyUrls = 'linkifyUrls' in props ? props.linkifyUrls : false
    const validationText = 'validationText' in props ? props.validationText : undefined
    const displayValue = formatDisplayValue(props.value)
    
    // For multiline text with linkifyUrls enabled, apply linkification to make URLs clickable
    const renderedContent = multiline && linkifyUrls && props.value ? (
      <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
        {linkifyText(props.value)}
      </span>
    ) : displayValue
    
    // Check for persistent validation (when not editing)
    const persistentValidation = validationText 
      ? (typeof validationText === 'function' ? validationText(props.value, false) : validationText)
      : null
    
    return (
      <div className="flex flex-col">
        <div
          className={cn(
            "py-1 px-1 rounded-sm transition-colors duration-75",
            props.textClass || "text-sm-regular",
            !multiline && "truncate",
            multiline && "whitespace-pre-wrap",
            !props.nonInteractive && "hover:bg-[var(--color-interactive-surface-hover)]",
            props.className
          )}
          style={{
            cursor: props.nonInteractive ? 'default' : 'pointer',
            ...(!props.value ? { color: 'var(--color-base-text-tertiary)' } : {}),
            ...(multiline ? { overflowWrap: 'break-word', wordBreak: 'break-word' } : {}),
            ...(props.style || {})
          }}
          onClick={() => !props.nonInteractive && setIsEditing(true)}
        >
          {renderedContent}
        </div>
        {/* Persistent validation when not editing (only shows if validationText returns content) */}
        {persistentValidation && (
          <div className="h-5 flex items-start mt-2">
            {persistentValidation}
          </div>
        )}
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
        return <RequestBadge variant={tempValue as RequestVariant} size="sm" showText={true} customLabel={displayLabel} />
      }
      
      if (props.badgeComponent === 'project') {
        return <ProjectBadge variant={tempValue as ProjectVariant} size="sm" showText={true} customLabel={displayLabel} />
      }
      
      // Default to neutral badge styling (like "Design" in request table)
      return (
        <Badge variant="neutral" className="text-xs">
          {displayLabel}
        </Badge>
      )
    }

    return (
      <Popover open={!props.nonInteractive && isPopoverOpen} onOpenChange={(open) => !props.nonInteractive && setIsPopoverOpen(open)}>
        <PopoverTrigger asChild>
          <div
            className={cn(
              "py-1 px-1 rounded transition-colors duration-75 flex items-center justify-between gap-2",
              !props.nonInteractive && "hover:bg-[var(--color-interactive-surface-hover)]",
              isPopoverOpen && "bg-[var(--color-interactive-surface-hover)]",
              props.className
            )}
            style={{ 
              cursor: props.nonInteractive ? 'default' : 'pointer',
              ...(props.badgeBorderRadius ? { borderRadius: props.badgeBorderRadius } : {})
            }}
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
          className="p-0" 
          align="start"
          style={{ width: props.type === 'badge' && props.popoverWidth ? props.popoverWidth : 'var(--radix-popover-trigger-width)' }}
        >
          <Command>
            {(props.searchable || props.dividerIndex !== undefined) && (
              <div className="[&_[data-slot=command-input-wrapper]]:!h-auto [&_[data-slot=command-input-wrapper]]:!py-1">
                <CommandInput placeholder={props.searchPlaceholder || "Search options..."} className="!h-auto !py-2 px-4 text-sm" />
              </div>
            )}
            <CommandList 
              className={props.maxHeight ? undefined : undefined}
              style={props.maxHeight ? { maxHeight: props.maxHeight, overflowY: 'auto', overflowX: 'hidden' } : undefined}
            >
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {props.options.map((option, index) => (
                  <React.Fragment key={option.value}>
                    <CommandItem
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
                          return <RequestBadge variant={option.value as RequestVariant} size="sm" showText={true} customLabel={option.label} />
                        }
                        
                        if (props.badgeComponent === 'project') {
                          return <ProjectBadge variant={option.value as ProjectVariant} size="sm" showText={true} customLabel={option.label} />
                        }
                        
                        return (
                          <Badge variant="neutral" className="text-xs">
                            {option.label}
                          </Badge>
                        )
                      })()}
                      {option.value === tempValue && (
                        <Check size={16} className="text-primary" />
                      )}
                    </CommandItem>
                    {/* Only show divider if there are more options after it */}
                    {props.dividerIndex !== undefined && index === props.dividerIndex && index < props.options.length - 1 && (
                      <div className="my-1">
                        <CommandSeparator />
                      </div>
                    )}
                  </React.Fragment>
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
              "py-1 px-1 text-sm-regular rounded-sm transition-colors duration-75 flex items-center justify-between gap-2",
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
})

InlineEdit.displayName = 'InlineEdit'

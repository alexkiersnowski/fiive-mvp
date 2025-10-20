"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
// import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  readOnly?: boolean
  hasError?: boolean
  style?: React.CSSProperties
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No option found.",
  className,
  disabled = false,
  readOnly = false,
  hasError = false,
  style,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>()

  const selectedOption = options.find((option) => option.value === value)
  const triggerRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth)
    }
  }, [])

  return (
    <Popover open={open && !readOnly} onOpenChange={(open) => !readOnly && setOpen(open)}>
      <PopoverTrigger asChild>
        <div
          ref={triggerRef}
          role="combobox"
          aria-expanded={open}
          aria-controls={open ? "combobox-options" : undefined}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => {
            if (readOnly || disabled) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setOpen(!open)
            }
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
            }
          }}
          onClick={() => !readOnly && !disabled && setOpen(!open)}
          className={cn(
            "w-full px-4 py-2 text-sm font-normal border rounded-md bg-transparent transition-[color,box-shadow] duration-75 outline-none flex items-center justify-between",
            !readOnly && "border-[var(--color-neutral-5)] bg-[var(--color-base-surface-page-background)]",
            "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px]",
            open && "border-ring ring-ring/50 ring-[2px]",
            hasError && "border-destructive",
            hasError && open && "ring-destructive/20 ring-[2px]",
            !selectedOption && "text-muted-foreground",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            readOnly && "cursor-default",
            !disabled && !readOnly && "cursor-pointer",
            className
          )}
          style={{
            ...style,
            ...(readOnly && {
              background: 'var(--color-neutral-alpha-2, rgba(0, 0, 85, 0.02))'
            })
          }}
        >
          <span>{selectedOption ? selectedOption.label : placeholder}</span>
          <ChevronsUpDown 
            className="ml-2 h-4 w-4 shrink-0 opacity-50" 
            style={readOnly ? { color: '#B5B7C4' } : undefined}
          />
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0" 
        align="start"
        style={{ width: triggerWidth ? `${triggerWidth}px` : 'auto' }}
      >
        <Command id="combobox-options">
          {searchPlaceholder && (
            <div className="[&_[data-slot=command-input-wrapper]]:!h-auto [&_[data-slot=command-input-wrapper]]:!py-1">
              <CommandInput placeholder={searchPlaceholder} className="!h-auto !py-2 px-4 text-sm" />
            </div>
          )}
          <CommandList className="max-h-[200px]">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={(currentValue) => {
                    onValueChange?.(currentValue)
                    setOpen(false)
                  }}
                  className="cursor-pointer"
                >
                  {option.label}
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, SquaresFour, DotsThree, User } from "@phosphor-icons/react"
import { Avatar, AvatarFallback, AvatarImage } from "./avatar"
import { Button } from "./button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "./popover"
import { Combobox, ComboboxOption } from "./combobox"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './command'

export interface ListRowProps {
  // State
  state?: "default" | "hover"
  
  // Avatar/Icon
  avatar?: boolean
  avatarUrl?: string | null
  avatarSize?: number // Size in pixels (default: 24)
  avatarFallback?: React.ReactNode
  iconStart?: boolean | React.ReactNode
  
  // Content
  text?: string
  textColor?: string // Custom color for text (default: primary)
  secondaryText?: boolean | string
  
  // Combobox (for empty state selection)
  comboboxOptions?: (ComboboxOption & { avatar?: string })[]
  onComboboxSelect?: (value: string) => void
  comboboxPlaceholder?: string
  
  // Actions
  iconButtonEnd?: boolean | React.ReactNode
  visibility?: boolean
  actions?: boolean
  dropdownItems?: Array<{
    label: string
    icon?: React.ReactNode
    onClick?: () => void
    destructive?: boolean
  }>
  
  // Layout
  variant?: "stacked" | "inline"
  
  // Interactivity
  nonInteractive?: boolean // Disables hover states and click handlers
  
  // Additional props
  className?: string
  onClick?: () => void
}

const ListRow = React.forwardRef<HTMLDivElement & { triggerCombobox: () => void }, ListRowProps>(
  ({
    state = "default",
    avatar = false,
    avatarUrl = null,
    avatarSize = 24,
    avatarFallback,
    iconStart = false,
    text = "Text",
    textColor = 'var(--color-base-text-primary)',
    secondaryText = false,
    comboboxOptions,
    onComboboxSelect,
    comboboxPlaceholder = "Select...",
    iconButtonEnd = false,
    visibility = false,
    actions = true,
    dropdownItems,
    variant = "stacked",
    nonInteractive = false,
    className,
    onClick,
    ...props
  }, ref) => {
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [isComboboxOpen, setIsComboboxOpen] = React.useState(false);
    const divRef = React.useRef<HTMLDivElement>(null);
    
    // Expose triggerCombobox function through ref
    React.useImperativeHandle(ref, () => ({
      ...divRef.current!,
      triggerCombobox: () => {
        if (comboboxOptions) {
          setIsComboboxOpen(true);
        }
      }
    }));
    
    // Only show combobox if it's explicitly triggered (not on regular click)
    const shouldShowCombobox = comboboxOptions && (isComboboxOpen || !iconButtonEnd);
    // Default icon components
    const getDefaultIcon = () => {
      if (avatar) {
        const size = `${avatarSize}px`;
        const iconSize = Math.round(avatarSize * 0.67); // Scale icon proportionally
        
        // Scenario 1: Invited members (text is "—") - show User icon
        if (text === '—') {
          return (
            <div 
              className="rounded-full flex items-center justify-center"
              style={{ 
                width: size, 
                height: size,
                background: 'var(--color-neutral-9, #8B8D98)'
              }}
            >
              <User size={iconSize} weight="fill" className="text-white" />
            </div>
          )
        }
        
        // Scenario 2: Custom avatar fallback provided - show custom fallback
        if (avatarFallback && React.isValidElement(avatarFallback)) {
          return (
            <div 
              className="rounded-full flex items-center justify-center"
              style={{ 
                width: size, 
                height: size,
                background: 'var(--color-neutral-9, #8B8D98)'
              }}
            >
              {React.cloneElement(avatarFallback as React.ReactElement<{ size?: number }>, { size: iconSize })}
            </div>
          )
        }
        
        // Scenario 3: Active members - use Avatar component
        const initials = text.split(' ').map(n => n[0]).join('').toUpperCase()
        return (
          <Avatar 
            className="rounded-full"
            style={{ 
              width: size, 
              height: size
            }}
          >
            <AvatarImage src={avatarUrl || undefined} alt={text} />
            <AvatarFallback 
              className="text-xs font-medium text-white"
              style={{ 
                background: 'var(--color-neutral-9, #8B8D98)'
              }}
            >
              {initials}
            </AvatarFallback>
          </Avatar>
        )
      }
      if (iconStart === true) {
        return <SquaresFour size={16} className="text-neutral-600" />
      }
      if (React.isValidElement(iconStart)) {
        return iconStart
      }
      return null
    }

    const getEndIcon = () => {
      if (iconButtonEnd === true) {
        return <DotsThree size={16} style={{ color: 'var(--color-base-text-primary)' }} />
      }
      if (React.isValidElement(iconButtonEnd)) {
        return iconButtonEnd
      }
      return null
    }

    // State styling
    const getStateStyles = () => {
      switch (state) {
        case "hover":
          return "hover:bg-[var(--color-interactive-surface-hover)]"
        default:
          return ""
      }
    }

    // If combobox should be shown, wrap in Popover, otherwise use regular div
    if (shouldShowCombobox) {
      return (
        <Popover open={isComboboxOpen} onOpenChange={setIsComboboxOpen}>
          <PopoverTrigger asChild>
            <div
              ref={divRef}
              className={cn(
                "flex items-center p-1 transition-colors duration-75",
                !nonInteractive && "cursor-pointer hover:bg-[var(--color-interactive-surface-hover)]",
                isComboboxOpen && "bg-[var(--color-interactive-surface-hover)]",
                getStateStyles(),
                className
              )}
              style={{ borderRadius: 'calc(var(--radius) - 2px)' }}
              {...props}
            >
              {/* Start Icon/Avatar */}
              {(avatar || iconStart) && (
                <div className="flex-shrink-0 mr-3">
                  {getDefaultIcon()}
                </div>
              )}

              {/* Content */}
              <div className={cn(
                "flex-1 min-w-0",
                variant === "inline" ? "flex items-center justify-between" : "flex flex-col"
              )}>
                <span className="text-sm-regular truncate" style={{ color: textColor }}>
                  {text}
                </span>
                {secondaryText && (
                  <span className="text-xs-regular truncate" style={{ color: 'var(--color-base-text-tertiary)' }}>
                    {typeof secondaryText === 'string' ? secondaryText : 'Metadata'}
                  </span>
                )}
              </div>
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start" style={{ width: 'var(--radix-popover-trigger-width)' }}>
            <Command>
              <div className="[&_[data-slot=command-input-wrapper]]:!h-auto [&_[data-slot=command-input-wrapper]]:!py-1">
                <CommandInput placeholder={comboboxPlaceholder || "Search..."} className="!h-auto !py-2 px-4 text-sm" />
              </div>
              <CommandList className="max-h-[200px]">
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup>
                  {comboboxOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => {
                        onComboboxSelect?.(option.value);
                        setIsComboboxOpen(false);
                      }}
                      className="cursor-pointer flex items-center gap-3"
                    >
                      <Avatar className="h-5 w-5">
                        {option.avatar && (
                          <AvatarImage src={option.avatar} alt={option.label} />
                        )}
                        <AvatarFallback className="text-xs text-white" style={{ background: 'var(--color-neutral-9, #8B8D98)' }}>
                          {option.label.split(' ').map(n => n[0]).join('').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span>{option.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <div
        ref={divRef}
        className={cn(
          "flex items-center p-1 transition-colors duration-75",
          !nonInteractive && "cursor-pointer hover:bg-[var(--color-interactive-surface-hover)]",
          isDropdownOpen && "bg-[var(--color-interactive-surface-hover)]",
          getStateStyles(),
          className
        )}
        style={{ borderRadius: 'calc(var(--radius) - 2px)' }}
        onClick={!nonInteractive ? (e) => {
          e.stopPropagation();
          onClick?.();
        } : undefined}
        {...props}
      >
        {/* Start Icon/Avatar */}
        {(avatar || iconStart) && (
          <div className="flex-shrink-0 mr-3">
            {getDefaultIcon()}
          </div>
        )}

        {/* Content */}
        <div className={cn(
          "flex-1 min-w-0",
          variant === "inline" ? "flex items-center justify-between" : "flex flex-col"
        )}>
          {variant === "stacked" ? (
            <>
              {/* Primary Text */}
              <span className="text-sm-regular truncate" style={{ color: textColor }}>
                {text}
              </span>
              {/* Secondary Text */}
              {secondaryText && (
                <span className="text-xs-regular truncate" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  {typeof secondaryText === 'string' ? secondaryText : 'Metadata'}
                </span>
              )}
            </>
          ) : (
            <>
              {/* Primary Text */}
              <span className="text-sm-regular truncate" style={{ color: textColor }}>
                {text}
              </span>
              {/* Secondary Text */}
              {secondaryText && (
                <span className="text-xs-regular truncate" style={{ color: 'var(--color-base-text-tertiary)' }}>
                  {typeof secondaryText === 'string' ? secondaryText : 'Metadata'}
                </span>
              )}
            </>
          )}
        </div>

        {/* End Icon/Actions */}
        {iconButtonEnd && (
          <div className="flex-shrink-0 ml-3 flex items-center" onClick={(e) => e.stopPropagation()}>
            {dropdownItems ? (
              <DropdownMenu modal={false} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className={`p-0 cursor-pointer transition-colors duration-75 ${
                      isDropdownOpen 
                        ? 'bg-[var(--color-interactive-surface-hover)] hover:bg-[var(--color-interactive-surface-hover)]' 
                        : 'hover:bg-[var(--color-interactive-surface-hover)]'
                    }`}
                    style={{ height: '32px', width: '32px' }}
                  >
                    {getEndIcon()}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {dropdownItems.map((item, index) => (
                    <DropdownMenuItem 
                      key={index} 
                      onClick={item.onClick}
                      style={item.destructive ? { color: 'var(--color-red-11)' } : undefined}
                    >
                      {item.icon}
                      {item.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                className="p-0 cursor-pointer transition-colors duration-75 hover:bg-[var(--color-interactive-surface-hover)]"
                style={{ height: '32px', width: '32px' }}
                onClick={(e) => {
                  e.stopPropagation();
                  // Action button clicked
                }}
              >
                {getEndIcon()}
              </Button>
            )}
          </div>
        )}
      </div>
    )
  }
)

ListRow.displayName = "ListRow"

export { ListRow }

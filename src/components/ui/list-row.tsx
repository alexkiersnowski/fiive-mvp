"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { CheckCircle, SquaresFour, DotsThree, User } from "@phosphor-icons/react"

export interface ListRowProps {
  // State
  state?: "default" | "hover"
  
  // Avatar/Icon
  avatar?: boolean
  iconStart?: boolean | React.ReactNode
  
  // Content
  text?: string
  secondaryText?: boolean | string
  
  // Actions
  iconEnd?: boolean | React.ReactNode
  visibility?: boolean
  actions?: boolean
  
  // Layout
  variant?: "stacked" | "inline"
  
  // Additional props
  className?: string
  onClick?: () => void
}

const ListRow = React.forwardRef<HTMLDivElement, ListRowProps>(
  ({
    state = "default",
    avatar = false,
    iconStart = false,
    text = "Text",
    secondaryText = false,
    iconEnd = false,
    visibility = false,
    actions = true,
    variant = "stacked",
    className,
    onClick,
    ...props
  }, ref) => {
    // Default icon components
    const getDefaultIcon = () => {
      if (avatar) {
        // If text is "—", show User icon for invited members
        if (text === '—') {
          return (
            <div 
              className="rounded-full flex items-center justify-center"
              style={{ 
                width: '24px', 
                height: '24px',
                background: 'var(--color-neutral-9, #8B8D98)'
              }}
            >
              <User size={16} weight="fill" className="text-white" />
            </div>
          )
        }
        // Otherwise show initials for active members
        const initials = text.split(' ').map(n => n[0]).join('').toUpperCase()
        return (
          <div 
            className="rounded-full flex items-center justify-center"
            style={{ 
              width: '24px', 
              height: '24px',
              background: 'var(--color-neutral-9, #8B8D98)'
            }}
          >
            <span className="text-xs font-medium text-white">{initials}</span>
          </div>
        )
      }
      if (iconStart === true) {
        return <SquaresFour size={16} className="text-neutral-600" />
      }
      if (React.isValidElement(iconStart)) {
        return iconStart
      }
      return <CheckCircle size={16} className="text-neutral-600" />
    }

    const getEndIcon = () => {
      if (iconEnd === true) {
        return <DotsThree size={16} className="text-neutral-400" />
      }
      if (React.isValidElement(iconEnd)) {
        return iconEnd
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

    return (
      <div
        ref={ref}
        className={cn(
          "flex items-center p-1 transition-all duration-75 cursor-pointer",
          "hover:bg-[var(--color-interactive-surface-hover)]",
          getStateStyles(),
          className
        )}
        style={{ borderRadius: 'calc(var(--radius) - 2px)' }}
        onClick={onClick}
        {...props}
      >
        {/* Start Icon/Avatar */}
        <div className="flex-shrink-0 mr-3">
          {getDefaultIcon()}
        </div>

        {/* Content */}
        <div className={cn(
          "flex-1 min-w-0",
          variant === "inline" ? "flex items-center justify-between" : "flex flex-col"
        )}>
          {variant === "stacked" ? (
            <>
              {/* Primary Text */}
              <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
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
              <span className="text-sm-regular truncate" style={{ color: 'var(--color-base-text-primary)' }}>
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
        {actions && (
          <div className="flex-shrink-0 ml-3">
            {getEndIcon()}
          </div>
        )}
      </div>
    )
  }
)

ListRow.displayName = "ListRow"

export { ListRow }

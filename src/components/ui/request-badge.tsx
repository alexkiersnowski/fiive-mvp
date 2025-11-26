import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { CaretDown } from "@phosphor-icons/react"

export type RequestVariant = "new" | "in_review" | "accepted" | "canceled"
export type BadgeSize = "sm" | "lg"

interface RequestBadgeProps {
  variant: RequestVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showText?: boolean
  showIconRight?: boolean
  customLabel?: string
}

const requestStyles = {
  new: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  in_review: {
    backgroundColor: "var(--color-semantic-warning-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  accepted: {
    backgroundColor: "var(--color-semantic-success-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  canceled: {
    backgroundColor: "var(--color-neutral-10)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const textStyles = {
  new: {
    color: "var(--color-neutral-11)"
  },
  in_review: {
    color: "var(--color-semantic-warning-11)"
  },
  accepted: {
    color: "var(--color-semantic-success-11)"
  },
  canceled: {
    color: "var(--color-base-text-inverse)"
  }
}

const tooltipLabels = {
  new: "New",
  in_review: "In review",
  accepted: "Accepted",
  canceled: "Canceled"
}

export function RequestBadge({ variant, size = "sm", className, showText = false, showIconRight = false, customLabel }: RequestBadgeProps) {
  // Validate variant and provide fallback
  const validVariant = Object.keys(requestStyles).includes(variant) ? variant : 'new'
  
  const badgeStyles = requestStyles[validVariant]
  const textColorStyles = textStyles[validVariant]

  // Size-specific styles
  const sizeStyles = size === "lg" 
    ? { paddingTop: '6px', paddingBottom: '6px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '4px' }
    : {}
  
  const textClass = size === "lg" ? "text-sm-medium" : "text-xs"
  const displayLabel = customLabel || tooltipLabels[variant]

  return (
    <Badge
      variant="outline"
      className={cn(textClass, "border-0 flex items-center justify-center min-w-0 flex-shrink-0 gap-1.5", className)}
      style={{ ...badgeStyles, ...sizeStyles, maxWidth: '100%' }}
    >
      {showText && (
        <span style={{ color: textColorStyles.color }} className="truncate">
          {displayLabel}
        </span>
      )}
      {showIconRight && size === "lg" && (
        <CaretDown size={12} style={{ color: textColorStyles.color, flexShrink: 0 }} />
      )}
    </Badge>
  )
}

import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { CaretDown } from "@phosphor-icons/react"

export type ProjectVariant = "planned" | "active" | "on_hold" | "completed" | "canceled"
export type BadgeSize = "sm" | "lg"

interface ProjectBadgeProps {
  variant: ProjectVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showText?: boolean
  showIconRight?: boolean
  customLabel?: string
}

const projectStyles = {
  planned: {
    backgroundColor: "var(--color-purple-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  active: {
    backgroundColor: "var(--color-sky-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  on_hold: {
    backgroundColor: "var(--color-neutral-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  completed: {
    backgroundColor: "var(--color-semantic-success-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  canceled: {
    backgroundColor: "var(--color-neutral-10)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const textStyles = {
  planned: {
    color: "var(--color-purple-11)"
  },
  active: {
    color: "var(--color-sky-11)"
  },
  on_hold: {
    color: "var(--color-neutral-11)"
  },
  completed: {
    color: "var(--color-semantic-success-11)"
  },
  canceled: {
    color: "var(--color-base-text-inverse)"
  }
}

const tooltipLabels = {
  planned: "Planned",
  active: "Active",
  on_hold: "On hold",
  completed: "Completed",
  canceled: "Canceled"
}

export function ProjectBadge({ variant, size = "sm", className, showText = false, showIconRight = false, customLabel }: ProjectBadgeProps) {
  // Validate variant and provide fallback
  const validVariant = Object.keys(projectStyles).includes(variant) ? variant : 'planned'
  
  const badgeStyles = projectStyles[validVariant]
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


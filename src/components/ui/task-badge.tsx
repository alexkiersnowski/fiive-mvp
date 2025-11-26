import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { CaretDown } from "@phosphor-icons/react"

export type TaskVariant = "to_do" | "in_progress" | "on_hold" | "done"
export type BadgeSize = "sm" | "lg"

interface TaskBadgeProps {
  variant: TaskVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showText?: boolean
  showIconRight?: boolean
  customLabel?: string
}

const taskStyles = {
  to_do: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  in_progress: {
    backgroundColor: "var(--color-semantic-info-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  on_hold: {
    backgroundColor: "var(--color-semantic-warning-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  done: {
    backgroundColor: "var(--color-semantic-success-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const textStyles = {
  to_do: {
    color: "var(--color-neutral-11)"
  },
  in_progress: {
    color: "var(--color-semantic-info-11)"
  },
  on_hold: {
    color: "var(--color-semantic-warning-11)"
  },
  done: {
    color: "var(--color-semantic-success-11)"
  }
}

const tooltipLabels = {
  to_do: "To do",
  in_progress: "In progress",
  on_hold: "On hold",
  done: "Done"
}

export function TaskBadge({ variant, size = "sm", className, showText = false, showIconRight = false, customLabel }: TaskBadgeProps) {
  // Validate variant and provide fallback
  const validVariant = Object.keys(taskStyles).includes(variant) ? variant : 'to_do'
  
  const badgeStyles = taskStyles[validVariant]
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


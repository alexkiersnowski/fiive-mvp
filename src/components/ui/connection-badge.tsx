import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { Circle } from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

export type StatusVariant = "connected" | "invited" | "disconnected" | "draft"
export type BadgeSize = "sm" | "lg"

interface StatusBadgeProps {
  variant: StatusVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showTooltip?: boolean
  showText?: boolean
}

const statusStyles = {
  connected: {
    backgroundColor: "var(--color-semantic-success-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  invited: {
    backgroundColor: "var(--color-semantic-info-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  disconnected: {
    backgroundColor: "var(--color-semantic-error-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  draft: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const iconStyles = {
  connected: {
    color: "var(--color-semantic-success-11)"
  },
  invited: {
    color: "var(--color-semantic-info-11)"
  },
  disconnected: {
    color: "var(--color-semantic-error-11)"
  },
  draft: {
    color: "var(--color-neutral-11)"
  }
}

const tooltipLabels = {
  connected: "Connected",
  invited: "Invited",
  disconnected: "Disconnected",
  draft: "Draft"
}

export function StatusBadge({ variant, size = "sm", className, showTooltip = false, showText = false }: StatusBadgeProps) {
  const badgeStyles = statusStyles[variant]
  const circleStyles = iconStyles[variant]

  // Size-specific styles
  const sizeStyles = size === "lg" 
    ? { paddingTop: '6px', paddingBottom: '6px', paddingLeft: '12px', paddingRight: '12px', borderRadius: '4px' }
    : {}
  
  const textClass = size === "lg" ? "text-sm-medium" : "text-xs"
  const iconSize = size === "lg" ? 12 : 6
  const iconWidth = size === "lg" ? '0.5rem' : '0.5rem'
  const iconHeight = size === "lg" ? '0.5rem' : '0.5rem'

  const badge = (
    <Badge
      variant="outline"
      className={cn(textClass, "border-0 flex items-center justify-center gap-1.5", className)}
      style={{ ...badgeStyles, ...sizeStyles }}
    >
      <Circle weight="fill" size={iconSize} style={{ width: iconWidth, height: iconHeight, ...circleStyles }} />
      {showText && (
        <span style={{ color: circleStyles.color }}>
          {tooltipLabels[variant]}
        </span>
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <Tooltip delayDuration={250}>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p>{tooltipLabels[variant]}</p>
      </TooltipContent>
    </Tooltip>
  )
}

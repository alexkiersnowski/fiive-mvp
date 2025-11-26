import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

export type EngagementVariant = "onboarding" | "active" | "paused" | "offboarded"
export type BadgeSize = "sm" | "lg"

interface EngagementBadgeProps {
  variant: EngagementVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showTooltip?: boolean
  showText?: boolean
  neutral?: boolean // If true, always use neutral colors regardless of variant
}

const engagementStyles = {
  onboarding: {
    backgroundColor: "var(--color-purple-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  active: {
    backgroundColor: "var(--color-semantic-info-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  paused: {
    backgroundColor: "var(--color-semantic-warning-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  offboarded: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const textStyles = {
  onboarding: {
    color: "var(--color-purple-11)"
  },
  active: {
    color: "var(--color-semantic-info-11)"
  },
  paused: {
    color: "var(--color-semantic-warning-11)"
  },
  offboarded: {
    color: "var(--color-neutral-11)"
  }
}

const tooltipLabels = {
  onboarding: "Onboarding",
  active: "Active",
  paused: "Paused",
  offboarded: "Offboarded"
}

export function EngagementBadge({ variant, size = "sm", className, showTooltip = false, showText = false, neutral = false }: EngagementBadgeProps) {
  // Validate variant and provide fallback
  const validVariant = Object.keys(engagementStyles).includes(variant) ? variant : 'offboarded'
  
  // Use neutral colors if neutral prop is true, otherwise use variant-specific colors
  const badgeStyles = neutral 
    ? { backgroundColor: "var(--color-neutral-alpha-3)", borderRadius: "var(--radius-1-max, 3px)" }
    : engagementStyles[validVariant]
  
  const textColorStyles = neutral
    ? { color: "var(--color-neutral-11)" }
    : textStyles[validVariant]

  // Size-specific styles
  const sizeStyles = size === "lg" 
    ? { paddingTop: '6px', paddingBottom: '6px', paddingLeft: '12px', paddingRight: '12px' }
    : {}
  
  const textClass = size === "lg" ? "text-sm-medium" : "text-xs"

  const badge = (
    <Badge
      variant="outline"
      className={cn(textClass, "border-0 flex items-center justify-center", className)}
      style={{ ...badgeStyles, ...sizeStyles }}
    >
      {showText && (
        <span style={{ color: textColorStyles.color }}>
          {tooltipLabels[variant]}
        </span>
      )}
    </Badge>
  )

  if (!showTooltip) {
    return badge
  }

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        {badge}
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={8}>
        <p>{tooltipLabels[variant]}</p>
      </TooltipContent>
    </Tooltip>
  )
}

import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

export type HealthVariant = "healthy" | "at_risk" | "critical"
export type BadgeSize = "sm" | "lg"

interface HealthBadgeProps {
  variant: HealthVariant
  size?: BadgeSize
  className?: string
  children?: React.ReactNode
  showTooltip?: boolean
  showText?: boolean
}

const healthStyles = {
  healthy: {
    backgroundColor: "var(--color-semantic-success-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  at_risk: {
    backgroundColor: "var(--color-semantic-warning-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  critical: {
    backgroundColor: "var(--color-semantic-error-3)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const textStyles = {
  healthy: {
    color: "var(--color-semantic-success-11)"
  },
  at_risk: {
    color: "var(--color-semantic-warning-11)"
  },
  critical: {
    color: "var(--color-semantic-error-11)"
  }
}

const tooltipLabels = {
  healthy: "Healthy",
  at_risk: "At risk",
  critical: "Critical"
}

export function HealthBadge({ variant, size = "sm", className, showTooltip = false, showText = false }: HealthBadgeProps) {
  // Validate variant and provide fallback
  const validVariant = Object.keys(healthStyles).includes(variant) ? variant : 'healthy'
  
  const badgeStyles = healthStyles[validVariant]
  const colorStyles = textStyles[validVariant]

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
        <span style={{ color: colorStyles.color }}>
          {tooltipLabels[validVariant]}
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
        <p>{tooltipLabels[validVariant]}</p>
      </TooltipContent>
    </Tooltip>
  )
}


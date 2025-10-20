import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { Circle } from "@phosphor-icons/react"
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip"

export type StatusVariant = "connected" | "invited" | "disconnected" | "draft"

interface StatusBadgeProps {
  variant: StatusVariant
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

export function StatusBadge({ variant, className, showTooltip = false, showText = false }: StatusBadgeProps) {
  const badgeStyles = statusStyles[variant]
  const circleStyles = iconStyles[variant]

  const badge = (
    <Badge
      variant="outline"
      className={cn("text-xs border-0 flex items-center justify-center gap-1.5", className)}
      style={badgeStyles}
    >
      <Circle weight="fill" size={6} style={{ width: '0.375rem', height: '0.375rem', ...circleStyles }} />
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

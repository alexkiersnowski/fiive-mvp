import * as React from "react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"
import { Circle } from "@phosphor-icons/react"

export type StatusVariant = "connected" | "invited" | "disconnected" | "draft"

interface StatusBadgeProps {
  variant: StatusVariant
  className?: string
  children?: React.ReactNode
}

const statusStyles = {
  connected: {
    backgroundColor: "var(--color-semantic-success-3)",
    color: "var(--color-semantic-success-11)",
    borderColor: "var(--color-semantic-success-6)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  invited: {
    backgroundColor: "var(--color-semantic-info-3)",
    color: "var(--color-semantic-info-11)",
    borderColor: "var(--color-semantic-info-6)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  disconnected: {
    backgroundColor: "var(--color-semantic-error-3)",
    color: "var(--color-semantic-error-11)",
    borderColor: "var(--color-semantic-error-6)",
    borderRadius: "var(--radius-1-max, 3px)"
  },
  draft: {
    backgroundColor: "var(--color-neutral-3)",
    color: "var(--color-neutral-11)",
    borderColor: "var(--color-neutral-6)",
    borderRadius: "var(--radius-1-max, 3px)"
  }
}

const statusLabels = {
  connected: "Connected",
  invited: "Invited", 
  disconnected: "Disconnected",
  draft: "Draft"
}

export function StatusBadge({ variant, className, children }: StatusBadgeProps) {
  const label = children || statusLabels[variant]
  const styles = statusStyles[variant]

  return (
    <Badge
      variant="outline"
      className={cn("text-xs border-0 flex items-center gap-1", className)}
      style={styles}
    >
      <Circle weight="fill" size={8} style={{ width: '0.5rem', height: '0.5rem' }} />
      {label}
    </Badge>
  )
}

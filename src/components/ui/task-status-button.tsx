import * as React from "react"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

export type TaskStatusVariant = "to_do" | "in_progress" | "on_hold" | "done"

interface TaskStatusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: TaskStatusVariant
  asChild?: boolean
  customLabel?: string
}

const taskStatusStyles = {
  to_do: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    color: "var(--color-neutral-11)",
    hoverBg: "var(--color-neutral-alpha-4)",
    label: "To do"
  },
  in_progress: {
    backgroundColor: "var(--color-semantic-info-3)",
    color: "var(--color-semantic-info-11)",
    hoverBg: "var(--color-semantic-info-4)",
    label: "In progress"
  },
  on_hold: {
    backgroundColor: "var(--color-semantic-warning-3)",
    color: "var(--color-semantic-warning-11)",
    hoverBg: "var(--color-semantic-warning-4)",
    label: "On hold"
  },
  done: {
    backgroundColor: "var(--color-semantic-success-3)",
    color: "var(--color-semantic-success-11)",
    hoverBg: "var(--color-semantic-success-4)",
    label: "Done"
  }
}

export function TaskStatusButton({ variant, className, children, asChild = false, customLabel, ...props }: TaskStatusButtonProps) {
  const style = taskStatusStyles[variant]
  
  const hoverClass = `hover:bg-[${style.hoverBg}]`
  
  const Comp = asChild ? Slot : "button"
  const displayLabel = customLabel || style.label
  
  return (
    <Comp
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors duration-75 border-0 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 cursor-pointer",
        hoverClass,
        className
      )}
      style={{
        backgroundColor: style.backgroundColor,
        color: style.color
      }}
      {...props}
    >
      <span>{displayLabel}</span>
      {children}
    </Comp>
  )
}


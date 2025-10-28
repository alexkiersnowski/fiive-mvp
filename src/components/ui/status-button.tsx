import * as React from "react"
import { CaretDown } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { Slot } from "@radix-ui/react-slot"

export type StatusVariant = "new" | "in_review" | "accepted" | "canceled"

interface StatusButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: StatusVariant
  asChild?: boolean
}

const statusStyles = {
  new: {
    backgroundColor: "var(--color-neutral-alpha-3)",
    color: "var(--color-neutral-11)",
    hoverBg: "var(--color-neutral-alpha-4)",
    label: "New"
  },
  in_review: {
    backgroundColor: "var(--color-semantic-warning-3)",
    color: "var(--color-semantic-warning-11)",
    hoverBg: "var(--color-semantic-warning-4)",
    label: "In Review"
  },
  accepted: {
    backgroundColor: "var(--color-semantic-success-3)",
    color: "var(--color-semantic-success-11)",
    hoverBg: "var(--color-semantic-success-4)",
    label: "Accepted"
  },
  canceled: {
    backgroundColor: "var(--color-neutral-10)",
    color: "var(--color-base-text-inverse)",
    hoverBg: "",
    label: "Canceled"
  }
}

export function StatusButton({ variant, className, children, asChild = false, ...props }: StatusButtonProps) {
  const style = statusStyles[variant]
  
  const hoverClass = variant === 'canceled' 
    ? '' 
    : `hover:bg-[${style.hoverBg}]`
  
  const Comp = asChild ? Slot : "button"
  
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
      <span>{style.label}</span>
      {children}
    </Comp>
  )
}


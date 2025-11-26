import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const inputVariants = cva(
  "file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input flex w-full min-w-0 rounded-md border bg-transparent transition-[color,box-shadow] duration-75 outline-none file:inline-flex file:border-0 file:bg-transparent file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[2px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      size: {
        default: "h-9 px-3 py-1 text-sm",
        sm: "h-8 px-2 py-1 text-sm",
        lg: "h-10 px-4 py-2 text-sm",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Input({ 
  className, 
  type, 
  size,
  ...props 
}: React.ComponentProps<"input"> & VariantProps<typeof inputVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        inputVariants({ size, className }),
        "border-[var(--color-neutral-5)] bg-[var(--color-base-surface-page-background)]"
      )}
      {...props}
    />
  )
}

export { Input, inputVariants }
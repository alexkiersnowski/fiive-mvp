"use client"

import * as React from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { BuildingOffice, Users } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

const RadioCards = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & {
    className?: string
  }
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root
    ref={ref}
    className={cn("grid grid-cols-1 sm:grid-cols-2 gap-4", className)}
    {...props}
  />
))
RadioCards.displayName = "RadioCards"

const RadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    className?: string
    children: React.ReactNode
    icon?: React.ReactNode
  }
>(({ className, children, icon, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex flex-col items-start p-6 border rounded-lg cursor-pointer transition-all duration-200 hover:border-gray-300 data-[state=checked]:border-gray-900 bg-[var(--color-base-surface-page-background)]",
      className
    )}
    {...props}
  >
    {icon && <div className="mb-4">{icon}</div>}
    {children}
  </RadioGroupPrimitive.Item>
))
RadioCard.displayName = "RadioCard"

// Icon components for easy use
const AgencyIcon = () => <BuildingOffice size={24} weight="regular" />
const ClientIcon = () => <Users size={24} weight="regular" />

export { RadioCards, RadioCard, AgencyIcon, ClientIcon }

"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"
import { WarningCircle, CheckCircle } from "@phosphor-icons/react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <>
      <style>{`
        [data-sonner-toast][data-styled=true] [data-title] {
          font: var(--typography-text-xs-regular) !important;
          letter-spacing: var(--typography-text-xs-letter-spacing) !important;
        }
      `}</style>
      <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={3000}
      visibleToasts={1}
      position="bottom-right"
      icons={{
        error: <WarningCircle size={16} />,
        success: null
      }}
      toastOptions={{
        style: {
          fontFamily: "Inter, sans-serif",
          fontWeight: "400"
        }
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--color-base-text-primary)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
    </>
  )
}

export { Toaster }

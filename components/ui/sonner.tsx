"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

import { useIsMobile } from "@/hooks/use-mobile"

// Bottom-center above the tab bar on phones, bottom-right on desktop (DESIGN.md §6).
const Toaster = ({ ...props }: ToasterProps) => {
  const isMobile = useIsMobile()
  const { resolvedTheme } = useTheme()

  return (
    <Sonner
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      position={isMobile ? "bottom-center" : "bottom-right"}
      mobileOffset={{ bottom: "calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 12px)" }}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-5 text-sage" />,
        info: <InfoIcon className="size-5 text-plum" />,
        warning: <TriangleAlertIcon className="size-5 text-amber" />,
        error: <OctagonXIcon className="size-5 text-rose" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "transparent",
          "--border-radius": "var(--radius-card)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast text-base shadow-float!",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

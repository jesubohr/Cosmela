import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-base font-medium whitespace-nowrap transition-[background-color,border-color,color,scale] duration-150 ease-out outline-none select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-plum-hover active:bg-plum-hover",
        secondary:
          "border-border bg-surface text-foreground hover:bg-porcelain aria-expanded:bg-porcelain",
        outline:
          "border-border bg-surface text-foreground hover:bg-porcelain aria-expanded:bg-porcelain",
        ghost: "text-foreground hover:bg-lilac aria-expanded:bg-lilac",
        destructive: "bg-destructive text-on-solid hover:bg-destructive/90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 gap-2 px-4",
        // Small sizes look compact but keep a 44px hit area through the ::after overlay.
        xs: "relative h-8 gap-1 px-2 text-sm after:absolute after:-inset-y-1.5 after:inset-x-0 [&_svg:not([class*='size-'])]:size-4",
        sm: "relative h-9 gap-1.5 px-3 text-sm after:absolute after:-inset-y-1 after:inset-x-0 [&_svg:not([class*='size-'])]:size-4",
        lg: "h-12 gap-2 px-5",
        icon: "size-11",
        "icon-xs": "relative size-8 after:absolute after:-inset-1.5 [&_svg:not([class*='size-'])]:size-4",
        "icon-sm": "relative size-9 after:absolute after:-inset-1",
        "icon-lg": "size-12",
      },
      // Pass press={false} where the scale would distract (e.g. dense toolbars).
      press: {
        true: "motion-safe:not-disabled:not-aria-disabled:active:scale-[0.96]",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      press: true,
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  press,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, press, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }

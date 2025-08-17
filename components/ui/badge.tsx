import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
      },
      shiny: {
        true: "relative overflow-hidden",
        false: "",
      },
    },
    defaultVariants: {
      variant: "default",
      shiny: false,
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {
  shiny?: boolean;
  shinySpeed?: number;
  asChild?: boolean;
}

function Badge({
  className,
  variant,
  shiny = false,
  shinySpeed = 5,
  asChild = false,
  children,
  ...props
}: BadgeProps) {
  const Comp = asChild ? Slot : "span"
  const animationDuration = `${shinySpeed}s`;

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant, shiny }), className)}
      {...props}
    >
      <span className={shiny ? "relative z-10" : ""}>{children}</span>

      {shiny && (
        <span
          className="absolute inset-0 pointer-events-none animate-shine dark:hidden"
          style={{
            background:
              "linear-gradient(120deg, transparent 40%, rgba(255,255,255,0.6) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animationDuration,
            mixBlendMode: "screen",
          }}
        />
      )}

      {shiny && (
        <span
          className="absolute inset-0 pointer-events-none animate-shine hidden dark:block"
          style={{
            background:
              "linear-gradient(120deg, transparent 40%, rgba(0,0,150,0.25) 50%, transparent 60%)",
            backgroundSize: "200% 100%",
            animationDuration,
            mixBlendMode: "multiply",
          }}
        />
      )}
    </Comp>
  )
}

export { Badge, badgeVariants }

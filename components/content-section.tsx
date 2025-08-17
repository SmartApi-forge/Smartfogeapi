"use client"
import { cn } from "@/lib/utils"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Bold, CalendarIcon as Calendar1, Ellipsis, Italic, Strikethrough, Underline } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ContentSection() {
  return (
    <section>
      <div className="bg-muted/50 py-24">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div>
            <span className="text-primary">AI-Powered Generation</span>
            <h2 className="text-foreground mt-4 text-4xl font-semibold">From Prompt to Production-Ready APIs</h2>
            <p className="text-muted-foreground mb-12 mt-4 text-lg">
              Transform your ideas into fully functional APIs with just a simple description. SmartAPIForge generates
              complete backend code, documentation, and deployment configurations automatically.
            </p>
          </div>

          <div className="border-foreground/5 space-y-6 [--color-border:color-mix(in_oklab,var(--color-foreground)10%,transparent)] sm:space-y-0 sm:divide-y">
            <div className="grid sm:grid-cols-5">
              <CodeIllustration className="sm:col-span-2 sm:border-r sm:pr-12" />
              <div className="mt-6 sm:col-span-3 sm:mt-0 sm:pl-12">
                <h3 className="text-foreground text-xl font-semibold">Multi-Framework Code Generation</h3>
                <p className="text-muted-foreground mt-4 text-lg">
                  Generate production-ready API code in multiple frameworks including FastAPI, Express.js, and more.
                  Each generated API includes proper validation, error handling, and security best practices.
                </p>
              </div>
            </div>
            <div className="grid sm:grid-cols-5">
              <div className="mt-6 sm:col-span-3 sm:mt-0 sm:pr-12 sm:pt-12">
                <h3 className="text-foreground text-xl font-semibold">Auto-Generated Documentation</h3>
                <p className="text-muted-foreground mt-4 text-lg">
                  Every API comes with comprehensive OpenAPI documentation, interactive Swagger UI, and Postman
                  collections. No manual documentation needed - everything is generated automatically from your prompt.
                </p>
              </div>
              <div className="flex items-center justify-center pt-12 sm:col-span-2 sm:border-l sm:pl-12">
                <ScheduleIllustation className="pt-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

type IllustrationProps = {
  className?: string
  variant?: "elevated" | "outlined" | "mixed"
}

export const ScheduleIllustation = ({ className, variant = "elevated" }: IllustrationProps) => {
  return (
    <div className={cn("relative", className)}>
      <div
        className={cn(
          "bg-background -translate-x-1/8 absolute flex -translate-y-[110%] items-center gap-2 rounded-lg p-1",
          {
            "shadow-black-950/10 shadow-lg": variant === "elevated",
            "border-foreground/10 border": variant === "outlined",
            "border-foreground/10 border shadow-md shadow-black/5": variant === "mixed",
          },
        )}
      >
        <Button size="sm" className="rounded-sm">
          <Calendar1 className="size-3" />
          <span className="text-sm font-medium">Generate Docs</span>
        </Button>
        <span className="bg-border block h-4 w-px"></span>
        <ToggleGroup type="multiple" size="sm" className="gap-0.5 *:rounded-md">
          <ToggleGroupItem value="bold" aria-label="Toggle bold">
            <Bold className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Toggle italic">
            <Italic className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Toggle underline">
            <Underline className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="strikethrough" aria-label="Toggle strikethrough">
            <Strikethrough className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="bg-border block h-4 w-px"></span>
        <Button size="icon" className="size-8" variant="ghost">
          <Ellipsis className="size-3" />
        </Button>
      </div>
      <span>
        <span className="bg-secondary text-secondary-foreground py-1">OpenAPI 3.0 spec</span> is our priority.
      </span>
    </div>
  )
}

export const CodeIllustration = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn("[mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_50%,transparent_100%)]", className)}
    >
      <ul className="text-muted-foreground mx-auto w-fit font-mono text-2xl font-medium">
        {["Endpoints", "Schemas", "Routes", "Models", "Tests"].map((item, index) => (
          <li
            key={index}
            className={cn(
              index == 2 &&
                "text-foreground before:absolute before:-translate-x-[110%] before:text-orange-500 before:content-['Generate']",
            )}
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  )
}

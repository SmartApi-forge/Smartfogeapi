"use client";
import { cn } from "@/lib/utils";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Bold,
  CalendarIcon as Calendar1,
  Ellipsis,
  Italic,
  Strikethrough,
  Underline,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ContentSection() {
  return (
    <section>
      <div className="bg-muted/50 py-24">
        <div className="mx-auto w-full max-w-5xl px-6">
          <div>
            <span className="text-primary text-sm sm:text-base font-medium">
              AI-Powered Generation
            </span>
            <h2 className="text-foreground mt-3 sm:mt-4 text-2xl sm:text-3xl md:text-4xl font-semibold leading-tight sm:leading-tight text-balance">
              From Prompt to Production-Ready APIs
            </h2>
            <p className="text-muted-foreground mb-8 sm:mb-12 mt-3 sm:mt-4 text-base sm:text-lg leading-relaxed max-w-4xl">
              Transform your ideas into fully functional APIs with just a simple
              description. SmartAPIForge generates complete backend code,
              documentation, and deployment configurations automatically.
            </p>
          </div>

          <div className="border-foreground/5 space-y-8 sm:space-y-12 [--color-border:color-mix(in_oklab,var(--color-foreground)10%,transparent)] sm:divide-y">
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-5">
              <CodeIllustration className="order-2 sm:order-1 sm:col-span-2 sm:border-r sm:pr-8 lg:pr-12" />
              <div className="order-1 sm:order-2 sm:col-span-3 sm:pl-8 lg:pl-12">
                <h3 className="text-foreground text-lg sm:text-xl font-semibold leading-tight">
                  Multi-Framework Code Generation
                </h3>
                <p className="text-muted-foreground mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg leading-relaxed">
                  Generate production-ready API code in multiple frameworks
                  including FastAPI, Express.js, and more. Each generated API
                  includes proper validation, error handling, and security best
                  practices.
                </p>
              </div>
            </div>
            <div className="grid gap-6 sm:gap-8 sm:grid-cols-5 sm:pt-8 lg:pt-12">
              <div className="sm:col-span-3 sm:pr-8 lg:pr-12">
                <h3 className="text-foreground text-lg sm:text-xl font-semibold leading-tight">
                  Auto-Generated Documentation
                </h3>
                <p className="text-muted-foreground mt-3 sm:mt-4 text-sm sm:text-base lg:text-lg leading-relaxed">
                  Every API comes with comprehensive OpenAPI documentation,
                  interactive Swagger UI, and Postman collections. No manual
                  documentation needed - everything is generated automatically
                  from your prompt.
                </p>
              </div>
              <div className="flex items-center justify-center sm:col-span-2 sm:border-l sm:pl-8 lg:pl-12">
                <ScheduleIllustation className="pt-4 sm:pt-8" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type IllustrationProps = {
  className?: string;
  variant?: "elevated" | "outlined" | "mixed";
};

export const ScheduleIllustation = ({
  className,
  variant = "elevated",
}: IllustrationProps) => {
  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center min-h-[200px] sm:min-h-[250px]",
        className,
      )}
    >
      <div
        className={cn(
          "bg-background absolute flex items-center gap-1 sm:gap-2 rounded-lg p-1 -translate-y-[60%] sm:-translate-y-[110%] scale-75 sm:scale-100 origin-center",
          {
            "shadow-black-950/10 shadow-lg": variant === "elevated",
            "border-foreground/10 border": variant === "outlined",
            "border-foreground/10 border shadow-md shadow-black/5":
              variant === "mixed",
          },
        )}
      >
        <Button size="sm" className="rounded-sm text-xs sm:text-sm h-7 sm:h-8">
          <Calendar1 className="size-2 sm:size-3" />
          <span className="hidden sm:inline font-medium">Generate Docs</span>
          <span className="sm:hidden font-medium">Docs</span>
        </Button>
        <span className="bg-border block h-3 sm:h-4 w-px"></span>
        <ToggleGroup type="multiple" size="sm" className="gap-0.5 *:rounded-md">
          <ToggleGroupItem
            value="bold"
            aria-label="Toggle bold"
            className="h-6 w-6 sm:h-8 sm:w-8"
          >
            <Bold className="size-3 sm:size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="italic"
            aria-label="Toggle italic"
            className="h-6 w-6 sm:h-8 sm:w-8"
          >
            <Italic className="size-3 sm:size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="underline"
            aria-label="Toggle underline"
            className="h-6 w-6 sm:h-8 sm:w-8"
          >
            <Underline className="size-3 sm:size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem
            value="strikethrough"
            aria-label="Toggle strikethrough"
            className="h-6 w-6 sm:h-8 sm:w-8"
          >
            <Strikethrough className="size-3 sm:size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="bg-border block h-3 sm:h-4 w-px"></span>
        <Button size="icon" className="size-6 sm:size-8" variant="ghost">
          <Ellipsis className="size-2 sm:size-3" />
        </Button>
      </div>
      <div className="text-center px-2">
        <span className="text-xs sm:text-sm">
          <span className="bg-secondary text-secondary-foreground py-1 px-2 rounded text-xs sm:text-sm">
            OpenAPI 3.0 spec
          </span>{" "}
          is our priority.
        </span>
      </div>
    </div>
  );
};

export const CodeIllustration = ({ className }: { className?: string }) => {
  return (
    <div
      className={cn(
        "[mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_50%,transparent_100%)] flex justify-center items-center min-h-[200px] sm:min-h-[250px]",
        className,
      )}
    >
      <ul className="text-muted-foreground mx-auto w-fit font-mono text-lg sm:text-xl md:text-2xl font-medium space-y-1 sm:space-y-2">
        {["Endpoints", "Schemas", "Routes", "Models", "Tests"].map(
          (item, index) => (
            <li
              key={index}
              className={cn(
                "relative",
                index == 2 &&
                  "text-foreground before:absolute before:-translate-x-[100%] sm:before:-translate-x-[110%] before:text-orange-500 before:content-['Generate'] before:text-sm sm:before:text-base before:pr-2 before:font-sans before:font-medium",
              )}
            >
              {item}
            </li>
          ),
        )}
      </ul>
    </div>
  );
};

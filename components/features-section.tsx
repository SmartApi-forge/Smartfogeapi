import type React from "react"
import { cn } from "@/lib/utils"
import { SkeletonOne, SkeletonTwo, SkeletonThree, SkeletonFour } from "@/components/animated-skeleton-client"

// Static feature data - no hooks needed, pure Server Component
const features = [
  {
    title: "Natural Language to API",
    description:
      "Transform your ideas into production-ready APIs using simple English descriptions. No coding required.",
    skeleton: <SkeletonOne />,
    className: "col-span-1 lg:col-span-4 border-b lg:border-r dark:border-neutral-800",
  },
  {
    title: "Auto-Generated Documentation",
    description:
      "Get comprehensive OpenAPI documentation and interactive Swagger UI automatically generated for every API.",
    skeleton: <SkeletonTwo />,
    className: "border-b col-span-1 lg:col-span-2 dark:border-neutral-800",
  },
  {
    title: "One-Click Deployment",
    description: "Deploy your APIs instantly to production with automated CI/CD pipelines and cloud hosting.",
    skeleton: <SkeletonThree />,
    className: "col-span-1 lg:col-span-3 lg:border-r dark:border-neutral-800",
  },
  {
    title: "AI-Powered Testing",
    description: "Comprehensive test suites generated automatically with intelligent validation and error detection.",
    skeleton: <SkeletonFour />,
    className: "col-span-1 lg:col-span-3 border-b lg:border-none",
  },
]

export default function FeaturesSection() {
  return (
    <div className="relative z-20 py-10 lg:py-20 max-w-7xl mx-auto">
      <div className="px-8">
        <h4 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-semibold text-foreground">
          Everything you need to build APIs
        </h4>

        <p className="text-base sm:text-lg max-w-2xl my-3 sm:my-4 mx-auto text-muted-foreground text-center font-normal leading-relaxed">
          From natural language processing to automated deployment, SmartAPIForge provides all the tools you need to
          create production-ready APIs in seconds.
        </p>
      </div>

      <div className="relative">
        <div className="grid grid-cols-1 lg:grid-cols-6 mt-12 xl:border rounded-md dark:border-neutral-800">
          {features.map((feature) => (
            <FeatureCard key={feature.title} className={feature.className}>
              <FeatureTitle>{feature.title}</FeatureTitle>
              <FeatureDescription>{feature.description}</FeatureDescription>
              <div className="h-full w-full">{feature.skeleton}</div>
            </FeatureCard>
          ))}
        </div>
      </div>
    </div>
  )
}

const FeatureCard = ({
  children,
  className,
}: {
  children?: React.ReactNode
  className?: string
}) => {
  return <div className={cn(`p-4 sm:p-8 relative overflow-hidden`, className)}>{children}</div>
}

const FeatureTitle = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p className="max-w-5xl mx-auto text-left tracking-tight text-foreground text-lg sm:text-xl md:text-2xl leading-tight sm:leading-snug">
      {children}
    </p>
  )
}

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm sm:text-base max-w-4xl text-left mx-auto",
        "text-muted-foreground font-normal leading-relaxed",
        "text-left max-w-sm mx-0 my-2 sm:my-3",
      )}
    >
      {children}
    </p>
  )
}

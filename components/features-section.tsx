"use client"

import type React from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { IconCode, IconRocket, IconFileText, IconShield } from "@tabler/icons-react"

export default function FeaturesSection() {
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

  return (
    <div className="relative z-20 py-10 lg:py-20 max-w-7xl mx-auto">
      <div className="px-8">
        <h4 className="text-3xl lg:text-5xl lg:leading-tight max-w-5xl mx-auto text-center tracking-tight font-medium text-foreground">
          Everything you need to build APIs
        </h4>

        <p className="text-sm lg:text-base max-w-2xl my-4 mx-auto text-muted-foreground text-center font-normal">
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
    <p className="max-w-5xl mx-auto text-left tracking-tight text-foreground text-xl md:text-2xl md:leading-snug">
      {children}
    </p>
  )
}

const FeatureDescription = ({ children }: { children?: React.ReactNode }) => {
  return (
    <p
      className={cn(
        "text-sm md:text-base max-w-4xl text-left mx-auto",
        "text-muted-foreground text-center font-normal",
        "text-left max-w-sm mx-0 md:text-sm my-2",
      )}
    >
      {children}
    </p>
  )
}

export const SkeletonOne = () => {
  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-card shadow-2xl group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2">
          <div className="bg-muted rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-4">
              <IconCode className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Generated API Code</span>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div className="text-purple-600 dark:text-purple-400">@app.post("/users")</div>
              <div className="text-blue-600 dark:text-blue-400">def create_user(user: UserModel):</div>
              <div className="ml-4 text-green-600 dark:text-green-400"># Auto-generated validation</div>
              <div className="ml-4 text-muted-foreground">return {`{"id": user.id}`}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute bottom-0 z-40 inset-x-0 h-60 bg-gradient-to-t from-background via-background to-transparent w-full pointer-events-none" />
      <div className="absolute top-0 z-40 inset-x-0 h-60 bg-gradient-to-b from-background via-transparent to-transparent w-full pointer-events-none" />
    </div>
  )
}

export const SkeletonTwo = () => {
  const docs = [
    { title: "User Management", color: "bg-blue-500" },
    { title: "Authentication", color: "bg-green-500" },
    { title: "Data Models", color: "bg-purple-500" },
    { title: "API Reference", color: "bg-orange-500" },
    { title: "Examples", color: "bg-pink-500" },
  ]

  const docVariants = {
    whileHover: {
      scale: 1.05,
      rotate: 0,
      zIndex: 100,
    },
    whileTap: {
      scale: 1.05,
      rotate: 0,
      zIndex: 100,
    },
  }

  return (
    <div className="relative flex flex-col items-start p-8 gap-10 h-full overflow-hidden">
      <div className="flex flex-row -ml-20">
        {docs.map((doc, idx) => (
          <motion.div
            variants={docVariants}
            key={"docs-first" + idx}
            style={{
              rotate: Math.random() * 20 - 10,
            }}
            whileHover="whileHover"
            whileTap="whileTap"
            className="rounded-xl -mr-4 mt-4 p-1 bg-card border border-border shrink-0 overflow-hidden"
          >
            <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-muted p-3 flex flex-col justify-between">
              <div className={`w-4 h-4 rounded ${doc.color}`} />
              <div className="space-y-1">
                <div className="h-2 bg-border rounded" />
                <div className="h-2 bg-border rounded w-3/4" />
              </div>
              <IconFileText className="h-4 w-4 text-gray-400" />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="flex flex-row">
        {docs.map((doc, idx) => (
          <motion.div
            key={"docs-second" + idx}
            style={{
              rotate: Math.random() * 20 - 10,
            }}
            variants={docVariants}
            whileHover="whileHover"
            whileTap="whileTap"
            className="rounded-xl -mr-4 mt-4 p-1 bg-card border border-border shrink-0 overflow-hidden"
          >
            <div className="rounded-lg h-20 w-20 md:h-40 md:w-40 bg-muted p-3 flex flex-col justify-between">
              <div className={`w-4 h-4 rounded ${doc.color}`} />
              <div className="space-y-1">
                <div className="h-2 bg-border rounded" />
                <div className="h-2 bg-border rounded w-3/4" />
              </div>
              <IconFileText className="h-4 w-4 text-gray-400" />
            </div>
          </motion.div>
        ))}
      </div>
      <div className="absolute left-0 z-[100] inset-y-0 w-20 bg-gradient-to-r from-background to-transparent h-full pointer-events-none" />
      <div className="absolute right-0 z-[100] inset-y-0 w-20 bg-gradient-to-l from-background to-transparent h-full pointer-events-none" />
    </div>
  )
}

export const SkeletonThree = () => {
  return (
    <div className="relative flex gap-10 h-full group/deploy">
      <div className="w-full mx-auto bg-transparent dark:bg-transparent group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2 relative">
          <div className="bg-muted rounded-lg p-6 h-full flex flex-col justify-center items-center">
            <IconRocket className="h-16 w-16 text-blue-500 mb-4 group-hover/deploy:scale-110 transition-transform duration-200" />
            <div className="text-center space-y-2">
              <div className="text-sm font-medium text-foreground">Deploy to Production</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span>Ready to deploy</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SkeletonFour = () => {
  return (
    <div className="h-60 md:h-60 flex flex-col items-center relative bg-transparent dark:bg-transparent mt-10">
      <div className="bg-muted rounded-lg p-6 w-full h-full">
        <div className="flex items-center gap-2 mb-4">
          <IconShield className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium">Test Results</span>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs">API Endpoints: 12/12 passed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs">Validation Tests: 8/8 passed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-xs">Security Checks: 5/5 passed</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 bg-yellow-500 rounded-full" />
            <span className="text-xs">Performance: 95% score</span>
          </div>
        </div>
      </div>
    </div>
  )
}

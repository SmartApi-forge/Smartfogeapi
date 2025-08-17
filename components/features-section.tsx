"use client"

import type React from "react"
import { useMemo, useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"
import { IconCode, IconRocket, IconFileText, IconShield, IconCircleCheck } from "@tabler/icons-react"
import { CodeTypingAnimation } from "@/components/ui/typing-animation"

export default function FeaturesSection() {
  // Memoize to keep element identity stable and avoid remounts of skeletons
  const features = useMemo(() => [
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
  ], [])

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

export const SkeletonOne = () => {
  const codeLines = useMemo(
    () => [
      // Desktop-only preamble (hidden on mobile)
      { text: 'from fastapi import FastAPI', className: 'hidden md:block text-muted-foreground' },
      { text: 'from pydantic import BaseModel', className: 'hidden md:block text-muted-foreground' },
      { text: '', className: 'hidden md:block' },
      { text: 'app = FastAPI()', className: 'hidden md:block text-muted-foreground' },
      { text: '', className: 'hidden md:block' },
      { text: 'class UserModel(BaseModel):', className: 'hidden md:block text-blue-600 dark:text-blue-400' },
      { text: '    id: int', className: 'hidden md:block ml-4 text-muted-foreground' },
      { text: '    name: str | None = None', className: 'hidden md:block ml-4 text-muted-foreground' },
      { text: '', className: 'hidden md:block' },
      // Mobile + Desktop core snippet
      { text: '@app.post("/users")', className: 'text-purple-600 dark:text-purple-400' },
      { text: 'def create_user(user: UserModel):', className: 'text-blue-600 dark:text-blue-400' },
      { text: '    # Auto-generated validation', className: 'ml-4 text-green-600 dark:text-green-400' },
      { text: '    return {"id": user.id}', className: 'ml-4 text-muted-foreground' },
      // Desktop-only extra endpoint
      { text: '', className: 'hidden md:block' },
      { text: '@app.get("/users/{id}")', className: 'hidden md:block text-purple-600 dark:text-purple-400' },
      { text: 'def get_user(id: int):', className: 'hidden md:block text-blue-600 dark:text-blue-400' },
      { text: '    return {"id": id, "name": "Alice"}', className: 'hidden md:block ml-4 text-muted-foreground' },
    ],
    []
  )

  return (
    <div className="relative flex py-8 px-2 gap-10 h-full">
      <div className="w-full p-5 mx-auto bg-card shadow-2xl group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2">
          <div className="bg-muted rounded-lg p-4 h-full">
            <div className="flex items-center gap-2 mb-4">
              <IconCode className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium">Generated API Code</span>
            </div>
            <CodeTypingAnimation
              lines={codeLines}
              lineDelay={600}
              charDelay={50}
              startDelay={1000}
              loop
              loopDelay={1600}
              className="text-xs md:text-sm leading-6 md:leading-7"
            />
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
  // Ordered flow per spec
  const stages = [
    { key: "build", label: "Building", percent: 20, dur: 1600 },
    { key: "lint", label: "Lint & Type Check", percent: 45, dur: 1600 },
    { key: "static", label: "Build Static Pages", percent: 75, dur: 1600 },
    { key: "generate", label: "Generating Output", percent: 95, dur: 1600 },
    { key: "success", label: "Live", percent: 100, dur: 2200 },
  ] as const
  const [stageIdx, setStageIdx] = useState(0)
  const stage = stages[stageIdx]

  // Auto advance through the pipeline and loop
  useEffect(() => {
    const t = setTimeout(() => {
      setStageIdx((i) => (i + 1) % stages.length)
    }, stage.dur)
    return () => clearTimeout(t)
  }, [stageIdx])

  return (
    <div className="relative flex gap-10 h-full group/deploy">
      <div className="w-full mx-auto bg-transparent dark:bg-transparent group h-full">
        <div className="flex flex-1 w-full h-full flex-col space-y-2 relative">
          <div className="relative overflow-hidden bg-muted rounded-lg p-6 h-full min-h-[260px] flex flex-col justify-center items-center">
            {/* Subtle animated gradient backdrop */}
            <motion.div
              aria-hidden
              className="absolute inset-0 opacity-50"
              initial={{ backgroundPosition: "0% 50%" }}
              animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
              transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              style={{
                backgroundImage:
                  "radial-gradient(600px 200px at 20% 20%, hsl(var(--primary)/0.15), transparent), radial-gradient(600px 200px at 80% 80%, hsl(var(--primary)/0.12), transparent)",
                backgroundSize: "200% 200%",
              }}
            />

            {/* Foreground content that should hide on success */}
            <motion.div
              className="absolute inset-0"
              initial={false}
              animate={
                stage.key === "success"
                  ? { opacity: 0, filter: "blur(2px)", transitionEnd: { visibility: "hidden" } }
                  : { opacity: 1, filter: "none", visibility: "visible" }
              }
              transition={{ duration: 0.25 }}
              aria-hidden={stage.key === "success"}
            >
              {/* Rocket centered (higher to keep progress visible) */}
              <div className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
                <motion.div
                  className="relative"
                  initial={{ y: 0, rotate: 0, opacity: 1 }}
                  animate={{
                    y: stage.key === "success" ? -30 : [0, -6, 0],
                    rotate: stage.key === "success" ? 0 : [0, 2, 0],
                    opacity: stage.key === "success" ? 0.25 : 1,
                  }}
                  transition={{ duration: stage.key === "success" ? 1.1 : 2.2, repeat: stage.key === "success" ? 0 : Infinity, ease: "easeInOut" }}
                  whileHover={{ scale: 1.06 }}
                >
                  <IconRocket className="h-16 w-16 text-blue-500 drop-shadow-[0_6px_16px_rgba(59,130,246,0.45)]" />

                  {/* Exhaust flame during pre-success stages */}
                  <motion.div
                    className="absolute left-1/2 -bottom-3 -translate-x-1/2 h-3 w-3 rounded-full bg-orange-400/80 blur-[2px] -z-10"
                    animate={{ opacity: stage.key === "success" ? 0 : 1, scale: [0.7, 1.05, 0.7] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: "mirror" }}
                  />

                  {/* Exhaust particles looping */}
                  {Array.from({ length: 6 }).map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 -bottom-2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-blue-400/60 -z-10"
                      style={{ filter: "blur(1px)" }}
                      animate={{
                        opacity: stage.key === "success" ? 0 : [0, 1, 0],
                        y: stage.key === "success" ? 10 : [0, 26],
                        x: stage.key === "success" ? 0 : [0, (i - 2.5) * 6],
                      }}
                      transition={{ duration: 1.4 + i * 0.12, repeat: Infinity, delay: i * 0.1, ease: "easeOut" }}
                    />
                  ))}
                </motion.div>
              </div>

              {/* Labels + progress just below center */}
              <div className="absolute left-1/2 top-[52%] -translate-x-1/2 translate-y-0 w-full max-w-xs text-center">
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Deploy to Production</div>
                  <div className="text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>Ready to deploy</span>
                  </div>
                </div>
                <div className="mt-1">
                  <div className="relative h-2 w-full rounded-full bg-border/60 overflow-hidden">
                    <motion.div
                      key={stageIdx}
                      className="absolute left-0 top-0 h-full rounded-full"
                      initial={{ width: `${stages[Math.max(0, stageIdx - 1)]?.percent ?? 0}%` }}
                      animate={{
                        width: `${stage.percent}%`,
                        background: stage.key === "success"
                          ? "linear-gradient(to right, #22c55e, #86efac)"
                          : "linear-gradient(to right, #3b82f6, #22d3ee)",
                      }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{stage.label}</span>
                    <motion.span
                      initial={{ opacity: 0.6 }}
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.6, repeat: Infinity }}
                    >
                      {stage.percent}%
                    </motion.span>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Full-section success sweep + animated check when done */}
            <motion.div
              className="absolute inset-0 grid place-items-center pointer-events-none"
              initial={false}
              animate={{ opacity: stage.key === "success" ? 1 : 0 }}
              transition={{ duration: 0.4 }}
            >
              {/* Sweep background */}
              <motion.div
                className="absolute inset-0 z-[5]"
                initial={{ scale: 0.2, borderRadius: 24, backgroundColor: "rgba(16,185,129,0.12)" }}
                animate={{ scale: stage.key === "success" ? 1.4 : 0.2, backgroundColor: "rgba(16,185,129,0.14)" }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
              {/* Pulsing ring + check */}
              <motion.div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[10] flex items-center justify-center"
                initial={{ scale: 0.7 }}
                animate={{ scale: stage.key === "success" ? 1 : 0.7 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
              >
                <motion.div
                  className="absolute rounded-full border-2 border-emerald-400/50"
                  style={{ width: 110, height: 110 }}
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: [0.8, 1.1, 0.95], opacity: [0.6, 1, 0.8] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <IconCircleCheck className="relative h-16 w-16 text-emerald-500" />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}

export const SkeletonFour = () => {
  const [started, setStarted] = useState(false)
  const [counts, setCounts] = useState({ e: 0, v: 0, s: 0, p: 0 })
  const [finished, setFinished] = useState(false)
  const [cycle, setCycle] = useState(0)

  // Simple RAF-based count up with easing and stagger, loops by scheduling next cycle
  useEffect(() => {
    if (!started) return

    const targets = { e: 12, v: 8, s: 5, p: 95 }
    const duration = 1200 // ms per counter
    const stagger = 180 // ms

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

    const animKeys: (keyof typeof targets)[] = ["e", "v", "s", "p"]
    const rafIds: number[] = []

    setFinished(false)
    setCounts({ e: 0, v: 0, s: 0, p: 0 })

    animKeys.forEach((key, idx) => {
      const startTime = performance.now() + idx * stagger
      const loop = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - startTime) / duration))
        const eased = easeOutCubic(t)
        const val = Math.round(targets[key] * eased)
        setCounts((c) => ({ ...c, [key]: val }))
        if (t < 1) rafIds[idx] = requestAnimationFrame(loop)
      }
      rafIds[idx] = requestAnimationFrame(loop)
    })

    // Show success check near completion, then schedule next cycle
    const totalMs = duration + stagger * (animKeys.length - 1)
    const doneTimer = setTimeout(() => setFinished(true), totalMs)
    const cycleTimer = setTimeout(() => setCycle((c) => c + 1), totalMs + 2000)

    return () => {
      rafIds.forEach((id) => cancelAnimationFrame(id))
      clearTimeout(doneTimer)
      clearTimeout(cycleTimer)
    }
  }, [started, cycle])

  const container = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0, transition: { staggerChildren: 0.12 } },
  }
  const item = {
    hidden: { opacity: 0, y: 8 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <div className="h-60 md:h-60 flex flex-col items-center relative bg-transparent dark:bg-transparent mt-10">
      <motion.div
        className="bg-muted rounded-lg p-6 w-full h-full"
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        onViewportEnter={() => setStarted(true)}
      >
        <motion.div className="flex items-center gap-2 mb-4" variants={item}>
          <IconShield className="h-5 w-5 text-green-500" />
          <span className="text-sm font-medium">Test Results</span>
        </motion.div>
        <div className="space-y-3">
          <motion.div className="flex items-center gap-3" variants={item}>
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.6 }}
            />
            <span className="text-xs">API Endpoints: {counts.e}/12 passed</span>
          </motion.div>
          <motion.div className="flex items-center gap-3" variants={item}>
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: 0.1 }}
            />
            <span className="text-xs">Validation Tests: {counts.v}/8 passed</span>
          </motion.div>
          <motion.div className="flex items-center gap-3" variants={item}>
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.25, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, delay: 0.2 }}
            />
            <span className="text-xs">Security Checks: {counts.s}/5 passed</span>
          </motion.div>
          <motion.div className="flex items-center gap-3" variants={item}>
            <motion.div
              className="w-2 h-2 rounded-full bg-yellow-500"
              animate={{ scale: [1, 1.2, 1], boxShadow: ["0 0 0 0 rgba(250,204,21,0.0)", "0 0 0 6px rgba(250,204,21,0.15)", "0 0 0 0 rgba(250,204,21,0.0)"] }}
              transition={{ repeat: Infinity, duration: 2.0 }}
            />
            <span className="text-xs">Performance: {counts.p}% score</span>
          </motion.div>
        </div>

        {/* Success check overlay */}
        <motion.div
          className="absolute inset-0 pointer-events-none grid place-items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: finished ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        >
          <motion.div
            className="relative"
            initial={{ scale: 0.7 }}
            animate={{ scale: finished ? 1 : 0.7 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <motion.div
              className="absolute -inset-6 rounded-full"
              style={{ boxShadow: "0 0 0 0 rgba(16,185,129,0.0)" }}
              animate={{ boxShadow: finished ? ["0 0 0 0 rgba(16,185,129,0.0)", "0 0 0 16px rgba(16,185,129,0.15)", "0 0 0 0 rgba(16,185,129,0.0)"] : "0 0 0 0 rgba(16,185,129,0.0)" }}
              transition={{ duration: 1.6 }}
            />
            <IconCircleCheck className="h-10 w-10 text-emerald-500" />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  )
}

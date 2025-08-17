header.tsx:
"use client"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Menu, ChevronDown, Sun, Moon, Laptop, Code2, Cpu, NotebookText, Rocket } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import React from "react"
import { AnimatePresence, motion } from "framer-motion"

const menuItems = [
  { name: "Model Platform", key: "features" },
  { name: "Solutions", key: "solutions" },
  { name: "Developers", key: "resources" },
  { name: "Pricing", key: "pricing" },
]

const panels: Record<string, { title: string; items: { icon: React.ReactNode; title: string; desc: string; href: string }[] }[]> = {
  features: [
    {
      title: "Products",
      items: [
        { icon: <Cpu className="size-4 text-primary" />, title: "Serverless Inference", desc: "Deploy AI at scale.", href: "#" },
        { icon: <Rocket className="size-4 text-primary" />, title: "Dedicated Endpoints", desc: "Custom hardware.", href: "#" },
        { icon: <Code2 className="size-4 text-primary" />, title: "Fine‑Tuning", desc: "Improve model quality.", href: "#" },
      ],
    },
    {
      title: "Tools",
      items: [
        { icon: <NotebookText className="size-4 text-primary" />, title: "Docs", desc: "API & guides.", href: "#" },
        { icon: <Code2 className="size-4 text-primary" />, title: "Sandbox", desc: "Experiment quickly.", href: "#" },
      ],
    },
  ],
  solutions: [
    {
      title: "By use case",
      items: [
        { icon: <Code2 className="size-4 text-primary" />, title: "Backend APIs", desc: "REST & GraphQL.", href: "#" },
        { icon: <Cpu className="size-4 text-primary" />, title: "Microservices", desc: "Compose services.", href: "#" },
      ],
    },
    {
      title: "For teams",
      items: [
        { icon: <NotebookText className="size-4 text-primary" />, title: "Documentation", desc: "Auto‑generated.", href: "#" },
        { icon: <Rocket className="size-4 text-primary" />, title: "Deployment", desc: "Ship faster.", href: "#" },
      ],
    },
  ],
  resources: [
    {
      title: "Developers",
      items: [
        { icon: <NotebookText className="size-4 text-primary" />, title: "Guides", desc: "Step‑by‑step.", href: "#" },
        { icon: <Code2 className="size-4 text-primary" />, title: "Examples", desc: "Copy & adapt.", href: "#" },
      ],
    },
  ],
  pricing: [
    {
      title: "Plans",
      items: [
        { icon: <Rocket className="size-4 text-primary" />, title: "Starter", desc: "Free forever.", href: "#pricing" },
        { icon: <Rocket className="size-4 text-primary" />, title: "Pro", desc: "For teams.", href: "#pricing" },
        { icon: <Rocket className="size-4 text-primary" />, title: "Comparator", desc: "Compare plans.", href: "/pricing-comparator" },
      ],
    },
  ],
}

export const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false)
  const [openKey, setOpenKey] = React.useState<string | null>(null)
  const [panelStyle, setPanelStyle] = React.useState<{ left: number; width: number } | null>(null)
  const navRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRefs = React.useRef<Record<string, HTMLAnchorElement | null>>({})

  const openPanel = (key: string) => {
    setOpenKey(key)
    requestAnimationFrame(() => {
      const nav = navRef.current
      const trigger = triggerRefs.current[key]
      if (!nav || !trigger) return
      const navRect = nav.getBoundingClientRect()
      const tRect = trigger.getBoundingClientRect()
      const width = Math.min(920, Math.max(560, tRect.width * 2.8))
      const center = tRect.left + tRect.width / 2
      let left = center - width / 2 - navRect.left
      left = Math.max(12, Math.min(left, navRect.width - width - 12))
      setPanelStyle({ left, width })
    })
  }

  const closePanel = () => setOpenKey(null)

  return (
    <header className="w-full sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <nav className="mx-auto max-w-7xl px-6" ref={navRef} onMouseLeave={() => setTimeout(closePanel, 120)}>
        <div className="relative flex items-center justify-between py-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>

          <div className="hidden lg:flex items-center space-x-8">
            {menuItems.map((item) => (
              <Link
                key={item.key}
                href="#"
                ref={(el) => {
                  triggerRefs.current[item.key] = el
                }}
                onMouseEnter={() => openPanel(item.key)}
                className="group flex items-center text-muted-foreground hover:text-foreground text-sm font-medium"
              >
                {item.name}
                <ChevronDown className="ml-1 h-4 w-4 transition-transform duration-200 group-aria-expanded:rotate-180" />
              </Link>
            ))}
          </div>

          <div className="hidden lg:flex items-center space-x-3">
            <ThemeSwitch
              modes={["light", "dark", "system"]}
              icons={[
                <Sun key="sun-icon" size={16} />,
                <Moon key="moon-icon" size={16} />,
                <Laptop key="laptop-icon" size={16} />,
              ]}
              showInactiveIcons="all"
              variant="icon-click"
            />
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
              <Link href="/login">Log In</Link>
            </Button>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg px-4">
              <Link href="/signup">Create</Link>
            </Button>
          </div>

          {/* Mobile menu button */}
          <button onClick={() => setMenuState(!menuState)} className="lg:hidden p-2">
            <Menu className="h-6 w-6" />
          </button>
        
          {/* Mega Panel */}
          <AnimatePresence>
            {openKey && panelStyle && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.6 }}
                className="absolute left-0 right-0 top-full z-50"
                onMouseEnter={() => openKey && openPanel(openKey)}
                onMouseLeave={() => setTimeout(closePanel, 120)}
              >
                <div
                  style={{ left: panelStyle.left, width: panelStyle.width }}
                  className="relative mx-0 rounded-b-xl rounded-t-none border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                    {panels[openKey]?.map((col, idx) => (
                      <div key={idx} className="space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground">{col.title}</p>
                        <ul className="space-y-2">
                          {col.items.map((it, j) => (
                            <li key={j}>
                              <Link href={it.href} className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground transition-colors">
                                <span className="mt-0.5">{it.icon}</span>
                                <span>
                                  <span className="block text-sm font-medium">{it.title}</span>
                                  <span className="block text-xs text-muted-foreground">{it.desc}</span>
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Mobile Menu Panel */}
          <AnimatePresence>
            {menuState && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
                className="absolute left-0 right-0 top-full z-50 lg:hidden"
              >
                <div className="mx-0 border-b border-border bg-popover text-popover-foreground shadow-xl">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Theme</span>
                    <ThemeSwitch
                      modes={["light", "dark", "system"]}
                      icons={[<Sun key="sun-icon-m" size={16} />, <Moon key="moon-icon-m" size={16} />, <Laptop key="laptop-icon-m" size={16} />]}
                      showInactiveIcons="all"
                      variant="icon-click"
                    />
                  </div>
                  <div className="px-2 py-2">
                    {menuItems.map((item) => (
                      <Link
                        key={`m-${item.key}`}
                        href={item.key === "pricing" ? "#pricing" : "#"}
                        onClick={() => setMenuState(false)}
                        className="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent"
                      >
                        {item.name}
                      </Link>
                    ))}
                    <div className="mt-2 flex gap-2 px-1 pb-2">
                      <Button asChild variant="ghost" className="flex-1">
                        <Link href="/login" onClick={() => setMenuState(false)}>Log In</Link>
                      </Button>
                      <Button asChild className="flex-1">
                        <Link href="/signup" onClick={() => setMenuState(false)}>Create</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </nav>
    </header>
  )
}


app/page.tsx:
import { HeroHeader } from "@/components/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import FeaturesSection from "@/components/features-section"
import IntegrationsSection from "@/components/integrations-section"
import ContentSection from "@/components/content-section"
import PricingSection from "@/components/pricing-section"
import FAQSection from "@/components/faq-section"
import Footer from "@/components/footer"
import NewsletterCTA from "@/components/newsletter-cta"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-x-clip">
      <HeroHeader />

      <main className="pt-4">
        <section className="relative border-b border-border/50 px-3 sm:px-0">
          {/* Background grid with vertical borders */}
          <div className="absolute inset-0 z-0 hero-grid hidden sm:grid">
            <div></div>
            <div className="border-x border-border/50"></div>
            <div></div>
          </div>

          {/* Gradient Background Effects */}
          <figure className="hero-gradient-main" />
          <figure className="hero-gradient-left" />
          <figure className="hero-gradient-right" />

          {/* Content layer with proper z-index */}
          <div className="relative z-10 min-h-[80svh] sm:grid sm:[grid-template-columns:clamp(80px,10vw,120px)_minmax(0,1fr)_clamp(80px,10vw,120px)]">
            <div className="hidden sm:block" />
            <div className="mx-auto w-full max-w-5xl px-3 sm:px-4 flex flex-col items-center divide-y divide-border/50 h-full">
              {/* Trust signal section */}
              <div className="flex w-full flex-col md:flex-row items-center justify-center gap-2 text-center md:text-left text-xs sm:text-sm text-muted-foreground py-1 mt-2 sm:mt-3 mb-3 sm:mb-4 md:mb-6">
                <div className="flex -space-x-1 mb-1 md:mb-0">
                  <div className="h-6 w-6 rounded-full bg-blue-500 border-2 border-background"></div>
                  <div className="h-6 w-6 rounded-full bg-green-500 border-2 border-background"></div>
                  <div className="h-6 w-6 rounded-full bg-purple-500 border-2 border-background"></div>
                </div>
                <span className="block">Trusted by developers and non-developers alike</span>
              </div>

              {/* Main content area */}
              <div className="flex flex-col items-center justify-center py-4 sm:py-6 md:py-8 text-center space-y-4 sm:space-y-6 flex-1 w-full">
                {/* Hero headline with responsive clamp and single semantic H1 */}
                <div className="max-w-5xl mx-auto px-2 sm:px-4 md:px-6 text-center">
                  <h1 className="hero-text mx-auto max-w-[20ch] sm:max-w-[24ch] md:max-w-none text-foreground leading-tight tracking-tight text-balance mb-1 sm:mb-2">
                    <span className="md:whitespace-nowrap">Instantly Build and Deploy Secure</span>
                    <br className="hidden md:block" />
                    <span className="md:hidden"> </span>
                    <span className="md:whitespace-nowrap">APIs From a Simple Prompt</span>
                  </h1>
                </div>

                {/* AI Input Box */}
                <div className="w-full max-w-2xl mx-auto px-0">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                    <Input
                      className="flex-1 rounded-lg border border-border bg-background px-3 sm:px-4 py-3 sm:py-4 h-11 sm:h-12 input-text input-placeholder focus:ring-2 focus:ring-ring focus:border-transparent text-sm sm:text-base"
                      placeholder="Describe your API: e.g. 'CRUD for a product catalog'"
                    />
                    <Button
                      variant="default"
                      className="rounded-lg px-4 sm:px-6 h-11 sm:h-12 sm:w-auto w-full text-sm sm:text-base"
                    >
                      Generate API
                    </Button>
                  </div>
                </div>

                {/* Supporting text with precise line breaks */}
                <div className="max-w-3xl mx-auto space-y-1 mt-1 px-2 sm:px-0">
                  <p className="text-muted-foreground text-sm sm:text-base md:text-lg text-balance">
                    Go from user story to production-ready, documented API in seconds. No setup, no coding,
                  </p>
                  <p className="text-muted-foreground text-sm sm:text-base md:text-lg text-balance">no hassle.</p>
                </div>

                {/* CTA Buttons with sophisticated styling */}
                <div className="hero-button-container">
                  <div className="hero-button-wrapper">
                    <div className="flex w-full flex-col gap-3">
                      <Button className="hero-primary-button">Get Started Free</Button>
                      <Button className="hero-secondary-button">View Demo</Button>
                    </div>

                    {/* Footer text */}
                    <p className="text-xs sm:text-sm text-center text-muted-foreground mt-2 sm:mt-3 mb-1 sm:mb-2 px-2">
                      No signup required to try - Always free for students and hobbyists
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="hidden sm:block" />
          </div>

          <FeaturesSection />
        </section>

        <IntegrationsSection />

        <ContentSection />

        <PricingSection />
        <FAQSection />
        <NewsletterCTA />
        <Footer />
      </main>
    </div>
  )
}

global.css:
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

:root {
  /* Updated to use #FAFAFA background and clean minimal colors */
  --background: #fafafa;
  --foreground: rgb(9, 9, 11);
  --card: #ffffff;
  --card-foreground: rgb(9, 9, 11);
  --popover: #ffffff;
  --popover-foreground: rgb(9, 9, 11);
  --primary: #3b82f6; /* Blue for primary elements */
  --primary-foreground: #ffffff;
  --secondary: #6b7280;
  --secondary-foreground: #ffffff;
  --muted: #f3f4f6;
  --muted-foreground: #6b7280;
  --accent: #8b5cf6; /* Purple for accent */
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --destructive-foreground: #ffffff;
  --border: #e5e7eb;
  --input: #ffffff;
  --ring: #3b82f6;
  --chart-1: #3b82f6;
  --chart-2: #8b5cf6;
  --chart-3: #ef4444;
  --chart-4: #f59e0b;
  --chart-5: #10b981;
  --radius: 0.5rem;
  --sidebar: #ffffff;
  --sidebar-foreground: rgb(9, 9, 11);
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #8b5cf6;
  --sidebar-accent-foreground: #ffffff;
  --sidebar-border: #e5e7eb;
  --sidebar-ring: #3b82f6;
}

/* Consistent typography scale across sections */
@layer base {
  h1 {
    @apply text-3xl md:text-5xl lg:text-6xl font-semibold leading-tight text-foreground;
  }
  h2 {
    @apply text-2xl md:text-4xl lg:text-5xl font-semibold leading-snug text-foreground;
  }
  h3 {
    @apply text-xl md:text-2xl lg:text-3xl font-semibold leading-snug text-foreground;
  }
  p {
    @apply text-base md:text-lg text-muted-foreground;
  }
}

.dark {
  /* Base surfaces aligned to zinc scale */
  --background: #09090B; /* zinc-950 */
  --foreground: #FAFAFA; /* zinc-50 */
  --card: #18181B; /* zinc-900 */
  --card-foreground: #FAFAFA;
  --popover: #18181B;
  --popover-foreground: #FAFAFA;
  --primary: #3b82f6; /* brand primary */
  --primary-foreground: #ffffff; /* readable on primary */
  --secondary: #27272A; /* zinc-800 */
  --secondary-foreground: #FAFAFA;
  --muted: #18181B;
  --muted-foreground: #A1A1AA; /* zinc-400 */
  --accent: #8b5cf6; /* accent color */
  --accent-foreground: #ffffff;
  --destructive: #ef4444;
  --destructive-foreground: #FAFAFA;
  --border: #27272A; /* zinc-800 */
  --input: #27272A;
  --ring: #3b82f6;
  --chart-1: #3b82f6;
  --chart-2: #8b5cf6;
  --chart-3: #ef4444;
  --chart-4: #f59e0b;
  --chart-5: #10b981;
  --radius: 0.5rem;
  /* Sidebar */
  --sidebar: #18181B;
  --sidebar-foreground: #FAFAFA;
  --sidebar-primary: #3b82f6;
  --sidebar-primary-foreground: #ffffff;
  --sidebar-accent: #27272A;
  --sidebar-accent-foreground: #FAFAFA;
  --sidebar-border: #27272A;
  --sidebar-ring: #3b82f6;
}

@theme inline {
  --font-sans: var(--font-geist);
  --font-mono: ui-monospace, SFMono-Regular, "SF Mono", Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
    transition: background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  body {
    @apply bg-background text-foreground font-sans;
    overflow-x: hidden; /* Prevent horizontal scroll due to wide effects or tables */
  }
}

/* Updated hero text styling with better responsive scaling for laptop viewports */
.hero-text {
  font-family: "Geist", sans-serif;
  font-weight: 500;
  font-style: normal;
  font-size: clamp(28px, 5vw, 64px);
  line-height: clamp(34px, 5.5vw, 64px);
  color: var(--foreground);
}

/* Specific breakpoint adjustments for better laptop display */
@media (min-width: 768px) and (max-width: 1024px) {
  .hero-text {
    font-size: clamp(36px, 4.5vw, 48px);
    line-height: clamp(42px, 5vw, 52px);
  }
}

@media (min-width: 1025px) and (max-width: 1280px) {
  .hero-text {
    font-size: clamp(48px, 4vw, 56px);
    line-height: clamp(52px, 4.5vw, 60px);
  }
}

/* Added button text styling for Get Started and View Demo buttons */
.button-text {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 16px;
  line-height: 26px;
  color: rgb(250, 250, 250);
}

/* Added button text styling for Get Started and View Demo buttons */
.button-text-dark {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 16px;
  line-height: 26px;
  color: rgb(9, 9, 11);
}

/* Added Generate API button text styling */
.generate-button-text {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 16px;
  line-height: 24px;
  color: rgb(250, 250, 250);
}

/* Added input text styling */
.input-text {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 16px;
  line-height: 24px;
  color: var(--foreground);
}

/* Added input placeholder text styling */
.input-placeholder::placeholder {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 16px;
  line-height: 24px;
  color: var(--muted-foreground);
}

/* Footer brand section - light glassmorphism */
.footer-brand-section {
  background: transparent;
  position: relative;
  padding: 40px 0;
}

/* Light glassmorphism card */
.brand-glass-light-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 20px;
  padding: 48px 32px;
  text-align: center;
  position: relative;
  box-shadow: 
    0 8px 32px rgba(0, 0, 0, 0.04),
    0 1px 2px rgba(0, 0, 0, 0.02),
    inset 0 1px 0 rgba(255, 255, 255, 0.4);
  max-width: 700px;
  margin: 0 auto;
}

.brand-glass-light-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, transparent 50%);
  border-radius: 20px;
  pointer-events: none;
}

/* Dark glassmorphism card variant */
.dark .brand-glass-light-card {
  background: rgba(15, 23, 42, 0.35);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.2),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
}

.dark .brand-glass-light-card::before {
  background: linear-gradient(135deg, rgba(148, 163, 184, 0.06) 0%, transparent 50%);
}

/* Footer brand name styling - light theme integration */
.footer-brand-name {
  font-family: "Geist", sans-serif;
  font-weight: 600;
  font-style: normal;
  font-size: clamp(48px, 8vw, 96px);
  line-height: clamp(52px, 8.5vw, 100px);
  color: var(--foreground);
  letter-spacing: -0.02em;
  margin-bottom: 24px;
}

/* Footer brand tagline styling - light theme integration */
.footer-brand-tagline {
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-style: normal;
  font-size: 20px;
  line-height: 28px;
  color: var(--muted-foreground);
  margin: 0;
  max-width: 500px;
  margin-left: auto;
  margin-right: auto;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .brand-glass-light-card {
    padding: 32px 24px;
    border-radius: 16px;
    margin: 0 16px;
  }
  
  .footer-brand-tagline {
    font-size: 18px;
    line-height: 26px;
  }
}

/* Added hero grid system with responsive clamp values and smooth transitions */
.hero-grid {
  display: grid;
  grid-template-columns: clamp(28px, 10vw, 120px) auto clamp(28px, 10vw, 120px);
}

/* Responsive grid adjustments */
@media (max-width: 640px) {
  .hero-grid {
    grid-template-columns: clamp(16px, 5vw, 28px) auto clamp(16px, 5vw, 28px);
  }
}

@media (min-width: 641px) and (max-width: 1024px) {
  .hero-grid {
    grid-template-columns: clamp(28px, 8vw, 80px) auto clamp(28px, 8vw, 80px);
  }
}

@media (min-width: 1025px) {
  .hero-grid {
    grid-template-columns: clamp(80px, 10vw, 120px) auto clamp(80px, 10vw, 120px);
  }
}

/* Added sophisticated button styling system with responsive containers and gradient effects */

/* Hero Button Container - Responsive width with center alignment */
.hero-button-container {
  @apply flex items-center justify-center px-4;
}

@media (min-width: 640px) {
  .hero-button-container {
    @apply px-12;
  }
}

/* Hero Button Wrapper - Responsive max width */
.hero-button-wrapper {
  @apply flex w-full flex-col items-center justify-start;
  max-width: 90vw;
}

@media (min-width: 640px) {
  .hero-button-wrapper {
    max-width: 320px;
  }
}

@media (min-width: 768px) {
  .hero-button-wrapper {
    max-width: 392px;
  }
}

/* Primary Button - "Get Started Free" - Responsive sizing */
.hero-primary-button {
  @apply h-12 sm:h-14 flex w-full flex-col items-center justify-center rounded-lg text-sm sm:text-base bg-primary text-primary-foreground hover:bg-primary/90 transition-colors duration-150;
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-size: clamp(14px, 2.5vw, 16px);
  line-height: clamp(20px, 3vw, 26px);
  /* Light mode explicit color: Emerald */
  background-color: #10b981; /* emerald-500 */
  color: #ffffff;
  padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
}

/* Light mode hover */
.hero-primary-button:hover {
  background-color: #059669; /* emerald-600 */
}

/* Dark mode primary button colors */
.dark .hero-primary-button {
  background-color: #22c55e; /* green-500 */
  color: #ffffff;
}

.dark .hero-primary-button:hover {
  background-color: #16a34a; /* green-600 */
}

/* Secondary Button - "View Demo" - Responsive sizing */
.hero-secondary-button {
  @apply h-12 sm:h-14 flex w-full flex-col items-center justify-center rounded-lg text-sm sm:text-base border border-border bg-transparent backdrop-blur-xl transition-colors duration-150 hover:bg-black/5;
  border-color: hsl(214.3 31.8% 91.4%);
  font-family: "Geist", sans-serif;
  font-weight: 400;
  font-size: clamp(14px, 2.5vw, 16px);
  line-height: clamp(20px, 3vw, 26px);
  color: var(--foreground);
  padding: clamp(8px, 2vw, 12px) clamp(16px, 4vw, 24px);
}

.dark .hero-secondary-button {
  border-color: hsl(217.2 32.6% 17.5%);
  @apply dark:hover:bg-white/5;
}

/* Mobile-specific button adjustments */
@media (max-width: 640px) {
  .hero-primary-button,
  .hero-secondary-button {
    @apply h-11;
    font-size: 14px;
    line-height: 20px;
    padding: 10px 16px;
  }
  
  .hero-button-container {
    @apply px-2;
  }
}

/* Gradient Background Effects */
.hero-gradient-main {
  @apply pointer-events-none absolute z-0 block aspect-square rounded-full blur-[200px];
  bottom: -70%;
  left: 50%;
  width: 520px;
  transform: translateX(-50%);
  background-color: hsla(221.2, 83.2%, 53.3%, 0.4);
}

.hero-gradient-left {
  @apply pointer-events-none absolute z-20 hidden aspect-square rounded-full opacity-50 blur-[100px];
  left: 4vw;
  top: 64px;
  width: 32vw;
  background-color: hsl(0 0% 100%);
}

.hero-gradient-right {
  @apply pointer-events-none absolute z-20 hidden aspect-square rounded-full opacity-50 blur-[100px];
  bottom: -50px;
  right: 7vw;
  width: 30vw;
  background-color: hsl(0 0% 100%);
}

.dark .hero-gradient-left,
.dark .hero-gradient-right {
  background-color: var(--background);
}

@media (min-width: 768px) {
  .hero-gradient-left,
  .hero-gradient-right {
    @apply block;
  }
}

styles/global.css:
@import 'tailwindcss';
@import 'tw-animate-css';

@custom-variant dark (&:is(.dark *));

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --radius: 0.625rem;
  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-primary: oklch(0.205 0 0);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.97 0 0);
  --sidebar-accent-foreground: oklch(0.205 0 0);
  --sidebar-border: oklch(0.922 0 0);
  --sidebar-ring: oklch(0.708 0 0);
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --card: oklch(0.145 0 0);
  --card-foreground: oklch(0.985 0 0);
  --popover: oklch(0.145 0 0);
  --popover-foreground: oklch(0.985 0 0);
  --primary: oklch(0.985 0 0);
  --primary-foreground: oklch(0.205 0 0);
  --secondary: oklch(0.269 0 0);
  --secondary-foreground: oklch(0.985 0 0);
  --muted: oklch(0.269 0 0);
  --muted-foreground: oklch(0.708 0 0);
  --accent: oklch(0.269 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --destructive: oklch(0.396 0.141 25.723);
  --destructive-foreground: oklch(0.637 0.237 25.331);
  --border: oklch(0.269 0 0);
  --input: oklch(0.269 0 0);
  --ring: oklch(0.439 0 0);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.205 0 0);
  --sidebar-foreground: oklch(0.985 0 0);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.985 0 0);
  --sidebar-accent: oklch(0.269 0 0);
  --sidebar-accent-foreground: oklch(0.985 0 0);
  --sidebar-border: oklch(0.269 0 0);
  --sidebar-ring: oklch(0.439 0 0);
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}
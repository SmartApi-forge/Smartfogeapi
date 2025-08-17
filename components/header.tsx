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

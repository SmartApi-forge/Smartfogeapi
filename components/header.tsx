"use client"

import Link from "next/link"
import { Menu, Sun, Moon, Laptop, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { ThemeSwitch } from "@/components/ui/theme-switch"
import React from "react"
import { AnimatePresence, motion } from "@/components/motion-wrapper"
import { authService } from "@/lib/auth"

export const HeroHeader = () => {
  const [menuState, setMenuState] = React.useState(false)
  const [isLoggedIn, setIsLoggedIn] = React.useState(false)

  React.useEffect(() => {
    const checkAuth = async () => {
      const { session } = await authService.getCurrentSession()
      setIsLoggedIn(!!session?.user)
    }
    checkAuth()
  }, [])

  return (
    <header className="w-full sticky top-0 z-50 bg-background border-b border-border/20">
      <nav className="relative z-10 mx-auto max-w-7xl px-6">
        <div className="relative flex items-center justify-between py-3 sm:py-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>

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
              <Link href={isLoggedIn ? "/ask" : "/login"}>
                {isLoggedIn ? "Generate" : "Log In"}
              </Link>
            </Button>
          </div>

          <button onClick={() => setMenuState(!menuState)} className="lg:hidden p-2">
            <Menu className="h-6 w-6" />
          </button>

          <AnimatePresence>
            {menuState && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ type: "spring", stiffness: 360, damping: 30 }}
                className="fixed inset-0 z-[9999] lg:hidden bg-background"
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-border/20">
                  <Logo />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMenuState(false)}
                    className="h-10 w-10 rounded-full hover:bg-accent"
                  >
                    <X size={20} />
                  </Button>
                </div>

                <div className="flex flex-col h-full px-6 pb-6">
                  <div className="flex items-center justify-between py-4 border-b border-border/50">
                    <span className="text-lg font-medium text-foreground">Theme</span>
                    <ThemeSwitch
                      modes={["light", "dark", "system"]}
                      icons={[
                        <Sun key="sun-icon-m" size={16} />,
                        <Moon key="moon-icon-m" size={16} />,
                        <Laptop key="laptop-icon-m" size={16} />,
                      ]}
                      showInactiveIcons="all"
                      variant="circle-blur"
                      start="bottom-left"
                      animationVariant="circle-blur"
                    />
                  </div>

                  <div className="space-y-3 mt-8">
                    <Button asChild variant="outline" size="lg" className="w-full justify-center text-base h-12 border-border">
                      <Link href={isLoggedIn ? "/ask" : "/?auth=login"} onClick={() => setMenuState(false)}>
                        {isLoggedIn ? "Generate" : "Log In"}
                      </Link>
                    </Button>
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

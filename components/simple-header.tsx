"use client"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Share, GitBranch, Settings } from "lucide-react"

export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-background/95 dark:bg-[#0E100F] backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between px-6">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>
        </div>

        {/* Right side - Action buttons */}
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <GitBranch className="h-4 w-4 mr-2" />
            Share
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Share className="h-4 w-4 mr-2" />
            Upgrade
          </Button>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            Publish
          </Button>
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  )
}
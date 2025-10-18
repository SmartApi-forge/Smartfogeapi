"use client";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Share, GitBranch, Settings } from "lucide-react";

export function SimpleHeader() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#0E100F] backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-[#0E100F]/60 border-b border-border/50">
      <div className="container flex h-12 sm:h-14 md:h-16 items-center justify-between px-3 sm:px-4 md:px-6">
        {/* Left side - Logo */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <Logo />
          </Link>
        </div>

        {/* Right side - Action buttons - Responsive with subtle hover */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          {/* Share button - Icon only on mobile, text on larger screens */}
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#262726] transition-colors h-8 sm:h-9 px-2 sm:px-3"
          >
            <GitBranch className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Share</span>
          </Button>

          {/* Upgrade button - Hidden on mobile, visible on tablet+ */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden md:inline-flex text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#262726] transition-colors h-8 sm:h-9 px-2 sm:px-3"
          >
            <Share className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">Upgrade</span>
          </Button>

          {/* Publish button - Hidden on small mobile, visible on larger */}
          <Button
            variant="ghost"
            size="sm"
            className="hidden sm:inline-flex text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#262726] transition-colors h-8 sm:h-9 px-2 sm:px-3"
          >
            Publish
          </Button>

          {/* Settings button - Always visible, icon only */}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-[#262726] transition-colors h-8 w-8 sm:h-9 sm:w-9"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}

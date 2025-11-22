"use client"

import { cn } from "@/lib/utils"

interface HamburgerMenuProps {
  onClick: () => void
  className?: string
}

export function HamburgerMenu({ onClick, className }: HamburgerMenuProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative p-2 rounded-md transition-all duration-200 ease-in-out",
        "hover:bg-white/10 hover:scale-105",
        "focus:outline-none focus:ring-2 focus:ring-white/20",
        "active:scale-95",
        className
      )}
      aria-label="Open menu"
    >
      <div className="flex flex-col justify-center items-center w-6 h-6 space-y-1">
        {/* Top line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-200 ease-in-out",
          "group-hover:bg-white/90 group-hover:w-7"
        )} />
        {/* Middle line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-200 ease-in-out",
          "group-hover:bg-white/90 group-hover:w-5"
        )} />
        {/* Bottom line */}
        <div className={cn(
          "w-6 h-0.5 bg-white rounded-full transition-all duration-200 ease-in-out",
          "group-hover:bg-white/90 group-hover:w-7"
        )} />
      </div>
    </button>
  )
}